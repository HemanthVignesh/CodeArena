import { prisma, Difficulty } from "@codearena/db";

export interface UserStatistics {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number; // e.g. 64.57 (%)
  currentStreak: number;
  longestStreak: number;
  recentSolvedProblems: {
    id: string;
    slug: string;
    title: string;
    difficulty: Difficulty;
  }[];
  activityMap: Record<string, number>; // "YYYY-MM-DD" -> count
}

/**
 * Formats a Date into a standard UTC "YYYY-MM-DD" string.
 */
export function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the UTC date string for a given day offset from today.
 * e.g., offsetDays = 0 is today, 1 is yesterday.
 */
export function getUtcDateOffset(
  offsetDays: number,
  baseDate = new Date(),
): string {
  const target = new Date(
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate() - offsetDays,
    ),
  );
  return formatUtcDate(target);
}

/**
 * Calculates current and longest streaks from an array of active UTC date strings ("YYYY-MM-DD").
 *
 * Rules:
 * - Active Day: At least 1 ACCEPTED submission on that UTC date.
 * - Current Streak: Consecutive active days ending today (UTC), or ending yesterday (UTC)
 *   if no submission has occurred today yet. Returns 0 if inactive both today and yesterday.
 * - Longest Streak: Maximum consecutive active days found in the entire history.
 */
export function calculateStreaks(
  activeDateStrings: string[],
  baseDate = new Date(),
): { currentStreak: number; longestStreak: number } {
  if (activeDateStrings.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Create unique set of active dates sorted chronologically descending
  const uniqueDates = Array.from(new Set(activeDateStrings)).sort().reverse();
  const dateSet = new Set(uniqueDates);

  const todayStr = getUtcDateOffset(0, baseDate);
  const yesterdayStr = getUtcDateOffset(1, baseDate);

  // 1. Calculate current streak
  let currentStreak = 0;
  let startOffset = -1;

  if (dateSet.has(todayStr)) {
    startOffset = 0;
  } else if (dateSet.has(yesterdayStr)) {
    startOffset = 1;
  }

  if (startOffset !== -1) {
    let checkOffset = startOffset;
    while (dateSet.has(getUtcDateOffset(checkOffset, baseDate))) {
      currentStreak++;
      checkOffset++;
    }
  }

  // 2. Calculate longest streak
  // Convert sorted dates into epoch day numbers
  const epochDays = Array.from(dateSet)
    .map((d) => {
      const parts = d.split("-").map(Number);
      return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
    })
    .sort((a, b) => a - b); // Ascending order

  let longestStreak = 0;
  let runningStreak = 0;
  let prevDay: number | null = null;

  for (const day of epochDays) {
    if (prevDay === null) {
      runningStreak = 1;
    } else if (day === prevDay + 1) {
      runningStreak++;
    } else {
      runningStreak = 1;
    }
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    prevDay = day;
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
  };
}

/**
 * Computes authoritative user statistics from the database.
 * Single source of truth: PostgreSQL `Submission` table.
 *
 * Guarantees:
 * - Solved problems count each problem at most once (distinct problemId).
 * - Only COMPLETED submissions with verdict ACCEPTED count toward solved metrics.
 * - Handles zero submissions without division by zero.
 * - Single batched aggregation queries, zero N+1 database calls.
 */
export async function getUserStatistics(
  userId: string,
): Promise<UserStatistics> {
  const [
    totalSubmissions,
    acceptedSubmissionsCount,
    acceptedProblemRecords,
    allSubmissionsDates,
  ] = await Promise.all([
    // 1. Total Submissions Count
    prisma.submission.count({
      where: { userId },
    }),

    // 2. Total Accepted Submissions Count
    prisma.submission.count({
      where: {
        userId,
        status: "COMPLETED",
        verdict: "ACCEPTED",
      },
    }),

    // 3. Unique Solved Problems with Difficulty
    prisma.submission.findMany({
      where: {
        userId,
        status: "COMPLETED",
        verdict: "ACCEPTED",
      },
      select: {
        problemId: true,
        createdAt: true,
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
          },
        },
      },
      distinct: ["problemId"],
      orderBy: {
        createdAt: "desc",
      },
    }),

    // 4. All submission dates for activity heatmap & streaks
    prisma.submission.findMany({
      where: {
        userId,
      },
      select: {
        createdAt: true,
        verdict: true,
      },
    }),
  ]);

  // Derived solved problem counts
  const totalSolved = acceptedProblemRecords.length;
  let easySolved = 0;
  let mediumSolved = 0;
  let hardSolved = 0;

  const recentSolvedProblems: UserStatistics["recentSolvedProblems"] = [];

  for (const record of acceptedProblemRecords) {
    const diff = record.problem.difficulty;
    if (diff === Difficulty.EASY) easySolved++;
    else if (diff === Difficulty.MEDIUM) mediumSolved++;
    else if (diff === Difficulty.HARD) hardSolved++;

    if (recentSolvedProblems.length < 10) {
      recentSolvedProblems.push({
        id: record.problem.id,
        slug: record.problem.slug,
        title: record.problem.title,
        difficulty: record.problem.difficulty,
      });
    }
  }

  // Acceptance rate calculation
  const acceptanceRate =
    totalSubmissions > 0
      ? Math.round((acceptedSubmissionsCount / totalSubmissions) * 10000) / 100
      : 0;

  // Build activity map and extract accepted dates for streak calculation
  const activityMap: Record<string, number> = {};
  const acceptedDateStrings: string[] = [];

  for (const sub of allSubmissionsDates) {
    const dateStr = formatUtcDate(sub.createdAt);
    activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;

    if (sub.verdict === "ACCEPTED") {
      acceptedDateStrings.push(dateStr);
    }
  }

  // Calculate streaks
  const { currentStreak, longestStreak } =
    calculateStreaks(acceptedDateStrings);

  return {
    totalSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    totalSubmissions,
    acceptedSubmissions: acceptedSubmissionsCount,
    acceptanceRate,
    currentStreak,
    longestStreak,
    recentSolvedProblems,
    activityMap,
  };
}
