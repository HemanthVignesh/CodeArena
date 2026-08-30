import { NextResponse } from "next/server";
import { prisma } from "@codearena/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            problems: {
              where: {
                problem: {
                  isPublished: true,
                },
              },
            },
          },
        },
      },
    });

    const formattedTags = tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      problemCount: t._count.problems,
    }));

    return NextResponse.json(formattedTags, { status: 200 });
  } catch (error) {
    console.error(
      "[API] Error fetching problem tags:",
      (error as Error).message,
    );
    return NextResponse.json(
      { error: "Failed to retrieve problem tags." },
      { status: 500 },
    );
  }
}
