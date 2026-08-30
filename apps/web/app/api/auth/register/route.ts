import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@codearena/db";
import {
  hashPassword,
  createSession,
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
  SafeUser,
  SafeProfile,
} from "@/lib/auth";
import { validateRegistrationInput } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400 },
      );
    }

    const { email, username, password } = body;
    const validationErrors = validateRegistrationInput({
      email,
      username,
      password,
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // Check duplicate email
    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    // Check duplicate username
    const existingUsername = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });
    if (existingUsername) {
      return NextResponse.json(
        { error: "This username is already taken." },
        { status: 409 },
      );
    }

    // Hash password using Argon2id
    const passwordHash = await hashPassword(password);

    // Extract client metadata for session logging
    const ipAddress = req.headers.get("x-forwarded-for") || req.ip || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    // Create User + Profile atomically in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: cleanEmail,
          username: cleanUsername,
          passwordHash,
          profile: {
            create: {
              rating: 1200,
              totalSolved: 0,
              easySolved: 0,
              mediumSolved: 0,
              hardSolved: 0,
              totalSubmissions: 0,
              currentStreak: 0,
              maxStreak: 0,
            },
          },
        },
        include: {
          profile: true,
        },
      });

      return user;
    });

    // Create session
    const { sessionToken, expires } = await createSession(result.id, {
      ipAddress,
      userAgent,
    });

    const safeUser: SafeUser = {
      id: result.id,
      email: result.email,
      username: result.username,
      role: result.role,
      createdAt: result.createdAt,
    };

    const safeProfile: SafeProfile | null = result.profile
      ? {
          id: result.profile.id,
          rating: result.profile.rating,
          globalRank: result.profile.globalRank,
          totalSolved: result.profile.totalSolved,
          easySolved: result.profile.easySolved,
          mediumSolved: result.profile.mediumSolved,
          hardSolved: result.profile.hardSolved,
          totalSubmissions: result.profile.totalSubmissions,
          currentStreak: result.profile.currentStreak,
          maxStreak: result.profile.maxStreak,
        }
      : null;

    const response = NextResponse.json(
      {
        message: "Registration successful.",
        user: safeUser,
        profile: safeProfile,
      },
      { status: 201 },
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
    console.error("[Auth] Registration error:", (error as Error).message);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration." },
      { status: 500 },
    );
  }
}
