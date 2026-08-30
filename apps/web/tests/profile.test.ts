import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, Role, Language, Verdict, Difficulty } from "@codearena/db";
import { GET as getPublicProfileHandler } from "../app/api/users/[username]/route";
import { NextRequest } from "next/server";
import {
  getUserStatistics,
  calculateStreaks,
  formatUtcDate,
  getUtcDateOffset,
} from "../lib/statistics";
import { hashPassword } from "../lib/auth";

describe("CodeArena User Profiles & Progress Test Suite", () => {
  let user1Id: string;
  let user1Username: string;
  let user2Id: string;
  let user2Username: string;
  let problemEasyId: string;
  let problemMediumId: string;
  let problemHardId: string;

  beforeAll(async () => {
    const unique = Date.now();
    user1Username = `prof_u1_${unique}`;
    user2Username = `prof_u2_${unique}`;

    // User 1 (Active Solver)
    const user1 = await prisma.user.create({
      data: {
        email: `prof_u1_${unique}@example.com`,
        username: user1Username,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
        profile: {
          create: {
            bio: "Competitive coding enthusiast",
            rating: 1350,
            githubUrl: "https://github.com/test",
          },
        },
      },
    });
    user1Id = user1.id;

    // User 2 (Zero Submissions User)
    const user2 = await prisma.user.create({
      data: {
        email: `prof_u2_${unique}@example.com`,
        username: user2Username,
        passwordHash: await hashPassword("Password123!"),
        role: Role.USER,
      },
    });
    user2Id = user2.id;

    // Problems (Easy, Medium, Hard)
    const easyProb = await prisma.problem.create({
      data: {
        slug: `prof-easy-${unique}`,
        title: "Profile Easy Problem",
        difficulty: Difficulty.EASY,
        statement: "Easy",
        inputFormat: "none",
        outputFormat: "none",
        constraints: "none",
        isPublished: true,
      },
    });
    problemEasyId = easyProb.id;

    const mediumProb = await prisma.problem.create({
      data: {
        slug: `prof-med-${unique}`,
        title: "Profile Medium Problem",
        difficulty: Difficulty.MEDIUM,
        statement: "Medium",
        inputFormat: "none",
        outputFormat: "none",
        constraints: "none",
        isPublished: true,
      },
    });
    problemMediumId = mediumProb.id;

    const hardProb = await prisma.problem.create({
      data: {
        slug: `prof-hard-${unique}`,
        title: "Profile Hard Problem",
        difficulty: Difficulty.HARD,
        statement: "Hard",
        inputFormat: "none",
        outputFormat: "none",
        constraints: "none",
        isPublished: true,
      },
    });
    problemHardId = hardProb.id;

    // Submissions for User 1:
    // 1. Easy problem: 1 WA, then 2 ACCEPTED (must count as 1 solved, 3 total submissions, 2 accepted)
    // 2. Medium problem: 1 ACCEPTED (counts as 1 solved)
    // 3. Hard problem: 1 RUNNING (must NOT count as solved), 1 WA (must NOT count as solved)
    await prisma.submission.createMany({
      data: [
        {
          userId: user1Id,
          problemId: problemEasyId,
          language: Language.PYTHON,
          code: "print(1)",
          status: "COMPLETED",
          verdict: Verdict.WRONG_ANSWER,
          createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
        },
        {
          userId: user1Id,
          problemId: problemEasyId,
          language: Language.PYTHON,
          code: "print(2)",
          status: "COMPLETED",
          verdict: Verdict.ACCEPTED,
          createdAt: new Date(Date.now() - 86400000 * 1), // Yesterday
        },
        {
          userId: user1Id,
          problemId: problemEasyId,
          language: Language.CPP,
          code: "int main(){}",
          status: "COMPLETED",
          verdict: Verdict.ACCEPTED,
          createdAt: new Date(), // Today
        },
        {
          userId: user1Id,
          problemId: problemMediumId,
          language: Language.TYPESCRIPT,
          code: "console.log(3)",
          status: "COMPLETED",
          verdict: Verdict.ACCEPTED,
          createdAt: new Date(), // Today
        },
        {
          userId: user1Id,
          problemId: problemHardId,
          language: Language.PYTHON,
          code: "print(4)",
          status: "RUNNING",
          verdict: null,
          createdAt: new Date(),
        },
        {
          userId: user1Id,
          problemId: problemHardId,
          language: Language.PYTHON,
          code: "print(5)",
          status: "COMPLETED",
          verdict: Verdict.TIME_LIMIT_EXCEEDED,
          createdAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    if (problemEasyId || problemMediumId || problemHardId) {
      await prisma.submission.deleteMany({
        where: {
          problemId: { in: [problemEasyId, problemMediumId, problemHardId] },
        },
      });
      await prisma.problem.deleteMany({
        where: { id: { in: [problemEasyId, problemMediumId, problemHardId] } },
      });
    }
    if (user1Id) {
      await prisma.profile.deleteMany({ where: { userId: user1Id } });
      await prisma.session.deleteMany({ where: { userId: user1Id } });
      await prisma.user.deleteMany({ where: { id: user1Id } });
    }
    if (user2Id) {
      await prisma.session.deleteMany({ where: { userId: user2Id } });
      await prisma.user.deleteMany({ where: { id: user2Id } });
    }
  });

  function createRequest(url: string): NextRequest {
    return new NextRequest(url, { method: "GET" });
  }

  it("1. Public profile API returns 200 with safe public fields", async () => {
    const req = createRequest(
      `http://localhost:3000/api/users/${user1Username}`,
    );
    const res = await getPublicProfileHandler(req, {
      params: { username: user1Username },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user.username).toBe(user1Username);
    expect(data.profile.rating).toBe(1350);
    expect(data.profile.bio).toBe("Competitive coding enthusiast");
    expect(data.profile.githubUrl).toBe("https://github.com/test");

    // Security Check: private fields MUST NOT be present
    expect(data.user.email).toBeUndefined();
    expect(data.user.passwordHash).toBeUndefined();
    expect(data.user.role).toBeUndefined();
    expect(data.sessionToken).toBeUndefined();
  });

  it("2. Returns 404 for unknown username", async () => {
    const req = createRequest(
      "http://localhost:3000/api/users/unknown_nonexistent_user",
    );
    const res = await getPublicProfileHandler(req, {
      params: { username: "unknown_nonexistent_user" },
    });
    expect(res.status).toBe(404);
  });

  it("3. Correctly calculates total, accepted, and acceptance rate", async () => {
    const stats = await getUserStatistics(user1Id);

    // Total submissions = 6 (3 easy + 1 medium + 2 hard)
    expect(stats.totalSubmissions).toBe(6);
    // Accepted submissions = 3 (2 easy + 1 medium)
    expect(stats.acceptedSubmissions).toBe(3);
    // Acceptance rate = (3 / 6) * 100 = 50.00%
    expect(stats.acceptanceRate).toBe(50);
  });

  it("4. Correctly calculates solved problems and difficulty breakdown (deduplicating duplicates)", async () => {
    const stats = await getUserStatistics(user1Id);

    // User solved Easy and Medium, but not Hard. Total solved = 2 (not 3!)
    expect(stats.totalSolved).toBe(2);
    expect(stats.easySolved).toBe(1);
    expect(stats.mediumSolved).toBe(1);
    expect(stats.hardSolved).toBe(0);
  });

  it("5. Zero-submission user has 0 stats and no division-by-zero error", async () => {
    const stats = await getUserStatistics(user2Id);

    expect(stats.totalSubmissions).toBe(0);
    expect(stats.acceptedSubmissions).toBe(0);
    expect(stats.totalSolved).toBe(0);
    expect(stats.easySolved).toBe(0);
    expect(stats.mediumSolved).toBe(0);
    expect(stats.hardSolved).toBe(0);
    expect(stats.acceptanceRate).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
  });

  it("6. Unit test: calculateStreaks correctly handles active today and yesterday", () => {
    const today = new Date("2026-08-30T12:00:00Z");
    const todayStr = formatUtcDate(today);
    const yestStr = getUtcDateOffset(1, today);
    const day2Str = getUtcDateOffset(2, today);
    const day3Str = getUtcDateOffset(3, today);
    const day10Str = getUtcDateOffset(10, today);
    const day11Str = getUtcDateOffset(11, today);
    const day12Str = getUtcDateOffset(12, today);
    const day13Str = getUtcDateOffset(13, today);

    // Active today, yesterday, day2, day3 (4 day streak)
    // Plus historical 4 day streak (day 10, 11, 12, 13)
    const activeDates = [
      todayStr,
      yestStr,
      day2Str,
      day3Str,
      day10Str,
      day11Str,
      day12Str,
      day13Str,
    ];

    const result = calculateStreaks(activeDates, today);
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);
  });

  it("7. Unit test: calculateStreaks handles streak ending yesterday (today not yet solved)", () => {
    const today = new Date("2026-08-30T12:00:00Z");
    const yestStr = getUtcDateOffset(1, today);
    const day2Str = getUtcDateOffset(2, today);
    const day3Str = getUtcDateOffset(3, today);

    // Active yesterday, day 2, day 3 (3 day streak ending yesterday)
    const activeDates = [yestStr, day2Str, day3Str];

    const result = calculateStreaks(activeDates, today);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("8. Unit test: calculateStreaks returns 0 when inactive today and yesterday", () => {
    const today = new Date("2026-08-30T12:00:00Z");
    const day3Str = getUtcDateOffset(3, today);
    const day4Str = getUtcDateOffset(4, today);

    const activeDates = [day3Str, day4Str];
    const result = calculateStreaks(activeDates, today);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(2);
  });
});
