import { Mastra } from "@mastra/core/mastra";
import { PostgresStore, PgVector } from "@mastra/pg";
import { env } from "../config/env";
import { chatAgent } from "./agents/chat-agent";

const connectionString = env.DATABASE_URL;

// Create storage and vector instances
const storage = new PostgresStore({ connectionString });
const vectors = new PgVector({ connectionString });

// Create Mastra instance with AI Tracing (new observability system)
export const mastra = new Mastra({
  agents: { chatAgent },
  storage,
  vectors: {
    pgVector: vectors,
  },
  // Disable deprecated telemetry to suppress warnings
  telemetry: {
    enabled: false,
  },
  // Enable new AI Tracing system
  // When enabled, the default configuration automatically includes:
  // - Service Name: "mastra"
  // - Sampling: 100% of traces
  // - Exporters: DefaultExporter (persists to storage), CloudExporter (if MASTRA_CLOUD_ACCESS_TOKEN set)
  // - Processors: SensitiveDataFilter (automatically redacts sensitive fields)
  observability: {
    default: { enabled: true },
  },
});

// Export storage and vectors for direct access if needed
export { storage, vectors };
