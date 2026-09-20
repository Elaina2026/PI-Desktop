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
import { TooltipButton, Button, cx } from "../../components/ui";
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
import {
  AntigravityLogo,
  GitHubCopilotLogo,
  CursorLogo,
  OpenAILogo,
  AnthropicLogo,
  ClaudeLogo,
  GoogleGeminiLogo,
  GrokLogo,
  ClineLogo,
  CodeBuddyLogo,
  QodoLogo,
  KimiLogo,
  MoonshotLogo,
  XiaomiLogo,
  DeepSeekLogo,
  MistralLogo,
  PerplexityLogo,
  GroqLogo,
  OpenRouterLogo,
  ZhipuLogo,
  MiniMaxLogo,
  KiroLogo,
  renderVendorLogo,
} from "../../components/ProviderLogo";
export {
  AntigravityLogo,
  GitHubCopilotLogo,
  CursorLogo,
  OpenAILogo,
  AnthropicLogo,
  ClaudeLogo,
  GoogleGeminiLogo,
  GrokLogo,
  ClineLogo,
  CodeBuddyLogo,
  QodoLogo,
  KimiLogo,
  MoonshotLogo,
  XiaomiLogo,
  DeepSeekLogo,
  MistralLogo,
  PerplexityLogo,
  GroqLogo,
  OpenRouterLogo,
  ZhipuLogo,
  MiniMaxLogo,
  KiroLogo,
  renderVendorLogo,
};
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
    const list: AccountEntry[] = [];
    const seenProviderIds = new Set<string>();

    if (vendors) {
      for (const vendor of vendors) {
        const totalForVendor = vendor.accounts.length;
        vendor.accounts.forEach((account, index) => {
          seenProviderIds.add(account.providerId);
          list.push({
            vendor,
            account,
            ordinal: index + 1,
            totalForVendor,
          });
        });
      }
    }

    for (const provider of providers) {
      if (seenProviderIds.has(provider.id)) continue;
      if (!provider.hasSecret && provider.authKind !== "none") continue;

      const vendorObj: OAuthVendor = {
        vendorId: provider.vendorKey || provider.id,
        name: provider.name,
        isSubscription: false,
        accounts: [
          {
            providerId: provider.id,
            accountLabel: provider.defaultModelId || provider.baseUrl,
            connected: provider.enabled,
          },
        ],
      };
      list.push({
        vendor: vendorObj,
        account: vendorObj.accounts[0],
        ordinal: 1,
        totalForVendor: 1,
      });
    }

    return list;
  }, [vendors, providers]);

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
      showToast("Account removed", {
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
      showToast("Account updated", {
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
      <div className="quota-tracker-header">
        <div className="quota-tracker-header-info">
          <h2 className="quota-tracker-title">
            {t("settings.quotaTracker", "Quota Tracker")}
          </h2>
          <p className="quota-tracker-desc">
            {t(
              "settings.quotaTrackerDesc",
              "Real-time usage quotas, fractional consumption, and countdown reset timers for AI providers.",
            )}
          </p>
        </div>
        <div className="quota-tracker-actions">
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
        <div className="quota-account-empty">
          <IconKey size={32} className="quota-account-empty-icon" />
          <div className="quota-account-empty-title">{t("settings.vendorNoAccounts", "No accounts connected yet")}</div>
          <p className="quota-account-empty-desc">
            Connect Antigravity, Claude Code, GitHub Copilot, or OpenAI Codex to monitor live quotas.
          </p>
          <Button
            variant="primary"
            className="quota-account-empty-cta"
            onClick={() => setPicking(true)}
          >
            {t("settings.vendorAddAccount", "Add Account")}
          </Button>
        </div>
      ) : (
        <div className="quota-accounts-list">
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
            const isRefreshing = refreshingQuota === account.providerId;
            const isConfirmingDelete = confirmDeleteId === account.providerId;

            return (
              <div key={account.providerId} className="quota-account-card">
                <div className="quota-account-header">
                  <div className="quota-account-info">
                    {renderVendorLogo(vendor, 28)}
                    <div>
                      <div className="quota-account-name">
                        {vendor.name}
                      </div>
                      <div className="quota-account-email">
                        {accountEmail}
                      </div>
                    </div>
                  </div>

                  <div className="quota-account-actions">
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
                      tooltip={t("settings.editProvider")}
                      ariaLabel={t("settings.editProvider")}
                      onClick={() => setEditingAccount(entry)}
                    >
                      <IconPencil size={15} />
                    </TooltipButton>

                    {isConfirmingDelete ? (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <Button
                          variant="primary"
                          size="sm"
                          className="quota-delete-btn"
                          onClick={() => void handleDelete(account.providerId)}
                        >
                          {t("settings.delete")}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    ) : (
                      <TooltipButton
                        type="button"
                        className="icon-btn icon-btn-square quota-delete-icon-btn"
                        tooltip={t("settings.delete")}
                        ariaLabel={t("settings.delete")}
                        onClick={() => setConfirmDeleteId(account.providerId)}
                      >
                        <IconTrash size={15} />
                      </TooltipButton>
                    )}

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label="Toggle Provider Enabled"
                      className={cx("settings-toggle", isEnabled && "on")}
                      onClick={() => void handleToggleProvider(account.providerId, isEnabled)}
                    >
                      <span className="settings-toggle-thumb" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="quota-buckets-count">
                  {rawBuckets.length > 0
                    ? `${rawBuckets.length} quotas`
                    : quota
                      ? "1 quota"
                      : t("common.loading")}
                </div>

                {rawBuckets.length > 0 ? (
                  <div className="quota-buckets-list">
                    {rawBuckets.map((b) => {
                      const isHidden = hiddenBuckets.has(b.id);
                      const remPct = b.disabled ? 0 : Math.min(100, Math.max(0, b.remainingPercentage));
                      const isWarning = remPct > 15 && remPct <= 40;
                      const statusClass = b.disabled || remPct <= 15 ? "status-error" : isWarning ? "status-warning" : "status-success";

                      return (
                        <div
                          key={b.id}
                          className={cx("quota-bucket-row", statusClass, isHidden && "is-hidden")}
                        >
                          <div className="quota-status-dot" />
                          <div className="quota-bucket-name" title={b.name}>
                            {b.name}
                          </div>
                          <div className="quota-bucket-ratio">
                            {formatUsageRatio(remPct, b.disabled)}
                          </div>
                          <div className="quota-progress-track">
                            <div
                              className="quota-progress-fill"
                              style={{ width: `${remPct}%` }}
                            />
                          </div>
                          <div className="quota-bucket-pct">
                            {remPct}%
                          </div>
                          <div className="quota-bucket-reset">
                            {b.disabled
                              ? "disabled"
                              : b.resetInSeconds && b.resetInSeconds > 0
                                ? `in ${formatResetDuration(b.resetInSeconds)}`
                                : remPct >= 100
                                  ? "—"
                                  : remPct <= 0
                                    ? "exhausted"
                                    : "—"}
                          </div>
                          <button
                            type="button"
                            className={cx("quota-eye-btn", isHidden && "is-hidden")}
                            title={isHidden ? "Show quota" : "Hide quota"}
                            onClick={() => toggleBucketVisibility(b.id)}
                          >
                            {isHidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : quota ? (
                  <div className="quota-simple-row">
                    <div className="text-sm">
                      Quota Status:{" "}
                      <span
                        className={cx(
                          "quota-simple-status",
                          quota.status === "healthy"
                            ? "status-success"
                            : quota.status === "low"
                              ? "status-warning"
                              : "status-error",
                        )}
                      >
                        {quota.remainingPercentage !== undefined
                          ? `${quota.remainingPercentage}% remaining`
                          : quota.status}
                      </span>
                    </div>
                    {quota.resetInSeconds ? (
                      <span className="text-xs text-text-muted">
                        in {formatResetDuration(quota.resetInSeconds)}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="quota-loading-text">
                    {t("common.loading")}
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
