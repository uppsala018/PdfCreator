"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import PdfLayoutEditor from "@/components/pdf-layout/PdfLayoutEditor"
import type { ImportedPdfInfo, ProjectContent } from "@/lib/project-schema"

interface ImportedPdfShellProps {
  projectId: string
  title: string
  content: ProjectContent
  importedPdf: ImportedPdfInfo
}

export default function ImportedPdfShell({
  projectId,
  title,
  content,
  importedPdf,
}: ImportedPdfShellProps) {
  const router = useRouter()

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#0D1B2A]">
      <div className="border-b border-[#1e3a52] bg-[#0a1929] px-4 h-11 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          My Projects
        </button>
        <span className="text-slate-700 text-xs">/</span>
        <span className="text-sm font-semibold text-white truncate">
          {title}
        </span>
      </div>

      <PdfLayoutEditor
        projectId={projectId}
        content={content}
        importedPdf={importedPdf}
      />
    </div>
  )
}
