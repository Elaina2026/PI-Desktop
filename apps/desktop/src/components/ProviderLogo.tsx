import type React from "react";
import type { OAuthVendor, ProviderPublic } from "@pi-desktop/shared";
import { IconBot } from "./icons";
import antigravityLogoUrl from "../assets/providers/antigravity.png";

const providerPngs = import.meta.glob<string>(
  "../assets/providers/*.png",
  { eager: true, import: "default" },
);

const providerIconMap = new Map<string, string>();
for (const [filePath, url] of Object.entries(providerPngs)) {
  const fileId = filePath.split("/").pop()?.replace(/\.png$/, "").toLowerCase();
  if (fileId && typeof url === "string") {
    providerIconMap.set(fileId, url);
  }
}

const ICON_ALIASES: Record<string, string> = {
  "github-copilot": "copilot",
  github: "copilot",
  "copilot-chat": "copilot",
  "openai-codex": "codex",
  chatgpt: "codex",
  openai: "openai",
  anthropic: "claude",
  claudecode: "claude",
  "claude-code": "claude",
  google: "gemini",
  "google-gemini": "gemini",
  "gemini-cli": "gemini-cli",
  moonshot: "kimi",
  moonshotai: "kimi",
  "moonshotai-cn": "kimi",
  "kimi-for-coding": "kimi",
  "kimi-coding": "kimi",
  zhipuai: "glm",
  zhipu: "glm",
  zai: "glm",
  "zai-coding-plan": "glm",
  "zhipuai-coding-plan": "glm",
  "minimax-cn": "minimax",
  "minimax-cn-openai": "minimax",
  cloudflare: "cloudflare-ai",
  "nvidia-nim": "nvidia",
  qodo: "qoder",
  "tencent-hunyuan": "tencent",
  dashscope: "qwen",
  aliyun: "qwen",
  "alibaba-cn": "qwen",
  volcengine: "volcengine-ark",
  doubao: "volcengine-ark",
  ark: "volcengine-ark",
  togetherai: "together",
  together: "together",
  "fireworks-ai": "fireworks",
  fireworks: "fireworks",
  "siliconflow-cn": "siliconflow",
  "opencode-free": "opencode",
  "opencode-go": "opencode-go",
  "kilo-code": "kilocode",
  codebuddy: "codebuddy-cn",
  "codebuddy-cn": "codebuddy-cn",
  xai: "grok-cli",
  lmstudio: "local-device",
  ollama: "ollama",
};

export function getProviderLogoUrl(idOrKey?: string): string | null {
  if (!idOrKey) return null;
  const key = idOrKey.trim().toLowerCase();
  if (providerIconMap.has(key)) return providerIconMap.get(key)!;
  if (ICON_ALIASES[key] && providerIconMap.has(ICON_ALIASES[key])) {
    return providerIconMap.get(ICON_ALIASES[key])!;
  }
  const stripped = key.replace(/-(cn|intl|free|local|api|v\d+|compatible)$/, "");
  if (providerIconMap.has(stripped)) return providerIconMap.get(stripped)!;
  if (ICON_ALIASES[stripped] && providerIconMap.has(ICON_ALIASES[stripped])) {
    return providerIconMap.get(ICON_ALIASES[stripped])!;
  }
  for (const [k, url] of providerIconMap) {
    if (k.length >= 4 && (key.includes(k) || k.includes(key))) {
      return url;
    }
  }
  return null;
}

export function AntigravityLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <img
      src={antigravityLogoUrl}
      alt="Antigravity"
      width={size}
      height={size}
      className={className ?? "provider-logo-img"}
      draggable={false}
      style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain" }}
    />
  );
}

export function GitHubCopilotLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02S.939 18.492.078 16.997A.6.6 0 0 1 0 16.741v-2.869a1 1 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z" />
    </svg>
  );
}

export function CursorLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M11.503.131L1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.03 1.03 0 0 0-.994 0M12 2.067l8.527 4.923l-8.527 4.923l-8.527-4.923zm-9.055 6.13L11.472 13.7v9.845L2.945 18.62zm18.11 0v10.423l-8.527 4.924V13.7z" />
    </svg>
  );
}

export function OpenAILogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M22.282 9.821a6 6 0 0 0-.516-4.91a6.05 6.05 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a6 6 0 0 0-3.998 2.9a6.05 6.05 0 0 0 .743 7.097a5.98 5.98 0 0 0 .51 4.911a6.05 6.05 0 0 0 6.515 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.772-4.206a6 6 0 0 0 3.997-2.9a6.06 6.06 0 0 0-.747-7.073M13.26 22.43a4.48 4.48 0 0 1-2.876-1.04l.141-.081l4.779-2.758a.79.79 0 0 0 .392-.681v-6.737l2.02 1.168a.07.07 0 0 1 .038.052v5.583a4.5 4.5 0 0 1-4.494 4.494M3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085l4.783 2.759a.77.77 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646M2.34 8.737a4.49 4.49 0 0 1 2.338-1.973v5.683a.79.79 0 0 0 .392.682l5.84 3.37l-2.02 1.168a.08.08 0 0 1-.071 0l-4.83-2.786A4.5 4.5 0 0 1 2.34 8.737m15.827 3.376l-5.842-3.37l2.02-1.168a.08.08 0 0 1 .071 0l4.83 2.791a4.49 4.49 0 0 1-.684 8.1v-5.672a.79.79 0 0 0-.395-.681m2.233-4.576l-.14-.085l-4.783-2.759a.77.77 0 0 0-.78 0L8.854 8.062V5.73a.08.08 0 0 1 .033-.062l4.84-2.795a4.5 4.5 0 0 1 6.68 4.463M9.202 12.528l-2.02-1.168a.07.07 0 0 1-.038-.052V5.725a4.5 4.5 0 0 1 7.37-3.453l-.142.08l-4.778 2.758a.79.79 0 0 0-.392.681zm1.097-2.365l2.602-1.5l2.607 1.5v2.999l-2.597 1.5l-2.607-1.5z" />
    </svg>
  );
}

export function AnthropicLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.304 3.541h-3.672l6.696 16.918H24Zm-10.608 0L0 20.459h3.744l1.37-3.553h7.005l1.369 3.553h3.744L10.536 3.541Zm-.371 10.223l2.291-5.946l2.291 5.946Z" />
    </svg>
  );
}

export function ClaudeLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="m4.714 15.956l4.718-2.648l.079-.23l-.08-.128h-.23l-.79-.048l-2.695-.073l-2.337-.097l-2.265-.122l-.57-.121l-.535-.704l.055-.453l.48-.352l.669.049l1.634.12l2.253.147l2.433.122l1.49.024l.23-.073l.038-.17l-.158-.146l-.08-.098l-1.398-.996l-2.34-1.63l-2.09-1.485l-.57-.45l-.33-.607l.206-.632l.643-.28l.74.195l1.373 1.021l2.054 1.483l1.835 1.338l.194.195l.183-.073l.036-.122l-.121-.219l-1.154-1.896l-1.57-2.625l-.765-1.24l-.195-.607l.085-.547l.487-.39l.74.025l.633.425l.935 1.483l1.507 2.455l1.093 1.774l.206.353l.183-.049l.06-.182l-.084-.304l-.84-2.82l-.9-2.966l-.28-1.045l-.048-.68l.34-.499l.62-.182l.62.243l.45.645l.632 2.053l.863 2.796l.546 1.835l.135.534h.182v-.194l.11-.96l.327-2.49l.34-2.224l.256-.766l.462-.51l.668-.134l.583.352l.255.608l-.121.996l-.426 2.406l-.547 2.769l-.073.498l.158.073l.17-.097l.633-1.033l1.555-2.406l1.336-1.993l.632-.705l.596-.28l.583.207l.34.583l-.157.778l-.827 1.41l-1.324 2.15l-1.288 2.006l-.146.352l.11.134l.194-.024l1.24-.875l2.406-1.604l1.458-.923l.766-.34l.656.024l.438.486l-.025.644l-.45.608l-1.567 1.13l-2.188 1.494l-1.847 1.252l-.146.194l.085.17l.195.025l1.846-.17l2.844-.22l1.057-.12l.62.193l.364.499l-.048.644l-.535.535l-.9.243l-2.358.267l-2.394.28l-.207.085l.024.134l.146.121l2.443.34l1.98.28l1.374.243l.498.377l.219.547l-.23.632l-.657.34l-1.373-.134l-2.455-.389l-2.103-.352l-.461-.061l-.061.085l.06.11l1.507 1.19l2.443 1.933l.498.413l.267.571l-.146.595l-.607.414l-.84-.11l-2.004-1.385l-1.92-1.422l-1.082-.789l-.206.073l-.037.121l.668 1.155l1.726 2.892l.28.535l.133.583l-.328.608l-.668.255l-.753-.17l-.985-1.41l-1.543-2.455l-1.093-1.81l-.195-.122l-.121.073l.036.195l.778 2.587l.766 2.808l.121.73l-.158.558l-.559.413l-.705-.048l-.643-.535l-.718-2.345l-.85-2.82l-.425-1.555l-.17-.11l-.146.061l-.097.875l-.365 2.576l-.425 2.455l-.23.644l-.499.437l-.704.086l-.608-.414l-.194-.656l.328-1.92l.461-2.492l.402-2.382l-.025-.219l-.145-.048l-.802 1.349l-1.616 2.624l-.948 1.483l-.474.56l-.668.267l-.656-.255l-.28-.656l.243-.73l1.19-1.834l1.52-2.394l.874-1.41l.037-.206l-.146-.11l-1.786.815l-2.734 1.251l-1.106.462l-.705.121l-.546-.376l-.207-.633l.28-.656l.753-.413l2.066-.96l2.455-1.142l.534-.28l-.024-.157l-.17-.037l-2.418.061l-2.673.085l-1.385.025l-.547-.292l-.352-.56l.085-.692l.522-.45l.766.025l2.272.048l2.29-.024l.656-.024Z" />
    </svg>
  );
}

export function GoogleGeminiLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
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

export function GrokLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M14.234 10.162L22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299l-.929-1.329L3.076 1.56h3.182l5.965 8.532l.929 1.329l7.754 11.09h-3.182z" />
    </svg>
  );
}

export function ClineLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="m23.365 13.556l-1.442-2.895V8.994c0-2.764-2.218-5.002-4.954-5.002h-2.464c.178-.367.276-.779.276-1.213A2.77 2.77 0 0 0 12.005 0a2.77 2.77 0 0 0-2.776 2.779c0 .434.098.846.276 1.213H7.042c-2.736 0-4.954 2.238-4.954 5.002v1.667L.646 13.556a1.386 1.386 0 0 0 .616 1.868l1.71.854v2.718c0 2.764 2.218 5.004 4.954 5.004h8.16c2.736 0 4.954-2.24 4.954-5.004v-2.718l1.71-.854a1.386 1.386 0 0 0 .615-1.868zM12.005 1.5c.703 0 1.276.574 1.276 1.279c0 .705-.573 1.279-1.276 1.279s-1.276-.574-1.276-1.279c0-.705.573-1.279 1.276-1.279zm7.42 16.5c0 1.932-1.55 3.504-3.454 3.504h-8.16c-1.904 0-3.454-1.572-3.454-3.504v-3.468l-1.543-.772l1.042-2.091V8.994c0-1.932 1.55-3.502 3.454-3.502h9.12c1.904 0 3.454 1.57 3.454 3.502v2.675l1.042 2.09l-1.543.773v3.468z" />
    </svg>
  );
}

export function CodeBuddyLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M18.636.289a1 1 0 0 0-.11 0c-.18.01-.195.02-.442.24c-.716.636-1.722 2.546-2.703 5.137l-.274.72l-.499.16c-1.554.498-2.934 1.488-3.924 2.816C9.69 8.034 8.31 7.044 6.756 6.546l-.5-.16l-.273-.72C4.996 3.076 3.996 1.165 3.28.53c-.247-.22-.262-.23-.442-.24a1 1 0 0 0-.824.375C1.86.87 1.83 1.12.923 8.38A13.6 13.6 0 0 0 0 13.333c0 3.04.99 5.86 2.67 8.16c.3.41.87.53 1.32.28c.45-.25.59-.8.32-1.23a12.2 12.2 0 0 1-2.31-7.21c0-1.42.24-3.08.82-5.11c.54-1.9 1.14-3.69 1.53-4.7c.6 1.4 1.43 3.02 2.21 4.57c.23.45.74.68 1.21.53c.47-.15.75-.62.66-1.1c-.26-1.44-.3-2.9-.11-4.35c1.07.4 2.03 1.09 2.8 2c-1.07 1.2-1.74 2.74-1.88 4.41c-.05.58.37 1.09.95 1.14c.58.05 1.09-.37 1.14-.95c.13-1.46.77-2.79 1.77-3.79c1 .99 1.64 2.33 1.77 3.79c.05.58.56 1 1.14.95c.58-.05 1-.56.95-1.14c-.14-1.67-.81-3.21-1.88-4.41c.77-.91 1.73-1.6 2.8-2c.19 1.45.15 2.91-.11 4.35c-.09.48.19.95.66 1.1c.47.15.98-.08 1.21-.53c.78-1.55 1.61-3.17 2.21-4.57c.39 1.01.99 2.8 1.53 4.7c.58 2.03.82 3.69.82 5.11c0 2.68-.84 5.25-2.31 7.21c-.27.43-.13.98.32 1.23c.45.25 1.02.13 1.32-.28c1.68-2.3 2.67-5.12 2.67-8.16a13.6 13.6 0 0 0-.92-4.95c-.91-7.26-.94-7.51-1.09-7.72a1 1 0 0 0-.714-.376z" />
    </svg>
  );
}

export function QodoLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c2.81 0 5.397-.968 7.452-2.586l2.327 2.328a1.06 1.06 0 0 0 1.498-1.498l-2.327-2.328A11.95 11.95 0 0 0 24 12C24 5.373 18.627 0 12 0zm0 2.12c5.467 0 9.88 4.413 9.88 9.88s-4.413 9.88-9.88 9.88S2.12 17.467 2.12 12 6.533 2.12 12 2.12z" />
    </svg>
  );
}

export function KimiLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M21.765.351C22.998.351 24 1.353 24 2.586S22.998 4.82 21.765 4.82h-1.974c-.15 0-.26-.12-.26-.26V2.586A2.237 2.237 0 0 1 21.765.351zM7.18 2.261l9.167 11.233c.12.15.08.36-.08.47l-1.93 1.33c-.15.1-.36.07-.47-.08L4.697 3.98a.335.335 0 0 1 .08-.47l1.93-1.33a.36.36 0 0 1 .473.081zm7.447 16.918l-9.167-11.233a.335.335 0 0 0-.47-.08l-1.93 1.33a.36.36 0 0 0-.08.47l9.17 11.234c.12.15.33.18.47.08l1.93-1.33c.15-.1.19-.32.077-.471zM2.235 23.649C1.002 23.649 0 22.647 0 21.414s1.002-2.235 2.235-2.235h1.974c.15 0 .26.12.26.26v1.974c0 1.233-.998 2.236-2.234 2.236z" />
    </svg>
  );
}

export function MoonshotLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="m1.053 16.91l9.538 2.55a21 20.981 0 0 0 .06 2.031l5.956 1.592a12 11.99 0 0 1-15.554-6.172m-1.02-5.79l11.352 3.035a21 20.981 0 0 0 .86 1.84l7.085 1.895a12 11.99 0 0 1-19.297-6.77m2.368-5.385l12.75 3.407a21 20.981 0 0 0 1.547 1.339l7.747 2.072A12 11.99 0 0 1 2.4 5.735M7.65 1.536l13.62 3.641a21 20.981 0 0 0 2.022.613l.675.18a12 11.99 0 0 1-16.317-4.434" />
    </svg>
  );
}

export function XiaomiLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF6900" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C8.016 0 4.756.255 2.493 2.516C.23 4.776 0 8.033 0 12.012s.23 7.235 2.494 9.497C4.757 23.77 8.017 24 12 24s7.243-.23 9.507-2.491C23.77 19.247 24 15.991 24 12.012S23.77 4.776 21.507 2.516C19.243.255 15.984 0 12 0m-4.71 6.577h4.092c2.091 0 3.864 1.77 3.864 3.858v6.988h-2.735v-6.988c0-.58-.5-.1.08-.08-1.08h-2.406v8.068H7.29zM16.71 6.577h2.735v10.846H16.71z" />
    </svg>
  );
}

export function DeepSeekLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#4D6BFE" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M23.748 4.651c-.254-.124-.364.113-.512.233c-.051.04-.094.09-.137.137c-.372.397-.806.657-1.373.626c-.829-.046-1.537.214-2.122.8c-.372.373-.629.82-.72 1.344c-.033.19-.044.385-.052.579c-.04.99-.074 1.98-.109 2.97c-.015.42-.027.84-.04 1.26c-.01.325-.07.641-.21.936c-.22.463-.58.783-1.062.946c-.352.12-.716.146-1.082.146c-.958 0-1.916-.002-2.874-.002c-.374 0-.745.02-1.11.109c-.585.143-1.033.486-1.328 1.018c-.184.33-.263.694-.264 1.067c-.002 1.396 0 2.792-.002 4.188c0 .245.024.49.098.723c.174.55.534.927 1.062 1.134c.32.125.658.156.999.156c1.614 0 3.228 0 4.842 0c.264 0 .524-.034.776-.117c.563-.186.953-.57 1.144-1.13c.09-.263.116-.541.116-.82c0-1.636 0-3.272 0-4.908c0-.236-.022-.472-.089-.7c-.173-.584-.545-.98-1.116-1.173c-.274-.093-.56-.121-.85-.121c-.886 0-1.772 0-2.658 0c-.235 0-.447-.07-.604-.254c-.183-.214-.2-.464-.09-.705c.108-.236.314-.344.572-.345c.878-.002 1.756 0 2.634-.002c.49 0 .97-.072 1.42-.266c.86-.37 1.41-1.02 1.63-1.94c.08-.34.1-.69.1-1.04c0-1.72 0-3.44 0-5.16c0-.28-.04-.55-.14-.81c-.24-.62-.68-1.03-1.3-1.22c-.28-.09-.58-.11-.88-.11c-.57 0-1.14 0-1.71 0c-.23 0-.44-.07-.6-.25c-.19-.21-.21-.46-.1-.7c.1-.24.31-.35.57-.35c.82 0 1.64 0 2.46 0c.28 0 .55.04.81.14c.64.24 1.06.68 1.25 1.32c.08.27.1.55.1.83c0 1.25 0 2.5 0 3.75c0 .24.02.48.09.71c.17.56.54.94 1.08 1.14c.29.11.6.14.91.14c.68 0 1.36 0 2.04 0c.25 0 .46.08.62.26c.18.2.2.45.1.69c-.1.24-.31.35-.57.35-.74 0-1.48 0-2.22 0c-.3 0-.59.04-.87.14c-.6.22-1 .61-1.21 1.21c-.1.28-.13.57-.13.87c0 1.12 0 2.24 0 3.36c0 .32.05.63.17.93c.27.68.76 1.1 1.46 1.27c.3.07.61.08.92.08c1.39 0 2.78 0 4.17 0c.34 0 .67-.06.98-.2c.69-.31 1.1-.84 1.26-1.58c.06-.27.08-.55.08-.83c0-2.37 0-4.74 0-7.11c0-.3-.04-.59-.15-.87c-.25-.65-.7-1.07-1.37-1.26c-.3-.08-.61-.1-.92-.1c-.81 0-1.62 0-2.43 0c-.24 0-.45-.07-.61-.25c-.19-.21-.21-.46-.1-.7c.11-.24.32-.35.58-.35c.78 0 1.56 0 2.34 0c.35 0 .69.05 1.02.18c.84.33 1.37.93 1.59 1.8c.07.28.09.57.09.86c0 1.88 0 3.76 0 5.64c0 .31.05.61.17.9c.28.69.78 1.12 1.49 1.28c.3.07.61.08.92.08h.27c.28 0 .5.17.58.44c.08.28-.02.53-.25.71c-.18.14-.39.2-.62.2h-.25c-.38 0-.75-.04-1.11-.16c-.74-.25-1.25-.74-1.5-1.49c-.1-.31-.13-.63-.13-.96c0-1.92 0-3.84 0-5.76c0-.28-.03-.55-.12-.81c-.2-.59-.6-.99-1.2-1.19c-.31-.1-.63-.13-.96-.13h-2.1c-.28 0-.5-.17-.58-.44c-.08-.28.02-.53.25-.71c.18-.14.39-.2.62-.2h2.07c.37 0 .73.04 1.08.15c.81.25 1.38.77 1.66 1.58c.11.31.14.64.14.97c0 2.45 0 4.9 0 7.35c0 .32.05.63.17.93c.27.68.76 1.1 1.46 1.27c.3.07.61.08.92.08h.08c.28 0 .5.17.58.44c.08.28-.02.53-.25.71c-.18.14-.39.2-.62.2h-.05c-.39 0-.77-.04-1.14-.17c-.74-.26-1.25-.76-1.49-1.52c-.09-.3-.12-.61-.12-.93c0-1.17 0-2.34 0-3.51c0-.29-.04-.57-.14-.84c-.23-.62-.67-1.02-1.3-1.22c-.31-.1-.63-.13-.96-.13h-4.22c-.28 0-.5-.17-.58-.44c-.08-.28.02-.53.25-.71c.18-.14.39-.2.62-.2h4.19c.37 0 .73.04 1.08.15c.78.25 1.33.74 1.61 1.52c.11.31.14.63.14.96c0 1.24 0 2.48 0 3.72c0 .28.04.55.13.82c.21.61.63 1.02 1.25 1.23c.31.1.63.13.96.13h.3c.28 0 .5.17.58.44c.08.28-.02.53-.25.71c-.18.14-.39.2-.62.2h-.28c-.39 0-.77-.05-1.14-.18c-.73-.27-1.23-.77-1.47-1.53c-.09-.29-.12-.6-.12-.91c0-1.84 0-3.68 0-5.52c0-.29-.04-.57-.14-.84c-.23-.62-.67-1.02-1.3-1.22c-.31-.1-.63-.13-.96-.13h-2.14c-.28 0-.5-.17-.58-.44c-.08-.28.02-.53.25-.71c.18-.14.39-.2.62-.2h2.11c.38 0 .75.05 1.11.18c.78.27 1.32.78 1.58 1.58c.1.3.13.62.13.94c0 1.84 0 3.68 0 5.52c0 .32.06.63.18.93c.28.7.79 1.13 1.51 1.29c.31.07.63.08.95.08h.08c.28 0 .5.17.58.44c.08.28-.02.53-.25.71c-.18.14-.39.2-.62.2h-.05c-.39 0-.77-.04-1.14-.17c-.76-.26-1.28-.77-1.52-1.55c-.09-.29-.12-.6-.12-.91c0-1.74 0-3.48 0-5.22c0-.28-.03-.55-.12-.81c-.2-.59-.6-.99-1.2-1.19c-.31-.1-.63-.13-.96-.13h-2.42c-.28 0-.5-.17-.58-.44c-.08-.28.02-.53.25-.71c.18-.14.39-.2.62-.2h2.39c.38 0 .75.05 1.11.18c.78.27 1.32.78 1.58 1.58c.1.3.13.62.13.94c0 1.74 0 3.48 0 5.22c0 .31.05.61.17.9c.28.69.78 1.12 1.49 1.28c.3.07.61.08.92.08h.27c.28 0 .5.17.58.44c.08.28-.02.53-.25.71c-.18.14-.39.2-.62.2h-.25c-.4 0-.79-.05-1.17-.19c-.73-.28-1.22-.79-1.45-1.56c-.08-.28-.11-.57-.11-.86c0-1.63 0-3.26 0-4.89c0-.28-.03-.55-.12-.81c-.2-.59-.6-.99-1.2-1.19c-.31-.1-.63-.13-.96-.13h-4.84c-.39 0-.77-.05-1.14-.18c-.73-.27-1.23-.77-1.47-1.53c-.09-.29-.12-.6-.12-.91c0-1.39 0-2.78 0-4.17c0-.28-.03-.55-.12-.81c-.2-.59-.6-.99-1.2-1.19c-.31-.1-.63-.13-.96-.13h-1.6c-.28 0-.5-.17-.58-.44c-.08-.28.02-.53.25-.71c.18-.14.39-.2.62-.2h1.57c.38 0 .75.05 1.11.18c.78.27 1.32.78 1.58 1.58c.1.3.13.62.13.94c0 1.39 0 2.78 0 4.17c0 .32.06.63.18.93c.28.7.79 1.13 1.51 1.29c.31.07.63.08.95.08h4.84c.38 0 .75.05 1.11.18c.78.27 1.32.78 1.58 1.58c.1.3.13.62.13.94c0 1.63 0 3.26 0 4.89c0 .31.05.61.17.9c.28.69.78 1.12 1.49 1.28c.3.07.61.08.92.08h.08c.28 0 .5.17.58.44c.08.28-.02.53-.25.71c-.18.14-.39.2-.62.2h-.05c-.4 0-.79-.05-1.17-.19c-.75-.27-1.25-.78-1.49-1.57c-.08-.27-.11-.55-.11-.84c0-2.07 0-4.14 0-6.21c0-.28-.03-.55-.12-.81c-.2-.59-.6-.99-1.2-1.19c-.31-.1-.63-.13-.96-.13h-4.84c-.28 0-.5-.17-.58-.44c-.08-.28.02-.53.25-.71c.18-.14.39-.2.62-.2h4.81c.38 0 .75.05 1.11.18c.78.27 1.32.78 1.58 1.58c.1.3.13.62.13.94c0 2.07 0 4.14 0 6.21c0 .32.06.63.18.93c.28.7.79 1.13 1.51 1.29c.31.07.63.08.95.08h.08c.28 0 .5.17.58.44c.08.28-.02.53-.25.71c-.18.14-.39.2-.62.2z" />
    </svg>
  );
}

export function MistralLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF7000" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429H24V3.429z" />
    </svg>
  );
}

export function PerplexityLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#20B2AA" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M22.398 7.09h-2.31V.068l-7.51 6.354V.158h-1.156v6.196L4.49 0v7.09H1.602v10.397H4.49V24l6.933-6.36v6.201h1.155v-6.047l6.932 5.867v-6.744h2.288zm-3.466 9.24l-6.354-5.378v-3.52l6.354-5.378zm-13.284 0V2.054l6.354 5.378v3.52zM3.456 8.944h1.034v6.69H3.456zm7.388 2.062l-6.354 5.378v5.562zm8.422 10.94l-6.354-5.378v-2.062l6.354 5.378zm1.278-4.25h-1.034V8.944h1.034z" />
    </svg>
  );
}

export function GroqLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F55036" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
    </svg>
  );
}

export function OpenRouterLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#6366F1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ZhipuLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#2563EB" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16v16H4V4zm4 4v8h8V8H8z" />
    </svg>
  );
}

export function MiniMaxLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#E11D48" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3h18v18H3V3zm3 4v10h3V7H6zm5 3v7h3v-7h-3zm5-2v9h3V8h-3z" />
    </svg>
  );
}

export function KiroLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF9900" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 22h20L12 2zm0 5l6.5 13h-13L12 7z" />
    </svg>
  );
}

export function renderVendorLogo(
  vendor:
    | OAuthVendor
    | ProviderPublic
    | { vendorId?: string; vendorKey?: string; id?: string; name?: string }
    | string,
  size = 28,
  className?: string,
): React.ReactElement {
  const vid =
    typeof vendor === "string"
      ? vendor
      : ("vendorId" in vendor && vendor.vendorId) ||
        ("vendorKey" in vendor && vendor.vendorKey) ||
        ("id" in vendor && vendor.id) ||
        "";
  const name = typeof vendor === "string" ? vendor : vendor.name || "";

  // 1. Try real 9router PNG icon first
  const logoUrl = getProviderLogoUrl(vid) || getProviderLogoUrl(name);
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name || vid}
        width={size}
        height={size}
        className={className ?? "provider-logo-img"}
        draggable={false}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: "contain",
          borderRadius: size >= 24 ? "var(--radius-xs)" : "2px",
          flexShrink: 0,
        }}
      />
    );
  }

  // 2. Fallback to vector SVGs if matched
  const lowerVid = vid.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerVid.includes("antigravity") || lowerName.includes("antigravity")) {
    return <AntigravityLogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("copilot") ||
    lowerVid.includes("github") ||
    lowerName.includes("copilot") ||
    lowerName.includes("github")
  ) {
    return <GitHubCopilotLogo size={size} className={className} />;
  }
  if (lowerVid.includes("cursor") || lowerName.includes("cursor")) {
    return <CursorLogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("claudecode") ||
    lowerVid.includes("claude-code") ||
    lowerName.includes("claude code")
  ) {
    return <ClaudeLogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("claude") ||
    lowerVid.includes("anthropic") ||
    lowerName.includes("claude") ||
    lowerName.includes("anthropic")
  ) {
    return <AnthropicLogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("openai") ||
    lowerVid.includes("codex") ||
    lowerVid.includes("chatgpt") ||
    lowerName.includes("openai") ||
    lowerName.includes("codex")
  ) {
    return <OpenAILogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("gemini") ||
    lowerVid.includes("google") ||
    lowerName.includes("gemini") ||
    lowerName.includes("google")
  ) {
    return <GoogleGeminiLogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("grok") ||
    lowerVid.includes("xai") ||
    lowerVid.includes("x.ai") ||
    lowerName.includes("grok") ||
    lowerName.includes("xai")
  ) {
    return <GrokLogo size={size} className={className} />;
  }
  if (lowerVid.includes("cline") || lowerName.includes("cline")) {
    return <ClineLogo size={size} className={className} />;
  }
  if (lowerVid.includes("codebuddy") || lowerName.includes("codebuddy")) {
    return <CodeBuddyLogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("qoder") ||
    lowerVid.includes("qodo") ||
    lowerName.includes("qoder") ||
    lowerName.includes("qodo")
  ) {
    return <QodoLogo size={size} className={className} />;
  }
  if (lowerVid.includes("kimi") || lowerName.includes("kimi")) {
    return <KimiLogo size={size} className={className} />;
  }
  if (lowerVid.includes("moonshot") || lowerName.includes("moonshot")) {
    return <MoonshotLogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("xiaomi") ||
    lowerVid.includes("mimo") ||
    lowerName.includes("xiaomi") ||
    lowerName.includes("mimo")
  ) {
    return <XiaomiLogo size={size} className={className} />;
  }
  if (lowerVid.includes("deepseek") || lowerName.includes("deepseek")) {
    return <DeepSeekLogo size={size} className={className} />;
  }
  if (lowerVid.includes("mistral") || lowerName.includes("mistral")) {
    return <MistralLogo size={size} className={className} />;
  }
  if (lowerVid.includes("perplexity") || lowerName.includes("perplexity")) {
    return <PerplexityLogo size={size} className={className} />;
  }
  if (lowerVid.includes("groq") || lowerName.includes("groq")) {
    return <GroqLogo size={size} className={className} />;
  }
  if (lowerVid.includes("openrouter") || lowerName.includes("openrouter")) {
    return <OpenRouterLogo size={size} className={className} />;
  }
  if (
    lowerVid.includes("zhipu") ||
    lowerVid.includes("zai") ||
    lowerVid.includes("glm") ||
    lowerName.includes("zhipu") ||
    lowerName.includes("glm")
  ) {
    return <ZhipuLogo size={size} className={className} />;
  }
  if (lowerVid.includes("minimax") || lowerName.includes("minimax")) {
    return <MiniMaxLogo size={size} className={className} />;
  }
  if (lowerVid.includes("kiro") || lowerName.includes("kiro")) {
    return <KiroLogo size={size} className={className} />;
  }

  // 3. Fallback avatar
  return (
    <div
      className="quota-fallback-avatar"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.max(10, Math.floor(size * 0.45))}px`,
        flexShrink: 0,
      }}
    >
      {name ? name[0]?.toUpperCase() : <IconBot size={Math.round(size * 0.65)} />}
    </div>
  );
}

export const renderProviderLogo = renderVendorLogo;
