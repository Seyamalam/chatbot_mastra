import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function handler(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace("/api/auth", "/api/auth");
  const targetUrl = `${API_URL}${pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" ? await request.text() : undefined,
    credentials: "include",
  });

  const responseHeaders = new Headers(response.headers);

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export { handler as GET, handler as POST };
