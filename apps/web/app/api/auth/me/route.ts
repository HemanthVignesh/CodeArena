import { NextRequest, NextResponse } from "next/server";
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Unauthorized. No session provided." },
        { status: 401 },
      );
    }

    const auth = await validateSession(sessionToken);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Session is invalid or expired." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        user: auth.user,
        profile: auth.profile,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Auth] Me endpoint error:", (error as Error).message);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
