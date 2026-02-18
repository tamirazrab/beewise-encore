import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export interface OpenAIResponse {
  content: string;
  tokensUsed: number;
  costUsd: number;
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const COST_PER_1K_INPUT_TOKENS = parseFloat(process.env.OPENAI_INPUT_COST_PER_1K || "0.15");
const COST_PER_1K_OUTPUT_TOKENS = parseFloat(process.env.OPENAI_OUTPUT_COST_PER_1K || "0.60");

export async function invokeOpenAI(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<OpenAIResponse> {
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    temperature: 0.7,
  });

  const choice = response.choices[0];
  if (!choice || !choice.message) {
    throw new Error("No response from OpenAI");
  }

  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const totalTokens = inputTokens + outputTokens;

  const costUsd =
    (inputTokens / 1000) * COST_PER_1K_INPUT_TOKENS +
    (outputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS;

  return {
    content: choice.message.content || "",
    tokensUsed: totalTokens,
    costUsd,
  };
}
