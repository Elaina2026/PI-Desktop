import { describe, expect, it } from "vitest";
import {
  compressToolText,
  compressToolContent,
  gitDiff,
  gitStatus,
  grep,
  find,
  dedupLog,
  smartTruncate,
} from "./rtk-compressor.js";

describe("rtk-compressor", () => {
  it("skips tiny inputs under MIN_COMPRESS_SIZE", () => {
    const small = "Hello world";
    expect(compressToolText(small)).toBe(small);
  });

  it("compresses git diff output", () => {
    const sampleDiff = `diff --git a/src/index.ts b/src/index.ts
index 1234567..89abcdef 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,6 @@
 import { foo } from "./foo";
-const a = 1;
+const a = 2;
+const b = 3;
 export default a;
`.repeat(20);

    expect(sampleDiff.length).toBeGreaterThan(500);
    const compressed = gitDiff(sampleDiff);
    expect(compressed.length).toBeLessThan(sampleDiff.length);
    expect(compressed).toContain("src/index.ts");
    expect(compressed).toContain("+");
  });

  it("compresses git status output", () => {
    const sampleStatus = `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
\tmodified:   src/a.ts
\tmodified:   src/b.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
\tsrc/c.ts
` + "\tmodified: src/extra.ts\n".repeat(30);

    const compressed = gitStatus(sampleStatus);
    expect(compressed).toContain("Branch: main");
    expect(compressed.length).toBeLessThan(sampleStatus.length);
  });

  it("compresses grep output", () => {
    const lines = [];
    for (let i = 1; i <= 30; i++) {
      lines.push(`src/file${i % 3}.ts:${i}:const targetValue = ${i};`);
    }
    const sampleGrep = lines.join("\n");
    const compressed = grep(sampleGrep);
    expect(compressed).toContain("matches in");
    expect(compressed).toContain("[file]");
    expect(compressed.length).toBeLessThan(sampleGrep.length);
  });

  it("compresses find output", () => {
    const lines = [];
    for (let i = 1; i <= 30; i++) {
      lines.push(`src/components/sub${i % 4}/Item${i}.tsx`);
    }
    const sampleFind = lines.join("\n");
    const compressed = find(sampleFind);
    expect(compressed).toContain("files in");
    expect(compressed).toContain("dirs:");
    expect(compressed.length).toBeLessThan(sampleFind.length);
  });

  it("compresses duplicate logs", () => {
    const lines = ["info: starting server", ...Array(20).fill("warn: connection retry"), "info: ready"];
    const sampleLogs = lines.join("\n");
    const compressed = dedupLog(sampleLogs);
    expect(compressed).toContain("duplicate lines");
    expect(compressed.length).toBeLessThan(sampleLogs.length);
  });

  it("safely handles compressToolContent array", () => {
    const largeRepeat = "Repeated line of build error info\n".repeat(40);
    const content = [
      { type: "text", text: largeRepeat },
      { type: "other", data: 123 },
    ];
    const result = compressToolContent(content as any);
    expect(result[0].text.length).toBeLessThan(largeRepeat.length);
    expect((result[1] as any).data).toBe(123);
  });
});
