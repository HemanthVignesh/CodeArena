import { NextRequest, NextResponse } from "next/server";
import { prisma, Difficulty, Language } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
      timeLimitMs = 1000,
      memoryLimitMb = 256,
      isPublished = false,
      tags = [],
    } = body;

    // Field validations
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 },
      );
    }

    if (
      !slug ||
      typeof slug !== "string" ||
      !/^[a-z0-9-]+$/.test(slug.trim())
    ) {
      return NextResponse.json(
        {
          error:
            "Slug is required and must contain only lowercase letters, numbers, and hyphens.",
        },
        { status: 400 },
      );
    }

    if (
      !statement ||
      typeof statement !== "string" ||
      statement.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Problem statement is required." },
        { status: 400 },
      );
    }

    if (
      !difficulty ||
      !Object.values(Difficulty).includes(difficulty as Difficulty)
    ) {
      return NextResponse.json(
        { error: "Invalid difficulty. Must be EASY, MEDIUM, or HARD." },
        { status: 400 },
      );
    }

    const numTimeLimit = Number(timeLimitMs);
    const numMemoryLimit = Number(memoryLimitMb);

    if (isNaN(numTimeLimit) || numTimeLimit <= 0 || numTimeLimit > 10000) {
      return NextResponse.json(
        {
          error: "Time limit must be a positive number between 1 and 10000 ms.",
        },
        { status: 400 },
      );
    }

    if (isNaN(numMemoryLimit) || numMemoryLimit <= 0 || numMemoryLimit > 2048) {
      return NextResponse.json(
        {
          error:
            "Memory limit must be a positive number between 1 and 2048 MB.",
        },
        { status: 400 },
      );
    }

    const cleanSlug = slug.trim().toLowerCase();

    // Check slug uniqueness
    const existingSlug = await prisma.problem.findUnique({
      where: { slug: cleanSlug },
    });
    if (existingSlug) {
      return NextResponse.json(
        { error: `A problem with slug '${cleanSlug}' already exists.` },
        { status: 409 },
      );
    }

    // Create problem and link tags atomically
    const newProblem = await prisma.$transaction(async (tx) => {
      const problem = await tx.problem.create({
        data: {
          title: title.trim(),
          slug: cleanSlug,
          difficulty: difficulty as Difficulty,
          statement: statement.trim(),
          inputFormat: (inputFormat || "").trim(),
          outputFormat: (outputFormat || "").trim(),
          constraints: (constraints || "").trim(),
          timeLimitMs: numTimeLimit,
          memoryLimitMb: numMemoryLimit,
          isPublished: Boolean(isPublished),
        },
      });

      // Handle tags
      if (Array.isArray(tags) && tags.length > 0) {
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
                problemId: problem.id,
                tagId: tag.id,
              },
            });
          }
        }
      }

      // Create default language templates
      await tx.languageTemplate.createMany({
        data: [
          {
            problemId: problem.id,
            language: Language.PYTHON,
            boilerPlate: "# Write your solution here\n",
          },
          {
            problemId: problem.id,
            language: Language.CPP,
            boilerPlate:
              "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n",
          },
          {
            problemId: problem.id,
            language: Language.TYPESCRIPT,
            boilerPlate: "// Write your solution here\n",
          },
        ],
      });

      return problem;
    });

    return NextResponse.json(newProblem, { status: 201 });
  } catch (error) {
    console.error(
      "[Admin API] Create problem error:",
      (error as Error).message,
    );
    return NextResponse.json(
      { error: "An unexpected error occurred while creating the problem." },
      { status: 500 },
    );
  }
}
