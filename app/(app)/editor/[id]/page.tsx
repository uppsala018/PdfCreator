import { cache } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import EditorShell from "./EditorShell"
import ImportedPdfShell from "./ImportedPdfShell"
import type { ImportedPdfInfo, ProjectContent } from "@/lib/project-schema"

// Always fetch the latest project from Supabase — never serve a cached snapshot.
// Without this, Next.js App Router's prefetch cache can return stale content
// when the user navigates back to a project they were just editing.
export const dynamic = "force-dynamic"

interface Props {
  params: { id: string }
}

// cache() deduplicates the Supabase call so generateMetadata and the page
// component share one round-trip per request.
const fetchProject = cache(async (id: string) => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return null
  return data
})

function getImportedPdf(content: unknown): ImportedPdfInfo | null {
  if (
    typeof content !== "object" ||
    content === null ||
    !("projectType" in content) ||
    (content as { projectType?: unknown }).projectType !== "imported_pdf" ||
    !("importedPdf" in content)
  ) {
    return null
  }

  const importedPdf = (content as { importedPdf?: unknown }).importedPdf
  if (
    typeof importedPdf !== "object" ||
    importedPdf === null ||
    !("originalFilename" in importedPdf) ||
    typeof (importedPdf as { originalFilename?: unknown }).originalFilename !== "string"
  ) {
    return null
  }

  return importedPdf as ImportedPdfInfo
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await fetchProject(params.id)
  return {
    title: project?.title ?? "Editor",
  }
}

export default async function EditorPage({ params }: Props) {
  const project = await fetchProject(params.id)

  // RLS means a missing row is either genuinely missing or owned by someone else.
  if (!project) notFound()

  const importedPdf = getImportedPdf(project.content)
  if (importedPdf) {
    return (
      <ImportedPdfShell
        projectId={project.id}
        title={project.title}
        content={project.content as unknown as ProjectContent}
        importedPdf={importedPdf}
      />
    )
  }

  return <EditorShell project={project} />
}
