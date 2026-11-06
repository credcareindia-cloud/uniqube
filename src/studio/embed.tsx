import css from './index.css?inline'
import type { OsUser } from './components/OsChrome'

export type StudioMount = {
  projectId: string
  projectName: string
  user: OsUser
}

const extra = `
.studio-root {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  font-family: var(--font-body);
  background: #f4f2ec;
  color: var(--text);
}
`

/** Studio styles for the estimate tab. Removed from the document when that tab leaves the page. */
export function studioDocumentCss() {
  return `${css}\n${extra}`
}
