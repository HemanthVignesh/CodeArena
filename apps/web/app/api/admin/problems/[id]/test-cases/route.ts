import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB limit for MVP

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
    const testCases = await prisma.testCase.findMany({
      where: { problemId: id },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json(testCases, { status: 200 });
  } catch (error) {
    console.error(
      "[Admin API] Get test cases error:",
      (error as Error).message,
    );
    return NextResponse.json(
      { error: "Failed to retrieve test cases." },
      { status: 500 },
    );
  }
}

export async function POST(
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

    const { id: problemId } = params;

    // Verify problem exists
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });
    if (!problem) {
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
      inputData,
      expectedOutput,
      isSample = false,
      isHidden = true,
      orderIndex,
      explanation,
    } = body;

    if (inputData === undefined || typeof inputData !== "string") {
      return NextResponse.json(
        { error: "inputData is required." },
        { status: 400 },
      );
    }

    if (expectedOutput === undefined || typeof expectedOutput !== "string") {
      return NextResponse.json(
        { error: "expectedOutput is required." },
        { status: 400 },
      );
    }

    if (Buffer.byteLength(inputData, "utf8") > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "inputData exceeds the maximum allowed size of 64 KB." },
        { status: 400 },
      );
    }

    if (Buffer.byteLength(expectedOutput, "utf8") > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "expectedOutput exceeds the maximum allowed size of 64 KB." },
        { status: 400 },
      );
    }

    // Determine orderIndex if not provided
    let calculatedOrderIndex =
      orderIndex !== undefined ? Number(orderIndex) : undefined;
    if (calculatedOrderIndex === undefined || isNaN(calculatedOrderIndex)) {
      const highestCase = await prisma.testCase.findFirst({
        where: { problemId },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });
      calculatedOrderIndex = highestCase ? highestCase.orderIndex + 1 : 0;
    }

    const createdTestCase = await prisma.testCase.create({
      data: {
        problemId,
        inputData,
        expectedOutput,
        isSample: Boolean(isSample),
        // If marked as sample, it is typically not hidden
        isHidden: isSample ? false : Boolean(isHidden),
        orderIndex: calculatedOrderIndex,
        explanation: explanation ? String(explanation).trim() : null,
      },
    });

    return NextResponse.json(createdTestCase, { status: 201 });
  } catch (error) {
    console.error(
      "[Admin API] Create test case error:",
      (error as Error).message,
    );
    return NextResponse.json(
      { error: "An unexpected error occurred while creating the test case." },
      { status: 500 },
    );
  }
}
