import { prisma } from "@codearena/db";
import { Role } from "@codearena/db";
import argon2 from "argon2";
import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "codearena_session";
export const SESSION_MAX_AGE = 14 * 24 * 60 * 60; // 14 days in seconds

export interface SafeUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  createdAt: Date;
}

export interface SafeProfile {
  id: string;
  rating: number;
  globalRank: number | null;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalSubmissions: number;
  currentStreak: number;
  maxStreak: number;
}

export interface AuthContextData {
  user: SafeUser;
  profile: SafeProfile | null;
}

/**
 * Hash password using Argon2id with recommended parameters.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify password against an Argon2id hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error(
      "[Auth] Password verification error:",
      (error as Error).message,
    );
    return false;
  }
}

/**
 * Generate a cryptographically random 256-bit session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new database session for a user.
 */
export async function createSession(
  userId: string,
  options?: { ipAddress?: string; userAgent?: string },
): Promise<{ sessionToken: string; expires: Date }> {
  const sessionToken = generateSessionToken();
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    },
  });

  return { sessionToken, expires };
}

/**
 * Validate a session token from the database.
 * Returns the user and profile if valid and unexpired; null otherwise.
 */
export async function validateSession(
  sessionToken: string,
): Promise<AuthContextData | null> {
  if (!sessionToken || typeof sessionToken !== "string") {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expires < new Date()) {
    // Delete expired session asynchronously
    prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const { user } = session;
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

  return { user: safeUser, profile: safeProfile };
}

/**
 * Invalidate / delete a session by its token.
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  try {
    await prisma.session.deleteMany({
      where: { sessionToken },
    });
  } catch (error) {
    console.warn("[Auth] Delete session error:", (error as Error).message);
  }
}

/**
 * Get current session token from request cookies (Next.js server context or explicit request).
 */
export async function getSessionToken(req?: any): Promise<string | null> {
  if (req && req.cookies) {
    const fromReq = req.cookies.get(SESSION_COOKIE_NAME);
    if (typeof fromReq === "string") return fromReq;
    if (fromReq?.value) return fromReq.value;
  }
  try {
    const cookieStore = cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the currently authenticated user from cookies, or null if not logged in.
 */
export async function getCurrentUser(
  req?: any,
): Promise<AuthContextData | null> {
  const token = await getSessionToken(req);
  if (!token) return null;
  return validateSession(token);
}

/**
 * Require an authenticated user; throws or returns null if unauthenticated.
 */
export async function requireUser(req?: any): Promise<AuthContextData> {
  const auth = await getCurrentUser(req);
  if (!auth) {
    throw new Error("UNAUTHORIZED");
  }
  return auth;
}

/**
 * Require an admin user; throws if unauthenticated or not an ADMIN.
 */
export async function requireAdmin(req?: any): Promise<AuthContextData> {
  const auth = await requireUser(req);
  if (auth.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return auth;
}

/**
 * Build standard Set-Cookie header string for session creation.
 */
export function buildSessionCookieOptions(expires: Date) {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
    maxAge: SESSION_MAX_AGE,
  };
}
