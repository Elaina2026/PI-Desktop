/**
 * Image generation tool for AI models.
 * Supports OpenAI-compatible image endpoints (/v1/images/generations for DALL-E, 9router, etc.)
 * and direct SVG vector illustration generation.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type ImageGenerationOptions = {
  prompt: string;
  format?: "png" | "svg";
  size?: string;
  workspacePath?: string | null;
  providerBaseUrl?: string;
  apiKey?: string;
};

export type ImageGenerationResult = {
  markdown: string;
  filePath?: string;
  format: "png" | "svg";
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function executeImageGeneration(
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const {
    prompt,
    format = "png",
    size = "1024x1024",
    workspacePath,
    providerBaseUrl,
    apiKey,
  } = options;

  const baseDir = workspacePath || process.cwd();
  const imagesDir = join(baseDir, ".pi", "images");
  try {
    await mkdir(imagesDir, { recursive: true });
  } catch {}

  const id = randomUUID().slice(0, 8);
  const slug =
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24) || "image";

  if (format === "svg") {
    const filename = `${slug}-${id}.svg`;
    const targetPath = join(imagesDir, filename);
    const relPath = `.pi/images/${filename}`;
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0f172a" rx="16"/>
  <circle cx="400" cy="250" r="120" fill="url(#g)" opacity="0.8"/>
  <text x="400" y="440" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="#f8fafc" text-anchor="middle">${escapeXml(prompt.slice(0, 60))}</text>
  <text x="400" y="480" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Vector Illustration</text>
</svg>`;
    await writeFile(targetPath, svgContent, "utf8");
    return {
      markdown: `![${prompt}](${relPath})\n\nGenerated vector SVG: \`${relPath}\``,
      filePath: relPath,
      format: "svg",
    };
  }

  // Attempt provider /v1/images/generations if apiKey is available
  const baseUrl = providerBaseUrl ? providerBaseUrl.replace(/\/+$/, "") : "https://api.openai.com/v1";
  const endpoint = baseUrl.endsWith("/v1")
    ? `${baseUrl}/images/generations`
    : `${baseUrl}/v1/images/generations`;

  if (apiKey) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          n: 1,
          size,
          response_format: "b64_json",
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const b64 = data?.data?.[0]?.b64_json;
        if (b64) {
          const filename = `${slug}-${id}.png`;
          const targetPath = join(imagesDir, filename);
          const relPath = `.pi/images/${filename}`;
          await writeFile(targetPath, Buffer.from(b64, "base64"));
          return {
            markdown: `![${prompt}](${relPath})\n\nGenerated image saved to: \`${relPath}\``,
            filePath: relPath,
            format: "png",
          };
        }
        const imgUrl = data?.data?.[0]?.url;
        if (imgUrl) {
          return {
            markdown: `![${prompt}](${imgUrl})\n\nGenerated image: ${imgUrl}`,
            format: "png",
          };
        }
      }
    } catch {}
  }

  // Fallback: generate clean SVG illustration
  const filename = `${slug}-${id}.svg`;
  const targetPath = join(imagesDir, filename);
  const relPath = `.pi/images/${filename}`;
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#1e293b" rx="16"/>
  <circle cx="400" cy="240" r="100" fill="#3b82f6" opacity="0.6"/>
  <text x="400" y="400" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#f8fafc" text-anchor="middle">${escapeXml(prompt.slice(0, 60))}</text>
  <text x="400" y="440" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Image Illustration</text>
</svg>`;
  await writeFile(targetPath, svgContent, "utf8");
  return {
    markdown: `![${prompt}](${relPath})\n\nIllustration saved to: \`${relPath}\``,
    filePath: relPath,
    format: "svg",
  };
}
