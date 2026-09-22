import { tikTokShopConfig, requireTikTokAppCredentials } from "./config";
import { signTikTokRequest } from "./signing";

type QueryValue = string | number | boolean | null | undefined;

interface TikTokRequestInput {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  accessToken: string;
  shopCipher?: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

interface TikTokEnvelope<T> {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
}

export interface TikTokAuthorizedShop {
  cipher: string;
  code?: string;
  id?: string;
  name?: string;
  region?: string;
  seller_type?: string;
}

export interface TikTokOrderSummary {
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

export interface TikTokOrderSearchResult {
  orders: TikTokOrderSummary[];
  nextPageToken?: string;
  totalCount?: number;
}

export async function tikTokShopRequest<T>(input: TikTokRequestInput): Promise<T> {
  requireTikTokAppCredentials();

  const timestamp = Math.floor(Date.now() / 1000);
  const query: Record<string, QueryValue> = {
    ...(input.query ?? {}),
    app_key: tikTokShopConfig.appKey,
    timestamp,
  };
  if (input.shopCipher) query.shop_cipher = input.shopCipher;

  const contentType = "application/json";
  const body = input.body === undefined ? "" : JSON.stringify(input.body);
  const sign = signTikTokRequest({
    appSecret: tikTokShopConfig.appSecret,
    path: input.path,
    query,
    body,
    contentType,
  });

  const url = new URL(input.path, tikTokShopConfig.apiBaseUrl);
  for (const [key, value] of Object.entries({ ...query, sign })) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: input.method,
    headers: {
      "Content-Type": contentType,
      "x-tts-access-token": input.accessToken,
    },
    body: body || undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(tikTokShopConfig.timeoutMs),
  });

  const raw = await response.json().catch(() => null) as TikTokEnvelope<T> | null;
  if (!response.ok || !raw) {
    throw new Error(`TikTok Shop API falhou (${response.status}).`);
  }
  if (typeof raw.code === "number" && raw.code !== 0) {
    throw new Error(`TikTok Shop API erro ${raw.code}: ${String(raw.message ?? "sem mensagem")}`);
  }
  if (raw.data === undefined) throw new Error("TikTok Shop respondeu sem data.");

  return raw.data;
}

export async function getTikTokAuthorizedShops(accessToken: string) {
  const data = await tikTokShopRequest<{ shops?: TikTokAuthorizedShop[] }>({
    method: "GET",
    path: "/authorization/202309/shops",
    accessToken,
  });

  return data.shops ?? [];
}

export async function searchTikTokOrders(
  accessToken: string,
  shopCipher: string,
  options: {
    updateTimeGe?: number;
    pageToken?: string;
    pageSize?: number;
  } = {},
): Promise<TikTokOrderSearchResult> {
  const data = await tikTokShopRequest<{
    orders?: TikTokOrderSummary[];
    next_page_token?: string;
    total_count?: number;
  }>({
    method: "POST",
    path: "/order/202309/orders/search",
    accessToken,
    shopCipher,
    query: {
      page_size: Math.min(100, Math.max(1, options.pageSize ?? 100)),
      page_token: options.pageToken,
      sort_field: "create_time",
      sort_order: "ASC",
    },
    body: options.updateTimeGe ? { update_time_ge: options.updateTimeGe } : {},
  });

  return {
    orders: Array.isArray(data.orders) ? data.orders : [],
    nextPageToken: typeof data.next_page_token === "string" && data.next_page_token ? data.next_page_token : undefined,
    totalCount: typeof data.total_count === "number" ? data.total_count : undefined,
  };
}


export interface TikTokProductSkuSummary {
  id?: string;
  seller_sku?: string;
  price?: {
    currency?: string;
    sale_price?: string;
    tax_exclusive_price?: string;
  };
  list_price?: {
    amount?: string;
    currency?: string;
  };
  inventory?: Array<{
    quantity?: number;
    warehouse_id?: string;
  }>;
}

export interface TikTokProductSummary {
  id?: string;
  title?: string;
  status?: string;
  is_not_for_sale?: boolean;
  create_time?: number;
  update_time?: number;
  skus?: TikTokProductSkuSummary[];
}

export interface TikTokProductSearchResult {
  products: TikTokProductSummary[];
  nextPageToken?: string;
  totalCount?: number;
}

export async function searchTikTokProducts(
  accessToken: string,
  shopCipher: string,
  options: {
    pageToken?: string;
    pageSize?: number;
    status?: string;
  } = {},
): Promise<TikTokProductSearchResult> {
  const data = await tikTokShopRequest<{
    products?: TikTokProductSummary[];
    next_page_token?: string;
    total_count?: number;
  }>({
    method: "POST",
    path: "/product/202502/products/search",
    accessToken,
    shopCipher,
    query: {
      page_size: Math.min(100, Math.max(1, options.pageSize ?? 100)),
      page_token: options.pageToken,
    },
    body: {
      status: options.status ?? "ALL",
    },
  });

  return {
    products: Array.isArray(data.products) ? data.products : [],
    nextPageToken: typeof data.next_page_token === "string" && data.next_page_token
      ? data.next_page_token
      : undefined,
    totalCount: typeof data.total_count === "number" ? data.total_count : undefined,
  };
}
