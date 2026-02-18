import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { freeAIChatDB } from "./db";
import { getCostAlerts } from "./cost-monitoring";

const _ = new CronJob("daily-cost-check", {
  title: "Check daily cost budget",
  every: "1h",
  endpoint: checkDailyCost,
});

export const checkDailyCost = api({}, async () => {
  const alerts = await getCostAlerts();
  
  if (alerts.length > 0) {
    console.error("Cost alerts:", alerts);
  }

  return { alerts };
});

const _resetDailyUsage = new CronJob("reset-daily-usage", {
  title: "Reset daily usage counters",
  schedule: "0 0 * * *",
  endpoint: resetDailyUsage,
});

export const resetDailyUsage = api({}, async () => {
  await freeAIChatDB.exec`
    DELETE FROM user_usage_daily
    WHERE usage_date < CURRENT_DATE - INTERVAL '30 days'
  `;

  return { success: true };
});
