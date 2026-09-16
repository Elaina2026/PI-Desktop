import type {
  Api,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type { ThinkingLevel } from "@pi-desktop/shared";
import { completeOneShot } from "./one-shot-complete.js";
import {
  PROMPT_ENHANCEMENT_SYSTEM_PROMPT,
  PROMPT_ENHANCEMENT_USER_PREFIX,
} from "./prompt-templates.js";
import type { RuntimeProviderConfig } from "./provider-binding.js";

export type PromptEnhancementStream = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) => AssistantMessageEventStream;

export type PromptEnhancementOptions = {
  signal?: AbortSignal;
  /** Test seam for a provider stream; production uses the resolved model registry. */
  stream?: PromptEnhancementStream;
  /** Conversation id forwarded to OpenCode as `x-opencode-session`. */
  sessionId?: string;
};

export function promptEnhancementContext(draft: string): Context {
  return {
    systemPrompt: PROMPT_ENHANCEMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${PROMPT_ENHANCEMENT_USER_PREFIX}${draft}`,
        timestamp: Date.now(),
      },
    ],
  };
}

/**
 * Run one independent completion with no session history or tools.
 * Provider setup retries follow the same controller as the agent runtime.
 */
export async function enhancePromptDraft(
  provider: RuntimeProviderConfig,
  draft: string,
  thinkingLevel: ThinkingLevel,
  options: PromptEnhancementOptions = {},
): Promise<string> {
  const result = await completeOneShot(
    provider,
    promptEnhancementContext(draft),
    thinkingLevel,
    {
      signal: options.signal,
      stream: options.stream,
      sessionId: options.sessionId,
      emptyErrorCode: "PROMPT_ENHANCEMENT_EMPTY",
      emptyErrorMessage: "The model returned an empty enhanced draft.",
    },
  );
  return result.text;
}

export const COMMIT_MESSAGE_SYSTEM_PROMPT = [
  "You are an expert Git commit author following strict engineering standards (Claude Code quick-commit discipline):",
  "1. Analyze the provided git diff and write a concise, conventional git commit message adhering to the Conventional Commits specification (e.g. feat(scope): subject, fix(scope): subject, refactor(scope): subject).",
  "2. Ensure the commit message accurately reflects the changes and their purpose ('feat'/'add' = new capability, 'fix' = bug fix, 'refactor' = structural cleanup, 'test' = test coverage).",
  "3. Focus on the WHY rather than just the WHAT. Keep the subject line under 72 characters, imperative mood, lowercase subject.",
  "4. Return ONLY the raw commit message (subject and optional body), with zero markdown code fences, zero conversational commentary, and zero introductory preamble.",
].join("\n");

export async function generateCommitMessage(
  provider: RuntimeProviderConfig,
  diff: string,
  thinkingLevel: ThinkingLevel = "off",
  options: PromptEnhancementOptions = {},
): Promise<string> {
  const context: Context = {
    systemPrompt: COMMIT_MESSAGE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Git Diff:\n${diff.slice(0, 30_000)}`,
        timestamp: Date.now(),
      },
    ],
  };
  const result = await completeOneShot(
    provider,
    context,
    thinkingLevel,
    {
      signal: options.signal,
      stream: options.stream,
      sessionId: options.sessionId,
      emptyErrorCode: "COMMIT_MESSAGE_EMPTY",
      emptyErrorMessage: "The model returned an empty commit message.",
    },
  );
  return result.text.trim();
}
