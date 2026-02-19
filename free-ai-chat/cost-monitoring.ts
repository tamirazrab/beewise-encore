import { secret } from "encore.dev/config";
import { freeAIChatDB } from "./db";

// Use Encore secrets with fallback to environment variables for local development
const DAILY_BUDGET_ALERT_THRESHOLD_SECRET = secret("DAILY_BUDGET_ALERT_THRESHOLD");
const DAILY_BUDGET_ALERT_THRESHOLD = parseFloat(
  DAILY_BUDGET_ALERT_THRESHOLD_SECRET() || process.env.DAILY_BUDGET_ALERT_THRESHOLD || "30"
);

export interface DailyCostSummary {
  date: string;
  total_cost_usd: number;
  session_count: number;
  message_count: number;
  token_count: number;
}

export async function getDailyCostSummary(date: string): Promise<DailyCostSummary | null> {
  const summary = await freeAIChatDB.queryRow<DailyCostSummary>`
    SELECT 
      ${date} as date,
      COALESCE(SUM(cs.ai_cost_estimate_usd), 0) as total_cost_usd,
      COUNT(DISTINCT cs.id) as session_count,
      COALESCE(SUM(uud.message_count), 0) as message_count,
      COALESCE(SUM(uud.token_count), 0) as token_count
    FROM conversation_session cs
    LEFT JOIN user_usage_daily uud ON DATE(cs.created_at) = uud.usage_date
    WHERE DATE(cs.created_at) = ${date}
    GROUP BY DATE(cs.created_at)
  `;

  return summary;
}

export async function checkDailyBudget(): Promise<{ exceeded: boolean; cost: number }> {
  const today = new Date().toISOString().split("T")[0];
  const summary = await getDailyCostSummary(today);

  if (!summary) {
    return { exceeded: false, cost: 0 };
  }

  return {
    exceeded: summary.total_cost_usd > DAILY_BUDGET_ALERT_THRESHOLD,
    cost: summary.total_cost_usd,
  };
}

export async function getCostAlerts(): Promise<string[]> {
  const alerts: string[] = [];
  const budgetCheck = await checkDailyBudget();

  if (budgetCheck.exceeded) {
    alerts.push(
      `Daily budget threshold exceeded: $${budgetCheck.cost.toFixed(2)} (threshold: $${DAILY_BUDGET_ALERT_THRESHOLD})`
    );
  }

  return alerts;
}
