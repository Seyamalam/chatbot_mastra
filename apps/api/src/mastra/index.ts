import { Mastra } from "@mastra/core/mastra";
import { PostgresStore, PgVector } from "@mastra/pg";
import { env } from "../config/env";
import { chatAgent } from "./agents/chat-agent";

const connectionString = env.DATABASE_URL;

// Create storage and vector instances
const storage = new PostgresStore({ connectionString });
const vectors = new PgVector({ connectionString });

// Create Mastra instance with observability enabled
export const mastra = new Mastra({
  agents: { chatAgent },
  storage,
  vectors: {
    pgVector: vectors,
  },
  telemetry: {
    enabled: true,
  },
});

// Export storage and vectors for direct access if needed
export { storage, vectors };
