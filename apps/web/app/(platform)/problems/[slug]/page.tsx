import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@codearena/db";
import { getCurrentUser } from "@/lib/auth";
import { ProblemWorkspace } from "@/components/workspace/ProblemWorkspace";
import { WorkspaceProblemData } from "@/components/workspace/ProblemDescriptionPanel";

interface ProblemDetailPageProps {
  params: {
    slug: string;
  };
}

export const dynamic = "force-dynamic";

export default async function ProblemDetailPage({
  params,
}: ProblemDetailPageProps) {
  const { slug } = params;
  const auth = await getCurrentUser();
  const isAdmin = auth?.user?.role === "ADMIN";

  const problem = await prisma.problem.findUnique({
    where: { slug },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      testCases: {
        where: { isSample: true },
        orderBy: { orderIndex: "asc" },
      },
      templates: true,
    },
  });

  if (!problem) {
    notFound();
  }

  // Restrict unpublished draft problems to admins
  if (!problem.isPublished && !isAdmin) {
    notFound();
  }

  const workspaceProblem: WorkspaceProblemData = {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    statement: problem.statement,
    inputFormat: problem.inputFormat,
    outputFormat: problem.outputFormat,
    constraints: problem.constraints,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    acceptanceRate: problem.acceptanceRate,
    isPublished: problem.isPublished,
    tags: problem.tags.map((t) => t.tag),
    testCases: problem.testCases.map((tc) => ({
      id: tc.id,
      inputData: tc.inputData,
      expectedOutput: tc.expectedOutput,
      isSample: tc.isSample,
      orderIndex: tc.orderIndex,
      explanation: tc.explanation,
    })),
    templates: problem.templates.map((tpl) => ({
      id: tpl.id,
      language: tpl.language,
      boilerPlate: tpl.boilerPlate,
    })),
  };

  return <ProblemWorkspace problem={workspaceProblem} />;
}
