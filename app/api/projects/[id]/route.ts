import { NextResponse } from "next/server"

const DB: Record<string, any> = {
  demo_project_v0: {
    id: "demo_project_v0",
    name: "DEMO_PROJECT_V0",
    total_panels: 124,
    model_url: null,
    groups: [
      { id: "g1", name: "Level 01 - West", status: "In Progress" },
      { id: "g2", name: "Level 02 - Core", status: "Pending" },
    ],
  },
  campus_alpha: {
    id: "campus_alpha",
    name: "Campus Alpha",
    total_panels: 320,
    model_url: null,
    groups: [{ id: "g3", name: "Wing A", status: "Done" }],
  },
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const data = DB[params.id]
  if (!data) return new Response("Not found", { status: 404 })
  return NextResponse.json(data)
}
