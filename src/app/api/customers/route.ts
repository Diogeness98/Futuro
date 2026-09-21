import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const customers = await db.customer.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const input = z.object({ name: z.string().trim().min(1).max(160), email: z.string().trim().email().optional().or(z.literal("")), phone: z.string().trim().max(50).optional().or(z.literal("")) }).parse(await bodyFromRequest(request));
    const customer = await db.customer.create({ data: { organizationId: session.organizationId, name: input.name, email: input.email || null, phone: input.phone || null } });
    if ((request.headers.get("content-type") ?? "").includes("application/json")) return NextResponse.json({ customer }, { status: 201 });
    return NextResponse.redirect(new URL("/customers", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar cliente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
