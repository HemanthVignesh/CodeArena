import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@codearena/db";
import { requireAdmin } from "@/lib/auth";
import { ArrowLeft, ExternalLink, Edit } from "lucide-react";
import { TestCaseManagerClient } from "./TestCaseManagerClient";

interface TestCasePageProps {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export default async function TestCasePage({ params }: TestCasePageProps) {
  try {
    await requireAdmin();
  } catch {
    redirect(`/login?redirect=/admin/problems/${params.id}/test-cases`);
  }

  const { id } = params;

  const problem = await prisma.problem.findUnique({
    where: { id },
    include: {
      testCases: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!problem) {
    notFound();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/problems"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Test Case Manager
            </h1>
            <p className="text-xs text-slate-400">
              Configuring test cases for{" "}
              <span className="text-emerald-400 font-semibold">
                {problem.title}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/problems/${problem.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Metadata</span>
          </Link>
          <Link
            href={`/problems/${problem.slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Workspace</span>
          </Link>
        </div>
      </div>

      <TestCaseManagerClient
        problemId={problem.id}
        initialCases={problem.testCases}
      />
    </div>
  );
}
