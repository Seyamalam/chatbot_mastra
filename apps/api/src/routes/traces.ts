import { Hono } from "hono";
import { requireAuth, getSession } from "../middleware/auth";
import { storage, mastra } from "../mastra";

const traces = new Hono();

// Apply auth middleware to all traces routes
traces.use("*", requireAuth);

/**
 * GET /traces
 * Get list of traces grouped by conversation (threadId)
 */
traces.get("/", async (c) => {
  const session = getSession(c);
  const groupBy = c.req.query("groupBy") || "conversation"; // "conversation" or "trace"

  try {
    if (groupBy === "conversation") {
      // Get threads for this user from Mastra memory
      const agent = mastra.getAgent("chatAgent");
      const memory = await agent.getMemory();

      if (!memory) {
        return c.json({ conversations: [], traces: [] });
      }

      const threads = await memory.getThreadsByResourceId({
        resourceId: session.user.id,
        orderBy: "updatedAt",
        sortDirection: "DESC",
      });

      // For each thread, get trace count and latest trace info
      const conversations = await Promise.all(
        threads.map(async (thread: any) => {
          // Get traces for this thread by querying metadata
          const threadTraces = await storage.db.any(
            `SELECT DISTINCT "traceId", "startedAt", "endedAt", metadata, input, output
             FROM mastra_ai_spans 
             WHERE metadata->>'threadId' = $1
             AND "parentSpanId" IS NULL
             ORDER BY "startedAt" DESC`,
            [thread.id]
          );

          return {
            threadId: thread.id,
            title: thread.title || "Untitled Chat",
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            traceCount: threadTraces.length,
            traces: threadTraces.map((t: any) => ({
              traceId: t.traceId,
              startTime: t.startedAt,
              endTime: t.endedAt,
              input: t.input,
              output: t.output,
            })),
          };
        })
      );

      return c.json({ conversations, groupBy: "conversation" });
    }

    // Original behavior: list individual traces
    const limit = parseInt(c.req.query("limit") || "50");
    const page = parseInt(c.req.query("page") || "0");
    const offset = page * limit;

    const spans = await storage.db.any(
      `SELECT * FROM mastra_ai_spans 
       ORDER BY "startedAt" DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Group spans by traceId
    const tracesMap = new Map<string, any>();

    for (const span of spans) {
      const traceId = span.traceId;
      if (!tracesMap.has(traceId)) {
        tracesMap.set(traceId, {
          traceId,
          name: span.name,
          startTime: span.startedAt,
          endTime: span.endedAt,
          spans: [],
          metadata: span.metadata,
          attributes: span.attributes,
        });
      }
      tracesMap.get(traceId).spans.push(span);

      const trace = tracesMap.get(traceId);
      if (span.endedAt && (!trace.endTime || new Date(span.endedAt) > new Date(trace.endTime))) {
        trace.endTime = span.endedAt;
      }
    }

    const tracesList = Array.from(tracesMap.values());
    const countResult = await storage.db.one(
      'SELECT COUNT(DISTINCT "traceId") as count FROM mastra_ai_spans'
    );

    return c.json({
      traces: tracesList,
      groupBy: "trace",
      pagination: { limit, page, total: parseInt(countResult.count) },
    });
  } catch (error) {
    console.error("Error fetching traces:", error);
    return c.json({ conversations: [], traces: [], error: "Failed to fetch traces" });
  }
});

/**
 * GET /traces/conversation/:threadId
 * Get all traces for a specific conversation
 */
traces.get("/conversation/:threadId", async (c) => {
  const { threadId } = c.req.param();

  try {
    // Get all root spans (traces) for this thread
    const rootSpans = await storage.db.any(
      `SELECT DISTINCT "traceId", "startedAt", "endedAt", metadata, input, output, name
       FROM mastra_ai_spans 
       WHERE metadata->>'threadId' = $1
       AND "parentSpanId" IS NULL
       ORDER BY "startedAt" ASC`,
      [threadId]
    );

    // Get thread info from Mastra memory
    const agent = mastra.getAgent("chatAgent");
    const memory = await agent.getMemory();
    const thread = memory ? await memory.getThreadById({ threadId }) : null;

    return c.json({
      threadId,
      title: thread?.title || "Untitled Chat",
      traces: rootSpans.map((s: any) => ({
        traceId: s.traceId,
        name: s.name,
        startTime: s.startedAt,
        endTime: s.endedAt,
        input: s.input,
        output: s.output,
        metadata: s.metadata,
      })),
    });
  } catch (error) {
    console.error("Error fetching conversation traces:", error);
    return c.json({ error: "Failed to fetch conversation traces" }, 500);
  }
});

/**
 * GET /traces/:traceId
 * Get a specific trace by ID with all its spans
 */
traces.get("/:traceId", async (c) => {
  const { traceId } = c.req.param();

  try {
    // Get all spans for this trace from mastra_ai_spans
    const spans = await storage.db.any(
      `SELECT * FROM mastra_ai_spans 
       WHERE "traceId" = $1 
       ORDER BY "startedAt" ASC`,
      [traceId]
    );

    if (spans.length === 0) {
      return c.json({ error: "Trace not found" }, 404);
    }

    // Find the root span (no parentSpanId)
    const rootSpan = spans.find((s: any) => !s.parentSpanId) || spans[0];

    const trace = {
      traceId,
      spans: spans.map((s: any) => ({
        id: s.spanId,
        traceId: s.traceId,
        name: s.name,
        type: s.spanType,
        startTime: s.startedAt,
        endTime: s.endedAt,
        input: s.input,
        output: s.output,
        metadata: s.metadata,
        attributes: s.attributes,
        errorInfo: s.error,
        parentSpanId: s.parentSpanId,
        isRootSpan: !s.parentSpanId,
      })),
      startTime: rootSpan.startedAt,
      endTime: spans[spans.length - 1]?.endedAt,
      metadata: rootSpan.metadata,
    };

    return c.json({ trace });
  } catch (error) {
    console.error("Error fetching trace:", error);
    return c.json({ error: "Failed to fetch trace" }, 500);
  }
});

export default traces;
