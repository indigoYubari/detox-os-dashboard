import { NextRequest, NextResponse } from "next/server"

// Server-side proxy mot Anthropic. Nøkkelen ligger KUN på serveren
// (ANTHROPIC_API_KEY, ikke NEXT_PUBLIC) og eksponeres aldri til nettleseren.
export const runtime = "nodejs"

const ZOOM_SYSTEM_PROMPT =
  "Du er en klinisk assistent for en funksjonell medisinpraktiker. Analyser dette Zoom-møtereferatet og returner: 1) Nøkkelpunkter fra møtet (bullet-liste), 2) Anbefalte oppfølgingstester, 3) Første utkast til protokoll med tiltak. Svar på norsk."

const MODEL = "claude-sonnet-4-6"
const MAX_TOKENS = 2048

type AnthropicTextBlock = { type: string; text?: string }
type AnthropicResponse = { content?: AnthropicTextBlock[] }

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY er ikke konfigurert på serveren." },
      { status: 500 },
    )
  }

  let text: string
  try {
    const body = (await request.json()) as { text?: unknown }
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json(
        { error: "Mangler «text» i forespørselen." },
        { status: 400 },
      )
    }
    text = body.text
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON." }, { status: 400 })
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: ZOOM_SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json(
        { error: `Anthropic-feil (${res.status}): ${detail}` },
        { status: 502 },
      )
    }

    const data = (await res.json()) as AnthropicResponse
    const analysis = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("\n")

    return NextResponse.json({ analysis: analysis || "Tomt svar fra API." })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukjent feil."
    return NextResponse.json(
      { error: `Kunne ikke kontakte Anthropic: ${message}` },
      { status: 502 },
    )
  }
}
