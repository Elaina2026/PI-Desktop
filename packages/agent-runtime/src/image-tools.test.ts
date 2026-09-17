import { describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeImageGeneration } from "./image-tools.js";

describe("executeImageGeneration", () => {
  it("generates vector SVG file and markdown reference", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pi-img-test-"));
    try {
      const result = await executeImageGeneration({
        prompt: "Flowchart of login architecture",
        format: "svg",
        workspacePath: tempDir,
      });

      expect(result.format).toBe("svg");
      expect(result.markdown).toContain("![Flowchart of login architecture]");
      expect(result.markdown).toContain(".pi/images/");
      expect(result.filePath).toBeDefined();

      const diskPath = join(tempDir, result.filePath!);
      const content = await readFile(diskPath, "utf8");
      expect(content).toContain("<svg");
      expect(content).toContain("Flowchart of login architecture");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("falls back to SVG illustration when no API key provided for raster", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pi-img-test-"));
    try {
      const result = await executeImageGeneration({
        prompt: "Cute robot mascot",
        format: "png",
        workspacePath: tempDir,
      });

      expect(result.format).toBe("svg");
      expect(result.markdown).toContain("Cute robot mascot");
      expect(result.filePath).toBeDefined();

      const diskPath = join(tempDir, result.filePath!);
      const content = await readFile(diskPath, "utf8");
      expect(content).toContain("<svg");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
