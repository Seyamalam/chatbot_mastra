import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";

// Mock the auth module before importing middleware
const mockGetSession = mock<() => Promise<any>>(() => Promise.resolve(null));

mock.module("../lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

// Import after mocking
import { requireAuth, getSession, type AuthSession } from "../middleware/auth";

describe("Auth Middleware", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    mockGetSession.mockReset();
  });

  describe("requireAuth middleware", () => {
    test("returns 401 when no session exists", async () => {
      mockGetSession.mockResolvedValue(null);
      
      app.use("/protected/*", requireAuth);
      app.get("/protected/resource", (c) => c.json({ data: "secret" }));

      const res = await app.request("/protected/resource");
      
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    test("allows access when valid session exists", async () => {
      const mockSession: AuthSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
          image: null,
        },
        session: {
          id: "session-456",
          userId: "user-123",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };
      
      mockGetSession.mockResolvedValue(mockSession);
      
      app.use("/protected/*", requireAuth);
      app.get("/protected/resource", (c) => {
        const session = getSession(c);
        return c.json({ userId: session.user.id });
      });

      const res = await app.request("/protected/resource");
      
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe("user-123");
    });

    test("sets session in context for downstream handlers", async () => {
      const mockSession: AuthSession = {
        user: {
          id: "user-789",
          name: "Another User",
          email: "another@example.com",
          image: "https://example.com/avatar.jpg",
        },
        session: {
          id: "session-abc",
          userId: "user-789",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };
      
      mockGetSession.mockResolvedValue(mockSession);
      
      app.use("/protected/*", requireAuth);
      app.get("/protected/profile", (c) => {
        const session = getSession(c);
        return c.json({
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        });
      });

      const res = await app.request("/protected/profile");
      
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("user-789");
      expect(body.name).toBe("Another User");
      expect(body.email).toBe("another@example.com");
    });
  });

  describe("session destruction", () => {
    test("returns 401 after session is destroyed", async () => {
      // First request with valid session
      const mockSession: AuthSession = {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
        },
        session: {
          id: "session-456",
          userId: "user-123",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };
      
      mockGetSession.mockResolvedValue(mockSession);
      
      app.use("/protected/*", requireAuth);
      app.get("/protected/resource", (c) => c.json({ data: "secret" }));

      const res1 = await app.request("/protected/resource");
      expect(res1.status).toBe(200);

      // Simulate session destruction
      mockGetSession.mockResolvedValue(null);

      const res2 = await app.request("/protected/resource");
      expect(res2.status).toBe(401);
    });
  });
});

describe("Health Check", () => {
  test("returns ok status", async () => {
    const app = new Hono();
    app.get("/health", (c) => c.json({ status: "ok" }));

    const res = await app.request("/health");
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
