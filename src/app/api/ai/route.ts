import { NextResponse, type NextRequest } from "next/server";

interface AiRequestPayload {
  provider?: string;
  apiKey?: string;
  model?: string;
  prompt: string;
  temperature?: number;
}

export async function POST(request: NextRequest) {
  const { provider, apiKey, model, prompt, temperature }: AiRequestPayload =
    await request.json();

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required." },
      { status: 400 }
    );
  }

  if (!apiKey || !provider) {
    return NextResponse.json({
      provider: "local",
      output: buildLocalSummary(prompt)
    });
  }

  try {
    switch (provider) {
      case "openrouter":
        return await callOpenRouter({ apiKey, model, prompt, temperature });
      case "openai":
        return await callOpenAI({ apiKey, model, prompt, temperature });
      default:
        return NextResponse.json({
          provider: "local",
          output: buildLocalSummary(prompt)
        });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach AI provider.";

    return NextResponse.json(
      {
        provider: "local",
        error: message,
        output: buildLocalSummary(prompt)
      },
      { status: 200 }
    );
  }
}

async function callOpenRouter({
  apiKey,
  model,
  prompt,
  temperature
}: Required<Pick<AiRequestPayload, "apiKey" | "prompt">> &
  Pick<AiRequestPayload, "model" | "temperature">) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://agentic-automation-studio.vercel.app",
      "X-Title": "Agentic Automation Studio"
    },
    body: JSON.stringify({
      model: model ?? "openrouter/auto",
      temperature: temperature ?? 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are an automation assistant. Return structured JSON with `summary` and optional `insights` fields."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? response.statusText);
  }

  const content =
    payload.choices?.[0]?.message?.content ??
    JSON.stringify(payload, null, 2);

  return NextResponse.json({
    provider: "openrouter",
    output: content,
    model: payload.model ?? model
  });
}

async function callOpenAI({
  apiKey,
  model,
  prompt,
  temperature
}: Required<Pick<AiRequestPayload, "apiKey" | "prompt">> &
  Pick<AiRequestPayload, "model" | "temperature">) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model ?? "gpt-4o-mini",
      temperature: temperature ?? 0.7,
      messages: [
        {
          role: "system",
          content:
            "You are an automation assistant. Return structured JSON with `summary` and optional `insights` fields."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? response.statusText);
  }

  const content =
    payload.choices?.[0]?.message?.content ??
    JSON.stringify(payload, null, 2);

  return NextResponse.json({
    provider: "openai",
    output: content,
    model: payload.model ?? model
  });
}

function buildLocalSummary(prompt: string) {
  const sentences = prompt
    .replace(/\s+/g, " ")
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const summary = sentences.slice(0, 2).join(". ");

  return {
    summary:
      summary.length > 0
        ? summary
        : "Agent executed locally. Provide an API key to access real AI providers.",
    insights: [
      "Local fallback generated this response without contacting an external API.",
      "Add a valid API key under the AI Agent node to unlock real LLM capabilities."
    ]
  };
}
