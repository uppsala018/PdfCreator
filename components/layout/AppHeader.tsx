"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, LogOut, LayoutDashboard, Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  userEmail: string
}

export default function AppHeader({ userEmail }: AppHeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#1e3a52] bg-[#0a1929]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 shrink-0 group"
        >
          <div className="w-7 h-7 rounded bg-[#C9A84C] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#0D1B2A]" />
          </div>
          <span className="font-semibold text-white text-sm tracking-tight group-hover:text-[#C9A84C] transition-colors">
            Ebook Studio
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          <NavLink href="/dashboard" icon={<LayoutDashboard className="w-3.5 h-3.5" />}>
            Projects
          </NavLink>
          <NavLink href="/settings" icon={<Settings className="w-3.5 h-3.5" />}>
            Settings
          </NavLink>
        </nav>

        {/* User + sign-out */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:block text-xs text-slate-500 max-w-[160px] truncate">
            {userEmail}
          </span>
          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
              "text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            )}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm",
        "text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
      )}
    >
      {icon}
      {children}
    </Link>
  )
}
