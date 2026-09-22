function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const inventoryConfig = {
  lowStockThreshold: Math.max(0, Math.floor(numberFromEnv("LOW_STOCK_THRESHOLD", 5))),
};
