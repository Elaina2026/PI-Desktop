/**
 * Dedicated Quota Tracker page in Settings.
 * Displays real-time quota buckets, reset timers, and usage ratios for Antigravity
 * and all OAuth providers (matching Image 2 design).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  AccountQuotaInfo,
  OAuthAccount,
  OAuthVendor,
  ProviderPublic,
} from "@pi-desktop/shared";
import { useAppStore } from "../../stores/app-store";
import { api } from "../../lib/api";
import {
  beginOAuthLogin,
  type OAuthLoginSession,
} from "../../lib/oauth-login-session";
import { TooltipButton, Button } from "../../components/ui";
import {
  IconEye,
  IconEyeOff,
  IconKey,
  IconPencil,
  IconRefresh,
  IconTrash,
  IconBot,
  IconServer,
} from "../../components/icons";
import { OAuthLoginDialog } from "../../components/settings/OAuthLoginDialog";
import {
  VendorAccountDialog,
  type VendorAccountForm,
} from "../../components/settings/VendorAccountDialog";
import { VendorPickerDialog } from "../../components/settings/VendorPickerDialog";

type ActiveLogin = { vendor: OAuthVendor; session: OAuthLoginSession };

type AccountEntry = {
  vendor: OAuthVendor;
  account: OAuthAccount;
  ordinal: number;
  totalForVendor: number;
};

function formatResetDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "now";
  const weeks = Math.floor(totalSeconds / 604800);
  const remainderAfterWeeks = totalSeconds % 604800;
  const days = Math.floor(remainderAfterWeeks / 86400);
  const remainderAfterDays = remainderAfterWeeks % 86400;
  const hours = Math.floor(remainderAfterDays / 3600);
  const minutes = Math.floor((remainderAfterDays % 3600) / 60);

  if (weeks > 0) {
    return days > 0 ? `${weeks}w ${days}d` : `${weeks}w`;
  }
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${Math.max(1, minutes)}m`;
}

function formatUsageRatio(remainingPct: number, disabled?: boolean): string {
  if (disabled || remainingPct <= 0) return "1.000 / 1.000";
  if (remainingPct >= 100) return "0 / 1.000";
  const used = Math.round((100 - remainingPct) * 10);
  return `${used} / 1.000`;
}

export function AntigravityLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 6L6 42H16L24 24L32 42H42L24 6Z"
        fill="url(#antigravity_grad_quota)"
      />
      <defs>
        <linearGradient id="antigravity_grad_quota" x1="6" y1="42" x2="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="35%" stopColor="#EA4335" />
          <stop offset="70%" stopColor="#FBBC05" />
          <stop offset="100%" stopColor="#34A853" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function QuotaTrackerPage() {
  const { t } = useTranslation();
  const providers = useAppStore((s) => s.providers);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const showToast = useAppStore((s) => s.showToast);

  const [vendors, setVendors] = useState<OAuthVendor[] | null>(null);
  const [busyAccount, setBusyAccount] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [login, setLogin] = useState<ActiveLogin | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountEntry | null>(null);
  const [refreshingQuota, setRefreshingQuota] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Record<string, AccountQuotaInfo>>({});
  const [hiddenBuckets, setHiddenBuckets] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("pi_quota_hidden_buckets");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleBucketVisibility = (bucketId: string) => {
    setHiddenBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucketId)) next.delete(bucketId);
      else next.add(bucketId);
      try {
        localStorage.setItem("pi_quota_hidden_buckets", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const fetchQuota = useCallback(
    async (providerId: string, force = false) => {
      setRefreshingQuota(providerId);
      try {
        const quota = await api.getOauthAccountQuota(providerId, { force });
        setQuotas((prev) => ({ ...prev, [providerId]: quota }));
        if (force) {
          if (quota.error) {
            showToast(quota.error, { variant: "error" });
          } else {
            showToast(t("settings.quotaRefreshed", "Quota updated"), {
              variant: "success",
            });
          }
        }
      } catch (e) {
        if (force) {
          showToast(e instanceof Error ? e.message : String(e), {
            variant: "error",
          });
        }
      } finally {
        setRefreshingQuota(null);
      }
    },
    [showToast, t],
  );

  const loadVendors = useCallback(async () => {
    try {
      const result = await api.listOauthVendors();
      setVendors(result.vendors);
    } catch {
      setVendors([]);
    }
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  useEffect(() => () => login?.session.dispose(), [login]);

  const accounts = useMemo<AccountEntry[]>(() => {
    if (!vendors) return [];
    return vendors.flatMap((vendor) => {
      const totalForVendor = vendor.accounts.length;
      return vendor.accounts.map((account, index) => ({
        vendor,
        account,
        ordinal: index + 1,
        totalForVendor,
      }));
    });
  }, [vendors]);

  useEffect(() => {
    for (const entry of accounts) {
      if (entry.account.connected) {
        void fetchQuota(entry.account.providerId, false);
      }
    }
  }, [accounts, fetchQuota]);

  // Periodic quota refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      for (const entry of accounts) {
        if (entry.account.connected) {
          void fetchQuota(entry.account.providerId, false);
        }
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [accounts, fetchQuota]);

  const handlePickVendor = (vendor: OAuthVendor) => {
    setPicking(false);
    const session = beginOAuthLogin({ api, vendorId: vendor.vendorId });
    setLogin({ vendor, session });
  };

  const handleToggleProvider = async (providerId: string, currentEnabled: boolean) => {
    try {
      await api.updateProvider({ id: providerId, enabled: !currentEnabled });
      await refreshProviders();
      showToast(
        currentEnabled
          ? t("settings.providerDisabled", "Provider disabled")
          : t("settings.providerEnabled", "Provider enabled"),
        { variant: "success" },
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    }
  };

  const handleDelete = async (providerId: string) => {
    setBusyAccount(providerId);
    try {
      await api.deleteOauthAccount(providerId);
      await refreshProviders();
      await loadVendors();
      setQuotas((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      showToast(t("settings.vendorRemoved", "Account removed"), {
        variant: "success",
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    } finally {
      setBusyAccount(null);
      setConfirmDeleteId(null);
    }
  };

  const handleSaveEdit = async (form: VendorAccountForm) => {
    if (!editingAccount) return;
    const providerId = editingAccount.account.providerId;
    setBusyAccount(providerId);
    try {
      await api.updateProvider({
        id: providerId,
        defaultModelId: form.modelId,
        oauthAccountLabel: form.name,
      });
      await refreshProviders();
      await loadVendors();
      setEditingAccount(null);
      showToast(t("settings.vendorUpdated", "Account updated"), {
        variant: "success",
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { variant: "error" });
    } finally {
      setBusyAccount(null);
    }
  };

  const refreshAll = () => {
    for (const entry of accounts) {
      if (entry.account.connected) {
        void fetchQuota(entry.account.providerId, true);
      }
    }
  };

  return (
    <div className="settings-stack quota-tracker-page">
      <div className="provider-section-head" style={{ marginBottom: "var(--spacing-md, 16px)" }}>
        <div>
          <h2 className="settings-card-heading" style={{ fontSize: "var(--text-lg)" }}>
            {t("settings.quotaTracker", "Quota Tracker")}
          </h2>
          <p className="text-sm text-text-muted" style={{ marginTop: "4px" }}>
            {t(
              "settings.quotaTrackerDesc",
              "Real-time usage quotas, fractional consumption, and countdown reset timers for AI providers.",
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Button variant="secondary" onClick={refreshAll} disabled={accounts.length === 0}>
            <IconRefresh size={14} />
            <span>{t("settings.refreshAll", "Refresh All")}</span>
          </Button>
          <Button variant="primary" onClick={() => setPicking(true)}>
            <IconKey size={14} />
            <span>{t("settings.vendorAddAccount", "Add Account")}</span>
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="vendor-account-empty" style={{ padding: "var(--spacing-xl, 32px)", textAlign: "center" }}>
          <IconKey size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <div className="font-medium">{t("settings.vendorNoAccounts", "No accounts connected yet")}</div>
          <p className="text-sm text-text-muted" style={{ marginTop: "6px" }}>
            {t(
              "settings.quotaNoAccountsDesc",
              "Connect Antigravity, Claude Code, GitHub Copilot, or OpenAI Codex to monitor live quotas.",
            )}
          </p>
          <Button
            variant="primary"
            style={{ marginTop: "16px" }}
            onClick={() => setPicking(true)}
          >
            {t("settings.vendorAddAccount", "Add Account")}
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {accounts.map((entry) => {
            const { vendor, account } = entry;
            const provider = providers.find((c) => c.id === account.providerId);
            const isEnabled = provider?.enabled ?? true;
            const accountEmail =
              account.accountLabel ||
              provider?.oauthAccountLabel ||
              t("settings.vendorSignedInGeneric", "Signed in");
            const quota = quotas[account.providerId];
            const rawBuckets = quota?.buckets ?? [];
            const visibleBuckets = rawBuckets.filter((b) => !hiddenBuckets.has(b.id));
            const isAntigravity =
              vendor.vendorId.toLowerCase().includes("antigravity") ||
              vendor.name.toLowerCase().includes("antigravity");
            const isRefreshing = refreshingQuota === account.providerId;
            const isConfirmingDelete = confirmDeleteId === account.providerId;

            return (
              <div
                key={account.providerId}
                className="settings-card-block"
                style={{
                  padding: "16px 20px",
                  borderRadius: "var(--radius-lg, 12px)",
                  background: "var(--ds-bg-secondary, #212121)",
                  border: "1px solid var(--ds-border-subtle, rgba(255, 255, 255, 0.08))",
                  boxShadow: "var(--ds-shadow-dialog)",
                }}
              >
                {/* Card Header matching Image 2 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: "12px",
                    borderBottom: "1px solid var(--ds-border-subtle, rgba(255, 255, 255, 0.08))",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {isAntigravity ? (
                      <AntigravityLogo size={28} />
                    ) : (
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "var(--radius-md, 6px)",
                          background: "var(--ds-tile-hover)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconBot size={18} />
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold, 600)" }}>
                        {vendor.name}
                      </div>
                      <div className="text-xs text-text-muted" style={{ marginTop: "1px" }}>
                        {accountEmail}
                      </div>
                    </div>
                  </div>

                  {/* Actions right */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TooltipButton
                      type="button"
                      className="icon-btn icon-btn-square"
                      tooltip={t("common.refresh", "Refresh")}
                      ariaLabel={t("common.refresh", "Refresh")}
                      disabled={isRefreshing}
                      onClick={() => void fetchQuota(account.providerId, true)}
                    >
                      <IconRefresh
                        size={15}
                        className={isRefreshing ? "spin" : undefined}
                      />
                    </TooltipButton>

                    <TooltipButton
                      type="button"
                      className="icon-btn icon-btn-square"
                      tooltip={t("common.edit", "Edit")}
                      ariaLabel={t("common.edit", "Edit")}
                      onClick={() => setEditingAccount(entry)}
                    >
                      <IconPencil size={15} />
                    </TooltipButton>

                    {isConfirmingDelete ? (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <Button
                          variant="primary"
                          size="sm"
                          style={{ background: "#ef4444", borderColor: "#ef4444" }}
                          onClick={() => void handleDelete(account.providerId)}
                        >
                          {t("common.confirm", "Confirm")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t("common.cancel", "Cancel")}
                        </Button>
                      </div>
                    ) : (
                      <TooltipButton
                        type="button"
                        className="icon-btn icon-btn-square"
                        style={{ color: "#ef4444" }}
                        tooltip={t("common.delete", "Delete")}
                        ariaLabel={t("common.delete", "Delete")}
                        onClick={() => setConfirmDeleteId(account.providerId)}
                      >
                        <IconTrash size={15} />
                      </TooltipButton>
                    )}

                    {/* Enable/Disable Switch with orange active track matching Image 2 */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label="Toggle Provider Enabled"
                      style={{
                        width: "36px",
                        height: "20px",
                        borderRadius: "10px",
                        background: isEnabled ? "#f97316" : "rgba(255, 255, 255, 0.15)",
                        border: 0,
                        padding: "2px",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s ease",
                        marginLeft: "4px",
                      }}
                      onClick={() => void handleToggleProvider(account.providerId, isEnabled)}
                    >
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "#ffffff",
                          transform: isEnabled ? "translateX(16px)" : "translateX(0)",
                          transition: "transform 0.2s ease",
                        }}
                      />
                    </button>
                  </div>
                </div>

                {/* Subheader: Quotas count */}
                <div
                  className="text-xs text-text-muted"
                  style={{ marginTop: "12px", marginBottom: "8px", fontWeight: "var(--font-weight-medium, 500)" }}
                >
                  {rawBuckets.length > 0
                    ? `${rawBuckets.length} quotas`
                    : quota
                      ? t("settings.quotaSingle", "1 quota")
                      : t("settings.quotaLoading", "Loading quotas...")}
                </div>

                {/* Buckets list matching Image 2 */}
                {rawBuckets.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {rawBuckets.map((b) => {
                      const isHidden = hiddenBuckets.has(b.id);
                      const remPct = b.disabled ? 0 : Math.min(100, Math.max(0, b.remainingPercentage));
                      const isHealthy = remPct > 40;
                      const isWarning = remPct > 15 && remPct <= 40;
                      const dotColor = b.disabled || remPct <= 15 ? "#ef4444" : isWarning ? "#f59e0b" : "#22c55e";
                      const progressColor = dotColor;

                      return (
                        <div
                          key={b.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "14px 180px 90px 1fr 45px 110px 24px",
                            alignItems: "center",
                            gap: "12px",
                            padding: "6px 0",
                            opacity: isHidden ? 0.4 : 1,
                            transition: "opacity 0.2s ease",
                          }}
                        >
                          {/* Dot indicator */}
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: dotColor,
                              boxShadow: `0 0 6px ${dotColor}66`,
                            }}
                          />

                          {/* Bucket name */}
                          <div
                            style={{
                              fontSize: "var(--text-xs)",
                              fontWeight: "var(--font-weight-medium, 500)",
                              color: "var(--ds-text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={b.name}
                          >
                            {b.name}
                          </div>

                          {/* Usage fraction e.g. "0 / 1.000" */}
                          <div
                            style={{
                              fontSize: "11px",
                              fontFamily: "var(--font-mono)",
                              color: "var(--ds-text-muted)",
                            }}
                          >
                            {formatUsageRatio(remPct, b.disabled)}
                          </div>

                          {/* Horizontal progress bar line */}
                          <div
                            style={{
                              height: "3px",
                              width: "100%",
                              backgroundColor: "rgba(255, 255, 255, 0.08)",
                              borderRadius: "2px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${remPct}%`,
                                backgroundColor: progressColor,
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>

                          {/* Percentage text */}
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: "var(--font-weight-medium, 500)",
                              color: dotColor,
                              textAlign: "right",
                            }}
                          >
                            {remPct}%
                          </div>

                          {/* Countdown timer e.g. "in 7h 51m" */}
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--ds-text-muted)",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {b.resetInSeconds && !b.disabled ? `in ${formatResetDuration(b.resetInSeconds)}` : ""}
                          </div>

                          {/* Eye toggle button */}
                          <button
                            type="button"
                            className="icon-btn"
                            style={{
                              background: "none",
                              border: 0,
                              cursor: "pointer",
                              padding: "2px",
                              color: isHidden ? "var(--ds-text-faint)" : "var(--ds-text-muted)",
                            }}
                            title={isHidden ? t("settings.showQuota", "Show quota") : t("settings.hideQuota", "Hide quota")}
                            onClick={() => toggleBucketVisibility(b.id)}
                          >
                            {isHidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : quota ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 0",
                    }}
                  >
                    <div className="text-sm">
                      Quota Status:{" "}
                      <strong
                        style={{
                          color:
                            quota.status === "healthy"
                              ? "#22c55e"
                              : quota.status === "low"
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      >
                        {quota.remainingPercentage !== undefined
                          ? `${quota.remainingPercentage}% remaining`
                          : quota.status}
                      </strong>
                    </div>
                    {quota.resetInSeconds ? (
                      <span className="text-xs text-text-muted">
                        in {formatResetDuration(quota.resetInSeconds)}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xs text-text-muted" style={{ padding: "8px 0" }}>
                    {t("settings.quotaLoading", "Connecting to quota service...")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {picking && vendors && (
        <VendorPickerDialog
          vendors={vendors}
          onPick={handlePickVendor}
          onClose={() => setPicking(false)}
        />
      )}

      {login && (
        <OAuthLoginDialog
          vendor={login.vendor}
          session={login.session}
          onDone={async (accountLabel) => {
            setLogin(null);
            await refreshProviders();
            await loadVendors();
            showToast(
              accountLabel
                ? t("settings.vendorSignedInAs", { account: accountLabel })
                : t("settings.vendorSignedIn", { vendor: login.vendor.name }),
              { variant: "success" },
            );
          }}
          onClose={() => setLogin(null)}
        />
      )}

      {editingAccount && (() => {
        const editProvider = providers.find((c) => c.id === editingAccount.account.providerId);
        return editProvider ? (
          <VendorAccountDialog
            provider={editProvider}
            initialName={
              editingAccount.account.accountLabel ||
              editProvider.oauthAccountLabel ||
              editProvider.name
            }
            saving={busyAccount === editingAccount.account.providerId}
            onSave={handleSaveEdit}
            onClose={() => setEditingAccount(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
