import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;
    const correct = process.env.ADMIN_PASSWORD;

    // TEMPORARY DEBUG — remove after fixing
    console.log("ENV password:", JSON.stringify(correct));
    console.log("Entered password:", JSON.stringify(password));
    console.log("Match:", password === correct);

    if (!correct) {
      return NextResponse.json({ error: "ADMIN_PASSWORD not set." }, { status: 401 });
    }
    if (!password || password !== correct) {
      return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[admin-auth] error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}