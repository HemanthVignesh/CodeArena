import { NextRequest, NextResponse } from "next/server";
import { prisma, Difficulty } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }
    if (auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Admin privileges required." },
        { status: 403 },
      );
    }

    const { id } = params;
    const problem = await prisma.problem.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        testCases: {
          orderBy: { orderIndex: "asc" },
        },
        templates: true,
      },
    });

    if (!problem) {
      return NextResponse.json(
        { error: "Problem not found." },
        { status: 404 },
      );
    }

    const formatted = {
      ...problem,
      tags: problem.tags.map((t) => t.tag),
    };

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error("[Admin API] Get problem error:", (error as Error).message);
    return NextResponse.json(
      { error: "Failed to retrieve problem." },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }
    if (auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Admin privileges required." },
        { status: 403 },
      );
    }

    const { id } = params;
    const existingProblem = await prisma.problem.findUnique({
      where: { id },
    });

    if (!existingProblem) {
      return NextResponse.json(
        { error: "Problem not found." },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    const {
      title,
      slug,
      difficulty,
      statement,
      inputFormat,
      outputFormat,
      constraints,
      timeLimitMs,
      memoryLimitMb,
      isPublished,
      tags,
    } = body;

    const dataToUpdate: any = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "Title cannot be empty." },
          { status: 400 },
        );
      }
      dataToUpdate.title = title.trim();
    }

    if (slug !== undefined) {
      const cleanSlug = slug.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
        return NextResponse.json(
          {
            error:
              "Slug must contain only lowercase letters, numbers, and hyphens.",
          },
          { status: 400 },
        );
      }
      // Check if new slug conflicts with another problem
      if (cleanSlug !== existingProblem.slug) {
        const conflict = await prisma.problem.findUnique({
          where: { slug: cleanSlug },
        });
        if (conflict) {
          return NextResponse.json(
            { error: `Slug '${cleanSlug}' is already in use.` },
            { status: 409 },
          );
        }
      }
      dataToUpdate.slug = cleanSlug;
    }

    if (difficulty !== undefined) {
      if (!Object.values(Difficulty).includes(difficulty as Difficulty)) {
        return NextResponse.json(
          { error: "Invalid difficulty." },
          { status: 400 },
        );
      }
      dataToUpdate.difficulty = difficulty as Difficulty;
    }

    if (statement !== undefined) {
      dataToUpdate.statement = (statement || "").trim();
    }
    if (inputFormat !== undefined) {
      dataToUpdate.inputFormat = (inputFormat || "").trim();
    }
    if (outputFormat !== undefined) {
      dataToUpdate.outputFormat = (outputFormat || "").trim();
    }
    if (constraints !== undefined) {
      dataToUpdate.constraints = (constraints || "").trim();
    }

    if (timeLimitMs !== undefined) {
      const numTime = Number(timeLimitMs);
      if (isNaN(numTime) || numTime <= 0 || numTime > 10000) {
        return NextResponse.json(
          { error: "Invalid time limit." },
          { status: 400 },
        );
      }
      dataToUpdate.timeLimitMs = numTime;
    }

    if (memoryLimitMb !== undefined) {
      const numMem = Number(memoryLimitMb);
      if (isNaN(numMem) || numMem <= 0 || numMem > 2048) {
        return NextResponse.json(
          { error: "Invalid memory limit." },
          { status: 400 },
        );
      }
      dataToUpdate.memoryLimitMb = numMem;
    }

    if (isPublished !== undefined) {
      dataToUpdate.isPublished = Boolean(isPublished);
    }

    // Execute update inside a transaction to safely handle tag relationships
    const updated = await prisma.$transaction(async (tx) => {
      const problem = await tx.problem.update({
        where: { id },
        data: dataToUpdate,
      });

      // Update tags if provided
      if (Array.isArray(tags)) {
        // Remove existing tags
        await tx.problemTag.deleteMany({ where: { problemId: id } });

        for (const tagName of tags) {
          if (typeof tagName === "string" && tagName.trim().length > 0) {
            const cleanTag = tagName.trim();
            const tagSlug = cleanTag.toLowerCase().replace(/[^a-z0-9]+/g, "-");

            const tag = await tx.tag.upsert({
              where: { slug: tagSlug },
              update: { name: cleanTag },
              create: { name: cleanTag, slug: tagSlug },
            });

            await tx.problemTag.create({
              data: {
                problemId: id,
                tagId: tag.id,
              },
            });
          }
        }
      }

      return problem;
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error(
      "[Admin API] Update problem error:",
      (error as Error).message,
    );
    return NextResponse.json(
      { error: "An unexpected error occurred while updating the problem." },
      { status: 500 },
    );
  }
}
