export type SpecNode = {
  id: string
  label: string
  children?: SpecNode[]
}

const mm = (prefix: string, sizes: number[]): SpecNode[] =>
  sizes.map((size) => ({ id: `${prefix}-${size}`, label: `${size} mm` }))

const cement = (prefix: string, sizes = [6, 9, 12, 15, 18]): SpecNode => ({
  id: prefix,
  label: 'Cement board',
  children: mm(prefix, sizes),
})

const rockwool = (prefix: string): SpecNode => ({
  id: prefix,
  label: 'Rockwool',
  children: [
    {
      id: `${prefix}-89`,
      label: '89 mm',
      children: [35, 45, 120].flatMap((density) => [
        { id: `${prefix}-89-${density}-plain`, label: `${density} density, no foil` },
        { id: `${prefix}-89-${density}-foil`, label: `${density} density, one side foil` },
      ]),
    },
    {
      id: `${prefix}-150`,
      label: '150 mm',
      children: [35, 45, 120].flatMap((density) => [
        { id: `${prefix}-150-${density}-plain`, label: `${density} density, no foil` },
        { id: `${prefix}-150-${density}-foil`, label: `${density} density, one side foil` },
      ]),
    },
    { id: `${prefix}-glass`, label: 'Glass wool' },
  ],
})

const gypsum = (prefix: string, kinds: Array<[string, string]>): SpecNode => ({
  id: prefix,
  label: 'Gypsum',
  children: kinds.map(([id, label]) => ({
    id: `${prefix}-${id}`,
    label,
    children: mm(`${prefix}-${id}`, id === 'nr' ? [9, 12, 15, 18] : id === 'fr' ? [9, 12, 15, 18] : [9, 12, 15, 18]),
  })),
})

const paint = (prefix: string): SpecNode => ({
  id: prefix,
  label: 'Paint',
  children: [
    { id: `${prefix}-emulsion`, label: 'Emulsion' },
    { id: `${prefix}-plain`, label: 'Plain' },
    { id: `${prefix}-other`, label: 'Any other type' },
  ],
})

const tiles = (prefix: string, label: string, extra: SpecNode[] = []): SpecNode => ({
  id: prefix,
  label,
  children: [
    ...['300×300', '600×600', '1200×1200', '600×1200', '1200×2400', '2400×2400'].map((label) => ({
      id: `${prefix}-${label}`,
      label,
    })),
    ...extra,
  ],
})

export const LGS_SPEC: SpecNode[] = [
  { id: 'steel-lgs', label: 'LGS structure' },
  { id: 'steel-lgs-paint', label: 'Paint' },
  { id: 'steel-screws', label: 'Screws' },
  { id: 'steel-connectors', label: 'Connectors' },
  { id: 'steel-anchors', label: 'Anchors' },
]

export const ROLL_SPEC: SpecNode[] = [
  { id: 'steel-hrs', label: 'Hot rolled steel' },
  { id: 'steel-hrs-paint', label: 'Paint' },
]

export const PART_SPEC: Record<string, SpecNode[]> = {
  walls: [
    {
      id: 'wall-external',
      label: 'External wall',
      children: [
        cement('wall-ext-cement'),
        rockwool('wall-ext-rock'),
        {
          id: 'wall-ext-acp',
          label: 'ACP',
          children: [
            { id: 'wall-ext-acp-std', label: '4 mm FR-A2, standard colour' },
            { id: 'wall-ext-acp-wood', label: '4 mm FR-A2, wood finish' },
          ],
        },
        { id: 'wall-ext-siding', label: 'Siding' },
        gypsum('wall-ext-gypsum', [
          ['nr', 'Normal'],
          ['fr', 'Fire rated'],
        ]),
        paint('wall-ext-paint'),
        { id: 'wall-ext-render', label: 'Rendering' },
      ],
    },
    {
      id: 'wall-internal',
      label: 'Internal wall',
      children: [
        gypsum('wall-int-gypsum', [
          ['nr', 'Normal'],
          ['fr', 'Fire rated'],
          ['mr', 'Moisture resistant'],
        ]),
        rockwool('wall-int-rock'),
        paint('wall-int-paint'),
      ],
    },
    {
      id: 'wall-bathroom',
      label: 'Bathroom',
      children: [
        cement('wall-bath-cement'),
        tiles('wall-bath-tiles', 'Tiles'),
        { id: 'wall-bath-waterproof', label: 'Wall waterproofing' },
      ],
    },
  ],
  floors: [
    {
      id: 'floor-bottom',
      label: 'Bottom finish',
      children: [
        cement('floor-cement'),
        { id: 'floor-deck', label: 'Metal decking' },
      ],
    },
    rockwool('floor-core'),
    tiles('floor-dry', 'Dry area flooring', [
      { id: 'floor-dry-carpet', label: 'Carpet tiles' },
      { id: 'floor-dry-lvt', label: 'LVT' },
      { id: 'floor-dry-wood', label: 'Engineered wood' },
      { id: 'floor-dry-vinyl', label: 'Vinyl' },
    ]),
    tiles('floor-wet', 'Wet area flooring'),
  ],
  roof: [
    {
      id: 'roof-cover',
      label: 'Cover',
      children: [
        { id: 'roof-sandwich', label: 'Aluminium sandwich panel' },
        { id: 'roof-single', label: 'Single panel' },
        { id: 'roof-insulated', label: 'Insulated panel' },
        { id: 'roof-deck', label: 'Metal decking' },
      ],
    },
    rockwool('roof-core'),
    { id: 'roof-screws', label: 'Screws' },
    { id: 'roof-tpo', label: 'SIKA TPO membrane, 2 mm, with 50 mm PIR' },
  ],
  doors: [
    {
      id: 'door-alum',
      label: 'Aluminium doors and windows',
      children: [
        {
          id: 'door-alum-profile',
          label: 'Profile',
          children: [
            { id: 'door-alum-plain', label: 'Non thermal break' },
            { id: 'door-alum-thermal', label: 'Thermal break' },
          ],
        },
        {
          id: 'door-alum-glass',
          label: 'Glass',
          children: [
            { id: 'door-glass-6', label: '6 mm clear tempered' },
            { id: 'door-glass-8', label: '8 mm clear tempered' },
            { id: 'door-glass-10', label: '10 mm clear tempered' },
            { id: 'door-glass-12', label: '12 mm clear tempered' },
            { id: 'door-glass-dgu6', label: '6 + 12 air + 6 mm' },
            { id: 'door-glass-dgu8', label: '8 + 12 air + 8 mm' },
          ],
        },
      ],
    },
    { id: 'door-internal', label: 'Internal doors and windows' },
    { id: 'door-hmd', label: 'Hollow metal door' },
    { id: 'door-wood', label: 'Wooden door' },
    { id: 'door-pvc', label: 'PVC door' },
  ],
  facade: [
    cement('facade-cement'),
    {
      id: 'facade-acp',
      label: 'ACP',
      children: [
        { id: 'facade-acp-std', label: '4 mm FR-A2, standard colour' },
        { id: 'facade-acp-wood', label: '4 mm FR-A2, wood finish' },
      ],
    },
    { id: 'facade-siding', label: 'Siding' },
  ],
  finishes: [
    gypsum('finish-gypsum', [
      ['nr', 'Normal'],
      ['fr', 'Fire rated'],
      ['mr', 'Moisture resistant'],
    ]),
    paint('finish-paint'),
    { id: 'finish-render', label: 'Rendering' },
  ],
}

export function chosenLabels(nodes: SpecNode[], selected: ReadonlySet<string>, trail: string[] = []): string[] {
  const labels: string[] = []
  for (const node of nodes) {
    if (!selected.has(node.id)) continue
    const path = [...trail, node.label]
    if (!node.children?.length) labels.push(path.join(' · '))
    else labels.push(...chosenLabels(node.children, selected, path))
  }
  return labels
}
