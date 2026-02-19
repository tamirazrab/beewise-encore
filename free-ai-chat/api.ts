import { api } from "encore.dev/api";
import { APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { freeAIChatDB } from "./db";
import {
  incrementDailyUsage,
  incrementMonthlySessionUsage,
  getDailyUsage,
  getMonthlyUsage as getMonthlyUsageData,
  getMonthlyUsage,
} from "./usage-tracking";
import {
  checkDailyMessageLimit,
  checkDailyTokenLimit,
  checkMonthlySessionLimit,
  checkRequestTokenLimit,
  FREE_TIER_LIMITS,
} from "./limits";
import { invokeBedrock, getSessionMessages, saveMessage, estimateTokenCount } from "./bedrock";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  UsageResponse,
  FreeSubscriptionStatusResponse,
  ConversationSession,
  ConversationMessage,
} from "./types";

/** Supported session languages: code -> display name */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  zh: "Mandarin Chinese",
  fr: "French",
  ar: "Arabic",
  de: "German",
  ja: "Japanese",
  pt: "Portuguese",
  ko: "Korean",
  hi: "Hindi",
  ur: "Urdu",
  bn: "Bengali",
};

const SUPPORTED_LANGUAGE_CODES = new Set(Object.keys(SUPPORTED_LANGUAGES));

/** Build system prompt for the session's target language. */
function buildSystemPrompt(languageCode: string): string {
  const languageName = SUPPORTED_LANGUAGES[languageCode] ?? languageCode;
  return `You are a helpful language learning assistant. The user is practicing ${languageName}.

Rules:
- Always respond in ${languageName} only. Do not switch to another language unless the user explicitly asks.
- Have natural conversations about any topic the user brings up; use the conversation to help them practice ${languageName}.
- When the user makes grammar, spelling, or word-choice mistakes, gently correct them: you can give the correct form and a brief explanation, then continue the conversation.
- Be encouraging and supportive. Help with vocabulary and phrasing when useful.
- Keep responses clear and at a level appropriate for a learner.`;
}

function requireUserID(): string {
  const auth = getAuthData();
  if (!auth?.userID) throw APIError.unauthenticated("User ID not found");
  return auth.userID;
}

/** UUID validation regex pattern */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate UUID format and throw appropriate error if invalid */
function validateUUID(id: string, paramName: string = "id"): void {
  if (!id || typeof id !== "string") {
    throw APIError.invalidArgument(`${paramName} is required`);
  }
  if (!UUID_REGEX.test(id)) {
    throw APIError.invalidArgument(
      `${paramName} must be a valid UUID format. Received: "${id}"`
    );
  }
}

export const freeCreateSession = api(
  { method: "POST", path: "/free/sessions", auth: true },
  async (req: CreateSessionRequest): Promise<CreateSessionResponse> => {
    const userID = requireUserID();

    if (!SUPPORTED_LANGUAGE_CODES.has(req.language_code)) {
      throw APIError.invalidArgument(
        `language_code must be one of: ${[...SUPPORTED_LANGUAGE_CODES].sort().join(", ")}`
      );
    }

    const monthlyUsage = await getMonthlyUsage(userID);
    const sessionCount = monthlyUsage?.session_count || 0;

    const limitCheck = checkMonthlySessionLimit(sessionCount);
    if (!limitCheck.allowed) {
      throw APIError.resourceExhausted(limitCheck.reason || "Monthly session limit reached");
    }

    const session = await freeAIChatDB.queryRow<ConversationSession>`
      INSERT INTO conversation_session (user_id, language_code, status)
      VALUES (${userID}, ${req.language_code}, 'active')
      RETURNING id, user_id, language_code, total_messages, total_tokens_used, 
                 ai_cost_estimate_usd, session_duration_seconds, status, 
                 created_at, updated_at, closed_at
    `;

    if (!session) {
      throw APIError.internal("Failed to create session");
    }

    await incrementMonthlySessionUsage(userID);
    await incrementDailyUsage(userID, 0, 0, 1);

    const systemPrompt = buildSystemPrompt(session.language_code);
    await saveMessage(session.id, "system", systemPrompt, await estimateTokenCount(systemPrompt));

    return { session };
  }
);

export const freeListSessions = api(
  { method: "GET", path: "/free/sessions", auth: true },
  async (
    req: { limit?: number; offset?: number }
  ): Promise<{ sessions: ConversationSession[]; total: number }> => {
    const userID = requireUserID();
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    const sessions: ConversationSession[] = [];
    const sessionRows = await freeAIChatDB.query<ConversationSession>`
      SELECT id, user_id, language_code, total_messages, total_tokens_used,
             ai_cost_estimate_usd, session_duration_seconds, status,
             created_at, updated_at, closed_at
      FROM conversation_session
      WHERE user_id = ${userID}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    for await (const session of sessionRows) {
      sessions.push(session);
    }

    const totalRow = await freeAIChatDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM conversation_session
      WHERE user_id = ${userID}
    `;

    return {
      sessions,
      total: totalRow?.count || 0,
    };
  }
);

export const freeGetSession = api(
  { method: "GET", path: "/free/sessions/:id", auth: true },
  async (req: { id: string }): Promise<ConversationSession> => {
    const userID = requireUserID();
    
    // Validate UUID format for path parameter
    validateUUID(req.id, "session id");

    const session = await freeAIChatDB.queryRow<ConversationSession>`
      SELECT id, user_id, language_code, total_messages, total_tokens_used,
             ai_cost_estimate_usd, session_duration_seconds, status,
             created_at, updated_at, closed_at
      FROM conversation_session
      WHERE id = ${req.id} AND user_id = ${userID}
    `;

    if (!session) {
      throw APIError.notFound("Session not found");
    }

    return session;
  }
);

export const freeCloseSession = api(
  { method: "POST", path: "/free/sessions/:id/close", auth: true },
  async (req: { id: string }): Promise<ConversationSession> => {
    const userID = requireUserID();
    
    // Validate UUID format for path parameter
    validateUUID(req.id, "session id");

    const session = await freeAIChatDB.queryRow<ConversationSession>`
      UPDATE conversation_session
      SET status = 'closed',
          closed_at = NOW(),
          session_duration_seconds = EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER,
          updated_at = NOW()
      WHERE id = ${req.id} AND user_id = ${userID} AND status = 'active'
      RETURNING id, user_id, language_code, total_messages, total_tokens_used,
                 ai_cost_estimate_usd, session_duration_seconds, status,
                 created_at, updated_at, closed_at
    `;

    if (!session) {
      throw APIError.notFound("Active session not found");
    }

    return session;
  }
);

export const freeDeleteSession = api(
  { method: "DELETE", path: "/free/sessions/:id", auth: true },
  async (req: { id: string }): Promise<void> => {
    const userID = requireUserID();
    
    // Validate UUID format for path parameter
    validateUUID(req.id, "session id");

    await freeAIChatDB.exec`
      DELETE FROM conversation_session
      WHERE id = ${req.id} AND user_id = ${userID}
    `;
  }
);

export const freeSendMessage = api(
  { method: "POST", path: "/free/sessions/:id/messages", auth: true },
  async (req: SendMessageRequest & { id: string }): Promise<SendMessageResponse> => {
    const userID = requireUserID();
    
    // Validate UUID format for path parameter
    validateUUID(req.id, "session id");

    const session = await freeAIChatDB.queryRow<ConversationSession>`
      SELECT id, user_id, language_code, total_messages, total_tokens_used,
             ai_cost_estimate_usd, session_duration_seconds, status,
             created_at, updated_at, closed_at
      FROM conversation_session
      WHERE id = ${req.id} AND user_id = ${userID} AND status = 'active'
    `;

    if (!session) {
      throw APIError.notFound("Active session not found");
    }

    const dailyUsage = await getDailyUsage(userID);
    const currentMessageCount = dailyUsage?.message_count || 0;
    const currentTokenCount = dailyUsage?.token_count || 0;

    const messageLimitCheck = checkDailyMessageLimit(currentMessageCount);
    if (!messageLimitCheck.allowed) {
      throw APIError.resourceExhausted(messageLimitCheck.reason || "Daily message limit reached");
    }

    const userMessageTokens = await estimateTokenCount(req.content);
    const tokenLimitCheck = checkDailyTokenLimit(currentTokenCount, userMessageTokens);
    if (!tokenLimitCheck.allowed) {
      throw APIError.resourceExhausted(tokenLimitCheck.reason || "Daily token limit would be exceeded");
    }

    const requestTokenCheck = checkRequestTokenLimit(userMessageTokens);
    if (!requestTokenCheck.allowed) {
      throw APIError.invalidArgument(requestTokenCheck.reason || "Request too large");
    }

    await saveMessage(session.id, "user", req.content, userMessageTokens);
    await incrementDailyUsage(userID, 1, userMessageTokens, 0);

    const messages = await getSessionMessages(session.id, FREE_TIER_LIMITS.MAX_MESSAGES_PER_SESSION);
    const systemPrompt = buildSystemPrompt(session.language_code);
    const bedrockResponse = await invokeBedrock(messages, systemPrompt);

    await saveMessage(session.id, "assistant", bedrockResponse.content, bedrockResponse.tokensUsed);
    await incrementDailyUsage(userID, 1, bedrockResponse.tokensUsed, 0);

    const updatedSession = await freeAIChatDB.queryRow<ConversationSession>`
      UPDATE conversation_session
      SET ai_cost_estimate_usd = ai_cost_estimate_usd + ${bedrockResponse.costUsd},
          updated_at = NOW()
      WHERE id = ${session.id}
      RETURNING id, user_id, language_code, total_messages, total_tokens_used,
                 ai_cost_estimate_usd, session_duration_seconds, status,
                 created_at, updated_at, closed_at
    `;

    if (!updatedSession) {
      throw APIError.internal("Failed to update session");
    }

    const userMessage = await freeAIChatDB.queryRow<ConversationMessage>`
      SELECT id, session_id, role, content, token_count, created_at
      FROM conversation_message
      WHERE session_id = ${session.id} AND role = 'user'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const aiMessage = await freeAIChatDB.queryRow<ConversationMessage>`
      SELECT id, session_id, role, content, token_count, created_at
      FROM conversation_message
      WHERE session_id = ${session.id} AND role = 'assistant'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!userMessage || !aiMessage) {
      throw APIError.internal("Failed to retrieve messages");
    }

    return {
      message: userMessage,
      ai_response: aiMessage,
      session: updatedSession,
    };
  }
);

export const freeGetMessages = api(
  { method: "GET", path: "/free/sessions/:id/messages", auth: true },
  async (
    req: { id: string; limit?: number; offset?: number }
  ): Promise<{ messages: ConversationMessage[]; total: number }> => {
    const userID = requireUserID();
    
    // Validate UUID format for path parameter
    validateUUID(req.id, "session id");

    const session = await freeAIChatDB.queryRow<{ id: string }>`
      SELECT id FROM conversation_session WHERE id = ${req.id} AND user_id = ${userID}
    `;

    if (!session) {
      throw APIError.notFound("Session not found");
    }

    const limit = req.limit || 20;
    const offset = req.offset || 0;

    const messages: ConversationMessage[] = [];
    const messageRows = await freeAIChatDB.query<ConversationMessage>`
      SELECT id, session_id, role, content, token_count, created_at
      FROM conversation_message
      WHERE session_id = ${req.id}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    for await (const msg of messageRows) {
      messages.unshift(msg);
    }

    const totalRow = await freeAIChatDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM conversation_message
      WHERE session_id = ${req.id}
    `;

    return {
      messages,
      total: totalRow?.count || 0,
    };
  }
);

export const getFreeDailyUsage = api(
  { method: "GET", path: "/usage/daily", auth: true },
  async (req: {}): Promise<UsageResponse> => {
    const userID = requireUserID();

    const daily = await getDailyUsage(userID);
    const monthly = await getMonthlyUsage(userID);

    return {
      daily: {
        message_count: daily?.message_count || 0,
        token_count: daily?.token_count || 0,
        session_count: daily?.session_count || 0,
      },
      monthly: {
        session_count: monthly?.session_count || 0,
      },
      limits: {
        daily_message_limit: FREE_TIER_LIMITS.DAILY_MESSAGE_LIMIT,
        daily_token_limit: FREE_TIER_LIMITS.DAILY_TOKEN_LIMIT,
        monthly_session_limit: FREE_TIER_LIMITS.MONTHLY_SESSION_LIMIT,
      },
    };
  }
);

export const getMonthlyUsageEndpoint = api(
  { method: "GET", path: "/usage/monthly", auth: true },
  async (req: {}): Promise<{ session_count: number }> => {
    const userID = requireUserID();

    const monthly = await getMonthlyUsageData(userID);
    return {
      session_count: monthly?.session_count || 0,
    };
  }
);

export const getLimits = api(
  { method: "GET", path: "/limits", auth: true },
  async (req: {}): Promise<UsageResponse["limits"]> => {
    return {
      daily_message_limit: FREE_TIER_LIMITS.DAILY_MESSAGE_LIMIT,
      daily_token_limit: FREE_TIER_LIMITS.DAILY_TOKEN_LIMIT,
      monthly_session_limit: FREE_TIER_LIMITS.MONTHLY_SESSION_LIMIT,
    };
  }
);

export const getFreeSubscriptionStatus = api(
  { method: "GET", path: "/free/subscription/status", auth: true },
  async (req: {}): Promise<FreeSubscriptionStatusResponse> => {
    const userID = requireUserID();

    const status = await freeAIChatDB.queryRow<FreeSubscriptionStatusResponse>`
      SELECT plan_type, trial_ends_at
      FROM free_subscription_status
      WHERE user_id = ${userID}
    `;

    if (!status) {
      return {
        plan_type: "free",
        trial_ends_at: null,
      };
    }

    return status;
  }
);
