import { Hono } from "hono";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { mastra } from "../mastra";
import { requireAuth, getSession, getGoogleAccount } from "../middleware/auth";

const chat = new Hono();

// Apply auth middleware to all chat routes
chat.use("*", requireAuth);

/**
 * POST /chat/stream
 * Stream a chat response from the AI agent
 * Requirements: 2.2, 8.2
 */
chat.post("/stream", async (c) => {
  const session = getSession(c);
  const { message, threadId } = await c.req.json();

  if (!message || typeof message !== "string") {
    return c.json({ error: "Message is required" }, 400);
  }

  const agent = mastra.getAgent("chatAgent");

  // Get Google access token from account
  const account = await getGoogleAccount(session.user.id);

  // Create runtime context with Google access token and userId
  const runtimeContext = new RuntimeContext();
  runtimeContext.set("googleAccessToken", account?.accessToken || "");
  runtimeContext.set("userId", session.user.id);

  // Use the provided threadId or create one based on user ID
  const resolvedThreadId = threadId || `thread-${session.user.id}`;

  const stream = await agent.stream(message, {
    format: "aisdk",
    memory: {
      thread: resolvedThreadId,
      resource: session.user.id,
    },
    runtimeContext,
  });

  // Return the streaming response using AI SDK v5 format
  return stream.toUIMessageStreamResponse();
});

/**
 * GET /chat/history
 * Get chat history for a thread
 * Requirements: 2.4, 3.3
 */
chat.get("/history", async (c) => {
  const session = getSession(c);
  const threadId = c.req.query("threadId") || `thread-${session.user.id}`;

  const agent = mastra.getAgent("chatAgent");
  const memory = await agent.getMemory();

  if (!memory) {
    return c.json({ messages: [] });
  }

  const { uiMessages } = await memory.query({
    threadId,
    resourceId: session.user.id,
  });

  // Return messages in chronological order (oldest first)
  const sortedMessages = [...uiMessages].sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
  );

  return c.json({ messages: sortedMessages });
});

export default chat;
