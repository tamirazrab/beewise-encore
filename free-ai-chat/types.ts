export interface ConversationSession {
  id: string;
  user_id: string;
  language_code: string;
  total_messages: number;
  total_tokens_used: number;
  ai_cost_estimate_usd: number;
  session_duration_seconds: number | null;
  status: "active" | "closed";
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  token_count: number;
  created_at: Date;
}

export interface CreateSessionRequest {
  language_code: string;
}

export interface CreateSessionResponse {
  session: ConversationSession;
}

export interface SendMessageRequest {
  content: string;
}

export interface SendMessageResponse {
  message: ConversationMessage;
  ai_response: ConversationMessage;
  session: ConversationSession;
}

export interface UsageResponse {
  daily: {
    message_count: number;
    token_count: number;
    session_count: number;
  };
  monthly: {
    session_count: number;
  };
  limits: {
    daily_message_limit: number;
    daily_token_limit: number;
    monthly_session_limit: number;
  };
}

export interface FreeSubscriptionStatusResponse {
  plan_type: "free" | "trial" | "expired";
  trial_ends_at: Date | null;
}
