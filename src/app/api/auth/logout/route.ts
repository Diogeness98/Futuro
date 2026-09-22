import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST(request: Request) {
  await clearSession();

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
