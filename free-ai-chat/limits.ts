// import { secret } from "encore.dev/config";

// const DAILY_MESSAGE_LIMIT_SECRET = secret("DAILY_MESSAGE_LIMIT");
// const DAILY_TOKEN_LIMIT_SECRET = secret("DAILY_TOKEN_LIMIT");
// const MONTHLY_SESSION_LIMIT_SECRET = secret("MONTHLY_SESSION_LIMIT");
// const MAX_MESSAGES_PER_SESSION_SECRET = secret("MAX_MESSAGES_PER_SESSION");
// const MAX_TOKENS_PER_REQUEST_SECRET = secret("MAX_TOKENS_PER_REQUEST");

export const FREE_TIER_LIMITS = {
  // DAILY_MESSAGE_LIMIT: parseInt(
  //   DAILY_MESSAGE_LIMIT_SECRET() || process.env.DAILY_MESSAGE_LIMIT || "50"
  // ),
  DAILY_MESSAGE_LIMIT: parseInt(process.env.DAILY_MESSAGE_LIMIT || "50"),
  // DAILY_TOKEN_LIMIT: parseInt(
  //   DAILY_TOKEN_LIMIT_SECRET() || process.env.DAILY_TOKEN_LIMIT || "10000"
  // ),
  DAILY_TOKEN_LIMIT: parseInt(process.env.DAILY_TOKEN_LIMIT || "10000"),
  // MONTHLY_SESSION_LIMIT: parseInt(
  //   MONTHLY_SESSION_LIMIT_SECRET() || process.env.MONTHLY_SESSION_LIMIT || "10"
  // ),
  MONTHLY_SESSION_LIMIT: parseInt(process.env.MONTHLY_SESSION_LIMIT || "10"),
  // MAX_MESSAGES_PER_SESSION: parseInt(
  //   MAX_MESSAGES_PER_SESSION_SECRET() || process.env.MAX_MESSAGES_PER_SESSION || "20"
  // ),
  MAX_MESSAGES_PER_SESSION: parseInt(process.env.MAX_MESSAGES_PER_SESSION || "20"),
  // MAX_TOKENS_PER_REQUEST: parseInt(
  //   MAX_TOKENS_PER_REQUEST_SECRET() || process.env.MAX_TOKENS_PER_REQUEST || "2000"
  // ),
  MAX_TOKENS_PER_REQUEST: parseInt(process.env.MAX_TOKENS_PER_REQUEST || "2000"),
};

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkRequestTokenLimit(requestTokens: number): LimitCheckResult {
  if (requestTokens > FREE_TIER_LIMITS.MAX_TOKENS_PER_REQUEST) {
    return {
      allowed: false,
      reason: `Request exceeds maximum tokens per request (${FREE_TIER_LIMITS.MAX_TOKENS_PER_REQUEST})`,
    };
  }
  return { allowed: true };
}

export function checkDailyMessageLimit(currentCount: number): LimitCheckResult {
  if (currentCount >= FREE_TIER_LIMITS.DAILY_MESSAGE_LIMIT) {
    return {
      allowed: false,
      reason: `Daily message limit reached (${FREE_TIER_LIMITS.DAILY_MESSAGE_LIMIT})`,
    };
  }
  return { allowed: true };
}

export function checkDailyTokenLimit(currentTokens: number, additionalTokens: number): LimitCheckResult {
  const totalAfter = currentTokens + additionalTokens;
  if (totalAfter > FREE_TIER_LIMITS.DAILY_TOKEN_LIMIT) {
    return {
      allowed: false,
      reason: `Daily token limit would be exceeded (${FREE_TIER_LIMITS.DAILY_TOKEN_LIMIT})`,
    };
  }
  return { allowed: true };
}

export function checkMonthlySessionLimit(currentCount: number): LimitCheckResult {
  if (currentCount >= FREE_TIER_LIMITS.MONTHLY_SESSION_LIMIT) {
    return {
      allowed: false,
      reason: `Monthly session limit reached (${FREE_TIER_LIMITS.MONTHLY_SESSION_LIMIT})`,
    };
  }
  return { allowed: true };
}
