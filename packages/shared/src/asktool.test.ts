import { describe, expect, it } from "vitest";
import { formatAskToolOutput, type AskToolQuestion } from "./types.js";

describe("asktool output", () => {
  const questions: AskToolQuestion[] = [
    { question: "Preferred color?", options: ["Blue", "Green"] },
    { question: "Which platforms?", options: ["Web", "Desktop"], multiSelect: true },
  ];

  it("serializes each question with selected answers and a stable separator", () => {
    expect(formatAskToolOutput(questions, [["Blue"], ["Web", "Desktop"]])).toBe(
      "Preferred color?：Blue\n---\nWhich platforms?：Web、Desktop",
    );
  });

  it("keeps skipped answers as empty placeholders", () => {
    expect(formatAskToolOutput(questions, [null, ["Desktop"]])).toBe(
      "Preferred color?：\n---\nWhich platforms?：Desktop",
    );
  });

  it("formats output when options include preview metadata", () => {
    const questionsWithPreview: AskToolQuestion[] = [
      {
        question: "Select approach",
        options: [
          { label: "Option A", preview: "Preview for A" },
          { label: "Option B", preview: "Preview for B" },
        ],
      },
    ];
    expect(formatAskToolOutput(questionsWithPreview, [["Option A"]])).toBe(
      "Select approach：Option A",
    );
  });
});
