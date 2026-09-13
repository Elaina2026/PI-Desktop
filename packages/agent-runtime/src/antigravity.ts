import fs from "node:fs";
import path from "node:path";
/**
 * Native Antigravity stream adapter for Google Cloud Code Assist.
 *
 * Antigravity exposes models (Gemini 3, Claude 4.6, etc.) through the Google Cloud
 * Code Assist PredictionService (`/v1internal:streamGenerateContent?alt=sse`).
 * Requests require an envelope ({ project, model, request: { contents, ... } })
 * and stream SSE chunks wrapped in { response: { candidates, ... } }.
 */

import {
  calculateCost,
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type Context,
  type Model,
  type ProviderStreams,
  type SimpleStreamOptions,
  type TextContent,
  type ThinkingContent,
  type Tool,
  type ToolCall,
} from "@earendil-works/pi-ai";
import {
  convertMessages,
  convertTools,
  isThinkingPart,
  mapStopReasonString,
  retainThoughtSignature,
  supportsGoogleStrictToolSampling,
} from "@earendil-works/pi-ai/api/google-shared";

/**
 * Recursively convert JSON Schema `const` into OpenAPI 3.0 `enum: [val]`.
 * Google Cloud Code Assist's protobuf schema for OpenAPI `parameters` has no `const` field.
 */
const UNSUPPORTED_KEYWORDS = new Set(["$schema","$defs","definitions","$comment","$ref","const","title","default","examples","minLength","maxLength","exclusiveMinimum","exclusiveMaximum","minItems","maxItems","multipleOf","uniqueItems","additionalProperties","propertyNames","patternProperties"]);

function sanitizeOpenApiSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeOpenApiSchema);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const obj = { ...(value as Record<string, unknown>) };

  // Collapse anyOf / oneOf where every branch is a literal (e.g. TypeBox Union of Literals)
  // into a single canonical enum: ["a", "b"]. Anthropic Vertex rejects anyOf of single-enum branches.
  for (const unionKey of ["anyOf", "oneOf"]) {
    const unionList = obj[unionKey];
    if (Array.isArray(unionList) && unionList.length > 0) {
      const allLiterals = unionList.every(
        (branch) =>
          typeof branch === "object" &&
          branch !== null &&
          ("const" in branch || (Array.isArray(branch.enum) && branch.enum.length > 0)),
      );
      if (allLiterals) {
        const values: unknown[] = [];
        let commonType: unknown = undefined;
        for (const branch of unionList) {
          if ("const" in branch) {
            values.push(branch.const);
            commonType = commonType || branch.type || typeof branch.const;
          } else if (Array.isArray(branch.enum)) {
            values.push(...branch.enum);
            commonType = commonType || branch.type || (branch.enum.length > 0 ? typeof branch.enum[0] : undefined);
          }
        }
        delete obj[unionKey];
        if (commonType) obj.type = commonType;
        obj.enum = [...new Set(values)];
      }
    }
  }

  if ("const" in obj) {
    const val = obj.const;
    delete obj.const;
    if (!("enum" in obj)) {
      obj.enum = [val];
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (UNSUPPORTED_KEYWORDS.has(k) || k.startsWith("x-")) { delete obj[k]; } else { obj[k] = sanitizeOpenApiSchema(v); }
  }
  return obj;
}

function buildAntigravityTools(
  tools: Tool[],
  modelId: string,
): { functionDeclarations: Record<string, unknown>[] }[] | undefined {
  const isClaude = modelId.toLowerCase().startsWith("claude-");
  const raw = convertTools(
    tools,
    isClaude,
    supportsGoogleStrictToolSampling(modelId),
  );
  if (!raw) return raw;

  return raw.map((group) => ({
    ...group,
    functionDeclarations: group.functionDeclarations.map((decl) => {
      if (decl.parameters) {
        return {
          ...decl,
          parameters: sanitizeOpenApiSchema(decl.parameters) as Record<string, unknown>,
        };
      }
      return decl;
    }),
  }));
}



function lookupAntigravityProjectId(email?: string): string {
  try {
    const appData = process.env.APPDATA;
    if (!appData) return "";
    const dbPath = path.join(appData, "9router", "db", "data.sqlite");
    if (!fs.existsSync(dbPath)) return "";
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    if (email) {
      const row = db.prepare("SELECT data FROM providerConnections WHERE provider='antigravity' AND email=? LIMIT 1").get(email) as { data?: string } | undefined;
      if (row?.data) {
        const parsed = JSON.parse(row.data);
        if (typeof parsed.projectId === "string" && parsed.projectId.trim()) {
          return parsed.projectId.trim();
        }
      }
      return "";
    }
    const active = db.prepare("SELECT data FROM providerConnections WHERE provider='antigravity' AND isActive=1 LIMIT 1").get() as { data?: string } | undefined;
    if (active?.data) {
      const parsed = JSON.parse(active.data);
      if (typeof parsed.projectId === "string" && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch (_) {}
  return "";
}


export type AntigravityAccountCandidate = {
  email: string;
  accessToken: string;
  projectId: string;
};

export type AccountModelLock = {
  lockedUntil: number; // Unix timestamp in ms
  reason: string;
  modelGroup: string; // 'gemini' | '3p' | string
};

const LOCKS_FILE = path.join(
  process.env.USERPROFILE || process.env.HOME || ".",
  ".pi-desktop",
  "antigravity-model-locks.json"
);

export function getAntigravityModelGroup(modelId: string): string {
  const m = modelId.toLowerCase();
  if (m.startsWith("claude-") || m.startsWith("gpt-")) {
    return "3p";
  }
  return "gemini";
}

export function readAntigravityLocks(): Record<string, AccountModelLock> {
  try {
    if (fs.existsSync(LOCKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOCKS_FILE, "utf8"));
      return typeof data === "object" && data !== null ? data : {};
    }
  } catch (_) {}
  return {};
}

export function writeAntigravityLock(
  email: string,
  modelId: string,
  durationSeconds: number,
  reason: string = "quota_exhausted"
): void {
  try {
    const locks = readAntigravityLocks();
    const group = getAntigravityModelGroup(modelId);
    const key = `${email.toLowerCase()}:${group}`;
    const lockedUntil = Date.now() + Math.max(60, durationSeconds) * 1000;
    locks[key] = {
      lockedUntil,
      reason,
      modelGroup: group,
    };
    const dir = path.dirname(LOCKS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks, null, 2), "utf8");
  } catch (_) {}
}

export function isAntigravityAccountLocked(email: string, modelId: string): { locked: boolean; remainingSeconds: number } {
  const locks = readAntigravityLocks();
  const group = getAntigravityModelGroup(modelId);
  const key = `${email.toLowerCase()}:${group}`;
  const entry = locks[key];
  if (entry && entry.lockedUntil > Date.now()) {
    return {
      locked: true,
      remainingSeconds: Math.ceil((entry.lockedUntil - Date.now()) / 1000),
    };
  }
  return { locked: false, remainingSeconds: 0 };
}

export function parseResetDurationFromErrorMessage(message?: string): number | undefined {
  if (!message) return undefined;
  const match = message.match(/Resets in\s+((?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?)/i);
  if (!match) return undefined;

  const days = parseInt(match[2] || "0", 10);
  const hours = parseInt(match[3] || "0", 10);
  const minutes = parseInt(match[4] || "0", 10);
  const seconds = parseInt(match[5] || "0", 10);

  const totalSeconds = (days * 86400) + (hours * 3600) + (minutes * 60) + seconds;
  return totalSeconds > 0 ? totalSeconds : undefined;
}

export function getCandidateAntigravityAccounts(
  modelId?: string,
  excludeEmail?: string
): AntigravityAccountCandidate[] {
  const candidates: AntigravityAccountCandidate[] = [];
  try {
    const appData = process.env.APPDATA;
    if (!appData) return candidates;
    const dbPath = path.join(appData, "9router", "db", "data.sqlite");
    if (!fs.existsSync(dbPath)) return candidates;
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare("SELECT email, data FROM providerConnections WHERE provider='antigravity' AND isActive=1").all() as Array<{ email?: string; data?: string }>;
    for (const r of rows) {
      if (!r.email) continue;
      const email = r.email.trim();
      if (excludeEmail && email.toLowerCase() === excludeEmail.toLowerCase()) continue;

      if (modelId) {
        const lock = isAntigravityAccountLocked(email, modelId);
        if (lock.locked) continue;
      }

      if (r.data) {
        try {
          const d = JSON.parse(r.data);
          if (typeof d.accessToken === "string" && d.accessToken.trim()) {
            let pid = typeof d.projectId === "string" && d.projectId.trim() ? d.projectId.trim() : "";
            if (!pid || pid === "aicode-consumers") {
              pid = lookupAntigravityProjectId(email) || generateAntigravityProjectId();
            }
            candidates.push({
              email,
              accessToken: d.accessToken.trim(),
              projectId: pid,
            });
          }
        } catch {}
      }
    }
  } catch (_) {}
  return candidates;
}

function generateAntigravityProjectId(): string {
  const adj = ["useful", "bright", "swift", "calm", "bold"];
  const noun = ["fuze", "wave", "spark", "flow", "core"];
  return adj[Math.floor(Math.random() * adj.length)] + "-" + noun[Math.floor(Math.random() * noun.length)] + "-" + Math.random().toString(36).slice(2, 7);
}

let toolCallCounter = 0;

/**
 * Read Server-Sent Events line-by-line from a readable stream.
 */
async function* readSSE(response: Response): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let split = buffer.indexOf("\n\n");
      while (split !== -1) {
        const chunk = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            yield trimmed.slice(5).trim();
          }
        }
        split = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          yield trimmed.slice(5).trim();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const stream = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) => {
  const stream = createAssistantMessageEventStream();

  void (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "pending",
      timestamp: Date.now(),
    };

    try {
      const apiKey = options?.apiKey;
      if (!apiKey) {
        throw new Error(`No OAuth access token for Antigravity provider: ${model.provider}`);
      }

      const rawBaseUrl =
        model.baseUrl ||
        (options as any)?.baseUrl ||
        "https://daily-cloudcode-pa.googleapis.com";
      const baseUrl = rawBaseUrl
        .replace(/\/+$/, "")
        .replace(/\/v1internal$/i, "");
      const effectiveBaseUrl =
        baseUrl === "https://cloudcode-pa.googleapis.com"
          ? "https://daily-cloudcode-pa.googleapis.com"
          : baseUrl;
      const url = `${effectiveBaseUrl}/v1internal:streamGenerateContent?alt=sse`;

      const optHeaders = (options?.headers ?? {}) as Record<string, string>;
      const modelHeaders = (model.headers ?? {}) as Record<string, string>;
      let projectId =
        optHeaders["x-antigravity-project-id"] ||
        modelHeaders["x-antigravity-project-id"] ||
        optHeaders["x-goog-user-project"] ||
        modelHeaders["x-goog-user-project"] ||
        "";
      if (!projectId || projectId === "aicode-consumers") {
        const accountEmail = optHeaders["x-antigravity-account-email"] || modelHeaders["x-antigravity-account-email"] || "";
        projectId = lookupAntigravityProjectId(accountEmail);
      }

      const contents = convertMessages(model as any, context);

      const generationConfig: Record<string, any> = {};
      if (options?.temperature !== undefined) {
        generationConfig.temperature = options.temperature;
      }
      if (options?.maxTokens !== undefined) {
        generationConfig.maxOutputTokens = options.maxTokens;
      }

      if (options?.reasoning) {
        const level = String(options.reasoning).toUpperCase();
        generationConfig.thinkingConfig = {
          includeThoughts: true,
          thinkingLevel:
            level === "MINIMAL" || level === "LOW" || level === "MEDIUM" || level === "HIGH"
              ? level
              : "HIGH",
        };
      }

      let wireModel = model.id;
      if (wireModel === "gemini-3.8-flash" || wireModel === "gemini-3.7-flash") {
        const level = String(options?.reasoning ?? "").toLowerCase();
        const suffix = level === "high" ? "high" : level === "low" ? "low" : "medium";
        wireModel = `${wireModel}-${suffix}`;
      } else if (wireModel === "gemini-3.1-pro") {
        wireModel = "gemini-3.1-pro-low";
      } else if (wireModel === "claude-opus-4-6") {
        wireModel = "claude-opus-4-6-thinking";
      } else if (wireModel === "gpt-oss-120b") {
        wireModel = "gpt-oss-120b-medium";
      }

      let payload: any = {
        project: projectId,
        model: wireModel,
        userAgent: "antigravity",
        requestType: "agent",
        requestId: `agent/${Date.now()}/${Math.random().toString(36).slice(2, 9)}`,
        request: {
          contents,
          ...(context.systemPrompt
            ? { systemInstruction: { parts: [{ text: context.systemPrompt }] } }
            : {}),
          ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
          ...(context.tools && context.tools.length > 0
            ? { tools: buildAntigravityTools(context.tools, model.id) }
            : {}),
        },
      };

      const nextPayload = await options?.onPayload?.(payload, model);
      if (nextPayload !== undefined) {
        payload = nextPayload;
      }

      const reqHeaders: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...modelHeaders,
        ...optHeaders,
        "User-Agent": "antigravity/ide/2.11.0 darwin/arm64",
        "x-client-name": "antigravity",
        "x-client-version": "4.2.5",
      };
      delete reqHeaders["x-goog-user-project"];
      reqHeaders.Authorization = `Bearer ${apiKey}`;

            const fetchFn = options?.fetch ?? globalThis.fetch;
      let activeReqHeaders = { ...reqHeaders };
      let activePayload = { ...payload };
      let activeEmail = optHeaders["x-antigravity-account-email"] || modelHeaders["x-antigravity-account-email"] || "";

      // Check if primary account is already in cooldown for this model group
      if (activeEmail) {
        const check = isAntigravityAccountLocked(activeEmail, wireModel);
        if (check.locked) {
          const altCandidates = getCandidateAntigravityAccounts(wireModel, activeEmail);
          if (altCandidates.length > 0) {
            const nextAcc = altCandidates[0];
            activeReqHeaders.Authorization = `Bearer ${nextAcc.accessToken}`;
            activePayload.project = nextAcc.projectId;
            activeEmail = nextAcc.email;
          }
        }
      }

      // Auto-resolve activeEmail if not present in headers
      if (!activeEmail) {
        const pool = getCandidateAntigravityAccounts(wireModel);
        const match = pool.find((c) => c.accessToken === apiKey);
        if (match) {
          activeEmail = match.email;
        } else if (pool.length > 0) {
          activeEmail = pool[0].email;
        }
      }

      let response = await fetchFn(url, {
        method: "POST",
        headers: activeReqHeaders,
        body: JSON.stringify(activePayload),
        signal: options?.signal,
      });

      // Check if error is quota exhausted, rate limit, permission denied, or overloaded (429, 404, 403, 503, 400)
      let shouldFailover = false;
      let errBodyText = "";
      if (!response.ok) {
        try {
          errBodyText = await response.clone().text();
        } catch {}
        shouldFailover =
          response.status === 429 ||
          response.status === 404 ||
          response.status === 403 ||
          response.status === 503 ||
          /quota|exhausted|rate.?limit|too many requests|resource_exhausted|permission denied|overloaded/i.test(errBodyText);
      }

      if (!response.ok && shouldFailover) {
        let errText = "";
        try {
          errText = await response.clone().text();
        } catch {}

        let resetSec = parseResetDurationFromErrorMessage(errBodyText);
        if (!resetSec) {
          resetSec = response.status === 429 ? 300 : 120;
        }

        if (activeEmail) {
          writeAntigravityLock(activeEmail, wireModel, resetSec, "quota_failover");
        }

        const remainingCandidates = getCandidateAntigravityAccounts(wireModel, activeEmail);
        for (const candidate of remainingCandidates) {
          const failoverHeaders = {
            ...activeReqHeaders,
            Authorization: `Bearer ${candidate.accessToken}`,
          };
          const failoverPayload = {
            ...activePayload,
            project: candidate.projectId,
          };
          const altResponse = await fetchFn(url, {
            method: "POST",
            headers: failoverHeaders,
            body: JSON.stringify(failoverPayload),
            signal: options?.signal,
          });

          if (altResponse.ok) {
            response = altResponse;
            activeEmail = candidate.email;
            activeReqHeaders = failoverHeaders;
            activePayload = failoverPayload;
            break;
          } else {
            let altErr = "";
            try { altErr = await altResponse.clone().text(); } catch {}
            const altReset = parseResetDurationFromErrorMessage(altErr) || (altResponse.status === 429 ? 300 : 120);
            writeAntigravityLock(candidate.email, wireModel, altReset, "quota_failover");
          }
        }
      }

      if (!response.ok) {
                const errText = await response.text();
        let errorMessage = `Antigravity error (HTTP ${response.status}): ${errText.slice(0, 300)}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) {
            errorMessage = parsed.error.message;
          }
        } catch {}
        output.stopReason = "error";
        output.errorMessage = errorMessage;
        stream.push({ type: "error", reason: "error", error: output });
        stream.end(output);
        return;
      }

      const respHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        respHeaders[key] = val;
      });
      await options?.onResponse?.({ status: response.status, headers: respHeaders }, model);

      stream.push({ type: "start", partial: output });

      let currentBlock: TextContent | ThinkingContent | null = null;
      const blocks = output.content;
      const blockIndex = () => blocks.length - 1;

      for await (const sseLine of readSSE(response)) {
        if (!sseLine || sseLine === "[DONE]") continue;

        let parsed: any;
        try {
          parsed = JSON.parse(sseLine);
        } catch {
          continue;
        }

        const chunks = Array.isArray(parsed) ? parsed : [parsed.response ?? parsed];

        for (const chunk of chunks) {
          if (!chunk) continue;
          if (chunk.error) {
            const msg = chunk.error.message || JSON.stringify(chunk.error);
            if (activeEmail && /quota|exhausted|rate.?limit|resource_exhausted/i.test(msg)) {
              writeAntigravityLock(activeEmail, wireModel, 300, "quota_sse");
            }
            throw new Error(msg);
          }

          output.responseId ||= chunk.responseId;
          const candidate = chunk.candidates?.[0];

          if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.text !== undefined) {
                const isThinking = isThinkingPart(part) || Boolean(part.thought);
                if (
                  !currentBlock ||
                  (isThinking && currentBlock.type !== "thinking") ||
                  (!isThinking && currentBlock.type !== "text")
                ) {
                  if (currentBlock) {
                    if (currentBlock.type === "text") {
                      stream.push({
                        type: "text_end",
                        contentIndex: blocks.length - 1,
                        content: currentBlock.text,
                        partial: output,
                      });
                    } else {
                      stream.push({
                        type: "thinking_end",
                        contentIndex: blockIndex(),
                        content: currentBlock.thinking,
                        partial: output,
                      });
                    }
                  }
                  if (isThinking) {
                    currentBlock = { type: "thinking", thinking: "", thinkingSignature: undefined };
                    output.content.push(currentBlock);
                    stream.push({ type: "thinking_start", contentIndex: blockIndex(), partial: output });
                  } else {
                    currentBlock = { type: "text", text: "" };
                    output.content.push(currentBlock);
                    stream.push({ type: "text_start", contentIndex: blockIndex(), partial: output });
                  }
                }

                if (currentBlock.type === "thinking") {
                  currentBlock.thinking += part.text;
                  currentBlock.thinkingSignature = retainThoughtSignature(
                    currentBlock.thinkingSignature,
                    part.thoughtSignature,
                  );
                  stream.push({
                    type: "thinking_delta",
                    contentIndex: blockIndex(),
                    delta: part.text,
                    partial: output,
                  });
                } else {
                  currentBlock.text += part.text;
                  currentBlock.textSignature = retainThoughtSignature(
                    currentBlock.textSignature,
                    part.thoughtSignature,
                  );
                  stream.push({
                    type: "text_delta",
                    contentIndex: blockIndex(),
                    delta: part.text,
                    partial: output,
                  });
                }
              }

              if (part.functionCall) {
                if (currentBlock) {
                  if (currentBlock.type === "text") {
                    stream.push({
                      type: "text_end",
                      contentIndex: blocks.length - 1,
                      content: currentBlock.text,
                      partial: output,
                    });
                  } else {
                    stream.push({
                      type: "thinking_end",
                      contentIndex: blockIndex(),
                      content: currentBlock.thinking,
                      partial: output,
                    });
                  }
                  currentBlock = null;
                }

                const providedId = part.functionCall.id;
                const toolCallId =
                  providedId || `${part.functionCall.name}_${Date.now()}_${++toolCallCounter}`;

                const toolCall: ToolCall = {
                  type: "toolCall",
                  id: toolCallId,
                  name: part.functionCall.name || "",
                  arguments: (part.functionCall.args as Record<string, any>) ?? {},
                  ...(part.thoughtSignature && { thoughtSignature: part.thoughtSignature }),
                };

                output.content.push(toolCall);
                stream.push({ type: "toolcall_start", contentIndex: blockIndex(), partial: output });
                stream.push({
                  type: "toolcall_delta",
                  contentIndex: blockIndex(),
                  delta: JSON.stringify(toolCall.arguments),
                  partial: output,
                });
                stream.push({
                  type: "toolcall_end",
                  contentIndex: blockIndex(),
                  toolCall,
                  partial: output,
                });
              }
            }
          }

          if (candidate?.finishReason) {
            output.rawStopReason = candidate.finishReason;
            output.stopReason = mapStopReasonString(candidate.finishReason);
            if (output.content.some((b) => b.type === "toolCall") && output.stopReason === "stop") {
              output.stopReason = "toolUse";
            }
          }

          if (chunk.usageMetadata) {
            output.usage = {
              input:
                (chunk.usageMetadata.promptTokenCount || 0) -
                (chunk.usageMetadata.cachedContentTokenCount || 0),
              output:
                (chunk.usageMetadata.candidatesTokenCount || 0) +
                (chunk.usageMetadata.thoughtsTokenCount || 0),
              cacheRead: chunk.usageMetadata.cachedContentTokenCount || 0,
              cacheWrite: 0,
              reasoning: chunk.usageMetadata.thoughtsTokenCount || 0,
              totalTokens: chunk.usageMetadata.totalTokenCount || 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            };
            calculateCost(model, output.usage);
          }
        }
      }

      if (currentBlock) {
        if (currentBlock.type === "text") {
          stream.push({
            type: "text_end",
            contentIndex: blockIndex(),
            content: currentBlock.text,
            partial: output,
          });
        } else {
          stream.push({
            type: "thinking_end",
            contentIndex: blockIndex(),
            content: currentBlock.thinking,
            partial: output,
          });
        }
      }

      if (options?.signal?.aborted) {
        output.stopReason = "aborted";
        stream.push({ type: "error", reason: "aborted", error: output });
        stream.end(output);
        return;
      }

      const finalReason: "stop" | "length" | "toolUse" =
        output.stopReason === "length" || output.stopReason === "toolUse"
          ? output.stopReason
          : "stop";
      output.stopReason = finalReason;

      stream.push({ type: "done", reason: finalReason, message: output });
      stream.end(output);
    } catch (error) {
      const aborted =
        options?.signal?.aborted ||
        (error instanceof Error && error.name === "AbortError");
      const reason: "aborted" | "error" = aborted ? "aborted" : "error";
      output.stopReason = reason;
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({
        type: "error",
        reason,
        error: output,
      });
      stream.end(output);
    }
  })();

  return stream;
};

export const streamSimple = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) => {
  return stream(model, context, options);
};

export const antigravityApi = (): ProviderStreams => ({
  stream: stream as any,
  streamSimple: streamSimple as any,
});
