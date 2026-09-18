import type { Mode, UnifiedModeId } from "@pi-desktop/shared";
import {
  IconCode,
  IconHand,
  IconListChecks,
  IconShield,
  IconTarget,
  IconUnlock,
  IconZap,
} from "../../../components/icons";

export function ModeIcon({ mode }: { mode: Mode }) {
  if (mode === "plan") return <IconListChecks size={14} />;
  if (mode === "goal") return <IconTarget size={14} />;
  return <IconShield size={14} />;
}

export function UnifiedModeIcon({ unifiedMode, size = 14 }: { unifiedMode: UnifiedModeId; size?: number }) {
  switch (unifiedMode) {
    case "manual":
      return <IconHand size={size} />;
    case "edit-auto":
      return <IconCode size={size} />;
    case "plan":
      return <IconListChecks size={size} />;
    case "auto":
      return <IconZap size={size} />;
    case "bypass":
      return <IconUnlock size={size} />;
    default:
      return <IconHand size={size} />;
  }
}

