import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env, validateEnv } from "./config/env";
import { auth } from "./lib/auth";
import chat from "./routes/chat";

// Validate environment in production
validateEnv();

const app = new Hono();

// Logger middleware
app.use("*", logger());

// CORS middleware
app.use(
  "*",
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Better-Auth routes
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// Chat routes
app.route("/chat", chat);

const port = parseInt(env.PORT);
console.log(`Server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

// Export app for testing
export { app };
