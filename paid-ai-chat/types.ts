export interface PaidAISession {
  id: string;
  user_id: string;
  language_code: string;
  created_at: Date;
  last_message_at: Date;
}

export interface PaidAIUsage {
  id: string;
  user_id: string;
  session_id: string | null;
  tokens_used: number;
  cost_usd: number;
  created_at: Date;
}

export interface CreateSessionRequest {
  language_code: string;
}

export interface CreateSessionResponse {
  session: PaidAISession;
}

export interface SendMessageRequest {
  content: string;
}

export interface SendMessageResponse {
  content: string;
  tokens_used: number;
  cost_usd: number;
  session: PaidAISession;
}
