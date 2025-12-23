import { Hono } from "hono";
import { auth } from "../lib/auth";

const authRoutes = new Hono();

// All auth routes are handled by Better-Auth
// This includes:
// - GET/POST /api/auth/signin/google - Google OAuth sign in
// - GET /api/auth/callback/google - OAuth callback
// - POST /api/auth/signout - Sign out
// - GET /api/auth/session - Get current session

authRoutes.all("/*", (c) => auth.handler(c.req.raw));

export default authRoutes;
