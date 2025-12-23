import "../setup";
import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { RuntimeContext } from "@mastra/core/di";

/**
 * Google Tools Integration Tests
 * 
 * These tests verify the Google tools integration including:
 * - Ask about contacts and verify tool execution
 * - Ask about emails and verify tool execution
 * 
 * Requirements: 5.1, 6.1
 */

// Store original fetch
const originalFetch = globalThis.fetch;

// Helper to create a mock fetch that satisfies the type
const createMockFetch = (handler: (url: string, init?: RequestInit) => Promise<Response>) => {
  const mockFn = mock(handler) as any;
  mockFn.preconnect = () => {};
  return mockFn as typeof fetch;
};

describe("Google Tools Integration Tests", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("Google Contacts Tool (Requirement 5.1)", () => {
    test("fetches contacts when asked about contacts", async () => {
      const { googleContactsTool } = await import("../../mastra/tools/google-contacts");
      
      // Mock Google People API response
      const mockContacts = {
        connections: [
          {
            resourceName: "people/1",
            names: [{ displayName: "John Doe" }],
            emailAddresses: [{ value: "john@example.com" }],
            phoneNumbers: [{ value: "+1234567890" }],
          },
          {
            resourceName: "people/2",
            names: [{ displayName: "Jane Smith" }],
            emailAddresses: [{ value: "jane@example.com" }],
          },
        ],
      };
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("people.googleapis.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockContacts),
            text: () => Promise.resolve(JSON.stringify(mockContacts)),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      const result = await googleContactsTool.execute({
        context: { maxResults: 10 },
        runtimeContext,
      });
      
      expect(result.contacts).toBeDefined();
      expect(result.contacts.length).toBe(2);
      expect(result.contacts[0].name).toBe("John Doe");
      expect(result.contacts[0].email).toBe("john@example.com");
      expect(result.contacts[0].phone).toBe("+1234567890");
      expect(result.contacts[1].name).toBe("Jane Smith");
      expect(result.contacts[1].email).toBe("jane@example.com");
    });

    test("handles contacts without email or phone", async () => {
      const { googleContactsTool } = await import("../../mastra/tools/google-contacts");
      
      const mockContacts = {
        connections: [
          {
            resourceName: "people/1",
            names: [{ displayName: "Contact Without Details" }],
          },
        ],
      };
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("people.googleapis.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockContacts),
            text: () => Promise.resolve(JSON.stringify(mockContacts)),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      const result = await googleContactsTool.execute({
        context: { maxResults: 10 },
        runtimeContext,
      });
      
      expect(result.contacts.length).toBe(1);
      expect(result.contacts[0].name).toBe("Contact Without Details");
      expect(result.contacts[0].email).toBeUndefined();
      expect(result.contacts[0].phone).toBeUndefined();
    });

    test("handles empty contacts list", async () => {
      const { googleContactsTool } = await import("../../mastra/tools/google-contacts");
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("people.googleapis.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connections: [] }),
            text: () => Promise.resolve(JSON.stringify({ connections: [] })),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      const result = await googleContactsTool.execute({
        context: { maxResults: 10 },
        runtimeContext,
      });
      
      expect(result.contacts).toBeDefined();
      expect(result.contacts.length).toBe(0);
    });

    test("throws error when access token is missing", async () => {
      const { googleContactsTool } = await import("../../mastra/tools/google-contacts");
      
      const runtimeContext = new RuntimeContext();
      // Don't set googleAccessToken
      
      await expect(
        googleContactsTool.execute({
          context: { maxResults: 10 },
          runtimeContext,
        })
      ).rejects.toThrow("Google access token not available");
    });

    test("throws error when API returns error", async () => {
      const { googleContactsTool } = await import("../../mastra/tools/google-contacts");
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("people.googleapis.com")) {
          return Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve("Unauthorized"),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "invalid-token");
      
      await expect(
        googleContactsTool.execute({
          context: { maxResults: 10 },
          runtimeContext,
        })
      ).rejects.toThrow("Failed to fetch contacts");
    });

    test("respects maxResults parameter", async () => {
      const { googleContactsTool } = await import("../../mastra/tools/google-contacts");
      
      let capturedUrl: string | null = null;
      
      globalThis.fetch = createMockFetch((url) => {
        capturedUrl = url;
        if (url.includes("people.googleapis.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connections: [] }),
            text: () => Promise.resolve(JSON.stringify({ connections: [] })),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      await googleContactsTool.execute({
        context: { maxResults: 5 },
        runtimeContext,
      });
      
      expect(capturedUrl).toContain("pageSize=5");
    });
  });

  describe("Google Gmail Tool (Requirement 6.1)", () => {
    test("fetches emails when asked about emails", async () => {
      const { googleGmailTool } = await import("../../mastra/tools/google-gmail");
      
      // Mock Gmail API responses
      const mockMessageList = {
        messages: [
          { id: "msg1" },
          { id: "msg2" },
        ],
      };
      
      const mockMessageDetails: Record<string, any> = {
        msg1: {
          id: "msg1",
          snippet: "This is the first email snippet",
          payload: {
            headers: [
              { name: "Subject", value: "First Email Subject" },
              { name: "From", value: "sender1@example.com" },
              { name: "Date", value: "Mon, 1 Jan 2024 10:00:00 +0000" },
            ],
          },
        },
        msg2: {
          id: "msg2",
          snippet: "This is the second email snippet",
          payload: {
            headers: [
              { name: "Subject", value: "Second Email Subject" },
              { name: "From", value: "sender2@example.com" },
              { name: "Date", value: "Tue, 2 Jan 2024 11:00:00 +0000" },
            ],
          },
        },
      };
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("gmail.googleapis.com")) {
          if (url.includes("/messages?") || url.endsWith("/messages")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockMessageList),
              text: () => Promise.resolve(JSON.stringify(mockMessageList)),
            } as Response);
          } else {
            // Extract message ID from URL
            const msgId = url.split("/messages/")[1]?.split("?")[0];
            const detail = mockMessageDetails[msgId] || {
              id: msgId,
              snippet: "",
              payload: { headers: [] },
            };
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(detail),
              text: () => Promise.resolve(JSON.stringify(detail)),
            } as Response);
          }
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      const result = await googleGmailTool.execute({
        context: { maxResults: 10 },
        runtimeContext,
      });
      
      expect(result.emails).toBeDefined();
      expect(result.emails.length).toBe(2);
      expect(result.emails[0].id).toBe("msg1");
      expect(result.emails[0].subject).toBe("First Email Subject");
      expect(result.emails[0].from).toBe("sender1@example.com");
      expect(result.emails[0].snippet).toBe("This is the first email snippet");
      expect(result.emails[1].id).toBe("msg2");
      expect(result.emails[1].subject).toBe("Second Email Subject");
    });

    test("handles empty email list", async () => {
      const { googleGmailTool } = await import("../../mastra/tools/google-gmail");
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("gmail.googleapis.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ messages: [] }),
            text: () => Promise.resolve(JSON.stringify({ messages: [] })),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      const result = await googleGmailTool.execute({
        context: { maxResults: 10 },
        runtimeContext,
      });
      
      expect(result.emails).toBeDefined();
      expect(result.emails.length).toBe(0);
    });

    test("handles emails with missing headers", async () => {
      const { googleGmailTool } = await import("../../mastra/tools/google-gmail");
      
      const mockMessageList = { messages: [{ id: "msg1" }] };
      const mockMessageDetail = {
        id: "msg1",
        snippet: "Email without headers",
        payload: { headers: [] },
      };
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("gmail.googleapis.com")) {
          if (url.includes("/messages?") || url.endsWith("/messages")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockMessageList),
              text: () => Promise.resolve(JSON.stringify(mockMessageList)),
            } as Response);
          } else {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockMessageDetail),
              text: () => Promise.resolve(JSON.stringify(mockMessageDetail)),
            } as Response);
          }
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      const result = await googleGmailTool.execute({
        context: { maxResults: 10 },
        runtimeContext,
      });
      
      expect(result.emails.length).toBe(1);
      expect(result.emails[0].subject).toBe("No Subject");
      expect(result.emails[0].from).toBe("Unknown");
      expect(result.emails[0].snippet).toBe("Email without headers");
    });

    test("throws error when access token is missing", async () => {
      const { googleGmailTool } = await import("../../mastra/tools/google-gmail");
      
      const runtimeContext = new RuntimeContext();
      // Don't set googleAccessToken
      
      await expect(
        googleGmailTool.execute({
          context: { maxResults: 10 },
          runtimeContext,
        })
      ).rejects.toThrow("Google access token not available");
    });

    test("throws error when API returns error", async () => {
      const { googleGmailTool } = await import("../../mastra/tools/google-gmail");
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("gmail.googleapis.com")) {
          return Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve("Unauthorized"),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "invalid-token");
      
      await expect(
        googleGmailTool.execute({
          context: { maxResults: 10 },
          runtimeContext,
        })
      ).rejects.toThrow("Failed to fetch emails");
    });

    test("respects maxResults parameter", async () => {
      const { googleGmailTool } = await import("../../mastra/tools/google-gmail");
      
      let capturedUrl: string | null = null;
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("/messages?") || url.endsWith("/messages")) {
          capturedUrl = url;
        }
        if (url.includes("gmail.googleapis.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ messages: [] }),
            text: () => Promise.resolve(JSON.stringify({ messages: [] })),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      await googleGmailTool.execute({
        context: { maxResults: 5 },
        runtimeContext,
      });
      
      expect(capturedUrl).toContain("maxResults=5");
    });

    test("supports search query parameter", async () => {
      const { googleGmailTool } = await import("../../mastra/tools/google-gmail");
      
      let capturedUrl: string | null = null;
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("/messages?") || url.endsWith("/messages")) {
          capturedUrl = url;
        }
        if (url.includes("gmail.googleapis.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ messages: [] }),
            text: () => Promise.resolve(JSON.stringify({ messages: [] })),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "valid-access-token");
      
      await googleGmailTool.execute({
        context: { maxResults: 10, query: "from:test@example.com" },
        runtimeContext,
      });
      
      expect(capturedUrl).toContain("q=from");
    });
  });

  describe("Tool Execution in Chat Context", () => {
    test("contacts tool can be executed with valid runtime context", async () => {
      const { googleContactsTool } = await import("../../mastra/tools/google-contacts");
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("people.googleapis.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              connections: [
                {
                  names: [{ displayName: "Test Contact" }],
                  emailAddresses: [{ value: "test@example.com" }],
                },
              ],
            }),
            text: () => Promise.resolve("{}"),
          } as Response);
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      // Simulate runtime context as it would be set in chat route
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "user-oauth-token");
      runtimeContext.set("userId", "user-123");
      
      const result = await googleContactsTool.execute({
        context: { maxResults: 10 },
        runtimeContext,
      });
      
      expect(result.contacts).toBeDefined();
      expect(result.contacts.length).toBe(1);
    });

    test("gmail tool can be executed with valid runtime context", async () => {
      const { googleGmailTool } = await import("../../mastra/tools/google-gmail");
      
      globalThis.fetch = createMockFetch((url) => {
        if (url.includes("gmail.googleapis.com")) {
          if (url.includes("/messages?") || url.endsWith("/messages")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                messages: [{ id: "test-msg" }],
              }),
              text: () => Promise.resolve("{}"),
            } as Response);
          } else {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                id: "test-msg",
                snippet: "Test email",
                payload: {
                  headers: [
                    { name: "Subject", value: "Test Subject" },
                    { name: "From", value: "test@example.com" },
                    { name: "Date", value: "2024-01-01" },
                  ],
                },
              }),
              text: () => Promise.resolve("{}"),
            } as Response);
          }
        }
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      });
      
      // Simulate runtime context as it would be set in chat route
      const runtimeContext = new RuntimeContext();
      runtimeContext.set("googleAccessToken", "user-oauth-token");
      runtimeContext.set("userId", "user-123");
      
      const result = await googleGmailTool.execute({
        context: { maxResults: 10 },
        runtimeContext,
      });
      
      expect(result.emails).toBeDefined();
      expect(result.emails.length).toBe(1);
      expect(result.emails[0].subject).toBe("Test Subject");
    });
  });
});
