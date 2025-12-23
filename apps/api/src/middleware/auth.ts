import { Context, Next } from "hono";
import { auth } from "../lib/auth";
import { db, account, eq, and } from "@chatbot/shared/db";

export type AuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
};

/**
 * Middleware to require authentication for protected routes.
 * Sets session data on context if authenticated.
 * Returns 401 if not authenticated.
 */
export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  // Store session in context for route handlers
  c.set("session", session);
  
  await next();
}

/**
 * Get the current session from context.
 * Must be used after requireAuth middleware.
 */
export function getSession(c: Context): AuthSession {
  return c.get("session") as AuthSession;
}

/**
 * Helper to get Google account for a user.
 * Returns the account with access token for Google API calls.
 */
export async function getGoogleAccount(userId: string) {
  const accounts = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")));
  
  return accounts[0] || null;
}
