import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; caseId: string } },
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

    const { id: problemId, caseId } = params;

    const testCase = await prisma.testCase.findUnique({
      where: { id: caseId },
    });

    if (!testCase || testCase.problemId !== problemId) {
      return NextResponse.json(
        { error: "Test case not found for this problem." },
        { status: 404 },
      );
    }

    await prisma.testCase.delete({
      where: { id: caseId },
    });

    return NextResponse.json(
      { message: "Test case deleted successfully." },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "[Admin API] Delete test case error:",
      (error as Error).message,
    );
    return NextResponse.json(
      { error: "An unexpected error occurred while deleting the test case." },
      { status: 500 },
    );
  }
}
