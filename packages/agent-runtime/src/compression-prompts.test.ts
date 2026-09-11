import { describe, expect, it } from "vitest";
import {
  CAVEMAN_PROMPTS,
  PONYTAIL_PROMPTS,
  buildOutputCompressionPrompt,
} from "./compression-prompts.js";

describe("compression-prompts", () => {
  it("returns undefined when no settings or all off", () => {
    expect(buildOutputCompressionPrompt(undefined)).toBeUndefined();
    expect(buildOutputCompressionPrompt({})).toBeUndefined();
    expect(
      buildOutputCompressionPrompt({ caveman: "off", ponytail: "off" }),
    ).toBeUndefined();
  });

  it("builds caveman prompt when enabled", () => {
    const prompt = buildOutputCompressionPrompt({ caveman: "full" });
    expect(prompt).toBeDefined();
    expect(prompt).toContain("Respond like terse caveman");
    expect(prompt).toContain("ACTIVE EVERY RESPONSE");
  });

  it("builds ponytail prompt when enabled", () => {
    const prompt = buildOutputCompressionPrompt({ ponytail: "full" });
    expect(prompt).toBeDefined();
    expect(prompt).toContain("lazy senior developer");
    expect(prompt).toContain("Full: the ladder enforced");
  });

  it("combines both caveman and ponytail prompts", () => {
    const prompt = buildOutputCompressionPrompt({
      caveman: "lite",
      ponytail: "ultra",
    });
    expect(prompt).toBeDefined();
    expect(prompt).toContain("Respond tersely");
    expect(prompt).toContain("Ultra: YAGNI extremist");
  });

  it("contains all defined levels", () => {
    expect(CAVEMAN_PROMPTS.lite).toBeDefined();
    expect(CAVEMAN_PROMPTS.full).toBeDefined();
    expect(CAVEMAN_PROMPTS.ultra).toBeDefined();
    expect(CAVEMAN_PROMPTS["wenyan-lite"]).toBeDefined();
    expect(CAVEMAN_PROMPTS.wenyan).toBeDefined();
    expect(CAVEMAN_PROMPTS["wenyan-ultra"]).toBeDefined();

    expect(PONYTAIL_PROMPTS.lite).toBeDefined();
    expect(PONYTAIL_PROMPTS.full).toBeDefined();
    expect(PONYTAIL_PROMPTS.ultra).toBeDefined();
  });
});
