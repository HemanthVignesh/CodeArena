import { NextRequest, NextResponse } from "next/server";
import { prisma, Difficulty } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Pagination validation
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(searchParams.get("pageSize") || "20", 10);
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const pageSize = Math.min(
      100,
      Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam),
    );
    const skip = (page - 1) * pageSize;

    // Filter validation
    const search = searchParams.get("search")?.trim();
    const difficultyParam = searchParams.get("difficulty")?.toUpperCase();
    const tag = searchParams.get("tag")?.trim();

    // Validate difficulty enum if provided
    let difficulty: Difficulty | undefined;
    if (
      difficultyParam &&
      Object.values(Difficulty).includes(difficultyParam as Difficulty)
    ) {
      difficulty = difficultyParam as Difficulty;
    } else if (difficultyParam && difficultyParam !== "ALL") {
      return NextResponse.json(
        {
          error: `Invalid difficulty value '${difficultyParam}'. Must be EASY, MEDIUM, or HARD.`,
        },
        { status: 400 },
      );
    }

    // Build Prisma where clause
    const where: any = {
      isPublished: true,
    };

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    if (tag) {
      const tagSlug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      where.tags = {
        some: {
          tag: {
            OR: [
              { slug: tagSlug },
              { name: { equals: tag, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    // Fetch problems and total count concurrently
    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          timeLimitMs: true,
          memoryLimitMb: true,
          totalAccepted: true,
          totalSubmissions: true,
          acceptanceRate: true,
          createdAt: true,
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      prisma.problem.count({ where }),
    ]);

    // Format tags cleanly
    const formattedProblems = problems.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      timeLimitMs: p.timeLimitMs,
      memoryLimitMb: p.memoryLimitMb,
      totalAccepted: p.totalAccepted,
      totalSubmissions: p.totalSubmissions,
      acceptanceRate: p.acceptanceRate,
      createdAt: p.createdAt,
      tags: p.tags.map((t) => t.tag),
    }));

    const totalPages = Math.ceil(total / pageSize) || 1;

    return NextResponse.json(
      {
        problems: formattedProblems,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[API] Error fetching problem catalog:",
      (error as Error).message,
    );
    return NextResponse.json(
      { error: "Failed to retrieve problem catalog." },
      { status: 500 },
    );
  }
}
