import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // TODO: hier kun je e-mail of database-insert integreren.
    // Voor nu altijd succesvol antwoorden om timeouts te voorkomen:
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
