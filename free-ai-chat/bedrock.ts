import "dotenv/config";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  Message,
} from "@aws-sdk/client-bedrock-runtime";
import { secret } from "encore.dev/config";
import { freeAIChatDB } from "./db";
import { pruneMessages } from "./message-pruning";

// Use Encore secrets with fallback to environment variables for local development
const BEDROCK_MODEL_ID_SECRET = secret("BEDROCK_MODEL_ID");
const AWS_REGION_SECRET = secret("AWS_REGION");
const BEDROCK_COST_SECRET = secret("BEDROCK_COST_PER_1K_TOKENS");

const BEDROCK_MODEL_ID = BEDROCK_MODEL_ID_SECRET() || process.env.BEDROCK_MODEL_ID || "amazon.titan-text-lite-v1";
const BEDROCK_REGION = AWS_REGION_SECRET() || process.env.AWS_REGION || "us-east-1";
const BEDROCK_COST_PER_1K_TOKENS = parseFloat(
  BEDROCK_COST_SECRET() || process.env.BEDROCK_COST_PER_1K_TOKENS || "0.0001"
);

// Use Encore secrets with fallback to environment variables for local development
const AWS_ACCESS_KEY_ID_SECRET = secret("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY_SECRET = secret("AWS_SECRET_ACCESS_KEY");

let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  if (bedrockClient) {
    return bedrockClient;
  }

  // Try Encore secrets first, fall back to environment variables for local dev
  const accessKeyId = AWS_ACCESS_KEY_ID_SECRET() || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = AWS_SECRET_ACCESS_KEY_SECRET() || process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY using:\n" +
      "  - Encore secrets (for cloud): 'encore secret set --type local AWS_ACCESS_KEY_ID' and 'encore secret set --type local AWS_SECRET_ACCESS_KEY'\n" +
      "  - Or environment variables (for local dev): Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file or environment"
    );
  }

  bedrockClient = new BedrockRuntimeClient({
    region: BEDROCK_REGION,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return bedrockClient;
}

export interface BedrockResponse {
  content: string;
  tokensUsed: number;
  costUsd: number;
}

export async function estimateTokenCount(text: string): Promise<number> {
  return Math.ceil(text.length / 4);
}

export async function invokeBedrock(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<BedrockResponse> {
  // Convert messages to Converse API format
  const converseMessages: Message[] = messages
    .filter((msg) => msg.role !== "system") // System messages go in system array
    .map((msg): Message => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: [{ text: msg.content }],
    }));

  // Estimate tokens for all messages + system prompt
  const allText = systemPrompt + "\n\n" + messages.map((m) => m.content).join("\n");
  const estimatedInputTokens = await estimateTokenCount(allText);

  const command = new ConverseCommand({
    modelId: BEDROCK_MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: converseMessages,
    inferenceConfig: {
      maxTokens: 1000,
      temperature: 0.7,
      topP: 0.9,
    },
  });

  const client = getBedrockClient();
  const response = await client.send(command);

  // Extract text from response.output.message.content array
  const outputText =
    response.output?.message?.content
      ?.filter((block: any) => block.text != null)
      .map((block: any) => block.text)
      .join("") || "";

  const outputTokens = await estimateTokenCount(outputText);
  const totalTokens = estimatedInputTokens + outputTokens;
  const costUsd = (totalTokens / 1000) * BEDROCK_COST_PER_1K_TOKENS;

  return {
    content: outputText.trim(),
    tokensUsed: totalTokens,
    costUsd,
  };
}


export async function getSessionMessages(sessionId: string, limit: number = 20): Promise<Array<{ role: string; content: string }>> {
  const messages = await freeAIChatDB.query<{
    role: string;
    content: string;
  }>`
    SELECT role, content
    FROM conversation_message
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const result: Array<{ role: string; content: string }> = [];
  for await (const msg of messages) {
    result.unshift(msg);
  }

  return result;
}

export async function saveMessage(
  sessionId: string,
  role: "system" | "user" | "assistant",
  content: string,
  tokenCount: number
): Promise<void> {
  await freeAIChatDB.exec`
    INSERT INTO conversation_message (session_id, role, content, token_count)
    VALUES (${sessionId}, ${role}, ${content}, ${tokenCount})
  `;

  await freeAIChatDB.exec`
    UPDATE conversation_session
    SET total_messages = total_messages + 1,
        total_tokens_used = total_tokens_used + ${tokenCount},
        updated_at = NOW()
    WHERE id = ${sessionId}
  `;

  await pruneMessages(sessionId);
}
