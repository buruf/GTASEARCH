// TEMPORARY edge-runtime diagnostic for the prod middleware auth failure.
// Reports only booleans/lengths — never values. DELETE after diagnosis.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

  let tokenAuto: unknown = null;
  let tokenSecure: unknown = null;
  let tokenPlain: unknown = null;
  let err: string | null = null;
  try {
    tokenAuto = await getToken({ req, secret });
    tokenSecure = await getToken({ req, secret, secureCookie: true });
    tokenPlain = await getToken({ req, secret, secureCookie: false });
  } catch (e) {
    err = (e as Error).message;
  }

  const cookieNames = req.cookies.getAll().map((c) => c.name);

  return NextResponse.json({
    edgeSeesNEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
    edgeSeesAUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    secretLen: secret?.length ?? 0,
    nextauthUrl: process.env.NEXTAUTH_URL ?? null,
    vercelUrlPresent: Boolean(process.env.VERCEL_URL),
    cookieNamesSeen: cookieNames,
    gotTokenAuto: Boolean(tokenAuto),
    gotTokenSecureTrue: Boolean(tokenSecure),
    gotTokenSecureFalse: Boolean(tokenPlain),
    error: err,
  });
}
