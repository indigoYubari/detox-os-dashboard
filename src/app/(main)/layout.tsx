import { ParticleBackground } from "@/components/ui/ParticleBackground"
import { Topbar } from "@/components/ui/navigation/Topbar"

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="relative">
      <ParticleBackground />
      <div className="relative z-[1]">
        <Topbar />
        <div className="p-4 sm:px-6 sm:pb-10 sm:pt-10 lg:px-10 lg:pt-7">
          {children}
        </div>
      </div>
    </div>
  )
}
