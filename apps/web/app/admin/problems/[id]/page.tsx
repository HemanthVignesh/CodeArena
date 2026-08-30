import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@codearena/db";
import { requireAdmin } from "@/lib/auth";
import { ArrowLeft, Database, ExternalLink } from "lucide-react";
import { EditProblemForm } from "./EditProblemForm";

interface EditProblemPageProps {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export default async function EditProblemPage({
  params,
}: EditProblemPageProps) {
  try {
    await requireAdmin();
  } catch {
    redirect(`/login?redirect=/admin/problems/${params.id}`);
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
      _count: {
        select: {
          testCases: true,
        },
      },
    },
  });

  if (!problem) {
    notFound();
  }

  const tagString = problem.tags.map((t) => t.tag.name).join(", ");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/problems"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Edit Problem
            </h1>
            <p className="text-xs font-mono text-slate-400">{problem.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/problems/${problem.id}/test-cases`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>Manage Test Cases ({problem._count.testCases})</span>
          </Link>
          <Link
            href={`/problems/${problem.slug}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View Workspace</span>
          </Link>
        </div>
      </div>

      <EditProblemForm problem={problem} initialTags={tagString} />
    </div>
  );
}
