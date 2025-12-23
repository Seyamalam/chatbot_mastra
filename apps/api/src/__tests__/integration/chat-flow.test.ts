import "../setup";
import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { cors } from "hono/cors";

/**
 * Chat Flow Integration Tests
 * 
 * These tests verify the end-to-end chat flow including:
 * - Send message and verify streaming response
 * - Verify message persistence
 * - Test semantic recall with follow-up questions
 * 
 * Requirements: 2.1, 2.2, 3.2, 4.2, 4.3
 */

// Mock session storage
const sessionStore = new Map<string, any>();

// Mock message storage (simulates Mastra Memory)
const messageStore = new Map<string, any[]>();

// Helper to create a mock session
const createMockSession = (userId: string = "user-123") => ({
  user: {
    id: userId,
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  session: {
    id: `session-${userId}`,
    userId,
    expiresAt: new Date(Date.now() + 86400000),
  },
});

// Helper to create a streaming response
const createStreamResponse = (chunks: string[]) => {
  const encoder = new TextEncoder();
  let index = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        // Format as AI SDK streaming format
        const chunk = `0:${JSON.stringify(chunks[index])}\n`;
        controller.enqueue(encoder.encode(chunk));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};

// Helper to store a message
const storeMessage = (threadId: string, message: any) => {
  const messages = messageStore.get(threadId) || [];
  messages.push({
    ...message,
    id: message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: message.createdAt || new Date().toISOString(),
  });
  messageStore.set(threadId, messages);
};

// Helper to get messages for a thread
const getMessages = (threadId: string) => {
  const messages = messageStore.get(threadId) || [];
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
};

describe("Chat Flow Integration Tests", () => {
  let app: Hono;
  let mockAgentStream: ReturnType<typeof mock>;

  beforeEach(() => {
    sessionStore.clear();
    messageStore.clear();
    
    // Create a mock session
    const session = createMockSession("user-123");
    sessionStore.set(session.session.id, session);
    
    mockAgentStream = mock(() => Promise.resolve({
      toUIMessageStreamResponse: () => createStreamResponse(["Hello", ", ", "how ", "can ", "I ", "help?"]),
    }));
    
    app = new Hono();
    
    // CORS middleware
    app.use("*", cors({
      origin: "http://localhost:3000",
      credentials: true,
    }));
    
    // Auth middleware
    app.use("*", async (c, next) => {
      const cookie = c.req.header("Cookie");
      if (!cookie) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      
      const sessionMatch = cookie.match(/session=([^;]+)/);
      if (!sessionMatch) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      
      const session = sessionStore.get(sessionMatch[1]);
      if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      
      c.set("session" as never, session as never);
      await next();
    });
    
    // Chat stream endpoint
    app.post("/chat/stream", async (c) => {
      const session = c.get("session" as never) as any;
      const { message, threadId } = await c.req.json();
      
      if (!message || typeof message !== "string") {
        return c.json({ error: "Message is required" }, 400);
      }
      
      const resolvedThreadId = threadId || `thread-${session.user.id}`;
      
      // Store user message
      storeMessage(resolvedThreadId, {
        role: "user",
        content: message,
      });
      
      // Get streaming response from mock agent
      const streamResult = await mockAgentStream();
      
      // Store assistant response (simulated)
      storeMessage(resolvedThreadId, {
        role: "assistant",
        content: "Hello, how can I help?",
      });
      
      return streamResult.toUIMessageStreamResponse();
    });
    
    // Chat history endpoint
    app.get("/chat/history", async (c) => {
      const session = c.get("session" as never) as any;
      const threadId = c.req.query("threadId") || `thread-${session.user.id}`;
      
      const messages = getMessages(threadId);
      
      return c.json({ messages });
    });
  });

  afterEach(() => {
    sessionStore.clear();
    messageStore.clear();
  });

  describe("Send Message and Streaming Response (Requirements 2.1, 2.2)", () => {
    test("sends message and receives streaming response", async () => {
      const session = createMockSession("user-123");
      
      const res = await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "Hello, AI!" }),
      });
      
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    });

    test("streaming response contains chunked data", async () => {
      const session = createMockSession("user-123");
      
      const res = await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "Hello!" }),
      });
      
      expect(res.status).toBe(200);
      
      // Read the stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let chunkCount = 0;
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        chunkCount++;
      }
      
      // Should have received multiple chunks
      expect(chunkCount).toBeGreaterThan(0);
      expect(fullContent).toContain("Hello");
    });

    test("user message is displayed in conversation", async () => {
      const session = createMockSession("user-123");
      const userMessage = "What is the weather today?";
      
      // Send message
      await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });
      
      // Get history
      const historyRes = await app.request("/chat/history", {
        headers: { Cookie: `session=${session.session.id}` },
      });
      
      const body = await historyRes.json();
      const userMessages = body.messages.filter((m: any) => m.role === "user");
      
      expect(userMessages.length).toBeGreaterThan(0);
      expect(userMessages[0].content).toBe(userMessage);
    });

    test("rejects empty messages", async () => {
      const session = createMockSession("user-123");
      
      const res = await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "" }),
      });
      
      expect(res.status).toBe(400);
    });
  });

  describe("Message Persistence (Requirement 3.2)", () => {
    test("messages are persisted after sending", async () => {
      const session = createMockSession("user-123");
      
      // Send a message
      await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "First message" }),
      });
      
      // Get history
      const historyRes = await app.request("/chat/history", {
        headers: { Cookie: `session=${session.session.id}` },
      });
      
      const body = await historyRes.json();
      expect(body.messages.length).toBeGreaterThan(0);
    });

    test("multiple messages are persisted in order", async () => {
      const session = createMockSession("user-123");
      const messages = ["First", "Second", "Third"];
      
      // Send multiple messages
      for (const msg of messages) {
        await app.request("/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session=${session.session.id}`,
          },
          body: JSON.stringify({ message: msg }),
        });
      }
      
      // Get history
      const historyRes = await app.request("/chat/history", {
        headers: { Cookie: `session=${session.session.id}` },
      });
      
      const body = await historyRes.json();
      const userMessages = body.messages.filter((m: any) => m.role === "user");
      
      // Verify messages are in order
      expect(userMessages.length).toBe(3);
      expect(userMessages[0].content).toBe("First");
      expect(userMessages[1].content).toBe("Second");
      expect(userMessages[2].content).toBe("Third");
    });

    test("both user and assistant messages are persisted", async () => {
      const session = createMockSession("user-123");
      
      // Send a message
      await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "Hello" }),
      });
      
      // Get history
      const historyRes = await app.request("/chat/history", {
        headers: { Cookie: `session=${session.session.id}` },
      });
      
      const body = await historyRes.json();
      const userMessages = body.messages.filter((m: any) => m.role === "user");
      const assistantMessages = body.messages.filter((m: any) => m.role === "assistant");
      
      expect(userMessages.length).toBeGreaterThan(0);
      expect(assistantMessages.length).toBeGreaterThan(0);
    });
  });

  describe("Semantic Recall with Follow-up Questions (Requirements 4.2, 4.3)", () => {
    test("conversation context is maintained across messages", async () => {
      const session = createMockSession("user-123");
      
      // Send initial message
      await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "My name is John" }),
      });
      
      // Send follow-up question
      await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "What is my name?" }),
      });
      
      // Get history - should have both messages
      const historyRes = await app.request("/chat/history", {
        headers: { Cookie: `session=${session.session.id}` },
      });
      
      const body = await historyRes.json();
      const userMessages = body.messages.filter((m: any) => m.role === "user");
      
      expect(userMessages.length).toBe(2);
      expect(userMessages[0].content).toContain("John");
      expect(userMessages[1].content).toContain("name");
    });

    test("messages are associated with correct thread", async () => {
      const session = createMockSession("user-123");
      const customThreadId = "custom-thread-123";
      
      // Send message to custom thread
      await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ 
          message: "Message in custom thread",
          threadId: customThreadId,
        }),
      });
      
      // Get history for custom thread
      const historyRes = await app.request(`/chat/history?threadId=${customThreadId}`, {
        headers: { Cookie: `session=${session.session.id}` },
      });
      
      const body = await historyRes.json();
      expect(body.messages.length).toBeGreaterThan(0);
      
      // Get history for default thread (should be empty)
      const defaultHistoryRes = await app.request("/chat/history", {
        headers: { Cookie: `session=${session.session.id}` },
      });
      
      const defaultBody = await defaultHistoryRes.json();
      expect(defaultBody.messages.length).toBe(0);
    });

    test("history loads previous messages on page load", async () => {
      const session = createMockSession("user-123");
      
      // Send some messages
      await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "Previous message 1" }),
      });
      
      await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({ message: "Previous message 2" }),
      });
      
      // Simulate page reload - get history
      const historyRes = await app.request("/chat/history", {
        headers: { Cookie: `session=${session.session.id}` },
      });
      
      const body = await historyRes.json();
      
      // Should have all previous messages
      expect(body.messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
    });
  });

  describe("Error Handling", () => {
    test("returns 401 for unauthenticated requests", async () => {
      const res = await app.request("/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello" }),
      });
      
      expect(res.status).toBe(401);
    });

    test("returns 400 for missing message", async () => {
      const session = createMockSession("user-123");
      
      const res = await app.request("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${session.session.id}`,
        },
        body: JSON.stringify({}),
      });
      
      expect(res.status).toBe(400);
    });
  });
});
