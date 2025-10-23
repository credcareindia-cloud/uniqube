import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/components/auth/AuthContext"
import { AppLayout } from "@/components/layout/AppLayout"
import "./globals.css"


export const metadata: Metadata = {
  title: "UniQube 3D - IFC Project Management",
  description: "3D IFC SaaS platform for construction and manufacturing project management",
  generator: "UniQube 3D",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <AuthProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <AppLayout>
              {children}
            </AppLayout>
          </Suspense>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
