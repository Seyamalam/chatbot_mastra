import { Hono } from "hono";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { mastra } from "../mastra";
import { requireAuth, getSession, getGoogleAccount } from "../middleware/auth";

const chat = new Hono();

// Apply auth middleware to all chat routes
chat.use("*", requireAuth);

/**
 * GET /chat/threads
 * Get all threads for the current user
 */
chat.get("/threads", async (c) => {
  const session = getSession(c);
  const agent = mastra.getAgent("chatAgent");
  const memory = await agent.getMemory();

  if (!memory) {
    return c.json({ threads: [] });
  }

  const threads = await memory.getThreadsByResourceId({
    resourceId: session.user.id,
    orderBy: "updatedAt",
    sortDirection: "DESC",
  });

  return c.json({ threads });
});

/**
 * POST /chat/threads
 * Create a new thread
 */
chat.post("/threads", async (c) => {
  const session = getSession(c);
  const { title } = await c.req.json().catch(() => ({}));
  
  const agent = mastra.getAgent("chatAgent");
  const memory = await agent.getMemory();

  if (!memory) {
    return c.json({ error: "Memory not configured" }, 500);
  }

  const thread = await memory.createThread({
    resourceId: session.user.id,
    title: title || "New Chat",
  });

  return c.json({ thread });
});

/**
 * DELETE /chat/threads/:threadId
 * Delete a thread
 */
chat.delete("/threads/:threadId", async (c) => {
  const session = getSession(c);
  const threadId = c.req.param("threadId");
  
  const agent = mastra.getAgent("chatAgent");
  const memory = await agent.getMemory();

  if (!memory) {
    return c.json({ error: "Memory not configured" }, 500);
  }

  // Verify thread belongs to user
  const thread = await memory.getThreadById({ threadId });
  if (!thread || thread.resourceId !== session.user.id) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Delete all messages in the thread first
  const { uiMessages } = await memory.query({ threadId });
  if (uiMessages.length > 0) {
    await memory.deleteMessages(uiMessages.map((m) => m.id));
  }

  // Note: Mastra Memory doesn't have deleteThread, so we just delete messages
  // The thread will be orphaned but won't show in queries with messages
  
  return c.json({ success: true });
});

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
    memory: {
      thread: resolvedThreadId,
      resource: session.user.id,
    },
    runtimeContext,
  });

  // Get traceId from the stream response for observability
  const traceId = stream.traceId;

  // Return the text stream as SSE
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Send traceId as first event for client-side tracking
        if (traceId) {
          controller.enqueue(encoder.encode(`event: traceId\ndata: ${JSON.stringify(traceId)}\n\n`));
        }
        for await (const chunk of stream.textStream) {
          // Send each text chunk as SSE data
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Stream error:", error);
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
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
