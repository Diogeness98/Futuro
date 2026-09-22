import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("database health timeout")), 3_000);
      }),
    ]);

    return NextResponse.json({
      ok: true,
      service: "futuro",
      version: "0.2.0",
      database: "ready",
      timestamp,
    }, {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      service: "futuro",
      version: "0.2.0",
      database: "unavailable",
      timestamp,
    }, {
      status: 503,
      headers: NO_STORE_HEADERS,
    });
  }
}
