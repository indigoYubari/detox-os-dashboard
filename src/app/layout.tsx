import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
})

import { siteConfig } from "./siteConfig"

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: '%s – detox.OS',
  },
  description: siteConfig.description,
  keywords: [],
  openGraph: {
    type: "website",
    locale: "nb_NO",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  icons: {
    icon: "/favicon.ico",
  },
}

// Rot-layouten er et nakent skall: html, fonter, tema. Flaten legger sin
// egen ramme i (ny)/layout.tsx. (Den gamle, moerke appen under (main) er
// pensjonert 2026-09-25.)
//
// Foer la rot-layouten paa en sidebar ogsaa paa /login og paa 404-siden, og
// alle sider laa inne i <main className="lg:pl-[200px]"> — ogsaa de som ikke
// har en sidebar aa lene seg paa. Én ramme, ett sted.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="no">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} overflow-y-scroll scroll-auto antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          defaultTheme="dark"
          attribute="class"
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
