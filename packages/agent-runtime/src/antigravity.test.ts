import { describe, expect, it, vi } from "vitest";
import { antigravityApi, stream } from "./antigravity.js";

const testModel = {
  id: "gemini-3.8-flash-high",
  api: "antigravity",
  provider: "antigravity-provider",
  name: "Gemini 3.8 Flash High",
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1_000_000,
  maxTokens: 64_000,
  baseUrl: "https://cloudcode-pa.googleapis.com",
} as any;

const testContext = {
  systemPrompt: "You are a helpful assistant",
  messages: [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: "Hello!" }],
      timestamp: Date.now(),
    },
  ],
  tools: [],
};

function createMockSseResponse(lines: string[], status = 200, headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + "\n"));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    status,
    headers: {
      "content-type": "text/event-stream",
      ...headers,
    },
  });
}

describe("Antigravity stream adapter", () => {
  it("exports ProviderStreams with stream and streamSimple", () => {
    const api = antigravityApi();
    expect(typeof api.stream).toBe("function");
    expect(typeof api.streamSimple).toBe("function");
  });

  it("sends request with project envelope and extracts streamed text", async () => {
    let capturedUrl = "";
    let capturedBody: any;
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn(async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      capturedHeaders = init.headers;

      return createMockSseResponse([
        'data: {"response":{"candidates":[{"content":{"parts":[{"text":"Hi"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5,"totalTokenCount":15}}}',
        'data: {"response":{"candidates":[{"content":{"parts":[{"text":" there!"}]},"finishReason":"STOP"}]}}',
        "data: [DONE]",
      ]);
    });

    const eventStream = stream(testModel, testContext, {
      apiKey: "test-token-123",
      headers: { "x-goog-user-project": "my-gcp-project" },
      fetch: mockFetch as any,
    });

    const events: any[] = [];
    for await (const event of eventStream) {
      events.push(event);
    }

    expect(capturedUrl).toBe("https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse");
    expect(capturedBody).toMatchObject({
      project: "my-gcp-project",
      model: "gemini-3.8-flash-high",
      request: {
        systemInstruction: { parts: [{ text: "You are a helpful assistant" }] },
      },
    });
    expect(capturedHeaders.Authorization).toBe("Bearer test-token-123");
    expect(capturedHeaders["User-Agent"]).toContain("antigravity");
    expect(capturedHeaders["Client-Metadata"]).toBeDefined();

    const result = await eventStream.result();
    expect(result.stopReason).toBe("stop");
    expect(result.content).toEqual([{ type: "text", text: "Hi there!" }]);
    expect(result.usage.input).toBe(10);
    expect(result.usage.output).toBe(5);
  });

  it("handles thinking parts in the streamed response", async () => {
    const mockFetch = vi.fn(async () => {
      return createMockSseResponse([
        'data: {"response":{"candidates":[{"content":{"parts":[{"thought":true,"text":"Thinking step 1"}]}}]}}',
        'data: {"response":{"candidates":[{"content":{"parts":[{"thought":true,"text":"... done thinking"}]}}]}}',
        'data: {"response":{"candidates":[{"content":{"parts":[{"text":"Final answer"}]},"finishReason":"STOP"}]}}',
      ]);
    });

    const eventStream = stream(testModel, testContext, {
      apiKey: "test-token-123",
      reasoning: "high",
      fetch: mockFetch as any,
    });

    const textChunks: string[] = [];
    const thinkingChunks: string[] = [];
    for await (const event of eventStream) {
      if (event.type === "text_delta") textChunks.push(event.delta);
      if (event.type === "thinking_delta") thinkingChunks.push(event.delta);
    }

    expect(thinkingChunks.join("")).toBe("Thinking step 1... done thinking");
    expect(textChunks.join("")).toBe("Final answer");

    const result = await eventStream.result();
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toMatchObject({ type: "thinking", thinking: "Thinking step 1... done thinking" });
    expect(result.content[1]).toMatchObject({ type: "text", text: "Final answer" });
  });

  it("surfaces HTTP errors cleanly", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response('{"error":{"message":"Resource exhausted: quota exceeded","code":429}}', {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    });

    const eventStream = stream(testModel, testContext, {
      apiKey: "test-token-123",
      fetch: mockFetch as any,
    });

    const events: any[] = [];
    for await (const event of eventStream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    const result = await eventStream.result();
    expect(result.stopReason).toBe("error");
    expect(result.errorMessage).toContain("quota exceeded");
  });
  it("serializes tools using parametersJsonSchema for Gemini models (preserving const)", async () => {
    let capturedBody: any;
    const mockFetch = vi.fn(async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      return createMockSseResponse(['data: {"response":{"candidates":[{"content":{"parts":[{"text":"ok"}]}}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":2,"totalTokenCount":7}}}', 'data: {"response":{"candidates":[{"content":{"parts":[]},"finishReason":"STOP"}]}}', 'data: [DONE]']);
    });

    const toolWithConst = {
      name: "Grep",
      description: "Search file contents",
      parameters: {
        type: "object",
        properties: {
          outputMode: {
            anyOf: [
              { const: "content", type: "string" },
              { const: "filesWithMatches", type: "string" },
            ],
          },
        },
        required: ["outputMode"],
      },
    } as any;

    const eventStream = stream(
      testModel,
      { ...testContext, tools: [toolWithConst] },
      { apiKey: "test-token", fetch: mockFetch as any },
    );

    for await (const _ of eventStream) {}

    const toolGroup = capturedBody.request.tools[0];
    const decl = toolGroup.functionDeclarations[0];
    expect(decl.name).toBe("Grep");
    expect(decl.parametersJsonSchema).toBeDefined();
    expect(decl.parameters).toBeUndefined();
    expect(decl.parametersJsonSchema.properties.outputMode.anyOf[0].const).toBe("content");
  });

  it("serializes tools using parameters with const sanitized to enum for Claude models", async () => {
    let capturedBody: any;
    const mockFetch = vi.fn(async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      return createMockSseResponse(['data: {"response":{"candidates":[{"content":{"parts":[{"text":"ok"}]}}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":2,"totalTokenCount":7}}}', 'data: {"response":{"candidates":[{"content":{"parts":[]},"finishReason":"STOP"}]}}', 'data: [DONE]']);
    });

    const claudeModel = {
      ...testModel,
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
    };

    const toolWithConst = {
      name: "Grep",
      description: "Search file contents",
      parameters: {
        type: "object",
        properties: {
          outputMode: {
            anyOf: [
              { const: "content", type: "string" },
              { const: "filesWithMatches", type: "string" },
            ],
          },
        },
        required: ["outputMode"],
      },
    } as any;

    const eventStream = stream(
      claudeModel,
      { ...testContext, tools: [toolWithConst] },
      { apiKey: "test-token", fetch: mockFetch as any },
    );

    for await (const _ of eventStream) {}

    const toolGroup = capturedBody.request.tools[0];
    const decl = toolGroup.functionDeclarations[0];
    expect(decl.name).toBe("Grep");
    expect(decl.parameters).toBeDefined();
    expect(decl.parametersJsonSchema).toBeUndefined();
    const serializedDecl = JSON.stringify(decl);
    expect(serializedDecl).not.toContain('"const"');
    expect(decl.parameters.properties.outputMode.anyOf[0].enum).toEqual(["content"]);
    expect(decl.parameters.properties.outputMode.anyOf[1].enum).toEqual(["filesWithMatches"]);
  });
});
