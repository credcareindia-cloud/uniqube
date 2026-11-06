import type { SpecNode } from '../data/buildSpec'

export function SpecTree({
  nodes,
  selected,
  onToggle,
}: {
  nodes: SpecNode[]
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
}) {
  return (
    <ul className="spec-tree">
      {nodes.map((node) => {
        const on = selected.has(node.id)
        return (
          <li key={node.id}>
            <label>
              <input type="checkbox" checked={on} onChange={() => onToggle(node.id)} />
              <span>{node.label}</span>
            </label>
            {on && node.children && node.children.length > 0 && (
              <SpecTree nodes={node.children} selected={selected} onToggle={onToggle} />
            )}
          </li>
        )
      })}
    </ul>
  )
}
