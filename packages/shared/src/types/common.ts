/** Shared public types grouped by the owning application domain. */
export type Mode = "plan" | "goal" | "agent";

export const UNIFIED_MODE_IDS = ["manual", "edit-auto", "plan", "auto", "bypass"] as const;
export type UnifiedModeId = (typeof UNIFIED_MODE_IDS)[number];

export function resolveUnifiedMode(mode: Mode, permissionMode?: string): UnifiedModeId {
  if (mode === "plan") return "plan";
  if (permissionMode === "bypass") return "bypass";
  if (permissionMode === "auto" || mode === "goal") return "auto";
  if (permissionMode === "accept-edits") return "edit-auto";
  return "manual";
}

export function unifiedModeToSessionConfig(unified: UnifiedModeId): { mode: Mode; permissionMode: "ask" | "accept-edits" | "auto" | "bypass" } {
  switch (unified) {
    case "manual":
      return { mode: "agent", permissionMode: "ask" };
    case "edit-auto":
      return { mode: "agent", permissionMode: "accept-edits" };
    case "plan":
      return { mode: "plan", permissionMode: "ask" };
    case "auto":
      return { mode: "agent", permissionMode: "auto" };
    case "bypass":
      return { mode: "agent", permissionMode: "bypass" };
    default:
      return { mode: "agent", permissionMode: "ask" };
  }
}

/** Normalize mode values at compatibility boundaries. Older persisted and
 * scheduled data used `chat`; it is now the Plan operating state. */
export function normalizeMode(value: unknown, fallback: Mode = "agent"): Mode {
  if (value === "agent") return "agent";
  if (value === "goal") return "goal";
  if (value === "plan" || value === "chat") return "plan";
  return fallback;
}
