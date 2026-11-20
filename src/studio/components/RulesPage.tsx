import { useMemo, useState } from 'react'
import { BookMarked } from 'lucide-react'
import { RULES } from '../lib/rulesPreview'
import { SCOPE_AGENTS, rulesForAgent, type ScopeAgentId } from '../lib/agentScopes'

export function RulesPage() {
  const [agent, setAgent] = useState<ScopeAgentId | 'all'>('foundation')
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const base = agent === 'all' ? RULES : rulesForAgent(agent)
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (rule) =>
        rule.id.toLowerCase().includes(q) ||
        rule.name.toLowerCase().includes(q) ||
        rule.logic.toLowerCase().includes(q) ||
        rule.category.toLowerCase().includes(q),
    )
  }, [agent, query])

  return (
    <div className="rules-page">
      <div className="rules-page__toolbar">
        <div className="rules-page__filters" role="tablist" aria-label="Rule scope">
          <button type="button" className={agent === 'all' ? 'is-on' : undefined} onClick={() => setAgent('all')}>
            All
          </button>
          {SCOPE_AGENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={agent === item.id ? 'is-on' : undefined}
              onClick={() => setAgent(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="rules-page__search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules"
            aria-label="Search rules"
          />
        </label>
      </div>
      <p className="rules-page__count">{rows.length} shown</p>
      {rows.length === 0 ? (
        <p className="os-list__empty">No rule matches.</p>
      ) : (
        <ul className="os-list">
          {rows.map((rule) => {
            const status = rule.status.replaceAll('_', ' ').toLowerCase()
            const statusClass = status.includes('draft') ? 'is-draft' : status.includes('error') ? 'is-error' : 'is-ready'
            return (
              <li key={rule.id}>
                <div className="os-list__row">
                  <div className="os-list__main">
                    <span className="os-list__icon" aria-hidden>
                      <BookMarked size={18} strokeWidth={1.75} />
                    </span>
                    <span className="os-list__body">
                      <span className="os-list__title">{rule.name}</span>
                      <span className="os-list__meta">
                        <span className="os-list__chip os-list__chip--id">{rule.id}</span>
                        <span className="os-list__chip">{rule.category}</span>
                        <span className="os-list__mute">unit {rule.unit}</span>
                        <span className={`os-list__status ${statusClass}`}>{status}</span>
                      </span>
                      <span className="os-list__note">{rule.logic}</span>
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
