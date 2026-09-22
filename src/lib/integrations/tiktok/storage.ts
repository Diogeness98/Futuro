import { Prisma } from "../../../generated/prisma/client";
import { decryptJson, encryptJson } from "../../crypto/secrets";
import { db } from "../../db";
import type { TikTokAuthorizedShop } from "./client";
import type { TikTokTokenSet } from "./tokens";

const PROVIDER = "tiktok_shop";

interface TikTokStoredConfig {
  credentials: string;
  openId?: string;
  userType?: number;
  grantedScopes?: string[];
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
  shops: TikTokAuthorizedShop[];
  primaryShopCipher?: string;
  connectedAt: string;
  refreshedAt?: string;
}

export async function saveTikTokConnection(
  organizationId: string,
  tokens: TikTokTokenSet,
  shops: TikTokAuthorizedShop[],
) {
  const config: TikTokStoredConfig = {
    credentials: encryptTikTokTokens(organizationId, tokens),
    openId: tokens.openId,
    userType: tokens.userType,
    grantedScopes: tokens.grantedScopes,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    shops: sanitizeShops(shops),
    primaryShopCipher: shops[0]?.cipher,
    connectedAt: new Date().toISOString(),
  };
  const jsonConfig = toJson(config);

  return db.integration.upsert({
    where: {
      organizationId_provider: {
        organizationId,
        provider: PROVIDER,
      },
    },
    create: {
      organizationId,
      provider: PROVIDER,
      status: "connected",
      config: jsonConfig,
    },
    update: {
      status: "connected",
      config: jsonConfig,
    },
  });
}

export async function loadTikTokConnection(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_provider: {
        organizationId,
        provider: PROVIDER,
      },
    },
  });

  if (!integration || integration.status !== "connected") return null;
  const config = parseStoredConfig(integration.config);
  if (!config?.credentials) return null;

  return {
    integration,
    config,
    tokens: decryptTikTokTokens(organizationId, config.credentials),
  };
}

export async function updateTikTokTokens(organizationId: string, tokens: TikTokTokenSet) {
  const current = await loadTikTokConnection(organizationId);
  if (!current) throw new Error("TikTok Shop não está conectado.");

  const config: TikTokStoredConfig = {
    ...current.config,
    credentials: encryptTikTokTokens(organizationId, tokens),
    openId: tokens.openId ?? current.config.openId,
    userType: tokens.userType ?? current.config.userType,
    grantedScopes: tokens.grantedScopes ?? current.config.grantedScopes,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt ?? current.config.refreshTokenExpiresAt,
    refreshedAt: new Date().toISOString(),
  };

  await db.integration.update({
    where: { id: current.integration.id },
    data: { status: "connected", config: toJson(config) },
  });

  return config;
}

export async function disconnectTikTok(organizationId: string) {
  const config = toJson({ disconnectedAt: new Date().toISOString() });
  await db.integration.upsert({
    where: {
      organizationId_provider: {
        organizationId,
        provider: PROVIDER,
      },
    },
    create: {
      organizationId,
      provider: PROVIDER,
      status: "not_configured",
      config,
    },
    update: {
      status: "not_configured",
      config,
    },
  });
}

function encryptTikTokTokens(organizationId: string, tokens: TikTokTokenSet) {
  return encryptJson(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
    aad(organizationId),
  );
}

function decryptTikTokTokens(organizationId: string, encrypted: string) {
  return decryptJson<{ accessToken: string; refreshToken: string }>(encrypted, aad(organizationId));
}

function aad(organizationId: string) {
  return `futuro:tiktok-shop:${organizationId}`;
}

function sanitizeShops(shops: TikTokAuthorizedShop[]) {
  return shops
    .filter((shop) => Boolean(shop.cipher))
    .map((shop) => ({
      cipher: shop.cipher,
      code: shop.code,
      id: shop.id,
      name: shop.name,
      region: shop.region,
      seller_type: shop.seller_type,
    }));
}

function parseStoredConfig(value: unknown): TikTokStoredConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  if (typeof config.credentials !== "string") return null;

  return {
    credentials: config.credentials,
    openId: typeof config.openId === "string" ? config.openId : undefined,
    userType: typeof config.userType === "number" ? config.userType : undefined,
    grantedScopes: Array.isArray(config.grantedScopes) ? config.grantedScopes.map(String) : undefined,
    accessTokenExpiresAt: typeof config.accessTokenExpiresAt === "number" ? config.accessTokenExpiresAt : undefined,
    refreshTokenExpiresAt: typeof config.refreshTokenExpiresAt === "number" ? config.refreshTokenExpiresAt : undefined,
    shops: Array.isArray(config.shops) ? config.shops as TikTokAuthorizedShop[] : [],
    primaryShopCipher: typeof config.primaryShopCipher === "string" ? config.primaryShopCipher : undefined,
    connectedAt: typeof config.connectedAt === "string" ? config.connectedAt : "",
    refreshedAt: typeof config.refreshedAt === "string" ? config.refreshedAt : undefined,
  };
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
