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
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="antigravity_flow_grad" x1="6" y1="26" x2="26" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF7A00" />
          <stop offset="35%" stopColor="#FF007A" />
          <stop offset="70%" stopColor="#7928CA" />
          <stop offset="100%" stopColor="#0070F3" />
        </linearGradient>
      </defs>
      <path
        d="M 8 24.5 C 8 15, 12 7.5, 16 7.5 C 20 7.5, 24 15, 24 24.5"
        stroke="url(#antigravity_flow_grad)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GitHubCopilotLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z" />
    </svg>
  );
}

export function CursorLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 467 533" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M457.43 125.94L244.42 2.96c-6.84-3.95-15.28-3.95-22.12 0L9.3 125.94c-5.75 3.32-9.3 9.46-9.3 16.11v247.99c0 6.65 3.55 12.79 9.3 16.11l213.01 122.98c6.84 3.95 15.28 3.95 22.12 0l213.01-122.98c5.75-3.32 9.3-9.46 9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11ZM444.05 151.99l-205.63 356.16c-1.39 2.4-5.06 1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87 145.67c-2.4-1.39-1.42-5.06 1.36-5.06h411.26c5.84 0 9.49 6.33 6.57 11.39Z" fill="currentColor"/>
    </svg>
  );
}

export function OpenAILogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 611 611" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M252.794 108.802C289.191 99.0484 326.265 110.305 351.148 135.135C385.113 126.072 422.85 134.862 449.492 161.505C476.136 188.149 484.925 225.888 475.862 259.85V259.854C500.696 284.735 511.95 321.81 502.198 358.207C492.447 394.602 464.161 421.084 430.215 430.217C421.083 464.162 394.603 492.448 358.206 502.199C321.812 511.951 284.734 500.693 259.852 475.864C225.887 484.927 188.15 476.137 161.507 449.495C134.864 422.851 126.073 385.111 135.136 351.149C110.304 326.266 99.0496 289.192 108.801 252.795C118.552 216.4 146.84 189.918 180.784 180.785C189.917 146.841 216.396 118.553 252.794 108.802ZM374.292 407.145C374.292 411.271 372.092 415.086 368.517 417.148L283.723 466.102C302.487 480.585 327.555 486.459 352.217 479.852C386.997 470.532 410.068 439.312 410.555 405.006V317.717C410.555 315.08 409.125 312.621 406.843 311.303L374.292 292.509V407.145ZM251.868 415.897C248.296 417.959 243.893 417.959 240.317 415.897L155.526 366.942C152.366 390.436 159.811 415.08 177.866 433.136H177.863C203.325 458.594 241.896 462.962 271.85 446.232L347.449 402.586C349.735 401.268 351.148 398.8 351.148 396.163V358.579L251.868 415.897ZM368.602 220.628C366.319 219.309 363.474 219.318 361.191 220.637L328.641 239.431L427.921 296.749C431.496 298.811 433.697 302.627 433.697 306.752V404.661C455.622 395.654 473.244 376.881 479.851 352.218C489.169 317.442 473.668 281.85 444.201 264.274L368.602 220.628ZM177.303 206.34C155.377 215.348 137.756 234.122 131.148 258.783C121.832 293.561 137.331 329.153 166.799 346.727L242.398 390.373C244.68 391.692 247.525 391.684 249.807 390.366L282.357 371.572L183.078 314.253C179.504 312.189 177.303 308.375 177.303 304.251V206.34ZM259.849 279.145V331.858L305.5 358.213L351.15 331.858V279.145L305.5 252.789L259.849 279.145ZM327.276 144.9C308.512 130.418 283.445 124.543 258.782 131.15C224.002 140.471 200.931 171.691 200.445 205.995V293.286C200.445 295.923 201.875 298.381 204.158 299.7L236.707 318.493V203.856C236.707 199.731 238.909 195.916 242.483 193.853L327.276 144.9ZM433.137 177.867C407.675 152.407 369.103 148.038 339.149 164.769L263.55 208.415C261.265 209.734 259.852 212.202 259.852 214.838V252.423L359.132 195.105C362.703 193.041 367.108 193.041 370.682 195.105L455.473 244.06C458.635 220.567 451.189 195.922 433.135 177.867H433.137Z"/>
    </svg>
  );
}

export function AnthropicLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
    </svg>
  );
}

export function GoogleGeminiLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gemini_logo_grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="35%" stopColor="#9B72CB" />
          <stop offset="70%" stopColor="#D96570" />
          <stop offset="100%" stopColor="#F48847" />
        </linearGradient>
      </defs>
      <path
        d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
        fill="url(#gemini_logo_grad)"
      />
    </svg>
  );
}

export function GrokLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M395.479 633.828L735.91 381.105C752.599 368.715 776.454 373.548 784.406 392.792C826.26 494.285 807.561 616.253 724.288 699.996C641.016 783.739 525.151 802.104 419.247 760.277L303.556 814.143C469.49 928.202 670.987 899.995 796.901 773.282C896.776 672.843 927.708 535.937 898.785 412.476L899.047 412.739C857.105 231.37 909.358 158.874 1016.4 10.6326C1018.93 7.11771 1021.47 3.60279 1024 0L883.144 141.651V141.212L395.392 633.916"/>
      <path d="M325.226 695.251C206.128 580.84 226.662 403.776 328.285 301.668C403.431 226.097 526.549 195.254 634.026 240.596L749.454 186.994C728.657 171.88 702.007 155.623 671.424 144.2C533.19 86.9942 367.693 115.465 255.323 228.382C147.234 337.081 113.244 504.215 171.613 646.833C215.216 753.423 143.739 828.818 71.7385 904.916C46.2237 931.893 20.6216 958.87 0 987.429L325.139 695.339"/>
    </svg>
  );
}

export function renderVendorLogo(vendor: OAuthVendor, size = 28) {
  const vid = vendor.vendorId.toLowerCase();
  if (vid.includes("antigravity")) return <AntigravityLogo size={size} />;
  if (vid.includes("copilot") || vid.includes("github")) return <GitHubCopilotLogo size={size} />;
  if (vid.includes("cursor")) return <CursorLogo size={size} />;
  if (vid.includes("openai") || vid.includes("codex") || vid.includes("chatgpt")) return <OpenAILogo size={size} />;
  if (vid.includes("anthropic") || vid.includes("claude")) return <AnthropicLogo size={size} />;
  if (vid.includes("google") || vid.includes("gemini")) return <GoogleGeminiLogo size={size} />;
  if (vid.includes("grok") || vid.includes("xai")) return <GrokLogo size={size} />;
  return (
    <div
      className="quota-fallback-avatar"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {vendor.name ? vendor.name[0]?.toUpperCase() : <IconBot size={Math.round(size * 0.65)} />}
    </div>
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
                            {b.resetInSeconds && !b.disabled ? `in ${formatResetDuration(b.resetInSeconds)}` : ""}
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
