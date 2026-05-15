import { createClient } from "@/lib/supabase/server"
import AppHeader from "@/components/layout/AppHeader"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      <AppHeader userEmail={user?.email ?? ""} />
      {children}
    </div>
  )
}
