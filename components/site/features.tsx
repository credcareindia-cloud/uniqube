"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function Features() {
  const items = [
    { title: "Chat on the Component", desc: "Threaded comments tied to the exact part." },
    { title: "Zero‑install Visualization", desc: "Stream models without native apps." },
    { title: "Status & Punch Lists", desc: "Track groups and panels across phases." },
    { title: "Your Workflow, Visualized", desc: "Connect tasks to the 3D view." },
  ]
  return (
    <div id="features" className="grid gap-8 md:grid-cols-2">
      <Card className="border bg-card">
        <CardContent className="p-0">
          <ul className="divide-y">
            {items.map((it, i) => (
              <li key={i} className="grid items-start gap-1 p-4 md:p-5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </Badge>
                  <h3 className="font-medium">{it.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground pl-10">{it.desc}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="border bg-secondary/60">
        <CardContent className="p-5 md:p-8">
          <div className="rounded-lg border bg-background/60 p-6">
            <div className="h-56 w-full rounded-md bg-muted" />
            <p className="mt-4 text-sm text-muted-foreground">
              Drop your IFC here to preview. The full demo uses an in‑browser viewer with progressive loading.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
