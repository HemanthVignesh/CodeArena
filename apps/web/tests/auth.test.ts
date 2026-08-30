import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@codearena/db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  deleteSession,
  SafeUser,
  SafeProfile,
} from "@/lib/auth";
import {
  validateRegistrationInput,
  validateLoginInput,
} from "@/lib/validation";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { GET as meHandler } from "@/app/api/auth/me/route";
import { NextRequest } from "next/server";

describe("CodeArena Authentication & Session Test Suite", () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testUsername = `user_${Date.now()}`;
  const testPassword = "Password123!";
  let createdUserId: string;
  let activeSessionToken: string;

  beforeAll(async () => {
    // Clean up any test artifacts if necessary
  });

  afterAll(async () => {
    // Clean up test user and sessions from database
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
  });

  // 1. Registration with valid data
  it("1. should register a new user and create an atomic User + Profile + Session", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: testEmail,
        username: testUsername,
        password: testPassword,
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testEmail.toLowerCase());
    expect(body.user.username).toBe(testUsername);
    expect(body.user.role).toBe("USER");
    expect(body.profile).toBeDefined();
    expect(body.profile.rating).toBe(1200);

    // Verify sensitive fields are omitted
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.sessionToken).toBeUndefined();

    createdUserId = body.user.id;

    // Verify session cookie was set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("codearena_session=");
    expect(setCookie).toContain("HttpOnly");

    // Extract session token from cookie
    const tokenMatch = setCookie?.match(/codearena_session=([a-f0-9]+);/);
    expect(tokenMatch).toBeTruthy();
    if (tokenMatch) {
      activeSessionToken = tokenMatch[1];
    }
  });

  // 2. Duplicate email rejection
  it("2. should reject registration with a duplicate email (409)", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: testEmail,
        username: `unique_${Date.now()}`,
        password: testPassword,
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("email already exists");
  });

  // 3. Duplicate username rejection
  it("3. should reject registration with a duplicate username (409)", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: `other_${Date.now()}@example.com`,
        username: testUsername,
        password: testPassword,
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("username is already taken");
  });

  // 4. Invalid email validation
  it("4. should reject registration with an invalid email format (400)", async () => {
    const errors = validateRegistrationInput({
      email: "invalid-email-format",
      username: "valid_user",
      password: "Password123!",
    });

    expect(errors.some((e) => e.field === "email")).toBe(true);

    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "not-an-email",
        username: "valid_user_x",
        password: "Password123!",
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(400);
  });

  // 5. Weak password rejection
  it("5. should reject registration with a weak/short password (400)", async () => {
    const errors = validateRegistrationInput({
      email: "test@example.com",
      username: "valid_user",
      password: "123", // Too short and weak
    });

    expect(errors.some((e) => e.field === "password")).toBe(true);

    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "test_weak@example.com",
        username: "valid_user_y",
        password: "123",
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(400);
  });

  // 6. Successful login
  it("6. should log in successfully with valid credentials and return a new session", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      },
      body: JSON.stringify({
        login: testUsername,
        password: testPassword,
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.email).toBe(testEmail.toLowerCase());
    expect(body.user.username).toBe(testUsername);
    expect(body.profile).toBeDefined();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("codearena_session=");
    expect(setCookie).toContain("HttpOnly");

    const tokenMatch = setCookie?.match(/codearena_session=([a-f0-9]+);/);
    expect(tokenMatch).toBeTruthy();
    if (tokenMatch) {
      activeSessionToken = tokenMatch[1];
    }
  });

  // 7. Incorrect password rejection
  it("7. should reject login with an incorrect password (401 generic error)", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      },
      body: JSON.stringify({
        login: testUsername,
        password: "WrongPassword999!",
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain("Invalid username/email or password");
  });

  // 8. Logout functionality
  it("8. should log out and delete the database session", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `codearena_session=${activeSessionToken}`,
      },
    });

    const res = await logoutHandler(req);
    expect(res.status).toBe(200);

    // Verify session is deleted from database
    const validated = await validateSession(activeSessionToken);
    expect(validated).toBeNull();
  });

  // 9. Authenticated /api/auth/me
  it("9. should return current user details on /api/auth/me when authenticated", async () => {
    // Create a fresh session
    const { sessionToken } = await createSession(createdUserId);

    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: {
        cookie: `codearena_session=${sessionToken}`,
      },
    });

    const res = await meHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.id).toBe(createdUserId);
    expect(body.user.username).toBe(testUsername);
    expect(body.profile.rating).toBe(1200);

    await deleteSession(sessionToken);
  });

  // 10. Unauthenticated /api/auth/me
  it("10. should return 401 on /api/auth/me when no cookie is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      method: "GET",
    });

    const res = await meHandler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  // 11. Expired or invalid session
  it("11. should reject expired or non-existent session tokens with 401", async () => {
    const fakeToken =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: {
        cookie: `codearena_session=${fakeToken}`,
      },
    });

    const res = await meHandler(req);
    expect(res.status).toBe(401);

    // Test programmatic validation of expired session
    const expiredToken = "expired_session_test_token";
    await prisma.session.create({
      data: {
        sessionToken: expiredToken,
        userId: createdUserId,
        expires: new Date(Date.now() - 1000 * 60), // Expired 1 minute ago
      },
    });

    const expiredResult = await validateSession(expiredToken);
    expect(expiredResult).toBeNull();
  });

  // 12. Password hashing and verification unit checks
  it("12. should properly hash and verify passwords using Argon2id", async () => {
    const plain = "SuperSecretPassword123#";
    const hashed = await hashPassword(plain);

    expect(hashed).not.toBe(plain);
    expect(hashed.startsWith("$argon2id$")).toBe(true);

    const isValid = await verifyPassword(plain, hashed);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword("WrongPassword!", hashed);
    expect(isInvalid).toBe(false);
  });
});
