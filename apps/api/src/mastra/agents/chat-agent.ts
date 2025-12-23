import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PostgresStore, PgVector } from "@mastra/pg";
import { openai } from "@ai-sdk/openai";
import { env } from "../../config/env";
import { googleContactsTool } from "../tools/google-contacts";
import { googleGmailTool } from "../tools/google-gmail";

const connectionString = env.DATABASE_URL;

// Create memory with PostgresStore and PgVector for semantic recall
const memory = new Memory({
  storage: new PostgresStore({ connectionString }),
  vector: new PgVector({ connectionString }),
  options: {
    lastMessages: 20,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
  },
});

// Create the chat agent with memory and tool capabilities
export const chatAgent = new Agent({
  name: "chat-agent",
  instructions: `You are a helpful assistant with access to the user's Google contacts and emails.
When asked about contacts, use the googleContactsTool.
When asked about emails, use the googleGmailTool.
Be concise and helpful in your responses.`,
  model: openai("gpt-4o-mini"),
  memory,
  tools: { googleContactsTool, googleGmailTool },
});
