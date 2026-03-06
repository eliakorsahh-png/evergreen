// PATH: app/api/admin-auth/route.ts
// Server-side only — password never reaches the browser

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  // process.env.ADMIN_PASSWORD (no NEXT_PUBLIC_ prefix = server only)
  const correct = process.env.ADMIN_PASSWORD;

  if (!correct) {
    return NextResponse.json({ error: "Admin password not configured." }, { status: 500 });
  }

  if (password !== correct) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  // Return a simple session token the client stores in memory
  // (not localStorage — just React state, cleared on refresh)
  return NextResponse.json({ ok: true });
}