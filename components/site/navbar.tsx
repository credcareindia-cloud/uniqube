"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-[6px] bg-primary" aria-hidden />
          <span className="font-semibold">AssembleKit</span>
        </Link>
        <nav className="hidden gap-6 text-sm md:flex">
          <Link href="#features" className="text-muted-foreground hover:text-foreground">
            Features
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Demo
          </Link>
          <Link href="#" className="text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Sign in</Link>
          </Button>
          <Button className="bg-primary text-primary-foreground" asChild>
            <Link href="/dashboard">Try the Demo</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
