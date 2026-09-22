function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const automationRuntimeConfig = {
  cronConfigured: Boolean(process.env.AUTOMATION_CRON_SECRET),
  organizationLimit: Math.min(20, Math.max(1, Math.floor(numberFromEnv("AUTOMATION_WORKER_ORG_LIMIT", 5)))),
  batchSize: Math.min(10, Math.max(1, Math.floor(numberFromEnv("AUTOMATION_WORKER_BATCH_SIZE", 3)))),
};
