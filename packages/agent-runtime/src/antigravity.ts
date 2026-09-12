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
function sanitizeOpenApiConst(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeOpenApiConst);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const obj = { ...(value as Record<string, unknown>) };
  if ("const" in obj) {
    const val = obj.const;
    delete obj.const;
    if (!("enum" in obj)) {
      obj.enum = [val];
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    obj[k] = sanitizeOpenApiConst(v);
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
  if (!raw || !isClaude) return raw;

  return raw.map((group) => ({
    ...group,
    functionDeclarations: group.functionDeclarations.map((decl) => {
      if (decl.parameters) {
        return {
          ...decl,
          parameters: sanitizeOpenApiConst(decl.parameters) as Record<string, unknown>,
        };
      }
      return decl;
    }),
  }));
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

      const baseUrl = (model.baseUrl || "https://cloudcode-pa.googleapis.com")
        .replace(/\/+$/, "")
        .replace(/\/v1internal$/i, "");
      const url = `${baseUrl}/v1internal:streamGenerateContent?alt=sse`;

      const optHeaders = (options?.headers ?? {}) as Record<string, string>;
      const modelHeaders = (model.headers ?? {}) as Record<string, string>;
      const projectId =
        optHeaders["x-goog-user-project"] ||
        modelHeaders["x-goog-user-project"] ||
        "";

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

      let payload: any = {
        project: projectId,
        model: model.id,
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
        "User-Agent": "antigravity/ide/2.1.1 darwin/arm64",
        "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
        "Client-Metadata": JSON.stringify({ ideType: 9, platform: 3, pluginType: 2 }),
        ...(projectId ? { "x-goog-user-project": projectId } : {}),
        ...modelHeaders,
        ...optHeaders,
      };
      reqHeaders.Authorization = `Bearer ${apiKey}`;

      const fetchFn = options?.fetch ?? globalThis.fetch;
      const response = await fetchFn(url, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(payload),
        signal: options?.signal,
      });

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
            throw new Error(chunk.error.message || JSON.stringify(chunk.error));
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
