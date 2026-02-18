import { api } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { paidAIChatDB } from "./db";
import { invokeOpenAI } from "./openai";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  PaidAISession,
  PaidAIUsage,
} from "./types";

const SYSTEM_PROMPT = `You are a helpful language learning assistant. 
Help users practice their target language through conversation.
Be encouraging, correct mistakes gently, and provide explanations when appropriate.`;

function requireUserID(): string {
  const auth = getAuthData();
  if (!auth?.userID) throw APIError.unauthenticated("User ID not found");
  return auth.userID;
}

export const paidCreateSession = api(
  { method: "POST", path: "/paid/sessions", auth: true },
  async (req: CreateSessionRequest): Promise<CreateSessionResponse> => {
    const userID = requireUserID();

    const session = await paidAIChatDB.queryRow<PaidAISession>`
      INSERT INTO paid_ai_session (user_id, language_code)
      VALUES (${userID}, ${req.language_code})
      RETURNING id, user_id, language_code, created_at, last_message_at
    `;

    if (!session) {
      throw APIError.internal("Failed to create session");
    }

    return { session };
  }
);

export const paidSendMessage = api(
  { method: "POST", path: "/paid/sessions/:id/messages", auth: true },
  async (
    req: SendMessageRequest & { id: string }
  ): Promise<SendMessageResponse> => {
    const userID = requireUserID();

    const session = await paidAIChatDB.queryRow<PaidAISession>`
      SELECT id, user_id, language_code, created_at, last_message_at
      FROM paid_ai_session
      WHERE id = ${req.id} AND user_id = ${userID}
    `;

    if (!session) {
      throw APIError.notFound("Session not found");
    }

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: req.content },
    ];

    const openaiResponse = await invokeOpenAI(messages);

    await paidAIChatDB.exec`
      UPDATE paid_ai_session
      SET last_message_at = NOW()
      WHERE id = ${session.id}
    `;

    await paidAIChatDB.exec`
      INSERT INTO paid_ai_usage (user_id, session_id, tokens_used, cost_usd)
      VALUES (${userID}, ${session.id}, ${openaiResponse.tokensUsed}, ${openaiResponse.costUsd})
    `;

    const updatedSession = await paidAIChatDB.queryRow<PaidAISession>`
      SELECT id, user_id, language_code, created_at, last_message_at
      FROM paid_ai_session
      WHERE id = ${session.id}
    `;

    if (!updatedSession) {
      throw APIError.internal("Failed to update session");
    }

    return {
      content: openaiResponse.content,
      tokens_used: openaiResponse.tokensUsed,
      cost_usd: openaiResponse.costUsd,
      session: updatedSession,
    };
  }
);

export const paidGetSession = api(
  { method: "GET", path: "/paid/sessions/:id", auth: true },
  async (req: { id: string }): Promise<PaidAISession> => {
    const userID = requireUserID();

    const session = await paidAIChatDB.queryRow<PaidAISession>`
      SELECT id, user_id, language_code, created_at, last_message_at
      FROM paid_ai_session
      WHERE id = ${req.id} AND user_id = ${userID}
    `;

    if (!session) {
      throw APIError.notFound("Session not found");
    }

    return session;
  }
);

export const paidGetUsage = api(
  { method: "GET", path: "/paid/usage", auth: true },
  async (
    req: { limit?: number; offset?: number }
  ): Promise<{ usage: PaidAIUsage[]; total: number }> => {
    const userID = requireUserID();
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    const usage: PaidAIUsage[] = [];
    const rows = await paidAIChatDB.query<PaidAIUsage>`
      SELECT id, user_id, session_id, tokens_used, cost_usd, created_at
      FROM paid_ai_usage
      WHERE user_id = ${userID}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    for await (const usageItem of rows) {
      usage.push(usageItem);
    }

    const totalRow = await paidAIChatDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM paid_ai_usage
      WHERE user_id = ${userID}
    `;

    return {
      usage,
      total: totalRow?.count || 0,
    };
  }
);
