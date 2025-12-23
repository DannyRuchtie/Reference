import { NextResponse } from "next/server";

export function GET() {
  // Keep this tiny: it's used by the desktop wrapper to know when the local server is up.
  return NextResponse.json({ ok: true });
}


