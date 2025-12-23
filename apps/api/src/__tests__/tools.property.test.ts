import "./setup";
import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import * as fc from "fast-check";
import { RuntimeContext } from "@mastra/core/di";

// Store original fetch
const originalFetch = globalThis.fetch;

// Helper to create a mock fetch that satisfies the type
const createMockFetch = (handler: (url: string) => Promise<Response>) => {
  const mockFn = mock(handler) as any;
  mockFn.preconnect = () => {};
  return mockFn as typeof fetch;
};

describe("Google Tools Property Tests", () => {
  beforeEach(() => {
    // Reset fetch before each test
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Feature: chatbot-app, Property 7: Google tools require valid access token
   * *For any* execution of Google_Contacts_Tool or Google_Gmail_Tool without a valid
   * access token in RuntimeContext, the tool should throw an error indicating the
   * token is not available.
   * Validates: Requirements 5.2, 5.3, 6.2, 6.3
   */
  describe("Property 7: Google tools require valid access token", () => {
    test("googleContactsTool throws error when access token is missing", async () => {
      // Import tool dynamically to avoid module initialization issues
      const { googleContactsTool } = await import(
        "../mastra/tools/google-contacts"
      );

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            query: fc.option(fc.string(), { nil: undefined }),
            maxResults: fc.integer({ min: 1, max: 100 }),
          }),
          async (input) => {
            // Test with undefined runtimeContext
            try {
              await googleContactsTool.execute({
                context: input,
                runtimeContext: undefined as any,
              });
              return false; // Should have thrown
            } catch (error: any) {
              return error.message === "Google access token not available";
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test("googleContactsTool throws error when access token is empty", async () => {
      const { googleContactsTool } = await import(
        "../mastra/tools/google-contacts"
      );

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            query: fc.option(fc.string(), { nil: undefined }),
            maxResults: fc.integer({ min: 1, max: 100 }),
          }),
          async (input) => {
            const runtimeContext = new RuntimeContext();
            // Don't set googleAccessToken

            try {
              await googleContactsTool.execute({
                context: input,
                runtimeContext,
              });
              return false; // Should have thrown
            } catch (error: any) {
              return error.message === "Google access token not available";
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test("googleGmailTool throws error when access token is missing", async () => {
      const { googleGmailTool } = await import("../mastra/tools/google-gmail");

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            query: fc.option(fc.string(), { nil: undefined }),
            maxResults: fc.integer({ min: 1, max: 100 }),
          }),
          async (input) => {
            // Test with undefined runtimeContext
            try {
              await googleGmailTool.execute({
                context: input,
                runtimeContext: undefined as any,
              });
              return false; // Should have thrown
            } catch (error: any) {
              return error.message === "Google access token not available";
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test("googleGmailTool throws error when access token is empty", async () => {
      const { googleGmailTool } = await import("../mastra/tools/google-gmail");

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            query: fc.option(fc.string(), { nil: undefined }),
            maxResults: fc.integer({ min: 1, max: 100 }),
          }),
          async (input) => {
            const runtimeContext = new RuntimeContext();
            // Don't set googleAccessToken

            try {
              await googleGmailTool.execute({
                context: input,
                runtimeContext,
              });
              return false; // Should have thrown
            } catch (error: any) {
              return error.message === "Google access token not available";
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: chatbot-app, Property 8: Google Contacts tool returns structured output
   * *For any* valid Google People API response, the Google_Contacts_Tool should return
   * an object with a contacts array where each contact has name, and optionally email
   * and phone fields.
   * Validates: Requirements 5.4
   */
  describe("Property 8: Google Contacts tool returns structured output", () => {
    test("returns properly structured contacts from API response", async () => {
      const { googleContactsTool } = await import(
        "../mastra/tools/google-contacts"
      );

      // Generator for Google People API response format
      const googlePersonArb = fc.record({
        resourceName: fc.string(),
        names: fc.option(
          fc.array(fc.record({ displayName: fc.string() }), { minLength: 1 }),
          { nil: undefined }
        ),
        emailAddresses: fc.option(
          fc.array(fc.record({ value: fc.emailAddress() }), { minLength: 1 }),
          { nil: undefined }
        ),
        phoneNumbers: fc.option(
          fc.array(
            fc.record({
              value: fc.stringMatching(/^\+?[0-9\-\s]{7,15}$/),
            }),
            { minLength: 1 }
          ),
          { nil: undefined }
        ),
      });

      const googleApiResponseArb = fc.record({
        connections: fc.array(googlePersonArb, { minLength: 0, maxLength: 20 }),
      });

      await fc.assert(
        fc.asyncProperty(googleApiResponseArb, async (apiResponse) => {
          // Mock fetch to return the generated API response
          globalThis.fetch = createMockFetch(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(apiResponse),
              text: () => Promise.resolve(JSON.stringify(apiResponse)),
            } as Response)
          );

          const runtimeContext = new RuntimeContext();
          runtimeContext.set("googleAccessToken", "valid-token");

          const result = await googleContactsTool.execute({
            context: { maxResults: 10 },
            runtimeContext,
          });

          // Verify structure
          if (!result || typeof result !== "object") return false;
          if (!Array.isArray(result.contacts)) return false;

          // Each contact must have name (string), optional email and phone
          for (const contact of result.contacts) {
            if (typeof contact.name !== "string") return false;
            if (
              contact.email !== undefined &&
              typeof contact.email !== "string"
            )
              return false;
            if (contact.phone !== undefined && typeof contact.phone !== "string")
              return false;
          }

          // Verify count matches
          if (result.contacts.length !== (apiResponse.connections?.length || 0))
            return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: chatbot-app, Property 9: Google Gmail tool returns structured output
   * *For any* valid Gmail API response, the Google_Gmail_Tool should return an object
   * with an emails array where each email has id, subject, from, date, and snippet fields.
   * Validates: Requirements 6.4
   */
  describe("Property 9: Google Gmail tool returns structured output", () => {
    test("returns properly structured emails from API response", async () => {
      const { googleGmailTool } = await import("../mastra/tools/google-gmail");

      // Generator for Gmail message list response
      const messageIdArb = fc.stringMatching(/^[a-zA-Z0-9]{16}$/);

      const gmailHeaderArb = (name: string, valueArb: fc.Arbitrary<string>) =>
        fc.record({
          name: fc.constant(name),
          value: valueArb,
        });

      const gmailDetailArb = fc.record({
        id: messageIdArb,
        snippet: fc.string({ maxLength: 200 }),
        payload: fc.record({
          headers: fc.tuple(
            gmailHeaderArb("Subject", fc.string({ maxLength: 100 })),
            gmailHeaderArb("From", fc.emailAddress()),
            gmailHeaderArb(
              "Date",
              fc.date().map((d) => d.toISOString())
            )
          ),
        }),
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(messageIdArb, { minLength: 0, maxLength: 10 }),
          fc.array(gmailDetailArb, { minLength: 0, maxLength: 10 }),
          async (messageIds, messageDetails) => {
            // Ensure we have matching details for each message
            const messages = messageIds.map((id) => ({ id }));
            const detailsMap = new Map(
              messageDetails.map((d, i) => [
                messageIds[i] || d.id,
                { ...d, id: messageIds[i] || d.id },
              ])
            );

            // Mock fetch to return list then details
            globalThis.fetch = createMockFetch((url: string) => {
              if (url.includes("/messages?") || url.endsWith("/messages")) {
                // List endpoint
                return Promise.resolve({
                  ok: true,
                  json: () => Promise.resolve({ messages }),
                  text: () => Promise.resolve(JSON.stringify({ messages })),
                } as Response);
              } else {
                // Detail endpoint - extract message ID from URL
                const msgId = url.split("/messages/")[1]?.split("?")[0];
                const detail = detailsMap.get(msgId) || {
                  id: msgId,
                  snippet: "",
                  payload: {
                    headers: [
                      { name: "Subject", value: "No Subject" },
                      { name: "From", value: "Unknown" },
                      { name: "Date", value: "" },
                    ],
                  },
                };
                return Promise.resolve({
                  ok: true,
                  json: () => Promise.resolve(detail),
                  text: () => Promise.resolve(JSON.stringify(detail)),
                } as Response);
              }
            });

            const runtimeContext = new RuntimeContext();
            runtimeContext.set("googleAccessToken", "valid-token");

            const result = await googleGmailTool.execute({
              context: { maxResults: 10 },
              runtimeContext,
            });

            // Verify structure
            if (!result || typeof result !== "object") return false;
            if (!Array.isArray(result.emails)) return false;

            // Each email must have required fields
            for (const email of result.emails) {
              if (typeof email.id !== "string") return false;
              if (typeof email.subject !== "string") return false;
              if (typeof email.from !== "string") return false;
              if (typeof email.date !== "string") return false;
              if (typeof email.snippet !== "string") return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
