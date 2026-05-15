export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col">
      {children}
    </div>
  )
}
