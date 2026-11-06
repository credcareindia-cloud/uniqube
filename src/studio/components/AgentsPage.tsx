import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Layers } from 'lucide-react'
import { useAppStore } from '../store'
import { SCOPE_AGENTS, type ScopeAgentId } from '../lib/agentScopes'
import { DrawingPreview } from './DrawingPreview'
import { FoundationEnginePanel } from './FoundationEnginePanel'
import { SuperstructurePanel } from './SuperstructurePanel'
import { MepPanel } from './MepPanel'
import { ENGINE_RULES, type EngineRule } from '../lib/foundation/ruleText'
import { SUPER_RULES } from '../lib/superstructure/ruleText'
import { MEP_RULES } from '../lib/mep/rules'
import { ARCH_RULES } from '../lib/architecture/rules'
import { ArchitecturePanel } from './ArchitecturePanel'

function RulesView({ title, subtitle, rules }: { title: string; subtitle: string; rules: EngineRule[] }) {
  const groups: Array<{ module: string; rules: EngineRule[] }> = []
  for (const rule of rules) {
    const last = groups[groups.length - 1]
    if (last?.module === rule.module) last.rules.push(rule)
    else groups.push({ module: rule.module, rules: [rule] })
  }
  return (
    <div className="fe fe-rules">
      <header className="agents-chat__head">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </header>
      <div className="fe-rules__body">
        {groups.map((group) => (
          <section key={group.module}>
            <h3>{group.module}</h3>
            <ul className="agents-rules__list">
              {group.rules.map((rule) => (
                <li key={rule.id}>
                  <b>{rule.id}</b>
                  <strong>{rule.name}</strong>
                  <span>{rule.logic}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

export function AgentsPage({ projectId, focus }: { projectId: string; focus?: 'foundation' | 'structure' | 'architecture' | 'mep' }) {
  const documents = useAppStore((s) => s.documents)
  const [agent, setAgent] = useState<ScopeAgentId>(focus ?? 'foundation')
  useEffect(() => {
    if (focus) setAgent(focus)
  }, [focus])
  const [view, setView] = useState<'engine' | 'rules'>('engine')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const preview = useMemo(() => documents.find((doc) => doc.id === previewId) ?? null, [documents, previewId])

  useEffect(() => {
    if (previewId && !documents.some((doc) => doc.id === previewId)) setPreviewId(null)
  }, [documents, previewId])

  return (
    <div className="agents">
      <main className={clsx('agents-main', preview && 'has-drawing')}>
        <div className="agents-work">
          {agent === 'foundation' || agent === 'structure' || agent === 'architecture' || agent === 'mep' ? (
            <>
              <div className="agents-view">
                <button type="button" className={clsx(view === 'engine' && 'is-on')} onClick={() => setView('engine')}>
                  Engine
                </button>
                <button type="button" className={clsx(view === 'rules' && 'is-on')} onClick={() => setView('rules')}>
                  Rules
                </button>
                <span>
                  {agent === 'foundation'
                    ? view === 'engine'
                      ? 'Deterministic wall, framing and foundation logic (spec v0.1)'
                      : `${ENGINE_RULES.length} foundation rules · spec v0.1`
                    : agent === 'structure'
                      ? view === 'engine'
                        ? 'Deterministic LGS superstructure logic on the foundation walls and zones (spec v1.0)'
                        : `${SUPER_RULES.length} superstructure rules · spec v1.0`
                      : agent === 'architecture'
                        ? view === 'engine'
                          ? 'Walls, openings, floors and facade from the approved plan'
                          : `${ARCH_RULES.length} architecture rules`
                        : view === 'engine'
                          ? 'Electrical, mechanical and plumbing quantities'
                          : `${MEP_RULES.length} MEP rules`}
                </span>
              </div>
              {agent === 'foundation' ? (
                view === 'engine' ? (
                  <FoundationEnginePanel projectId={projectId} />
                ) : (
                  <RulesView title="Sub structure rules" subtitle="Load-bearing wall and foundation logic v0.1" rules={ENGINE_RULES} />
                )
              ) : agent === 'structure' ? (
                view === 'engine' ? (
                  <SuperstructurePanel projectId={projectId} />
                ) : (
                  <RulesView title="Super structure rules" subtitle="LGS superstructure logic v1.0" rules={SUPER_RULES} />
                )
              ) : agent === 'architecture' ? (
                view === 'engine' ? (
                  <ArchitecturePanel projectId={projectId} />
                ) : (
                  <RulesView title="Architecture rules" subtitle="Walls, openings, floors and facade" rules={ARCH_RULES} />
                )
              ) : view === 'engine' ? (
                <MepPanel projectId={projectId} />
              ) : (
                <RulesView title="MEP rules" subtitle="Electrical, mechanical and plumbing" rules={MEP_RULES} />
              )}
            </>
          ) : (
            <div className="agents-chat agents-chat--soon">
              <Layers size={28} />
              <h2>{SCOPE_AGENTS.find((item) => item.id === agent)?.label}</h2>
              <p>This agent is not open yet.</p>
            </div>
          )}
        </div>
        {preview && <DrawingPreview doc={preview} onClose={() => setPreviewId(null)} />}
      </main>
    </div>
  )
}
