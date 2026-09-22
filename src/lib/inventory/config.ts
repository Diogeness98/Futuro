function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const inventoryConfig = {
  lowStockThreshold: Math.max(0, Math.floor(numberFromEnv("LOW_STOCK_THRESHOLD", 5))),
};

export function shouldEmitLowStockEvent(input: {
  stock: number;
  active: boolean;
  threshold: number;
  previousStock?: number;
  previousActive?: boolean;
}) {
  if (!input.active || input.stock > input.threshold) return false;
  if (input.previousStock === undefined) return true;

  return input.previousStock > input.threshold || input.previousActive === false;
}
