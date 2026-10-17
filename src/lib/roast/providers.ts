import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import type { Summary } from "@/lib/summary";
import { buildRoastPrompt, SYSTEM_PROMPT } from "./prompt";
import { RoastOutputSchema, type RoastOutput } from "./schema";

export type ProviderName = "gemini" | "groq";

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  gemini: "gemini-3.8-flash",
  groq: "openai/gpt-oss-120b",
};

// "OFF" is the most permissive setting Gemini offers (PRD F11).
const GEMINI_SAFETY_OFF = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "OFF" }));

// Full thinking takes 20–100 s per roast; "low" keeps it inside the reveal sequence.
function geminiThinking(): "minimal" | "low" | "medium" | "high" {
  const level = process.env.GEMINI_THINKING;
  return level === "minimal" || level === "medium" || level === "high" ? level : "low";
}

function modelFor(provider: ProviderName, modelId?: string) {
  if (provider === "gemini") return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })(modelId ?? process.env.GEMINI_MODEL ?? DEFAULT_MODELS.gemini);
  return groq(modelId ?? process.env.GROQ_MODEL ?? DEFAULT_MODELS.groq);
}

/** Throws when the provider refuses, errors, or returns output that fails the schema. */
/** With a signal (the generation chain), retries are off: the chain owns retries and timeouts. */
export async function generateRoastWith(
  provider: ProviderName,
  summary: Summary,
  modelId?: string,
  signal?: AbortSignal,
): Promise<RoastOutput> {
  const { output } = await generateText({
    model: modelFor(provider, modelId),
    instructions: SYSTEM_PROMPT,
    prompt: buildRoastPrompt(summary),
    output: Output.object({ schema: RoastOutputSchema }),
    temperature: 1,
    maxRetries: signal ? 0 : 1,
    abortSignal: signal,
    providerOptions:
      provider === "gemini"
        ? { google: { safetySettings: GEMINI_SAFETY_OFF, thinkingConfig: { thinkingLevel: geminiThinking() } } }
        : undefined,
  });
  return output;
}
