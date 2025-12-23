import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const googleGmailTool = createTool({
  id: "google-gmail",
  description:
    "Fetches the user's recent emails from Gmail. Use when asked about emails or messages.",
  inputSchema: z.object({
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum emails to return"),
    query: z.string().optional().describe("Optional Gmail search query"),
  }),
  outputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        subject: z.string(),
        from: z.string(),
        date: z.string(),
        snippet: z.string(),
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

    // List messages
    const listUrl = new URL(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages"
    );
    listUrl.searchParams.set("maxResults", String(maxResults));
    if (context.query) {
      listUrl.searchParams.set("q", context.query);
    }

    const listResponse = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      throw new Error(`Failed to fetch emails: ${listResponse.status} ${errorText}`);
    }

    const listData = await listResponse.json();
    const messages = listData.messages || [];

    // Fetch details for each message
    const emails = await Promise.all(
      messages.slice(0, maxResults).map(async (msg: { id: string }) => {
        const detailUrl = new URL(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`
        );
        detailUrl.searchParams.set("format", "metadata");
        detailUrl.searchParams.set("metadataHeaders", "Subject");
        detailUrl.searchParams.append("metadataHeaders", "From");
        detailUrl.searchParams.append("metadataHeaders", "Date");

        const detailResponse = await fetch(detailUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!detailResponse.ok) {
          return {
            id: msg.id,
            subject: "Error fetching email",
            from: "Unknown",
            date: "",
            snippet: "",
          };
        }

        const detail = await detailResponse.json();
        const headers: Array<{ name: string; value: string }> =
          detail.payload?.headers || [];

        return {
          id: msg.id,
          subject:
            headers.find((h) => h.name === "Subject")?.value || "No Subject",
          from: headers.find((h) => h.name === "From")?.value || "Unknown",
          date: headers.find((h) => h.name === "Date")?.value || "",
          snippet: detail.snippet || "",
        };
      })
    );

    return { emails };
  },
});
