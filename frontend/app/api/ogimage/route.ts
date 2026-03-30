import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const n = Math.floor(Math.random() * 5) + 1;
  return NextResponse.redirect(new URL(`/ogimage${n}.jpg`, 'https://xn--80aaaqjgddaqi2bmfw7b.xn--p1ai'), {
    status: 302,
  });
}
