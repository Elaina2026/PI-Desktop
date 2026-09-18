import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { TFunction } from "i18next";
import {
  keybindingDisplayParts,
  type Mode,
  type PermissionMode,
  type ShortcutPlatform,
  type ThinkingLevel,
  type UnifiedModeId,
  resolveUnifiedMode,
  unifiedModeToSessionConfig,
} from "@pi-desktop/shared";
import { useAppStore, type AppState } from "../../../stores/app-store";
import { computeTokenCost, resolveModelRate } from "../../../lib/model-pricing";
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
import { ModeIcon, UnifiedModeIcon } from "./ComposerModeIcon";
import { ComposerModelPicker } from "./ComposerModelPicker";
import {
  MODE_LABEL_KEYS,
  PERMISSION_MODE_I18N_KEYS,
  UNIFIED_MODES,
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
  const [unifiedModeOpen, setUnifiedModeOpen] = useState(false);
  const messages = useAppStore((s) => s.messages);
  const currentUnifiedId = resolveUnifiedMode(mode, composerPermissionMode);
  const currentUnifiedDef =
    UNIFIED_MODES.find((d) => d.id === currentUnifiedId) ?? UNIFIED_MODES[0];
  const sessionCost = useMemo(() => {
    let total = 0;
    for (const m of messages) {
      if (m.role === "assistant" && m.usage && m.modelId) {
        const rates = resolveModelRate(m.modelId);
        total += computeTokenCost(m.usage, rates);
      }
    }
    return total;
  }, [messages]);
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
                className={`icon-btn icon-btn-square ${addMenuOpen ? "active" : ""}`}
                tooltip={t("chat.addFiles")}
                ariaLabel={t("chat.addFiles")}
                disabled={controlsBlocked || pasting}
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
                onClick={() => {
                  modelMenu.setOpen(false);
                  setUnifiedModeOpen(false);
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
                {t("chat.addFilesOption", "Files")}
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
                  {t("chat.addMediaOption", "Photos & Media")}
                </span>
              </button>
            ) : null}
          </div>
        </AnchoredMenu>
        <AnchoredMenu
          className="composer-mode-anchor"
          open={unifiedModeOpen}
          onClose={() => setUnifiedModeOpen(false)}
          menuClassName="composer-unified-mode-menu"
          label={t("settings.mode", "Mode")}
          role="menu"
          align="start"
          side="top"
          trigger={(ref) => (
            <TooltipButton
              ref={ref}
              type="button"
              className="icon-btn mode-chip composer-mode-chip"
              data-mode={currentUnifiedId}
              data-open={unifiedModeOpen ? "true" : undefined}
              data-planning={planningLive ? "true" : undefined}
              tooltip={
                planningLive
                  ? t(`${mode}.planning`)
                  : t(currentUnifiedDef.labelKey, currentUnifiedDef.defaultLabel)
              }
              ariaLabel={
                planningLive
                  ? t(`${mode}.planning`)
                  : t(currentUnifiedDef.labelKey, currentUnifiedDef.defaultLabel)
              }
              disabled={controlsBlocked}
              aria-haspopup="menu"
              aria-expanded={unifiedModeOpen}
              onClick={() => {
                modelMenu.setOpen(false);
                setAddMenuOpen(false);
                setPermissionOpen(false);
                setUnifiedModeOpen((open) => !open);
              }}
            >
              <span className="composer-mode-chip-face" key={currentUnifiedId}>
                <UnifiedModeIcon unifiedMode={currentUnifiedId} />
                <span className="composer-mode-chip-label text-sm">
                  {t(currentUnifiedDef.labelKey, currentUnifiedDef.defaultLabel)}
                </span>
                <IconChevronDown size={11} style={{ opacity: 0.7, marginLeft: 2 }} />
              </span>
            </TooltipButton>
          )}
        >
          {UNIFIED_MODES.map((candidate) => {
            const isSelected = currentUnifiedId === candidate.id;
            return (
              <button
                key={candidate.id}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                disabled={controlsBlocked}
                className={`composer-unified-mode-item ${isSelected ? "active" : ""}`}
                onClick={async () => {
                  setUnifiedModeOpen(false);
                  const targetConfig = unifiedModeToSessionConfig(candidate.id);
                  try {
                    await configureActiveSession({
                      mode: targetConfig.mode,
                      permissionMode: targetConfig.permissionMode,
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
                <div className="composer-unified-mode-icon">
                  <UnifiedModeIcon unifiedMode={candidate.id} size={15} />
                </div>
                <div className="composer-unified-mode-text">
                  <div className="composer-unified-mode-title">
                    {t(candidate.labelKey, candidate.defaultLabel)}
                  </div>
                  <div className="composer-unified-mode-desc">
                    {t(candidate.descKey, candidate.defaultDesc)}
                  </div>
                </div>
                {isSelected ? <IconCheck size={14} className="composer-unified-mode-check" /> : null}
              </button>
            );
          })}
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
            setUnifiedModeOpen(false);
            setAddMenuOpen(false);
          }}
        />
        {sessionCost > 0 ? (
          <span
            className="composer-cost-badge"
            title={`Total session cost: $${sessionCost.toFixed(4)}`}
          >
            ${sessionCost < 0.01 ? sessionCost.toFixed(4) : sessionCost.toFixed(3)}
          </span>
        ) : null}
        <TooltipButton
          type="button"
          className={`icon-btn icon-btn-square composer-enhance-btn${enhancingPrompt ? " is-loading" : ""}`}
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
            className="icon-btn icon-btn-square composer-enhance-undo"
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
