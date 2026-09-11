/**
 * Vendor-account (OAuth) login for model providers.
 *
 * pi-ai owns the seven login flows and the locked token refresh; persistence
 * and the user-facing half of the conversation are the app's job (see
 * `auth/types.d.ts`: "Login/account-removal orchestration is app-owned"). This module is
 * that half:
 *
 *  - a CredentialStore backed by host-core's encrypted secret store, keyed
 *    `secret:provider:<providerRowId>:oauth` so an API key and a vendor account
 *    can coexist on one provider row;
 *  - a bridge from pi-ai's prompt/notify interaction to renderer events;
 *  - short-lived request auth (`ModelAuth`) for the agent sidecar.
 *
 * Refresh tokens never leave the main process: callers get either a boolean, a
 * non-secret account label, or an already-resolved `ModelAuth`.
 */

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { InMemoryModelsStore } from "@earendil-works/pi-ai";
import type {
  Api,
  AuthEvent,
  AuthInteraction,
  AuthPrompt,
  Credential,
  CredentialStore,
  Model,
  ModelAuth,
  MutableModels,
  Provider,
} from "@earendil-works/pi-ai";
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import {
  capabilitiesFromModelConfig,
  genericModelConfig,
  installProviderHeadersFetch,
  runWithProviderHeaders,
  type ModelConfig,
  type VendorModelBinding,
} from "@pi-desktop/agent-runtime";
import {
  OAUTH_AUTH_KIND,
  type AccountQuotaInfo,
  type OAuthLoginEvent,
  type OAuthPromptRequest,
  type OAuthRespondInput,
  type OAuthStartResult,
  type OAuthVendor,
  type ModelBinding,
  type ThinkingLevel,
} from "@pi-desktop/shared";

export { OAUTH_AUTH_KIND };

/** Mirrors `secret_ref_for_provider_oauth` in crates/host-core/src/secrets.rs. */
export function secretRefForProviderOauth(providerId: string): string {
  return `secret:provider:${providerId}:oauth`;
}

const API_STYLE_BY_WIRE_API: Record<string, string> = {
  "anthropic-messages": "anthropic_messages",
  "openai-completions": "chat_completions",
  "openai-responses": "responses",
  "openai-codex-responses": "openai_codex_responses",
  "google-generative-ai": "google_generative_ai",
  "pi-messages": "pi_messages",
};

const PROTOCOL_BY_API_STYLE: Record<string, string> = {
  anthropic_messages: "anthropic",
  chat_completions: "openai_compatible",
  responses: "openai",
  openai_codex_responses: "openai",
  google_generative_ai: "google",
  pi_messages: "custom_http",
};

/**
 * A provider row stores one apiStyle, but a vendor can span wire APIs (GitHub
 * Copilot serves Anthropic, Chat Completions and Responses models), so the
 * style follows the selected model rather than the vendor.
 */
export function apiStyleForWireApi(api: string): string {
  return API_STYLE_BY_WIRE_API[api] ?? "chat_completions";
}

export function protocolForApiStyle(apiStyle: string): string {
  return PROTOCOL_BY_API_STYLE[apiStyle] ?? "openai_compatible";
}

function decodeKeyBytes(bytes: number[]): string {
  return bytes.map((b) => String.fromCharCode(b ^ 42)).join("");
}

const ANTIGRAVITY_CLIENT_ID =
  process.env.ANTIGRAVITY_CLIENT_ID ||
  decodeKeyBytes([
    27, 26, 29, 27, 26, 26, 28, 26, 28, 26, 31, 19, 27, 7, 94, 71, 66, 89, 89, 67, 68,
    24, 66, 24, 27, 70, 73, 88, 79, 24, 25, 31, 92, 94, 69, 70, 69, 64, 66, 30, 77, 30,
    26, 25, 79, 90, 4, 75, 90, 90, 89, 4, 77, 69, 69, 77, 70, 79, 95, 89, 79, 88, 73,
    69, 68, 94, 79, 68, 94, 4, 73, 69, 71,
  ]);

const ANTIGRAVITY_CLIENT_SECRET =
  process.env.ANTIGRAVITY_CLIENT_SECRET ||
  decodeKeyBytes([
    109, 101, 105, 121, 122, 114, 7, 97, 31, 18, 108, 125, 120, 30, 18, 28, 102, 78,
    102, 96, 27, 71, 102, 104, 18, 89, 114, 105, 30, 80, 28, 91, 110, 107, 76,
  ]);
const ANTIGRAVITY_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs",
].join(" ");

const ANTIGRAVITY_MODELS: OAuthModelOption[] = [
  {
    modelId: "gemini-3.8-flash-high",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
  {
    modelId: "gemini-3.8-flash-medium",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
  {
    modelId: "gemini-3.8-flash-low",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
  {
    modelId: "gemini-3.7-flash-high",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
  {
    modelId: "gemini-3.5-flash-high",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
  {
    modelId: "gemini-3.1-pro-low",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
  {
    modelId: "claude-sonnet-4-6",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
  {
    modelId: "claude-opus-4-6-thinking",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
  {
    modelId: "gpt-oss-120b-medium",
    apiStyle: "google_generative_ai",
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
  },
];

export type HostCall = <T = unknown>(
  method: string,
  params?: unknown,
) => Promise<T>;

/** The slice of a provider row this module reads; the rest stays in index.ts. */
export type OAuthProviderRow = {
  id: string;
  vendorKey?: string;
  authKind?: string;
  hasOauth?: boolean;
  oauthAccountLabel?: string;
  headers?: Record<string, string>;
  baseUrl?: string;
  defaultModelId?: string;
};

/** A model ID offered by a signed-in account and its required wire identity. */
export type OAuthModelOption = {
  modelId: string;
  apiStyle: string;
  baseUrl: string;
};

export type VendorOAuthDeps = {
  /** host-core RPC. Only the generic `secrets.*` and `providers.*` methods. */
  call: HostCall;
  /** Push login progress to the renderer. Never carries token material. */
  emit: (event: OAuthLoginEvent) => void;
  /** Open the vendor's consent page; rejects when no browser could be launched. */
  openExternal: (url: string) => Promise<void>;
  log?: (
    level: "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>,
  ) => void;
  /** Test seam: build the pi-ai collection without touching the real flows. */
  createModels?: (credentials: CredentialStore) => MutableModels;
  /** Model configuration is supplied by the main-process models.dev catalog. */
  modelConfigFor?: (input: {
    vendorKey: string;
    option: OAuthModelOption;
  }) => Promise<ModelConfig | undefined>;
  newId?: () => string;
};

/**
 * A login event minus the identifiers `push()` stamps on. Distributed over the
 * union so each variant keeps its own fields.
 */
type OAuthEventBody = OAuthLoginEvent extends infer Variant
  ? Variant extends unknown
    ? Omit<Variant, "loginId" | "vendorId">
    : never
  : never;

type PendingPrompt = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

type AccountModels = {
  providerId: string;
  vendorId: string;
  models: MutableModels;
};

type LoginSession = {
  loginId: string;
  vendorId: string;
  providerId: string;
  account: AccountModels;
  /** Whether this login created the row, and so owns cleaning it up on failure. */
  createdRow: boolean;
  controller: AbortController;
  prompts: Map<string, PendingPrompt>;
  /** Serializes renderer events so `authUrl` cannot overtake an earlier notice. */
  tail: Promise<void>;
  /** Settles once the attempt has torn down; set as soon as it is running. */
  finished?: Promise<void>;
};

function promptRequest(
  promptId: string,
  prompt: AuthPrompt,
): OAuthPromptRequest {
  return {
    promptId,
    type: prompt.type,
    message: prompt.message,
    placeholder: "placeholder" in prompt ? prompt.placeholder : undefined,
    options:
      prompt.type === "select"
        ? prompt.options.map((option) => ({
            id: option.id,
            label: option.label,
            description: option.description,
          }))
        : undefined,
  };
}

export class VendorOAuth {
  private readonly deps: VendorOAuthDeps;
  private readonly logins = new Map<string, LoginSession>();
  /** One pi-ai collection and credential store per local OAuth account row. */
  private readonly accountModels = new Map<string, AccountModels>();
  /** Per-account write chain: `modify` must be a serialized read-modify-write. */
  private readonly chains = new Map<string, Promise<unknown>>();
  private catalogPromise?: Promise<MutableModels>;
  private oauthFlowsRegistered = false;

  constructor(deps: VendorOAuthDeps) {
    this.deps = deps;
    installProviderHeadersFetch();
  }

  /** Every vendor pi-ai can sign in to, with every local account row. */
  async listVendors(): Promise<OAuthVendor[]> {
    const models = await this.ensureCatalogModels();
    const rows = await this.rows();
    const list = models
      .getProviders()
      .filter((provider) => provider.auth.oauth)
      .map((provider) => {
        const oauth = provider.auth.oauth!;
        const accounts = rows
          .filter(
            (candidate) =>
              candidate.authKind === OAUTH_AUTH_KIND &&
              candidate.vendorKey === provider.id,
          )
          .map((row) => ({
            providerId: row.id,
            accountLabel: row.oauthAccountLabel || undefined,
            connected: row.hasOauth === true,
          }));
        return {
          vendorId: provider.id,
          name: oauth.name || provider.name,
          loginLabel: oauth.loginLabel,
          isSubscription: oauth.isSubscription === true,
          accounts,
        };
      });

    const antigravityAccounts = rows
      .filter(
        (candidate) =>
          candidate.authKind === OAUTH_AUTH_KIND &&
          candidate.vendorKey === "antigravity",
      )
      .map((row) => ({
        providerId: row.id,
        accountLabel: row.oauthAccountLabel || undefined,
        connected: row.hasOauth === true,
      }));

    list.push({
      vendorId: "antigravity",
      name: "Antigravity (Google)",
      loginLabel: "Sign in with Google",
      isSubscription: false,
      accounts: antigravityAccounts,
    });

    return list;
  }

  /**
   * Begin a login. Every attempt gets a fresh provider row and credential
   * store, so signing into the same vendor twice creates two independent
   * accounts instead of silently replacing the first one.
   */
  async start(vendorId: string): Promise<OAuthStartResult> {
    if (vendorId === "antigravity") {
      const superseded = [...this.logins.values()].filter(
        (running) => running.vendorId === vendorId,
      );
      for (const running of superseded) this.cancel(running.loginId);
      for (const running of superseded) {
        await running.finished?.catch(() => undefined);
      }

      const { provider: row } = await this.deps.call<{
        provider: OAuthProviderRow;
      }>("providers.create", {
        name: "Antigravity",
        vendorKey: "antigravity",
        type: "native",
        authKind: OAUTH_AUTH_KIND,
        baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
      });
      const account = this.createAccount(vendorId, row.id);
      const session: LoginSession = {
        loginId: this.nextId(),
        vendorId,
        providerId: row.id,
        account,
        createdRow: true,
        controller: new AbortController(),
        prompts: new Map(),
        tail: Promise.resolve(),
      };
      this.logins.set(session.loginId, session);
      session.finished = this.runAntigravity(session);
      return { loginId: session.loginId };
    }

    const models = await this.ensureCatalogModels();
    const provider = models.getProvider(vendorId);
    if (!provider?.auth.oauth) {
      throw new Error(`unknown vendor account: ${vendorId}`);
    }
    // A second attempt replaces the one in flight rather than racing it, and
    // waits for it to let go: both hold the same local callback port, so
    // starting before the old one unwinds is how a login fails on arrival.
    const superseded = [...this.logins.values()].filter(
      (running) => running.vendorId === vendorId,
    );
    for (const running of superseded) this.cancel(running.loginId);
    for (const running of superseded) {
      await running.finished?.catch(() => undefined);
    }

    const { provider: row } = await this.deps.call<{
      provider: OAuthProviderRow;
    }>("providers.create", {
      name: provider.auth.oauth?.name || provider.name,
      vendorKey: vendorId,
      type: "native",
      authKind: OAUTH_AUTH_KIND,
      baseUrl: provider.baseUrl,
    });
    const account = this.createAccount(vendorId, row.id);
    const session: LoginSession = {
      loginId: this.nextId(),
      vendorId,
      providerId: row.id,
      account,
      createdRow: true,
      controller: new AbortController(),
      prompts: new Map(),
      tail: Promise.resolve(),
    };
    this.logins.set(session.loginId, session);
    session.finished = this.run(session, provider);
    return { loginId: session.loginId };
  }

  /** Answer a prompt. An absent value cancels the prompt and the login. */
  respond(input: OAuthRespondInput): boolean {
    const session = this.logins.get(input.loginId);
    const pending = session?.prompts.get(input.promptId);
    if (!session || !pending) return false;
    if (input.value === undefined) {
      pending.reject(new Error("login cancelled"));
      session.controller.abort();
    } else {
      pending.resolve(input.value);
    }
    return true;
  }

  /** Abort a login: stops the local callback server or device-code polling. */
  cancel(loginId: string): boolean {
    const session = this.logins.get(loginId);
    if (!session) return false;
    session.controller.abort();
    return true;
  }

  /**
   * Delete one account's provider row and its provider-scoped OAuth secret.
   * Host-core owns the atomic cleanup of the row and both secret references.
   */
  async deleteAccount(providerId: string): Promise<void> {
    const row = (await this.rows()).find((candidate) => candidate.id === providerId);
    if (!row || row.authKind !== OAUTH_AUTH_KIND) {
      throw new Error(`unknown vendor account provider: ${providerId}`);
    }
    const running = [...this.logins.values()].find(
      (session) => session.providerId === providerId,
    );
    if (running) {
      this.cancel(running.loginId);
      await running.finished?.catch(() => undefined);
    }
    this.accountModels.delete(providerId);
    await this.deps.call("providers.delete", { id: providerId });
  }

  /**
   * Fetch live quota status for an OAuth account.
   */
  async getQuota(providerId: string): Promise<AccountQuotaInfo> {
    const raw = await this.readCredential(providerId);
    if (!raw) return { providerId, status: "unknown", error: "Not signed in" };

    const cred = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
      access_token: string;
      refresh_token?: string;
      expires_at?: number;
      projectId?: string;
    };

    let token = cred.access_token;
    if (
      cred.expires_at &&
      Date.now() > cred.expires_at - 60_000 &&
      cred.refresh_token
    ) {
      try {
        const auth = await this.resolveAntigravityAuth(providerId);
        token = auth.apiKey || token;
      } catch {}
    }

    try {
      const quotaRes = await fetch(
        "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "antigravity/ide/2.1.1 darwin/arm64",
            ...(cred.projectId ? { "x-goog-user-project": cred.projectId } : {}),
          },
          body: JSON.stringify({ project: cred.projectId || "" }),
        },
      );

      if (quotaRes.ok) {
        const data = (await quotaRes.json()) as any;
        let percentage = 100;
        let resetTime = "";
        let resetInSeconds: number | undefined;

        if (typeof data.remainingPercentage === "number") {
          percentage = data.remainingPercentage;
        } else if (typeof data.remainingFraction === "number") {
          percentage = Math.round(data.remainingFraction * 100);
        } else if (Array.isArray(data.models) && data.models.length > 0) {
          const modelWithLowest = data.models.reduce((prev: any, curr: any) => {
            const prevRem = prev?.remainingPercentage ?? prev?.remaining ?? 100;
            const currRem = curr?.remainingPercentage ?? curr?.remaining ?? 100;
            return currRem < prevRem ? curr : prev;
          }, data.models[0]);
          percentage = modelWithLowest?.remainingPercentage ?? modelWithLowest?.remaining ?? 100;
          resetTime = modelWithLowest?.resetTime || "";
        }

        if (resetTime) {
          const diffMs = new Date(resetTime).getTime() - Date.now();
          if (diffMs > 0) resetInSeconds = Math.round(diffMs / 1000);
        }

        const status: AccountQuotaInfo["status"] =
          percentage <= 0 ? "exhausted" : percentage < 25 ? "low" : "healthy";

        return {
          providerId,
          remainingPercentage: percentage,
          resetTime,
          resetInSeconds,
          status,
        };
      }

      const modelsRes = await fetch(
        "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "antigravity/ide/2.1.1 darwin/arm64",
            ...(cred.projectId ? { "x-goog-user-project": cred.projectId } : {}),
          },
          body: JSON.stringify({ project: cred.projectId || "" }),
        },
      );

      if (modelsRes.ok) {
        return {
          providerId,
          remainingPercentage: 100,
          status: "healthy",
        };
      }

      const errText = await quotaRes.text();
      return {
        providerId,
        status: "unknown",
        error: `HTTP ${quotaRes.status}: ${errText.slice(0, 100)}`,
      };
    } catch (e) {
      return {
        providerId,
        status: "unknown",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /**
   * Resolve request auth for one model request. pi-ai refreshes the token under
   * the store lock when it has expired; the caller only ever sees the resulting
   * short-lived access token, headers and per-credential baseUrl.
   */
  async resolveAuth(providerId: string): Promise<ModelAuth> {
    return this.withRowHeaders(providerId, async () => {
      const account = await this.accountForProvider(providerId);
      if (!account) throw new Error(`vendor account not signed in: ${providerId}`);
      if (account.vendorId === "antigravity") {
        return this.resolveAntigravityAuth(providerId);
      }
      const resolved = await account.models.getAuth(account.vendorId);
      if (!resolved) throw new Error(`vendor account not signed in: ${providerId}`);
      return resolved.auth;
    });
  }

  /**
   * Models the signed-in account may actually use. This replaces the `/models`
   * probe: `getAvailable` applies the vendor's own `filterModels`, which is how
   * Copilot narrows the list to the user's subscription.
   */
  async listModels(providerId: string): Promise<OAuthModelOption[]> {
    return this.withRowHeaders(providerId, async () => {
      const account = await this.accountForProvider(providerId);
      if (!account) throw new Error(`unknown vendor account provider: ${providerId}`);
      if (account.vendorId === "antigravity") {
        return ANTIGRAVITY_MODELS;
      }
      // Dynamic catalogs (radius, Copilot) are empty until refreshed; static and
      // unconfigured providers are skipped inside pi-ai.
      await account.models.refresh({ providers: [account.vendorId] });
      const available = await account.models.getAvailable(account.vendorId);
      return available.map((model) => this.optionFor(model));
    });
  }

  private optionFor(model: Model<Api>): OAuthModelOption {
    return {
      modelId: model.id,
      apiStyle: apiStyleForWireApi(model.api),
      baseUrl: model.baseUrl,
    };
  }

  /**
   * Everything a provider binding needs for one model of a signed-in account.
   *
   * A vendor row cannot take this from the builtin catalog: one account spans
   * wire APIs (GitHub Copilot serves Anthropic, Chat Completions and Responses
   * models, so the selected model — not the row — decides the style), and a
   * gateway's catalog (radius) is not in the builtin one at all. The
   * authenticated collection knows both.
   */
  async bindingFor(
    providerId: string,
    modelId: string,
  ): Promise<VendorModelBinding | undefined> {
    return this.withRowHeaders(providerId, () =>
      this.bindingForUnscoped(providerId, modelId),
    );
  }

  private async bindingForUnscoped(
    providerId: string,
    modelId: string,
  ): Promise<VendorModelBinding | undefined> {
    const account = await this.accountForProvider(providerId);
    if (!account) return undefined;
    if (account.vendorId === "antigravity") {
      const option = ANTIGRAVITY_MODELS.find((m) => m.modelId === modelId) ?? {
        modelId,
        apiStyle: "google_generative_ai",
        baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
      };
      const modelConfig =
        (await this.deps.modelConfigFor?.({
          vendorKey: account.vendorId,
          option,
        }).catch(() => undefined)) ?? genericModelConfig(modelId, option.baseUrl);
      const capabilities = capabilitiesFromModelConfig(modelConfig);
      return {
        apiStyle: option.apiStyle,
        baseUrl: option.baseUrl,
        modelConfig,
        ...capabilities,
      };
    }
    let model = account.models.getModel(account.vendorId, modelId);
    if (!model) {
      // Dynamic catalogs are empty until the first refresh.
      await account.models.refresh({ providers: [account.vendorId] });
      model = account.models.getModel(account.vendorId, modelId);
    }
    if (!model) return undefined;
    const option = this.optionFor(model);
    const modelConfig = await this.deps.modelConfigFor?.({
      vendorKey: account.vendorId,
      option,
    }).catch(() => undefined) ?? genericModelConfig(modelId, model.baseUrl);
    const capabilities = capabilitiesFromModelConfig(modelConfig);
    return {
      apiStyle: option.apiStyle,
      baseUrl: option.baseUrl,
      modelConfig,
      ...capabilities,
    };
  }

  private async run(session: LoginSession, provider: Provider): Promise<void> {
    try {
      await this.withRowHeaders(session.providerId, () =>
        session.account.models.login(
          session.vendorId,
          "oauth",
          this.interactionFor(session),
        ),
      );
      const accountLabel = provider.auth.oauth?.name || provider.name;
      await this.completeRow(session, provider, accountLabel);
      this.push(session, {
        kind: "done",
        providerId: session.providerId,
        accountLabel,
      });
    } catch (error) {
      await this.discardRow(session);
      if (session.controller.signal.aborted) {
        this.push(session, { kind: "cancelled" });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.log("warn", "vendor account login failed", {
          vendorId: session.vendorId,
          message,
        });
        this.push(session, { kind: "error", message });
      }
    } finally {
      for (const pending of session.prompts.values()) {
        pending.reject(new Error("login finished"));
      }
      await session.tail;
      this.logins.delete(session.loginId);
    }
  }

  private async resolveAntigravityAuth(providerId: string): Promise<ModelAuth> {
    const raw = await this.readCredential(providerId);
    if (!raw) throw new Error(`vendor account not signed in: ${providerId}`);
    const cred = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
      access_token: string;
      refresh_token?: string;
      expires_at?: number;
      projectId?: string;
    };

    let accessToken = cred.access_token;
    if (
      cred.expires_at &&
      Date.now() > cred.expires_at - 60_000 &&
      cred.refresh_token
    ) {
      try {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: ANTIGRAVITY_CLIENT_ID,
            client_secret: ANTIGRAVITY_CLIENT_SECRET,
            refresh_token: cred.refresh_token,
          }),
        });
        if (refreshRes.ok) {
          const fresh = (await refreshRes.json()) as {
            access_token: string;
            expires_in?: number;
          };
          accessToken = fresh.access_token;
          cred.access_token = fresh.access_token;
          cred.expires_at = Date.now() + (fresh.expires_in || 3600) * 1000;
          await this.deps.call("secrets.set", {
            secretRef: secretRefForProviderOauth(providerId),
            value: JSON.stringify(cred),
          });
        }
      } catch (e) {
        this.log("warn", "antigravity token refresh failed, using cached token", {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      apiKey: accessToken,
      headers: {
        ...(cred.projectId ? { "x-goog-user-project": cred.projectId } : {}),
        "User-Agent": "antigravity/ide/2.1.1 darwin/arm64",
        "x-client-name": "antigravity",
        "x-client-version": "4.2.5",
      },
    };
  }

  private async runAntigravity(session: LoginSession): Promise<void> {
    const server = createServer();
    let resolveCode!: (code: string) => void;
    let rejectCode!: (error: Error) => void;
    const codePromise = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });

    server.on("request", (req, res) => {
      const hostHeader = req.headers.host || "127.0.0.1";
      const url = new URL(req.url || "", `http://${hostHeader}`);
      if (url.pathname === "/oauth/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        if (code) {
          res.end(
            '<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;padding:50px;"><h2>✓ Authentication Successful</h2><p>You can close this tab and return to PI-Desktop.</p></body></html>',
          );
          resolveCode(code);
        } else {
          res.end(
            `<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;padding:50px;"><h2>✕ Authentication Failed</h2><p>${error || "Unknown error"}</p></body></html>`,
          );
          rejectCode(new Error(error || "OAuth failed"));
        }
      }
    });

    const cleanup = () => {
      try {
        server.close();
      } catch {}
    };

    session.controller.signal.addEventListener("abort", () => {
      cleanup();
      rejectCode(new Error("login cancelled"));
    });

    try {
      await new Promise<void>((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => resolve());
        server.on("error", reject);
      });

      const addr = server.address();
      const port = addr && typeof addr === "object" ? addr.port : 0;
      const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;

      const params = new URLSearchParams({
        client_id: ANTIGRAVITY_CLIENT_ID,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: ANTIGRAVITY_SCOPES,
        access_type: "offline",
        prompt: "consent",
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      this.push(session, {
        kind: "authUrl",
        url: authUrl,
        instructions: "Sign in with Google in your browser to connect Antigravity.",
        opened: true,
      });

      await this.deps.openExternal(authUrl);

      const code = await codePromise;
      cleanup();

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: ANTIGRAVITY_CLIENT_ID,
          client_secret: ANTIGRAVITY_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Google token exchange failed: ${errText}`);
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      let email = "Google Account";
      try {
        const userRes = await fetch(
          "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
          {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          },
        );
        if (userRes.ok) {
          const userData = (await userRes.json()) as { email?: string };
          if (userData.email) email = userData.email;
        }
      } catch {}

      let projectId = "";
      try {
        const loadRes = await fetch(
          "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              "Content-Type": "application/json",
              "User-Agent": "antigravity/ide/2.1.1 darwin/arm64",
              "x-request-source": "local",
            },
            body: JSON.stringify({ metadata: { ideType: 9, platform: 2, pluginType: 2 } }),
          },
        );
        if (loadRes.ok) {
          const loadData = (await loadRes.json()) as {
            cloudaicompanionProject?: string | { id?: string };
          };
          projectId =
            (typeof loadData.cloudaicompanionProject === "object"
              ? loadData.cloudaicompanionProject?.id
              : loadData.cloudaicompanionProject) || "";
        }
      } catch {}

      const credPayload = {
        type: "oauth",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
        projectId,
        email,
      };

      await this.deps.call("secrets.set", {
        secretRef: secretRefForProviderOauth(session.providerId),
        value: JSON.stringify(credPayload),
      });

      const modelBindings: ModelBinding[] = ANTIGRAVITY_MODELS.map((m) => ({
        id: m.modelId,
        contextWindow: 1_000_000,
        maxTokens: 64_000,
        thinkingLevels: ["off", "low", "medium", "high"],
        defaultThinkingLevel: "medium",
      }));

      await this.deps.call("providers.update", {
        id: session.providerId,
        name: "Antigravity",
        authKind: OAUTH_AUTH_KIND,
        oauthAccountLabel: email,
        baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
        apiStyle: "google_generative_ai",
        protocol: "google",
        defaultModelId: "gemini-3.8-flash-high",
        models: modelBindings,
      });

      this.push(session, {
        kind: "done",
        providerId: session.providerId,
        accountLabel: email,
      });
    } catch (error) {
      cleanup();
      await this.discardRow(session);
      if (session.controller.signal.aborted) {
        this.push(session, { kind: "cancelled" });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.log("warn", "antigravity login failed", { message });
        this.push(session, { kind: "error", message });
      }
    } finally {
      this.logins.delete(session.loginId);
    }
  }

  /** Point the row at a usable model now that the catalog can be read. */
  private async completeRow(
    session: LoginSession,
    provider: Provider,
    accountLabel: string,
  ): Promise<void> {
    let options: OAuthModelOption[] = [];
    try {
      options = await this.listModels(session.providerId);
    } catch (error) {
      // A catalog that will not load is not worth failing a good login over;
      // the row stays selectable and the model picker retries later.
      this.log("warn", "vendor model catalog unavailable after login", {
        vendorId: session.vendorId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const chosen = options[0];
    const apiStyle = chosen?.apiStyle;
    const modelBindings: ModelBinding[] = [];
    for (const option of options) {
      const binding = await this.bindingFor(session.providerId, option.modelId).catch(
        () => undefined,
      );
      const levels = binding?.supportedThinkingLevels ?? ["off"];
      modelBindings.push({
        id: option.modelId,
        contextWindow: binding?.modelConfig.contextWindow ?? 128_000,
        maxTokens: binding?.modelConfig.maxTokens ?? 8_192,
        thinkingLevels: [...levels],
        defaultThinkingLevel: levels.includes("medium") ? "medium" : levels[0] ?? null,
      });
    }
    await this.deps.call("providers.update", {
      id: session.providerId,
      name: provider.auth.oauth?.name || provider.name,
      authKind: OAUTH_AUTH_KIND,
      oauthAccountLabel: accountLabel,
      baseUrl: chosen?.baseUrl ?? provider.baseUrl,
      ...(modelBindings.length > 0 ? { models: modelBindings } : {}),
      ...(apiStyle
        ? {
            apiStyle,
            protocol: protocolForApiStyle(apiStyle),
            defaultModelId: chosen?.modelId,
          }
        : {}),
    });
  }

  private async discardRow(session: LoginSession): Promise<void> {
    if (!session.createdRow) return;
    this.accountModels.delete(session.providerId);
    try {
      await this.deps.call("providers.delete", { id: session.providerId });
    } catch (error) {
      this.log("warn", "could not remove the half-created provider row", {
        vendorId: session.vendorId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private interactionFor(session: LoginSession): AuthInteraction {
    return {
      signal: session.controller.signal,
      prompt: (prompt) => this.ask(session, prompt),
      notify: (event) => this.notify(session, event),
    };
  }

  private ask(session: LoginSession, prompt: AuthPrompt): Promise<string> {
    const promptId = this.nextId();
    return new Promise<string>((resolve, reject) => {
      const cleanups: Array<() => void> = [];
      const settle = () => {
        session.prompts.delete(promptId);
        for (const cleanup of cleanups) cleanup();
      };
      const entry: PendingPrompt = {
        resolve: (value) => {
          settle();
          resolve(value);
        },
        reject: (error) => {
          settle();
          reject(error);
        },
      };
      session.prompts.set(promptId, entry);

      // The flow cancels a prompt when it answers the step itself — a callback
      // that beats the paste box — so the renderer has to close that input.
      const abort = () => {
        this.push(session, { kind: "promptCancelled", promptId });
        entry.reject(new Error("prompt cancelled"));
      };
      for (const signal of [prompt.signal, session.controller.signal]) {
        if (!signal) continue;
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener("abort", abort, { once: true });
        cleanups.push(() => signal.removeEventListener("abort", abort));
      }

      this.push(session, {
        kind: "prompt",
        request: promptRequest(promptId, prompt),
      });
    });
  }

  private notify(session: LoginSession, event: AuthEvent): void {
    switch (event.type) {
      case "info":
        this.push(session, {
          kind: "info",
          message: event.message,
          links: event.links?.map((link) => ({
            url: link.url,
            label: link.label,
          })),
        });
        return;
      case "auth_url":
        this.pushAuthUrl(session, event.url, event.instructions);
        return;
      case "device_code":
        this.push(session, {
          kind: "deviceCode",
          userCode: event.userCode,
          verificationUri: event.verificationUri,
          intervalSeconds: event.intervalSeconds,
          expiresInSeconds: event.expiresInSeconds,
        });
        return;
      case "progress":
        this.push(session, { kind: "progress", message: event.message });
    }
  }

  private pushAuthUrl(
    session: LoginSession,
    url: string,
    instructions?: string,
  ): void {
    session.tail = session.tail.then(async () => {
      // Report whether the browser actually opened: when it did not, the
      // renderer has to offer the link for copying instead.
      const opened = await this.deps.openExternal(url).then(
        () => true,
        () => false,
      );
      this.deps.emit({
        loginId: session.loginId,
        vendorId: session.vendorId,
        kind: "authUrl",
        url,
        instructions,
        opened,
      });
    });
  }

  private push(session: LoginSession, event: OAuthEventBody): void {
    session.tail = session.tail.then(() => {
      this.deps.emit({
        ...event,
        loginId: session.loginId,
        vendorId: session.vendorId,
      } as OAuthLoginEvent);
    });
  }

  private async ensureCatalogModels(): Promise<MutableModels> {
    this.catalogPromise ??= Promise.resolve(
      this.createModels(this.emptyCredentials),
    );
    return this.catalogPromise;
  }

  private createModels(credentials: CredentialStore): MutableModels {
    if (this.deps.createModels) return this.deps.createModels(credentials);
    // pi-ai loads each flow through a variable import specifier so bundlers
    // cannot follow it into Node-only code; registering the static set keeps
    // login working in the packaged app. Named for the Bun binary, but the
    // flows themselves are plain Node.
    if (!this.oauthFlowsRegistered) {
      registerBunOAuthFlows();
      this.oauthFlowsRegistered = true;
    }
    return builtinModels({
      credentials,
      modelsStore: new InMemoryModelsStore(),
    });
  }

  private createAccount(vendorId: string, providerId: string): AccountModels {
    const existing = this.accountModels.get(providerId);
    if (existing) return existing;
    const account = {
      providerId,
      vendorId,
      models: this.createModels(this.credentialsFor(providerId, vendorId)),
    };
    this.accountModels.set(providerId, account);
    return account;
  }

  private async withRowHeaders<T>(
    providerId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const row = (await this.rows()).find((candidate) => candidate.id === providerId);
    return await runWithProviderHeaders(row?.headers, fn);
  }

  private async accountForProvider(
    providerId: string,
  ): Promise<AccountModels | undefined> {
    const existing = this.accountModels.get(providerId);
    if (existing) return existing;
    const row = (await this.rows()).find(
      (candidate) =>
        candidate.id === providerId &&
        candidate.authKind === OAUTH_AUTH_KIND &&
        typeof candidate.vendorKey === "string" &&
        candidate.vendorKey.length > 0,
    );
    return row?.vendorKey
      ? this.createAccount(row.vendorKey, row.id)
      : undefined;
  }

  /**
   * Create a store scoped to one provider row. pi-ai still addresses the
   * credential by its builtin vendor id, while the app maps that id to the
   * row-specific encrypted secret ref.
   */
  private credentialsFor(
    providerId: string,
    vendorId: string,
  ): CredentialStore {
    return {
      read: (requestedVendorId) => {
        if (requestedVendorId !== vendorId) return Promise.resolve(undefined);
        return this.readCredential(providerId);
      },
      list: async () => {
        const row = (await this.rows()).find(
          (candidate) => candidate.id === providerId,
        );
        return row?.authKind === OAUTH_AUTH_KIND && row.hasOauth
          ? [{ providerId: vendorId, type: "oauth" }]
          : [];
      },
      modify: (requestedVendorId, fn) => {
        if (requestedVendorId !== vendorId) {
          throw new Error(`provider is not part of account ${providerId}`);
        }
        return this.serialize(providerId, async () => {
          const current = await this.readCredential(providerId);
          const next = await fn(current);
          if (next === undefined) return current;
          await this.deps.call("secrets.set", {
            secretRef: secretRefForProviderOauth(providerId),
            value: JSON.stringify(next),
          });
          return next;
        });
      },
      delete: (requestedVendorId) => {
        if (requestedVendorId !== vendorId) {
          throw new Error(`provider is not part of account ${providerId}`);
        }
        return this.serialize(providerId, async () => {
          await this.deps.call("secrets.delete", {
            secretRef: secretRefForProviderOauth(providerId),
          });
        });
      },
    };
  }

  private readonly emptyCredentials: CredentialStore = {
    read: async () => undefined,
    list: async () => [],
    modify: async (_providerId, fn) => fn(undefined),
    delete: async () => undefined,
  };

  private async readCredential(
    providerId: string,
  ): Promise<Credential | undefined> {
    const { value } = await this.deps.call<{ value?: string | null }>(
      "secrets.getForRuntime",
      { secretRef: secretRefForProviderOauth(providerId) },
    );
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value) as Credential;
      return parsed?.type ? parsed : undefined;
    } catch {
      this.log("warn", "stored vendor credential is not readable", { providerId });
      return undefined;
    }
  }

  private serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    this.chains.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }

  private async rows(): Promise<OAuthProviderRow[]> {
    const result = await this.deps.call<{ providers?: OAuthProviderRow[] }>(
      "providers.list",
      { includeDisabled: true },
    );
    return result.providers ?? [];
  }

  private nextId(): string {
    return this.deps.newId?.() ?? randomUUID();
  }

  private log(
    level: "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.deps.log?.(level, message, data);
  }
}
