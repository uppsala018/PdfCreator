import MarketingNav from "@/components/marketing/Nav"
import Footer from "@/components/marketing/Footer"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white flex flex-col">
      <MarketingNav />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
