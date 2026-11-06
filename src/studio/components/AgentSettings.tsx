import { useState } from 'react'
import clsx from 'clsx'
import {
  AGENT_ACCESS,
  AGENT_CLOSED,
  AGENT_HABITS,
  MEASURE_HABITS,
  ESTIMATE_HABITS,
  AGENT_MODELS,
  AGENT_ROLE,
  AGENT_SCOPE,
  AGENT_TOOLS,
  ASK_MODE,
  EXECUTE_MODE,
} from '../lib/agentCatalog'
import { buildAiRulesBlock } from '../lib/rulesContext'

const SECTIONS = [
  { id: 'tools', label: 'Tools' },
  { id: 'mcp', label: 'MCP' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'access', label: 'Access' },
  { id: 'models', label: 'Models' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function AgentSettings() {
  const [section, setSection] = useState<SectionId>('tools')

  return (
    <div className="agent-settings">
      <nav className="agent-settings__nav" aria-label="Settings sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx('agent-settings__nav-item', section === item.id && 'is-on')}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="agent-settings__body">
        {section === 'tools' && (
          <section>
            <h2>Tools</h2>
            <p>Connected to the estimator in this app. Ask can use the read tools. Execute can also change the canvas and the scale.</p>
            <ul className="agent-settings__list">
              {AGENT_TOOLS.map((tool) => (
                <li key={tool.name}>
                  <div className="agent-settings__row">
                    <code>{tool.name}</code>
                    <span className="agent-settings__badge">{tool.mode}</span>
                    <em>Connected</em>
                  </div>
                  <p>{tool.access}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {section === 'mcp' && (
          <section>
            <h2>MCP</h2>
            <p>No MCP servers are connected. Web lookup uses the built-in web_search tool, which runs through the model provider.</p>
            <div className="agent-settings__empty">None connected</div>
          </section>
        )}

        {section === 'instructions' && (
          <section>
            <h2>Instructions</h2>
            <p>Sent as the estimator’s standing brief. Project name, scale, files, canvas line count, and the price-sheet count are added on each message.</p>
            <h3>Role</h3>
            <p>{AGENT_ROLE}</p>
            <p>{AGENT_SCOPE}</p>
            <h3>How to work</h3>
            <ul className="agent-settings__habits">
              {AGENT_HABITS.map((habit) => (
                <li key={habit}>{habit}</li>
              ))}
            </ul>
            <h3>How to measure</h3>
            <ul className="agent-settings__habits">
              {MEASURE_HABITS.map((habit) => (
                <li key={habit}>{habit}</li>
              ))}
            </ul>
            <h3>How to price and summarise</h3>
            <ul className="agent-settings__habits">
              {ESTIMATE_HABITS.map((habit) => (
                <li key={habit}>{habit}</li>
              ))}
            </ul>
            <h3>Ask</h3>
            <p>{ASK_MODE}</p>
            <h3>Execute</h3>
            <p>{EXECUTE_MODE}</p>
            <h3>Also sent with the project</h3>
            <pre>{buildAiRulesBlock('leadEstimation')}</pre>
          </section>
        )}

        {section === 'access' && (
          <section>
            <h2>Access</h2>
            <ul className="agent-settings__list">
              {AGENT_ACCESS.map((item) => (
                <li key={item.name}>
                  <div className="agent-settings__row">
                    <strong>{item.name}</strong>
                    <em>Open</em>
                  </div>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ul>
            <h3>Closed</h3>
            <ul className="agent-settings__habits">
              {AGENT_CLOSED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {section === 'models' && (
          <section>
            <h2>Models</h2>
            <p>Chosen from the chat composer. The key stays on the app server.</p>
            <ul className="agent-settings__list">
              {AGENT_MODELS.map((model) => (
                <li key={model.id}>
                  <div className="agent-settings__row">
                    <strong>{model.label}</strong>
                    <code>{model.id}</code>
                    <span className="agent-settings__badge">{model.note}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
