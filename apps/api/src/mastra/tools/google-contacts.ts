import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const googleContactsTool = createTool({
  id: "google-contacts",
  description:
    "Fetches the user's Google contacts. Use when asked about contacts or people.",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Optional search query to filter contacts"),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum contacts to return"),
  }),
  outputSchema: z.object({
    contacts: z.array(
      z.object({
        name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
      })
    ),
  }),
  execute: async ({ context, runtimeContext }) => {
    const accessToken = runtimeContext?.get("googleAccessToken") as
      | string
      | undefined;

    if (!accessToken) {
      throw new Error("Google access token not available");
    }

    const maxResults = context.maxResults ?? 10;
    const url = new URL(
      "https://people.googleapis.com/v1/people/me/connections"
    );
    url.searchParams.set(
      "personFields",
      "names,emailAddresses,phoneNumbers"
    );
    url.searchParams.set("pageSize", String(maxResults));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch contacts: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const contacts = (data.connections || []).map((person: any) => ({
      name: person.names?.[0]?.displayName || "Unknown",
      email: person.emailAddresses?.[0]?.value,
      phone: person.phoneNumbers?.[0]?.value,
    }));

    return { contacts };
  },
});
