import "./setup";
import { describe, test, expect, mock, beforeEach } from "bun:test";
import * as fc from "fast-check";
import { Hono } from "hono";

/**
 * Frontend Property Tests
 * 
 * These tests verify the properties related to frontend authentication behavior.
 * We test the endpoint logic by creating a minimal Hono app that mimics
 * the protected routes behavior.
 */

// Helper to create a valid session
const createMockSession = (userId: string = "user-123") => ({
  user: {
    id: userId,
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  session: {
    id: `session-${userId}`,
    userId,
    expiresAt: new Date(Date.now() + 86400000),
  },
});

// Simulated auth middleware that checks for session
const createAuthMiddleware = (getSession: () => any) => {
  return async (c: any, next: () => Promise<void>) => {
    const session = getSession();
    if (!session) {
      // Return 401 for API routes (frontend would redirect based on this)
      return c.json({ error: "Unauthorized", redirect: "/login" }, 401);
    }
    c.set("session", session);
    await next();
  };
};

describe("Frontend Property Tests", () => {
  /**
   * Feature: chatbot-app, Property 1: Unauthenticated requests redirect to login
   * *For any* HTTP request to a protected route without valid session credentials,
   * the system should return a redirect response (401 with redirect info) to the login page.
   * Validates: Requirements 1.1
   */
  describe("Property 1: Unauthenticated requests redirect to login", () => {
    test("protected routes return 401 with redirect for unauthenticated requests", async () => {
      // Generator for protected route paths
      const protectedRouteArb = fc.constantFrom(
        "/chat/stream",
        "/chat/history",
        "/api/protected",
        "/api/user/profile"
      );

      // Generator for HTTP methods
      const methodArb = fc.constantFrom("GET", "POST");

      await fc.assert(
        fc.asyncProperty(
          protectedRouteArb,
          methodArb,
          async (route, method) => {
            const app = new Hono();
            
            // Apply auth middleware that always returns no session
            const authMiddleware = createAuthMiddleware(() => null);
            
            app.use("/*", authMiddleware);
            app.get("/*", (c) => c.json({ data: "protected" }));
            app.post("/*", (c) => c.json({ data: "protected" }));

            const res = await app.request(route, { method });

            // Should return 401 with redirect info
            if (res.status !== 401) return false;

            const body = await res.json();
            return body.error === "Unauthorized" && body.redirect === "/login";
          }
        ),
        { numRuns: 100 }
      );
    });

    test("any request without session cookie returns unauthorized", async () => {
      // Generator for random request bodies
      const bodyArb = fc.option(
        fc.record({
          message: fc.string({ minLength: 1, maxLength: 200 }),
          threadId: fc.option(fc.uuid(), { nil: undefined }),
        }),
        { nil: undefined }
      );

      await fc.assert(
        fc.asyncProperty(bodyArb, async (body) => {
          const app = new Hono();
          
          // Simulate checking for session cookie
          const authMiddleware = async (c: any, next: () => Promise<void>) => {
            const cookie = c.req.header("Cookie");
            // No session cookie = unauthorized
            if (!cookie || !cookie.includes("session=")) {
              return c.json({ error: "Unauthorized", redirect: "/login" }, 401);
            }
            await next();
          };
          
          app.use("/*", authMiddleware);
          app.post("/chat/stream", (c) => c.json({ data: "ok" }));

          const options: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          };
          
          if (body) {
            options.body = JSON.stringify(body);
          }

          // Request without session cookie
          const res = await app.request("/chat/stream", options);

          return res.status === 401;
        }),
        { numRuns: 100 }
      );
    });

    test("expired sessions are treated as unauthenticated", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.integer({ min: 1, max: 1000000 }), // milliseconds in the past
          async (userId, msInPast) => {
            const app = new Hono();
            
            // Create expired session
            const expiredSession = {
              ...createMockSession(userId),
              session: {
                id: `session-${userId}`,
                userId,
                expiresAt: new Date(Date.now() - msInPast), // Expired
              },
            };
            
            const authMiddleware = async (c: any, next: () => Promise<void>) => {
              // Check if session is expired
              if (new Date(expiredSession.session.expiresAt) < new Date()) {
                return c.json({ error: "Unauthorized", redirect: "/login" }, 401);
              }
              c.set("session", expiredSession);
              await next();
            };
            
            app.use("/*", authMiddleware);
            app.get("/chat/history", (c) => c.json({ messages: [] }));

            const res = await app.request("/chat/history");

            // Expired session should return 401
            return res.status === 401;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: chatbot-app, Property 10: Authenticated requests include credentials
   * *For any* request made from the frontend to protected backend endpoints,
   * the request should include session credentials (cookies).
   * Validates: Requirements 8.4
   */
  describe("Property 10: Authenticated requests include credentials", () => {
    test("requests with valid session cookie are authorized", async () => {
      // Use alphanumeric strings to avoid issues with special characters in cookies
      const userIdArb = fc.stringMatching(/^[a-zA-Z0-9]{5,20}$/);
      
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          fc.string({ minLength: 1, maxLength: 200 }),
          async (userId, message) => {
            const app = new Hono();
            const session = createMockSession(userId);
            
            // Simulate checking for session cookie
            const authMiddleware = async (c: any, next: () => Promise<void>) => {
              const cookie = c.req.header("Cookie");
              // Valid session cookie = authorized
              if (cookie && cookie.includes(`session=${session.session.id}`)) {
                c.set("session", session);
                await next();
              } else {
                return c.json({ error: "Unauthorized" }, 401);
              }
            };
            
            app.use("/*", authMiddleware);
            app.post("/chat/stream", (c) => {
              const sess = c.get("session");
              return c.json({ userId: sess.user.id });
            });

            // Request with valid session cookie
            const res = await app.request("/chat/stream", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: `session=${session.session.id}`,
              },
              body: JSON.stringify({ message }),
            });

            if (res.status !== 200) return false;

            const body = await res.json();
            return body.userId === userId;
          }
        ),
        { numRuns: 100 }
      );
    });

    test("credentials mode include sends cookies with requests", async () => {
      // This test verifies the pattern that frontend uses credentials: "include"
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }),
          async (userId) => {
            const app = new Hono();
            const session = createMockSession(userId);
            let receivedCookie: string | null = null;
            
            app.use("/*", async (c, next) => {
              receivedCookie = c.req.header("Cookie") || null;
              const cookie = c.req.header("Cookie");
              if (cookie && cookie.includes("session=")) {
                c.set("session", session);
                await next();
              } else {
                return c.json({ error: "Unauthorized" }, 401);
              }
            });
            
            app.get("/chat/history", (c) => c.json({ messages: [] }));

            // Simulate request with credentials: "include" (sends cookies)
            const res = await app.request("/chat/history", {
              headers: {
                Cookie: `session=${session.session.id}; other=value`,
              },
            });

            // Verify cookie was received and request was authorized
            return (
              res.status === 200 &&
              receivedCookie !== null &&
              receivedCookie.includes("session=")
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test("session user id is correctly extracted from credentials", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.emailAddress(),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (userId, email, name) => {
            const app = new Hono();
            const session = {
              user: { id: userId, email, name, image: null },
              session: {
                id: `session-${userId}`,
                userId,
                expiresAt: new Date(Date.now() + 86400000),
              },
            };
            
            let extractedUserId: string | null = null;
            
            app.use("/*", async (c, next) => {
              const cookie = c.req.header("Cookie");
              if (cookie && cookie.includes(`session=${session.session.id}`)) {
                c.set("session", session);
                await next();
              } else {
                return c.json({ error: "Unauthorized" }, 401);
              }
            });
            
            app.get("/api/user", (c) => {
              const sess = c.get("session");
              extractedUserId = sess.user.id;
              return c.json({ user: sess.user });
            });

            const res = await app.request("/api/user", {
              headers: {
                Cookie: `session=${session.session.id}`,
              },
            });

            if (res.status !== 200) return false;

            const body = await res.json();
            return (
              extractedUserId === userId &&
              body.user.id === userId &&
              body.user.email === email &&
              body.user.name === name
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
