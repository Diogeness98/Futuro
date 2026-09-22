import { moneyToCents } from "../../http";
import type {
  TikTokProductSkuSummary,
  TikTokProductSummary,
} from "./client";

export interface NormalizedTikTokVariant {
  externalId: string;
  sellerSku: string | null;
  priceCents: number;
  currency: string | null;
  stock: number;
}

export interface NormalizedTikTokProduct {
  externalId: string;
  name: string;
  sku: string | null;
  priceCents: number;
  currency: string | null;
  stock: number;
  active: boolean;
  externalStatus: string | null;
  externalUpdatedAt: Date | null;
  variants: NormalizedTikTokVariant[];
}

export function normalizeTikTokProduct(
  product: TikTokProductSummary,
): NormalizedTikTokProduct | null {
  const externalId = stringValue(product.id);
  if (!externalId) return null;

  const variants = (product.skus ?? [])
    .map(normalizeVariant)
    .filter((variant): variant is NormalizedTikTokVariant => Boolean(variant));

  const prices = variants.map((variant) => variant.priceCents).filter((value) => value > 0);
  const stock = variants.reduce((sum, variant) => sum + variant.stock, 0);
  const currency = variants.find((variant) => variant.currency)?.currency ?? null;
  const status = stringValue(product.status) || null;
  const singleSku = variants.length === 1 ? variants[0]?.sellerSku ?? null : null;

  return {
    externalId,
    name: stringValue(product.title) || `TikTok Product ${externalId}`,
    sku: singleSku,
    priceCents: prices.length > 0 ? Math.min(...prices) : 0,
    currency,
    stock,
    active: status === "ACTIVATE" && product.is_not_for_sale !== true,
    externalStatus: status,
    externalUpdatedAt: unixSecondsToDate(product.update_time),
    variants,
  };
}

function normalizeVariant(
  sku: TikTokProductSkuSummary,
): NormalizedTikTokVariant | null {
  const externalId = stringValue(sku.id);
  if (!externalId) return null;

  const salePrice = stringValue(sku.price?.sale_price);
  const listPrice = stringValue(sku.list_price?.amount);
  const currency = stringValue(sku.price?.currency ?? sku.list_price?.currency) || null;

  return {
    externalId,
    sellerSku: stringValue(sku.seller_sku) || null,
    priceCents: moneyToCents(salePrice || listPrice || 0),
    currency,
    stock: (sku.inventory ?? []).reduce((sum, item) => {
      const quantity = Number(item.quantity ?? 0);
      return sum + (Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0);
    }, 0),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function unixSecondsToDate(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}
