import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import ProjectList from "./ProjectList"

export const metadata: Metadata = {
  title: "My Projects",
}

export default async function DashboardPage() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("projects")
    .select("id, title, author, theme, template, updated_at")
    .order("updated_at", { ascending: false })

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-red-400 text-sm">
          Failed to load projects: {error.message}
        </p>
      </div>
    )
  }

  return <ProjectList initialProjects={data ?? []} />
}
