import { useRef, useState } from "react";
import type { TFunction } from "i18next";
import {
  restoreInlineComposerFileReferenceTokens,
  serializeComposerFileReferences,
  serializeInlineComposerFileReferences,
  stripInlineComposerFileReferenceTokens,
} from "@pi-desktop/shared";
import type { AppState } from "../../../../stores/app-store";
import { useAppStore } from "../../../../stores/app-store";
import type { ComposerDraftSnapshot } from "../../../../lib/composer-smart-stop";
import { api } from "../../../../lib/api";
import { draftKeyForSession } from "../../../../lib/composer-draft-cache";
import { runExtensionCommand, runPaletteCommand } from "../../../../lib/commands";
import { resolveComposerCommand } from "../../../../hooks/use-composer-autocomplete";
import { readEditorValue, setEditorCaret, type ComposerFileReference } from "../editor";
import type { ComposerDraftController } from "./useComposerDraft";

type UseComposerSubmitOptions = {
  value: string;
  draftKey: string;
  activeSessionId: string | null | undefined;
  providerId?: string;
  modelId?: string;
  thinkingLevel: Parameters<AppState["configureActiveSession"]>[0]["thinkingLevel"];
  modelReady: boolean;
  sendBlocked: boolean;
  pasting: boolean;
  activeFileReferences: ComposerFileReference[];
  t: TFunction;
  sendPrompt: AppState["sendPrompt"];
  steerPrompt: AppState["steerPrompt"];
  showToast: AppState["showToast"];
  draft: Pick<
    ComposerDraftController,
    | "ref"
    | "draftSnapshot"
    | "clearDraftForKey"
    | "restoreDraftForKey"
    | "setValue"
    | "setCursor"
  >;
};

export type ComposerSubmitController = {
  enhancingPrompt: boolean;
  enhancementUndoText: string | null;
  enhancementError: { message: string; code: string } | null;
  clearEnhancementError: () => void;
  invalidatePromptEnhancement: () => void;
  enhancePrompt: () => Promise<void>;
  undoPromptEnhancement: () => void;
  submit: (steering?: boolean) => Promise<void>;
};

/**
 * Own prompt enhancement and send orchestration. It deliberately receives the
 * draft controller as a narrow dependency so command dispatch and optimistic
 * draft clearing remain independent from editor rendering.
 */
export function useComposerSubmit({
  value,
  draftKey,
  activeSessionId,
  providerId,
  modelId,
  thinkingLevel,
  modelReady,
  sendBlocked,
  pasting,
  activeFileReferences,
  t,
  sendPrompt,
  steerPrompt,
  showToast,
  draft,
}: UseComposerSubmitOptions): ComposerSubmitController {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [enhancementUndoText, setEnhancementUndoText] = useState<string | null>(null);
  const [enhancementError, setEnhancementError] = useState<{
    message: string;
    code: string;
  } | null>(null);
  const enhancementVersionRef = useRef(0);
  const enhancementRequestRef = useRef<symbol | null>(null);

  const invalidatePromptEnhancement = () => {
    enhancementVersionRef.current += 1;
    setEnhancementUndoText(null);
    setEnhancementError(null);
  };

  const enhancePrompt = async () => {
    const sourceText = value;
    const textToEnhance = stripInlineComposerFileReferenceTokens(
      sourceText,
      activeFileReferences,
    );
    const sourceKey = draftKey;
    const sourceVersion = enhancementVersionRef.current;
    if (
      !textToEnhance.trim() ||
      textToEnhance.trim().startsWith("/") ||
      !modelReady ||
      sendBlocked ||
      enhancingPrompt
    ) {
      return;
    }

    const requestToken = Symbol("prompt-enhancement");
    enhancementRequestRef.current = requestToken;
    setEnhancingPrompt(true);
    setEnhancementUndoText(null);
    setEnhancementError(null);
    try {
      const result = await api.enhancePrompt({
        sessionId: activeSessionId,
        draft: textToEnhance,
        providerId,
        modelId,
        thinkingLevel,
      });
      const currentKey = draftKeyForSession(useAppStore.getState().activeSessionId);
      if (
        enhancementRequestRef.current !== requestToken ||
        currentKey !== sourceKey ||
        enhancementVersionRef.current !== sourceVersion
      ) {
        return;
      }
      const modelDraft = result.enhancedDraft.trim();
      if (
        !modelDraft ||
        !stripInlineComposerFileReferenceTokens(modelDraft, activeFileReferences).trim()
      ) {
        throw Object.assign(new Error("The model returned an empty enhanced draft."), {
          code: "PROMPT_ENHANCEMENT_EMPTY",
        });
      }
      const enhancedDraft = restoreInlineComposerFileReferenceTokens(
        sourceText,
        modelDraft,
        activeFileReferences,
      );
      enhancementVersionRef.current += 1;
      draft.setValue(enhancedDraft);
      draft.setCursor(enhancedDraft.length);
      setEnhancementUndoText(sourceText);
      requestAnimationFrame(() => {
        const element = draft.ref.current;
        if (!element) return;
        element.focus();
        setEditorCaret(element, enhancedDraft.length);
      });
    } catch (error) {
      const currentKey = draftKeyForSession(useAppStore.getState().activeSessionId);
      if (
        enhancementRequestRef.current !== requestToken ||
        currentKey !== sourceKey ||
        enhancementVersionRef.current !== sourceVersion
      ) {
        return;
      }
      const typed = error as Error & { code?: string };
      setEnhancementError({
        message: typed.message || t("chat.enhancementFailed"),
        code: typed.code || "PROMPT_ENHANCEMENT_FAILED",
      });
    } finally {
      if (enhancementRequestRef.current === requestToken) setEnhancingPrompt(false);
    }
  };

  const undoPromptEnhancement = () => {
    if (enhancementUndoText === null) return;
    invalidatePromptEnhancement();
    draft.setValue(enhancementUndoText);
    draft.setCursor(enhancementUndoText.length);
    requestAnimationFrame(() => {
      const element = draft.ref.current;
      if (!element) return;
      element.focus();
      setEditorCaret(element, enhancementUndoText.length);
    });
  };

  const submit = async (steering = false) => {
    const text = draft.ref.current ? readEditorValue(draft.ref.current) : value;
    const inlineContent = serializeInlineComposerFileReferences(
      text,
      activeFileReferences,
    );
    const serializedContent = serializeComposerFileReferences(text, activeFileReferences);
    if (!serializedContent) return;
    if (sendBlocked) {
      if (pasting) showToast(t("chat.pasteInProgress"), { variant: "info" });
      return;
    }
    invalidatePromptEnhancement();
    const submittedDraftKey = draftKey;
    // Slash dispatch stays local for builtin and extension commands, while
    // templates, skills, and unknown aliases continue as normal prompt text.
    if (!steering && serializedContent.startsWith("/")) {
      const commandEnd = serializedContent.search(/\s/);
      const name = serializedContent.slice(
        1,
        commandEnd === -1 ? undefined : commandEnd,
      );

      // Fast-path /compact: clear composer draft immediately and trigger compaction locally
      if (name === "compact" || name === "compact-context") {
        draft.clearDraftForKey(submittedDraftKey);
        try {
          await runPaletteCommand("builtin.agent.compact");
        } catch (error) {
          showToast(error instanceof Error ? error.message : String(error), {
            variant: "error",
          });
        }
        return;
      }

      const command = name ? await resolveComposerCommand(name) : null;
      if (command && command.kind !== "template" && command.id) {
        const commandBody =
          commandEnd === -1 ? "" : serializedContent.slice(commandEnd).trim();
        const isModeCommand =
          command.id === "builtin.mode.agent" ||
          command.id === "builtin.mode.plan" ||
          command.id === "builtin.mode.goal";
        const isWorkflowCommand = command.id === "builtin.workflow";
        if (isWorkflowCommand) {
          try {
            const visibleDraft = text.trim();
            const visibleCommandEnd = visibleDraft.search(/\s/);
            const visibleCommandBody =
              visibleCommandEnd === -1
                ? ""
                : visibleDraft.slice(visibleCommandEnd).trim();
            const promptBody = visibleCommandBody || commandBody;
            const workflowPrompt = promptBody
              ? `[Workflow Orchestration Directive]\nExecute the following task using deterministic multi-agent workflow orchestration (Phase 1: Scout & Plan -> Phase 2: Fan-out Subagents via Task tool -> Phase 3: Adversarial Verification & Synthesis):\n\n${promptBody}`
              : `[Workflow Directive]\nList available multi-agent workflow patterns (review-changes, parallel-audit, feature-pipeline) and explain how to orchestrate them with subagents.`;
            const accepted = await sendPrompt(
              serializeInlineComposerFileReferences(
                workflowPrompt,
                activeFileReferences,
              ),
              draft.draftSnapshot(workflowPrompt),
            );
            if (accepted) draft.clearDraftForKey(submittedDraftKey);
          } catch (error) {
            showToast(error instanceof Error ? error.message : String(error), {
              variant: "error",
            });
          }
          return;
        }
        const isSimplifyCommand =
          name === "simplify" ||
          command.name === "simplify" ||
          command.id === "builtin.simplify";
        if (isSimplifyCommand) {
          try {
            const visibleDraft = text.trim();
            const visibleCommandEnd = visibleDraft.search(/\s/);
            const visibleCommandBody =
              visibleCommandEnd === -1
                ? ""
                : visibleDraft.slice(visibleCommandEnd).trim();
            const promptBody = visibleCommandBody || commandBody;
            const simplifyPrompt = [
              "[4-Lens Code Simplification Review Directive]",
              "Review the current git diff and changed code across 4 distinct lenses, then apply cleanups:",
              "1. Reuse: Find existing helpers, hooks, design tokens, and components in the codebase to replace new code.",
              "2. Simplification: Remove unrequested abstractions, unnecessary indirection, and premature generalizations.",
              "3. Efficiency: Optimize algorithmic complexity, loops, memory allocations, and redundant re-renders.",
              "4. Altitude: Verify code is placed at the correct architectural layer with clear separation of concerns.",
              ...(promptBody ? ["", `Focus / instructions: ${promptBody}`] : []),
            ].join("\n");
            const accepted = await sendPrompt(
              serializeInlineComposerFileReferences(
                simplifyPrompt,
                activeFileReferences,
              ),
              draft.draftSnapshot(simplifyPrompt),
            );
            if (accepted) draft.clearDraftForKey(submittedDraftKey);
          } catch (error) {
            showToast(error instanceof Error ? error.message : String(error), {
              variant: "error",
            });
          }
          return;
        }
        const isLoopCommand =
          name === "loop" || command?.name === "loop" || command?.id === "builtin.loop";
        if (isLoopCommand) {
          try {
            const visibleDraft = text.trim();
            const visibleCommandEnd = visibleDraft.search(/\s/);
            const visibleCommandBody =
              visibleCommandEnd === -1
                ? ""
                : visibleDraft.slice(visibleCommandEnd).trim();
            const promptBody = visibleCommandBody || commandBody;
            let interval: string | undefined;
            let taskBody = promptBody;
            const intervalMatch = promptBody.match(/^(\d+(?:[smh]|ms)?)\s*(.*)$/is);
            if (intervalMatch && intervalMatch[1]) {
              interval = intervalMatch[1];
              taskBody = intervalMatch[2].trim();
            }

            const loopPrompt = `[Loop Dynamic Pacing Directive]\nRun recurring task loop with dynamic prompt-cache aware pacing (TTL ~5 min / 300s):\n- Configured Interval: ${interval ?? "dynamic (self-paced)"}\n- Pacing Rules:\n  * Intervals under 5 minutes (< 270s): Active polling (CI runs, deploys) to keep prompt cache warm (Anthropic/OpenAI 5-minute TTL).\n  * Intervals over 5 minutes (>= 1200s): Amortize cache misses for long-running idle checks.\n  * Consecutive ticks with no state changes: Emit { "noop": true } and collapse consecutive noop: true ticks as a streak.\n\nTask:\n${taskBody || "Run scheduled background maintenance and verify state."}`;
            const accepted = await sendPrompt(
              serializeInlineComposerFileReferences(
                loopPrompt,
                activeFileReferences,
              ),
              draft.draftSnapshot(loopPrompt),
            );
            if (accepted) draft.clearDraftForKey(submittedDraftKey);
          } catch (error) {
            showToast(error instanceof Error ? error.message : String(error), {
              variant: "error",
            });
          }
          return;
        }
        if (isModeCommand && commandBody) {
          try {
            await runPaletteCommand(command.id);
            const visibleDraft = text.trim();
            const visibleCommandEnd = visibleDraft.search(/\s/);
            const visibleCommandBody =
              visibleCommandEnd === -1
                ? ""
                : visibleDraft.slice(visibleCommandEnd).trim();
            const accepted = await sendPrompt(
              serializeInlineComposerFileReferences(
                visibleCommandBody,
                activeFileReferences,
              ),
              draft.draftSnapshot(visibleCommandBody),
            );
            if (accepted) draft.clearDraftForKey(submittedDraftKey);
          } catch (error) {
            showToast(error instanceof Error ? error.message : String(error), {
              variant: "error",
            });
          }
          return;
        }
        if (command.kind === "extension") {
          try {
            await runExtensionCommand(command.name, commandBody);
            draft.clearDraftForKey(submittedDraftKey);
          } catch (error) {
            showToast(error instanceof Error ? error.message : String(error), {
              variant: "error",
            });
          }
          return;
        }
        if (!commandBody) {
          draft.clearDraftForKey(submittedDraftKey);
          try {
            if (command.kind === "builtin") await runPaletteCommand(command.id);
            else await api.executeCommand(command.id);
          } catch (error) {
            showToast(error instanceof Error ? error.message : String(error), {
              variant: "error",
            });
          }
          return;
        }
      }
    }
    if (!steering && !modelReady) {
      showToast(t("errors.MODEL_NOT_CONFIGURED"), { variant: "error" });
      return;
    }
    const submittedDraft = draft.draftSnapshot(text);
    draft.clearDraftForKey(submittedDraftKey);
    const accepted = steering
      ? await steerPrompt(inlineContent, submittedDraft)
      : await sendPrompt(inlineContent, submittedDraft);
    if (!accepted) draft.restoreDraftForKey(submittedDraftKey, submittedDraft);
  };

  return {
    enhancingPrompt,
    enhancementUndoText,
    enhancementError,
    clearEnhancementError: () => setEnhancementError(null),
    invalidatePromptEnhancement,
    enhancePrompt,
    undoPromptEnhancement,
    submit,
  };
}
