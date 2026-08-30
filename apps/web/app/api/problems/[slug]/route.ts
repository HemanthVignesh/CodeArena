import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { slug } = params;

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { error: "Invalid slug parameter." },
        { status: 400 },
      );
    }

    const auth = await getCurrentUser(req);
    const isAdmin = auth?.user?.role === "ADMIN";

    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        difficulty: true,
        statement: true,
        inputFormat: true,
        outputFormat: true,
        constraints: true,
        timeLimitMs: true,
        memoryLimitMb: true,
        isPublished: true,
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
        // Only load SAMPLE test cases (never hidden test cases)
        testCases: {
          where: { isSample: true },
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            inputData: true,
            expectedOutput: true,
            isSample: true,
            orderIndex: true,
            explanation: true,
          },
        },
        templates: {
          select: {
            id: true,
            language: true,
            boilerPlate: true,
          },
        },
      },
    });

    if (!problem) {
      return NextResponse.json(
        { error: `Problem with slug '${slug}' not found.` },
        { status: 404 },
      );
    }

    // If problem is unpublished, only ADMIN can access it
    if (!problem.isPublished && !isAdmin) {
      return NextResponse.json(
        { error: `Problem with slug '${slug}' not found.` },
        { status: 404 },
      );
    }

    const formattedProblem = {
      ...problem,
      tags: problem.tags.map((t) => t.tag),
    };

    return NextResponse.json(formattedProblem, { status: 200 });
  } catch (error) {
    console.error(
      "[API] Error fetching problem detail:",
      (error as Error).message,
    );
    return NextResponse.json(
      { error: "Failed to retrieve problem details." },
      { status: 500 },
    );
  }
}
