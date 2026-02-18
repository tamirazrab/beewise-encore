import { freeAIChatDB } from "./db";

export interface UsageCounters {
  message_count: number;
  token_count: number;
  session_count: number;
}

export async function incrementDailyUsage(
  userId: string,
  messageDelta: number,
  tokenDelta: number,
  sessionDelta: number = 0
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  await freeAIChatDB.exec`
    INSERT INTO user_usage_daily (user_id, usage_date, message_count, token_count, session_count)
    VALUES (${userId}, ${today}, ${messageDelta}, ${tokenDelta}, ${sessionDelta})
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
      message_count = user_usage_daily.message_count + EXCLUDED.message_count,
      token_count = user_usage_daily.token_count + EXCLUDED.token_count,
      session_count = user_usage_daily.session_count + EXCLUDED.session_count
  `;
}

export async function incrementMonthlySessionUsage(userId: string): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await freeAIChatDB.exec`
    INSERT INTO user_usage_monthly (user_id, usage_year, usage_month, session_count)
    VALUES (${userId}, ${year}, ${month}, 1)
    ON CONFLICT (user_id, usage_year, usage_month)
    DO UPDATE SET
      session_count = user_usage_monthly.session_count + 1
  `;
}

export async function getDailyUsage(userId: string): Promise<UsageCounters | null> {
  const today = new Date().toISOString().split("T")[0];

  return await freeAIChatDB.queryRow<UsageCounters>`
    SELECT message_count, token_count, session_count
    FROM user_usage_daily
    WHERE user_id = ${userId} AND usage_date = ${today}
  `;
}

export async function getMonthlyUsage(userId: string): Promise<{ session_count: number } | null> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return await freeAIChatDB.queryRow<{ session_count: number }>`
    SELECT session_count
    FROM user_usage_monthly
    WHERE user_id = ${userId} AND usage_year = ${year} AND usage_month = ${month}
  `;
}
