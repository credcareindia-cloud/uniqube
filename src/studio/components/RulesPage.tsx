import { useMemo, useState } from 'react'
import { RULES, RULE_CATEGORIES } from '../lib/rulesPreview'
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
      <header className="rules-page__head">
        <div>
          <h1>Rules</h1>
          <p>
            Unified estimation registry ({RULES.length} rules · {RULE_CATEGORIES.length} categories). Sub structure uses
            SUBSTRUCTURE.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a rule by id, name, or logic"
        />
      </header>
      <div className="rules-page__filters">
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
      <p className="rules-page__count">{rows.length} shown</p>
      <ul className="rules-page__list">
        {rows.map((rule) => (
          <li key={rule.id}>
            <b>{rule.id}</b>
            <strong>{rule.name}</strong>
            <small>
              {rule.category} · unit {rule.unit} · {rule.status.replaceAll('_', ' ').toLowerCase()}
            </small>
            <span>{rule.logic}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="rules-page__empty">No rule matches.</li>}
      </ul>
    </div>
  )
}
