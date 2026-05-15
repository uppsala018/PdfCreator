import { cache } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import EditorShell from "./EditorShell"

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

  return <EditorShell project={project} />
}
