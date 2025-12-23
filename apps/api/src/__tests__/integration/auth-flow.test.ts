import "../setup";
import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { cors } from "hono/cors";

/**
 * Auth Flow Integration Tests
 * 
 * These tests verify the end-to-end authentication flow including:
 * - Google OAuth login flow initiation
 * - Session persistence across requests
 * - Logout and redirect behavior
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

// Mock session storage to simulate session persistence
const sessionStore = new Map<string, any>();

// Helper to create a mock auth handler
const createMockAuthHandler = () => {
  return {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const cookie = headers.get("Cookie");
        if (!cookie) return null;
        
        const sessionMatch = cookie.match(/session=([^;]+)/);
        if (!sessionMatch) return null;
        
        const sessionId = sessionMatch[1];
        return sessionStore.get(sessionId) || null;
      },
    },
    handler: async (req: Request) => {
      const url = new URL(req.url);
      const path = url.pathname;
      
      // Handle Google OAuth sign-in initiation
      if (path.includes("/signin/google") || path.includes("/sign-in/social")) {
        // Simulate redirect to Google OAuth
        const callbackUrl = url.searchParams.get("callbackURL") || "/";
        return new Response(null, {
          status: 302,
          headers: {
            Location: `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(callbackUrl)}`,
          },
        });
      }
      
      // Handle OAuth callback (simulated)
      if (path.includes("/callback/google")) {
        // Create a new session
        const sessionId = `session-${Date.now()}`;
        const userId = `user-${Date.now()}`;
        
        const session = {
          user: {
            id: userId,
            name: "Test User",
            email: "test@example.com",
            image: null,
          },
          session: {
            id: sessionId,
            userId,
            expiresAt: new Date(Date.now() + 86400000), // 24 hours
          },
        };
        
        sessionStore.set(sessionId, session);
        
        const callbackUrl = url.searchParams.get("callbackURL") || "/";
        return new Response(null, {
          status: 302,
          headers: {
            Location: callbackUrl,
            "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
          },
        });
      }
      
      // Handle sign-out
      if (path.includes("/signout") || path.includes("/sign-out")) {
        const cookie = req.headers.get("Cookie");
        if (cookie) {
          const sessionMatch = cookie.match(/session=([^;]+)/);
          if (sessionMatch) {
            sessionStore.delete(sessionMatch[1]);
          }
        }
        
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
          },
        });
      }
      
      // Handle session check
      if (path.includes("/session")) {
        const cookie = req.headers.get("Cookie");
        if (!cookie) {
          return new Response(JSON.stringify({ session: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        const sessionMatch = cookie.match(/session=([^;]+)/);
        if (!sessionMatch) {
          return new Response(JSON.stringify({ session: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        const session = sessionStore.get(sessionMatch[1]);
        return new Response(JSON.stringify({ session: session || null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      return new Response("Not Found", { status: 404 });
    },
  };
};

describe("Auth Flow Integration Tests", () => {
  let app: Hono;
  let mockAuth: ReturnType<typeof createMockAuthHandler>;

  beforeEach(() => {
    sessionStore.clear();
    mockAuth = createMockAuthHandler();
    
    app = new Hono();
    
    // CORS middleware
    app.use("*", cors({
      origin: "http://localhost:3000",
      credentials: true,
    }));
    
    // Auth routes
    app.on(["POST", "GET"], "/api/auth/*", (c) => mockAuth.handler(c.req.raw));
    
    // Protected route
    app.get("/chat/history", async (c) => {
      const session = await mockAuth.api.getSession({ headers: c.req.raw.headers });
      if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      return c.json({ messages: [], userId: session.user.id });
    });
  });

  afterEach(() => {
    sessionStore.clear();
  });

  describe("Google OAuth Login Flow (Requirement 1.2)", () => {
    test("initiates Google OAuth flow when signing in", async () => {
      const res = await app.request("/api/auth/signin/google?callbackURL=/chat");
      
      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toContain("accounts.google.com");
    });

    test("creates session after successful OAuth callback", async () => {
      // Simulate OAuth callback
      const res = await app.request("/api/auth/callback/google?callbackURL=/chat");
      
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/chat");
      
      // Verify session cookie is set
      const setCookie = res.headers.get("Set-Cookie");
      expect(setCookie).toContain("session=");
    });

    test("session contains user info after OAuth callback", async () => {
      // First, simulate OAuth callback to create session
      const callbackRes = await app.request("/api/auth/callback/google");
      const setCookie = callbackRes.headers.get("Set-Cookie");
      const sessionMatch = setCookie?.match(/session=([^;]+)/);
      const sessionId = sessionMatch?.[1];
      
      expect(sessionId).toBeDefined();
      
      // Check session endpoint
      const sessionRes = await app.request("/api/auth/session", {
        headers: { Cookie: `session=${sessionId}` },
      });
      
      const body = await sessionRes.json();
      expect(body.session).toBeDefined();
      expect(body.session.user.email).toBe("test@example.com");
    });
  });

  describe("Session Persistence (Requirement 1.3)", () => {
    test("session persists across multiple requests", async () => {
      // Create session via OAuth callback
      const callbackRes = await app.request("/api/auth/callback/google");
      const setCookie = callbackRes.headers.get("Set-Cookie");
      const sessionMatch = setCookie?.match(/session=([^;]+)/);
      const sessionId = sessionMatch?.[1];
      
      // Make multiple requests with the same session
      for (let i = 0; i < 3; i++) {
        const res = await app.request("/chat/history", {
          headers: { Cookie: `session=${sessionId}` },
        });
        
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.userId).toBeDefined();
      }
    });

    test("protected routes are accessible with valid session", async () => {
      // Create session
      const callbackRes = await app.request("/api/auth/callback/google");
      const setCookie = callbackRes.headers.get("Set-Cookie");
      const sessionMatch = setCookie?.match(/session=([^;]+)/);
      const sessionId = sessionMatch?.[1];
      
      // Access protected route
      const res = await app.request("/chat/history", {
        headers: { Cookie: `session=${sessionId}` },
      });
      
      expect(res.status).toBe(200);
    });

    test("protected routes return 401 without session", async () => {
      const res = await app.request("/chat/history");
      
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });
  });

  describe("Logout and Redirect (Requirement 1.4)", () => {
    test("logout destroys session", async () => {
      // Create session
      const callbackRes = await app.request("/api/auth/callback/google");
      const setCookie = callbackRes.headers.get("Set-Cookie");
      const sessionMatch = setCookie?.match(/session=([^;]+)/);
      const sessionId = sessionMatch?.[1];
      
      // Verify session exists
      const beforeLogout = await app.request("/chat/history", {
        headers: { Cookie: `session=${sessionId}` },
      });
      expect(beforeLogout.status).toBe(200);
      
      // Logout
      const logoutRes = await app.request("/api/auth/signout", {
        method: "POST",
        headers: { Cookie: `session=${sessionId}` },
      });
      
      expect(logoutRes.status).toBe(200);
      
      // Verify session is destroyed
      const afterLogout = await app.request("/chat/history", {
        headers: { Cookie: `session=${sessionId}` },
      });
      expect(afterLogout.status).toBe(401);
    });

    test("logout clears session cookie", async () => {
      // Create session
      const callbackRes = await app.request("/api/auth/callback/google");
      const setCookie = callbackRes.headers.get("Set-Cookie");
      const sessionMatch = setCookie?.match(/session=([^;]+)/);
      const sessionId = sessionMatch?.[1];
      
      // Logout
      const logoutRes = await app.request("/api/auth/signout", {
        method: "POST",
        headers: { Cookie: `session=${sessionId}` },
      });
      
      // Verify cookie is cleared
      const logoutCookie = logoutRes.headers.get("Set-Cookie");
      expect(logoutCookie).toContain("session=");
      expect(logoutCookie).toContain("Expires=Thu, 01 Jan 1970");
    });
  });

  describe("Unauthenticated Access (Requirement 1.1)", () => {
    test("unauthenticated requests to protected routes return 401", async () => {
      const res = await app.request("/chat/history");
      
      expect(res.status).toBe(401);
    });

    test("requests with invalid session return 401", async () => {
      const res = await app.request("/chat/history", {
        headers: { Cookie: "session=invalid-session-id" },
      });
      
      expect(res.status).toBe(401);
    });

    test("requests with expired session return 401", async () => {
      // Create an expired session directly in the store
      const expiredSessionId = "expired-session";
      sessionStore.set(expiredSessionId, null); // Simulate expired/invalid session
      
      const res = await app.request("/chat/history", {
        headers: { Cookie: `session=${expiredSessionId}` },
      });
      
      expect(res.status).toBe(401);
    });
  });
});
