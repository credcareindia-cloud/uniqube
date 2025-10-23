import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function Hero() {
  return (
    <section className="container mx-auto grid gap-10 px-4 pb-12 pt-10 md:grid-cols-2 md:gap-14 md:px-8 md:pb-16 md:pt-14">
      <div className="flex flex-col justify-center">
        <h1 className="text-pretty text-3xl font-bold tracking-tight md:text-5xl">
          3D Model‑Driven Execution, Simplified
        </h1>
        <p className="mt-4 max-w-prose text-muted-foreground md:text-lg">
          Turn a single BIM into the live plan that drives every schedule, task, and decision—from design desk to
          jobsite.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button className="bg-primary text-primary-foreground" asChild>
            <Link href="/dashboard">Launch Demo</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="#features">Explore features</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Instant access — no account required</p>
      </div>
      <Card className="border-0 bg-secondary shadow-sm md:self-center">
        <CardContent className="p-4 md:p-8">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-card">
            <Image
              src="/images/assembly-dashboard.png"
              alt="Sample project dashboard preview"
              fill
              className="object-cover"
              priority
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
