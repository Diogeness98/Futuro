import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export function integrationEncryptionKey() {
  const encoded = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!encoded) throw new Error("INTEGRATION_ENCRYPTION_KEY não configurada.");

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY deve ser Base64 de exatamente 32 bytes.");
  }
  return key;
}

export function encryptJson(value: unknown, aad: string, key = integrationEncryptionKey()) {
  if (key.length !== KEY_BYTES) throw new Error("Chave de criptografia inválida.");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));

  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptJson<T>(payload: string, aad: string, key = integrationEncryptionKey()): T {
  const [version, ivPart, tagPart, encryptedPart] = payload.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !encryptedPart) {
    throw new Error("Credencial criptografada em formato inválido.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}
