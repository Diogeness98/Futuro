import { moneyToCents } from "../../http";

export interface TikTokOrderLike {
  id: string;
  status?: string;
  create_time?: number;
  update_time?: number;
  payment?: {
    currency?: string;
    total_amount?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function normalizeTikTokOrder(order: TikTokOrderLike) {
  return {
    externalId: typeof order.id === "string" ? order.id : String(order.id ?? ""),
    status: typeof order.status === "string" && order.status
      ? order.status.toLowerCase()
      : "unknown",
    totalCents: moneyToCents(order.payment?.total_amount ?? 0),
    currency: typeof order.payment?.currency === "string" ? order.payment.currency : undefined,
    createTime: typeof order.create_time === "number" ? order.create_time : undefined,
    updateTime: typeof order.update_time === "number" ? order.update_time : undefined,
  };
}
