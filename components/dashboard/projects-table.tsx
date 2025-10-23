"use client"

import useSWR from "swr"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type Project = {
  id: string
  name: string
  total_panels: number
  updated_at: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function ProjectsTable() {
  const { data, isLoading } = useSWR<Project[]>("/api/projects", fetcher)

  return (
    <Card className="overflow-hidden border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <input
          placeholder="Search projects..."
          className="h-9 w-64 rounded-md border bg-background px-3 text-sm outline-none"
        />
        <Button className="bg-primary text-primary-foreground">Create Project</Button>
      </div>
      <div className="divide-y">
        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-muted-foreground">
          <div className="col-span-7">Project Name</div>
          <div className="col-span-3">Last Updated</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          data?.map((p) => (
            <div key={p.id} className="grid grid-cols-12 items-center gap-4 px-4 py-3">
              <div className="col-span-7">
                <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <div className="text-xs text-muted-foreground">Panels: {p.total_panels}</div>
              </div>
              <div className="col-span-3 text-sm">{new Date(p.updated_at).toLocaleString()}</div>
              <div className="col-span-2 flex justify-end">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/projects/${p.id}`}>Open</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
