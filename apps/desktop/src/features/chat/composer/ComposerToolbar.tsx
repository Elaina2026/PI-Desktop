import { useState, type Dispatch, type SetStateAction } from "react";
import type { TFunction } from "i18next";
import {
  keybindingDisplayParts,
  type Mode,
  type PermissionMode,
  type ShortcutPlatform,
  type ThinkingLevel,
} from "@pi-desktop/shared";
import type { AppState } from "../../../stores/app-store";
import { AnchoredMenu } from "../../../components/settings/AnchoredMenu";
import { ContextUsageInspector } from "../../../components/ContextUsageInspector";
import { TooltipButton } from "../../../components/ui";
import {
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconFileText,
  IconImage,
  IconPlus,
  IconSparkles,
  IconStop,
  IconUndo2,
} from "../../../components/icons";
import { ModeIcon } from "./ComposerModeIcon";
import { ComposerModelPicker } from "./ComposerModelPicker";
import {
  MODE_LABEL_KEYS,
  PERMISSION_MODE_I18N_KEYS,
  nextMode,
} from "./model";
import type { useComposerModelMenu } from "./hooks/useComposerModelMenu";

type ModelMenuController = ReturnType<typeof useComposerModelMenu>;
type ContextUsage = Parameters<typeof ContextUsageInspector>[0];

export type ComposerToolbarProps = {
  t: TFunction;
  mode: Mode;
  planningLive: boolean;
  providerId?: string;
  modelId?: string;
  thinkingLevel: ThinkingLevel;
  composerPermissionMode: Exclude<PermissionMode, "inherit">;
  permissionOpen: boolean;
  setPermissionOpen: Dispatch<SetStateAction<boolean>>;
  controlsBlocked: boolean;
  pasting: boolean;
  pickAndAttach: () => Promise<void>;
  pickAndAttachPhotos?: () => Promise<void>;
  supportsVision?: boolean;
  configureActiveSession: AppState["configureActiveSession"];
  showToast: AppState["showToast"];
  modelMenu: ModelMenuController;
  modelLabel: string;
  thinkingLabel: string;
  contextUsage: ContextUsage | null;
  enhancementDraft: string;
  value: string;
  modelReady: boolean;
  sendBlocked: boolean;
  enhancingPrompt: boolean;
  enhancementUndoText: string | null;
  enhancePrompt: () => Promise<void>;
  undoPromptEnhancement: () => void;
  clearEnhancementError: () => void;
  runActive: boolean;
  hasDraftContent: boolean;
  abort: AppState["abort"];
  submit: () => Promise<void>;
};

/** Composer controls: mode, permission, model, enhancement, and send/stop. */
export function ComposerToolbar({
  t,
  mode,
  planningLive,
  providerId,
  modelId,
  thinkingLevel,
  composerPermissionMode,
  permissionOpen,
  setPermissionOpen,
  controlsBlocked,
  pasting,
  pickAndAttach,
  pickAndAttachPhotos,
  supportsVision,
  configureActiveSession,
  showToast,
  modelMenu,
  modelLabel,
  thinkingLabel,
  contextUsage,
  enhancementDraft,
  value,
  modelReady,
  sendBlocked,
  enhancingPrompt,
  enhancementUndoText,
  enhancePrompt,
  undoPromptEnhancement,
  clearEnhancementError,
  runActive,
  hasDraftContent,
  abort,
  submit,
}: ComposerToolbarProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const platform = (window.piDesktop?.platform ?? "darwin") as ShortcutPlatform;
  const steeringShortcut = keybindingDisplayParts("Alt+Enter", platform).join("+");
  return (
    <div className="composer-toolbar">
      <div className="composer-left">
        <AnchoredMenu
          className="composer-add-anchor"
          open={addMenuOpen}
          onClose={() => setAddMenuOpen(false)}
          menuClassName="composer-permission-menu composer-add-menu"
          label={t("chat.addFiles")}
          role="menu"
          align="start"
          side="top"
          trigger={(ref) => (
            <div className="composer-plus">
              <TooltipButton
                ref={ref}
                type="button"
                className={`icon-btn ${addMenuOpen ? "active" : ""}`}
                tooltip={t("chat.addFiles")}
                ariaLabel={t("chat.addFiles")}
                disabled={controlsBlocked || pasting}
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
                onClick={() => {
                  modelMenu.setOpen(false);
                  setModeOpen(false);
                  setPermissionOpen(false);
                  setAddMenuOpen((open) => !open);
                }}
              >
                <IconPlus size={15} aria-hidden="true" />
              </TooltipButton>
            </div>
          )}
        >
          <div className="composer-menu-root">
            <button
              type="button"
              role="menuitem"
              disabled={controlsBlocked || pasting}
              className="composer-plus-item"
              onClick={() => {
                setAddMenuOpen(false);
                void pickAndAttach();
              }}
            >
              <span className="composer-model-thinking-icon">
                <IconFileText size={14} aria-hidden="true" />
              </span>
              <span className="flex-1 text-left">
                {t("chat.addFilesOption", "Thêm tệp tin")}
              </span>
            </button>
            {supportsVision && pickAndAttachPhotos ? (
              <button
                type="button"
                role="menuitem"
                disabled={controlsBlocked || pasting}
                className="composer-plus-item"
                onClick={() => {
                  setAddMenuOpen(false);
                  void pickAndAttachPhotos();
                }}
              >
                <span className="composer-model-thinking-icon">
                  <IconImage size={14} aria-hidden="true" />
                </span>
                <span className="flex-1 text-left">
                  {t("chat.addMediaOption", "Thêm hình ảnh / Media")}
                </span>
              </button>
            ) : null}
          </div>
        </AnchoredMenu>
        <AnchoredMenu
          className="composer-mode-anchor"
          open={modeOpen}
          onClose={() => setModeOpen(false)}
          menuClassName="composer-permission-menu composer-mode-menu"
          label={t("settings.mode")}
          role="menu"
          align="start"
          side="top"
          trigger={(ref) => (
            <TooltipButton
              ref={ref}
              type="button"
              className="icon-btn mode-chip composer-mode-chip"
              data-mode={mode}
              data-open={modeOpen ? "true" : undefined}
              data-planning={planningLive ? "true" : undefined}
              tooltip={planningLive ? t(`${mode}.planning`) : t("settings.mode")}
              ariaLabel={planningLive ? t(`${mode}.planning`) : t("settings.mode")}
              disabled={controlsBlocked}
              aria-haspopup="menu"
              aria-expanded={modeOpen}
              onClick={() => {
                modelMenu.setOpen(false);
                setAddMenuOpen(false);
                setPermissionOpen(false);
                setModeOpen((open) => !open);
              }}
            >
              <span className="composer-mode-chip-face" key={mode}>
                <ModeIcon mode={mode} />
                <span className="composer-mode-chip-label text-sm">
                  {t(MODE_LABEL_KEYS[mode])}
                </span>
              </span>
            </TooltipButton>
          )}
        >
          {(["agent", "plan", "goal"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="menuitemradio"
              aria-checked={mode === candidate}
              disabled={controlsBlocked}
              className={`composer-plus-item ${mode === candidate ? "active" : ""}`}
              onClick={async () => {
                setModeOpen(false);
                try {
                  await configureActiveSession({
                    mode: candidate,
                    providerId,
                    modelId,
                    thinkingLevel,
                  });
                } catch (error) {
                  showToast(error instanceof Error ? error.message : String(error), {
                    variant: "error",
                  });
                }
              }}
            >
              <span className="composer-model-thinking-icon">
                <ModeIcon mode={candidate} />
              </span>
              <span className="flex-1 text-left">
                {t(MODE_LABEL_KEYS[candidate])}
              </span>
              {mode === candidate ? <IconCheck size={13} /> : null}
            </button>
          ))}
        </AnchoredMenu>
        <AnchoredMenu
          className="composer-permission"
          open={permissionOpen && mode !== "goal"}
          onClose={() => setPermissionOpen(false)}
          menuClassName="composer-permission-menu"
          label={t("chat.permissionMode")}
          role="menu"
          align="start"
          side="top"
          trigger={(ref) => (
            <TooltipButton
              ref={ref}
              type="button"
              className={`icon-btn mode-chip ${permissionOpen ? "active" : ""}`}
              tooltip={
                mode === "goal"
                  ? `${t("chat.permissionMode")} · ${t("goal.autoWarning")}`
                  : mode === "plan" && composerPermissionMode === "auto"
                    ? `${t("chat.permissionMode")} · ${t("plan.autoWarning")}`
                    : t("chat.permissionMode")
              }
              ariaLabel={
                mode === "goal"
                  ? `${t("chat.permissionMode")} · ${t("goal.autoWarning")}`
                  : mode === "plan" && composerPermissionMode === "auto"
                    ? `${t("chat.permissionMode")} · ${t("plan.autoWarning")}`
                    : t("chat.permissionMode")
              }
              aria-haspopup={mode === "goal" ? undefined : "menu"}
              aria-expanded={mode === "goal" ? false : permissionOpen}
              disabled={controlsBlocked || mode === "goal"}
              onClick={() => {
                modelMenu.setOpen(false);
                setModeOpen(false);
                setAddMenuOpen(false);
                setPermissionOpen((open) => !open);
              }}
            >
              <span className="text-sm">
                {t(PERMISSION_MODE_I18N_KEYS[composerPermissionMode])}
              </span>
              <IconChevronDown size={12} />
            </TooltipButton>
          )}
        >
          {(["ask", "accept-edits", "auto"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="menuitemradio"
              aria-checked={composerPermissionMode === candidate}
              disabled={controlsBlocked}
              className={`composer-plus-item ${composerPermissionMode === candidate ? "active" : ""}`}
              onClick={async () => {
                setPermissionOpen(false);
                try {
                  await configureActiveSession({
                    mode,
                    providerId,
                    modelId,
                    thinkingLevel,
                    permissionMode: candidate,
                  });
                } catch (error) {
                  showToast(error instanceof Error ? error.message : String(error), {
                    variant: "error",
                  });
                }
              }}
            >
              <span className="flex-1 text-left">
                {t(PERMISSION_MODE_I18N_KEYS[candidate])}
              </span>
              {composerPermissionMode === candidate ? <IconCheck size={13} /> : null}
            </button>
          ))}
        </AnchoredMenu>
      </div>

      <div className="composer-right">
        {contextUsage ? <ContextUsageInspector {...contextUsage} /> : null}
        <ComposerModelPicker
          t={t}
          controller={modelMenu}
          modelLabel={modelLabel}
          thinkingLabel={thinkingLabel}
          thinkingLevel={thinkingLevel}
          selectedProviderId={providerId}
          selectedModelId={modelId}
          controlsBlocked={controlsBlocked}
          onCloseOtherMenus={() => {
            setPermissionOpen(false);
            setModeOpen(false);
            setAddMenuOpen(false);
          }}
        />
        <TooltipButton
          type="button"
          className={`icon-btn composer-enhance-btn${enhancingPrompt ? " is-loading" : ""}`}
          tooltip={t("chat.enhancePrompt")}
          ariaLabel={enhancingPrompt ? t("chat.enhancingPrompt") : t("chat.enhancePrompt")}
          aria-busy={enhancingPrompt}
          disabled={
            !enhancementDraft.trim() ||
            enhancementDraft.trim().startsWith("/") ||
            !modelReady ||
            sendBlocked ||
            enhancingPrompt
          }
          onClick={() => void enhancePrompt()}
        >
          {enhancingPrompt ? (
            <>
              <span className="tool-spinner" aria-hidden="true" />
              <span>{t("chat.enhancingPrompt")}</span>
            </>
          ) : (
            <IconSparkles size={15} aria-hidden="true" />
          )}
        </TooltipButton>
        {enhancementUndoText !== null ? (
          <TooltipButton
            type="button"
            className="icon-btn composer-enhance-undo"
            tooltip={t("chat.undoEnhancement")}
            ariaLabel={t("chat.undoEnhancement")}
            disabled={controlsBlocked}
            onClick={undoPromptEnhancement}
          >
            <IconUndo2 size={15} aria-hidden="true" />
          </TooltipButton>
        ) : null}
        {runActive && !hasDraftContent ? (
          <TooltipButton
            type="button"
            className="stop-btn"
            tooltip={t("chat.stopGenerating")}
            ariaLabel={t("chat.stopGenerating")}
            onClick={() => void abort()}
          >
            <IconStop size={14} />
          </TooltipButton>
        ) : (
          <TooltipButton
            type="button"
            className="send-btn"
            ariaLabel={modelReady ? t("chat.send") : t("settings.addProvider")}
            tooltip={
              runActive
                ? t("chat.sendWhileRunning", { shortcut: steeringShortcut })
                : modelReady
                  ? t("chat.send")
                  : t("settings.addProvider")
            }
            disabled={
              !hasDraftContent ||
              sendBlocked ||
              (!modelReady && !value.trim().startsWith("/"))
            }
            onClick={() => void submit()}
          >
            <IconArrowUp size={15} />
          </TooltipButton>
        )}
      </div>
    </div>
  );
}
