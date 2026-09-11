import { describe, expect, it, vi } from "vitest";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
} from "@earendil-works/pi-ai";
import {
  createProviderFallbackStream,
  type FallbackTarget,
} from "./provider-retry.js";

const dummyModel = {
  id: "model",
  api: "openai-completions",
  provider: "provider",
  name: "Model",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 32_000,
  maxTokens: 4_000,
  baseUrl: "https://provider.invalid/v1",
} as any;

const dummyContext = { messages: [], tools: [] };

function errorMessage(msg: string): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: "openai-completions",
    provider: "provider",
    model: "model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage: msg,
    timestamp: Date.now(),
  };
}

function successMessage(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-completions",
    provider: "provider",
    model: "model",
    usage: {
      input: 10,
      output: 10,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 20,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

describe("provider fallback stream", () => {
  it("uses primary provider when successful", async () => {
    const primaryController = {
      claim: () => undefined,
      status: () => 200,
      headers: () => ({}),
      sleep: vi.fn(),
    };

    const target1: FallbackTarget = {
      model: dummyModel,
      controller: primaryController as any,
      createStream: () => {
        const stream = createAssistantMessageEventStream();
        const msg = successMessage("Primary response");
        queueMicrotask(() => {
          stream.push({ type: "start", partial: msg });
          stream.push({ type: "text_delta", contentIndex: 0, delta: "Primary response", partial: msg });
          stream.end(msg);
        });
        return stream;
      },
    };

    const fallbackStream = createProviderFallbackStream([target1], dummyContext, {});
    const result = await fallbackStream.result();
    expect(result.stopReason).toBe("stop");
    expect(result.content[0]).toEqual({ type: "text", text: "Primary response" });
  });

  it("falls back to secondary provider when primary fails pre-stream", async () => {
    const primaryController = {
      claim: () => undefined, // retries exhausted or not claimable
      status: () => 429,
      headers: () => ({}),
      sleep: vi.fn(),
    };

    const secondaryController = {
      claim: () => undefined,
      status: () => 200,
      headers: () => ({}),
      sleep: vi.fn(),
    };

    const onFallback = vi.fn();

    const target1: FallbackTarget = {
      model: dummyModel,
      controller: primaryController as any,
      createStream: () => {
        const stream = createAssistantMessageEventStream();
        queueMicrotask(() => {
          stream.push({
            type: "error",
            reason: "error",
            error: errorMessage("429: quota exhausted"),
          });
          stream.end(errorMessage("429: quota exhausted"));
        });
        return stream;
      },
    };

    const target2: FallbackTarget = {
      model: dummyModel,
      controller: secondaryController as any,
      createStream: () => {
        const stream = createAssistantMessageEventStream();
        const msg = successMessage("Fallback response");
        queueMicrotask(() => {
          stream.push({ type: "start", partial: msg });
          stream.push({ type: "text_delta", contentIndex: 0, delta: "Fallback response", partial: msg });
          stream.end(msg);
        });
        return stream;
      },
    };

    const fallbackStream = createProviderFallbackStream([target1, target2], dummyContext, {}, onFallback);
    const result = await fallbackStream.result();

    expect(onFallback).toHaveBeenCalledWith(0, 1, expect.anything());
    expect(result.stopReason).toBe("stop");
    expect(result.content[0]).toEqual({ type: "text", text: "Fallback response" });
  });
});
