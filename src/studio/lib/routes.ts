import type { AgentFocus, OsScreen } from '../components/OsChrome'

const ID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

export type AppRoute =
  | { kind: 'site' }
  | { kind: 'login' }
  | { kind: 'projects' }
  | { kind: 'new' }
  | { kind: 'project'; projectId: string; screen: OsScreen; agent?: AgentFocus }

export function parsePath(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { kind: 'site' }
  if (path === '/login') return { kind: 'login' }
  if (path === '/projects') return { kind: 'projects' }
  if (path === '/projects/new') return { kind: 'new' }
  const match = new RegExp(`^/projects/(${ID})(?:/(foundation|structure|architecture|mep|boq|dry-cost|costing|packages|offer|rules|settings|studio|documents))?$`).exec(path)
  if (!match) return { kind: 'projects' }
  const projectId = match[1]
  const section = match[2]
  if (section === 'foundation') return { kind: 'project', projectId, screen: 'agents', agent: 'foundation' }
  if (section === 'structure') return { kind: 'project', projectId, screen: 'agents', agent: 'structure' }
  if (section === 'architecture') return { kind: 'project', projectId, screen: 'agents', agent: 'architecture' }
  if (section === 'mep') return { kind: 'project', projectId, screen: 'agents', agent: 'mep' }
  if (section === 'boq') return { kind: 'project', projectId, screen: 'boq' }
  if (section === 'dry-cost') return { kind: 'project', projectId, screen: 'dry-cost' }
  if (section === 'costing') return { kind: 'project', projectId, screen: 'costing' }
  if (section === 'packages') return { kind: 'project', projectId, screen: 'packages' }
  if (section === 'offer') return { kind: 'project', projectId, screen: 'share' }
  if (section === 'rules') return { kind: 'project', projectId, screen: 'rules' }
  if (section === 'settings') return { kind: 'project', projectId, screen: 'setup' }
  if (section === 'studio') return { kind: 'project', projectId, screen: 'workspace' }
  if (section === 'documents') return { kind: 'project', projectId, screen: 'documents' }
  return { kind: 'project', projectId, screen: 'documents' }
}

export function screenFrom(route: AppRoute): OsScreen {
  if (route.kind === 'new') return 'create'
  if (route.kind === 'project') return route.screen
  return 'projects'
}

export function agentFrom(route: AppRoute): AgentFocus {
  return route.kind === 'project' && route.agent ? route.agent : 'foundation'
}

const ESTIMATE_SECTION = 'foundation|structure|architecture|mep|boq|dry-cost|costing|packages|offer|rules|settings|studio|documents'

export function parseEstimateLocation(pathname: string): { screen: OsScreen; agent: AgentFocus } | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  const match = new RegExp(`^/projects/[^/]+/estimate(?:/(${ESTIMATE_SECTION}))?$`).exec(path)
  if (!match) return null
  const section = match[1]
  if (section === 'foundation') return { screen: 'agents', agent: 'foundation' }
  if (section === 'structure') return { screen: 'agents', agent: 'structure' }
  if (section === 'architecture') return { screen: 'agents', agent: 'architecture' }
  if (section === 'mep') return { screen: 'agents', agent: 'mep' }
  if (section === 'boq') return { screen: 'boq', agent: 'foundation' }
  if (section === 'dry-cost') return { screen: 'dry-cost', agent: 'foundation' }
  if (section === 'costing') return { screen: 'costing', agent: 'foundation' }
  if (section === 'packages') return { screen: 'packages', agent: 'foundation' }
  if (section === 'offer') return { screen: 'share', agent: 'foundation' }
  if (section === 'rules') return { screen: 'rules', agent: 'foundation' }
  if (section === 'settings') return { screen: 'setup', agent: 'foundation' }
  if (section === 'studio') return { screen: 'workspace', agent: 'foundation' }
  if (section === 'documents') return { screen: 'documents', agent: 'foundation' }
  return { screen: 'documents', agent: 'foundation' }
}

/** Address inside the Uniqube estimate tab, kept so a reload opens the same section. */
export function estimateLocation(numericProjectId: string, screen: OsScreen, agent: AgentFocus): string {
  const base = `/projects/${numericProjectId}/estimate`
  if (screen === 'agents') return `${base}/${agent}`
  if (screen === 'boq') return `${base}/boq`
  if (screen === 'dry-cost') return `${base}/dry-cost`
  if (screen === 'costing') return `${base}/costing`
  if (screen === 'packages') return `${base}/packages`
  if (screen === 'share') return `${base}/offer`
  if (screen === 'rules') return `${base}/rules`
  if (screen === 'setup') return `${base}/settings`
  if (screen === 'workspace') return `${base}/studio`
  if (screen === 'guide' || screen === 'documents') return `${base}/documents`
  return base
}

/** Address for the signed-in screen. The public site is `/` and sign-in is `/login`. */
export function studioPath(screen: OsScreen, projectId: string | null, agent: AgentFocus): string {
  if (screen === 'create') return '/projects/new'
  if (screen === 'projects' || !projectId) return '/projects'
  const base = `/projects/${projectId}`
  if (screen === 'guide' || screen === 'documents') return `${base}/documents`
  if (screen === 'agents') return `${base}/${agent}`
  if (screen === 'boq') return `${base}/boq`
  if (screen === 'dry-cost') return `${base}/dry-cost`
  if (screen === 'costing') return `${base}/costing`
  if (screen === 'packages') return `${base}/packages`
  if (screen === 'share') return `${base}/offer`
  if (screen === 'rules') return `${base}/rules`
  if (screen === 'setup') return `${base}/settings`
  if (screen === 'workspace') return `${base}/studio`
  return '/projects'
}
