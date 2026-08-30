import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@codearena/db";
import {
  verifyPassword,
  createSession,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
  SafeUser,
  SafeProfile,
} from "@/lib/auth";
import { validateLoginInput } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";

    // Rate limit check: 10 attempts per 15 minutes per IP
    const rateLimitKey = `rl:auth:login:${ip.split(",")[0].trim()}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 10, 15 * 60);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again in a few minutes.",
          retryAfter: rateLimit.resetSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.resetSeconds.toString(),
          },
        },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400 },
      );
    }

    const { login, password } = body;
    const validationErrors = validateLoginInput({ login, password });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 },
      );
    }

    const cleanLogin = login.trim();

    // Query user by email OR username (case-insensitive for email)
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanLogin.toLowerCase() }, { username: cleanLogin }],
      },
      include: {
        profile: true,
      },
    });

    // Use constant-time or generic failure handling to prevent user enumeration
    if (!user) {
      return NextResponse.json(
        { error: "Invalid username/email or password." },
        { status: 401 },
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid username/email or password." },
        { status: 401 },
      );
    }

    // Extract client metadata for session logging
    const userAgent = req.headers.get("user-agent") || undefined;

    // Create session in database
    const { sessionToken, expires } = await createSession(user.id, {
      ipAddress: ip,
      userAgent,
    });

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    };

    const safeProfile: SafeProfile | null = user.profile
      ? {
          id: user.profile.id,
          rating: user.profile.rating,
          globalRank: user.profile.globalRank,
          totalSolved: user.profile.totalSolved,
          easySolved: user.profile.easySolved,
          mediumSolved: user.profile.mediumSolved,
          hardSolved: user.profile.hardSolved,
          totalSubmissions: user.profile.totalSubmissions,
          currentStreak: user.profile.currentStreak,
          maxStreak: user.profile.maxStreak,
        }
      : null;

    const response = NextResponse.json(
      {
        message: "Login successful.",
        user: safeUser,
        profile: safeProfile,
      },
      { status: 200 },
    );

    // Set secure HttpOnly cookie
    const cookieOptions = buildSessionCookieOptions(expires);
    response.cookies.set({
      ...cookieOptions,
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
    });

    return response;
  } catch (error) {
    console.error("[Auth] Login error:", (error as Error).message);
    return NextResponse.json(
      { error: "An unexpected error occurred during login." },
      { status: 500 },
    );
  }
}
