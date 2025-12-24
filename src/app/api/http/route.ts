import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { method, url, headers, body, timeout } = await request.json();

  if (!url) {
    return NextResponse.json(
      { error: "The URL field is required for HTTP requests." },
      { status: 400 }
    );
  }

  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), Math.min(timeout ?? 15000, 60000));

  try {
    const response = await fetch(url, {
      method: method ?? "GET",
      headers: headers?.reduce(
        (acc: Record<string, string>, header: { key?: string; value?: string }) => {
          if (header?.key) {
            acc[header.key] = header.value ?? "";
          }
          return acc;
        },
        {}
      ),
      body: method && ["GET", "HEAD"].includes(method.toUpperCase()) ? undefined : body,
      signal: abortController.signal
    });

    const contentType = response.headers.get("content-type") ?? "";
    const rawBody =
      contentType.includes("application/json") || contentType.includes("+json")
        ? await response.json().catch(async () => await response.text())
        : await response.text();

    return NextResponse.json({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: rawBody,
      contentType
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The request timed out."
        : error instanceof Error
          ? error.message
          : "Unknown HTTP request error.";

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
}
