import { streamText } from "ai";
import { google } from "@ai-sdk/google";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.GOOGLE_MODEL ?? "gemini-2.5-flash-lite";

interface SourcePayload {
  url: string;
  title?: string;
}

export async function POST(req: Request) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "Missing GOOGLE_GENERATIVE_AI_API_KEY." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as { country?: string };
    const country = body.country?.trim();

    if (!country) {
      return Response.json(
        { error: "Country is required." },
        { status: 400 }
      );
    }

    const prompt =
      "You create concise, prayer-oriented briefs from web sources. " +
      "Be factual, compassionate, and neutral. Avoid speculation and political persuasion. " +
      "If recent information is limited, say so. Do not include graphic details.\n\n" +
      `Country: ${country}\n` +
      "Task: Provide a short prayer brief based on current events from the last 7 days. " +
      "Format with headings exactly as:\n" +
      "Snapshot:\n" +
      "Prayer Focus:\n" +
      "Hope & Help:\n" +
      "Use 2-3 sentences for Snapshot. " +
      "Use 3-5 bullet points for Prayer Focus. " +
      "Use 1-2 bullet points for Hope & Help. " +
      "Keep the total under 180 words. " +
      "Do not include raw URLs or publication names in parentheses; sources are handled separately.";

    const result = streamText({
      model: google(MODEL),
      prompt,
      maxOutputTokens: 500,
      temperature: 0.3,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        };

        try {
          let text = "";
          const sources: SourcePayload[] = [];

          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              const delta = part.text;
              if (delta) {
                text += delta;
                sendEvent("delta", { delta });
              }
              continue;
            }

            if (part.type === "source" && part.sourceType === "url") {
              if (part.url) {
                sources.push({ url: part.url, title: part.title });
              }
              continue;
            }

            if (part.type === "error") {
              sendEvent("error", {
                error:
                  part.error instanceof Error
                    ? part.error.message
                    : "Unable to load prayer brief.",
              });
            }
          }

          const trimmed = text.trim();
          if (!trimmed) {
            sendEvent("error", { error: "No brief returned from model." });
            controller.close();
            return;
          }

          const dedupedSources = Array.from(
            new Map(
              sources
                .filter((source) => source.url)
                .map((source) => [source.url, source])
            ).values()
          );

          sendEvent("done", {
            country,
            updatedAt: new Date().toISOString(),
            text: trimmed,
            sources: dedupedSources,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error.";
          sendEvent("error", { error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
