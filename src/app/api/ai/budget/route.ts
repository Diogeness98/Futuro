import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOpenAiBudgetStatus } from "@/lib/ai/budget";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const budget = await getOpenAiBudgetStatus(session.organizationId);
  return NextResponse.json({ ok: true, budget });
}
