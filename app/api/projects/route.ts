import { NextResponse } from "next/server"

export async function GET() {
  const projects = [
    { id: "demo_project_v0", name: "DEMO_PROJECT_V0", total_panels: 124, updated_at: new Date().toISOString() },
    {
      id: "campus_alpha",
      name: "Campus Alpha",
      total_panels: 320,
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ]
  return NextResponse.json(projects)
}
