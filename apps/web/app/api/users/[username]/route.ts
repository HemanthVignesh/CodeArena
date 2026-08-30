import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@codearena/db";
import { getUserStatistics } from "@/lib/statistics";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/:username
 *
 * Retrieves public profile information and real-time statistics for a user.
 *
 * Security:
 * - Publicly accessible
 * - Case-insensitive username lookup
 * - Strictly excludes sensitive authentication fields (email, passwordHash, sessionToken)
 * - Returns authoritative derived statistics computed directly from PostgreSQL
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } },
) {
  try {
    const rawUsername = params.username?.trim();
    if (!rawUsername) {
      return NextResponse.json(
        { error: "Username parameter is required" },
        { status: 400 },
      );
    }

    // 1. Fetch user & associated profile metadata
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: rawUsername,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
        profile: {
          select: {
            rating: true,
            bio: true,
            avatarUrl: true,
            githubUrl: true,
            linkedinUrl: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Compute authoritative statistics from Submission table
    const stats = await getUserStatistics(user.id);

    // 3. Return safe public payload
    return NextResponse.json(
      {
        user: {
          username: user.username,
          createdAt: user.createdAt,
        },
        profile: {
          rating: user.profile?.rating ?? 1200,
          bio: user.profile?.bio ?? null,
          avatarUrl: user.profile?.avatarUrl ?? null,
          githubUrl: user.profile?.githubUrl ?? null,
          linkedinUrl: user.profile?.linkedinUrl ?? null,
          totalSolved: stats.totalSolved,
          easySolved: stats.easySolved,
          mediumSolved: stats.mediumSolved,
          hardSolved: stats.hardSolved,
          totalSubmissions: stats.totalSubmissions,
          acceptedSubmissions: stats.acceptedSubmissions,
          acceptanceRate: stats.acceptanceRate,
          currentStreak: stats.currentStreak,
          longestStreak: stats.longestStreak,
          recentSolved: stats.recentSolvedProblems,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Users API] Error fetching user profile:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving the profile" },
      { status: 500 },
    );
  }
}
