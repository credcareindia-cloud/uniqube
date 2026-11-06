export type DisciplineId = 'civil' | 'arch' | 'struct' | 'mep'

export type CatalogComponent = {
  id: string
  label: string
  discipline: DisciplineId
}

export type MaterialVariant = {
  id: string
  label: string
}

export type CatalogMaterial = {
  id: string
  label: string
  variants: MaterialVariant[]
}

export const DISCIPLINES: Array<{ id: DisciplineId; label: string }> = [
  { id: 'civil', label: 'Civil & Infra' },
  { id: 'arch', label: 'Arch' },
  { id: 'struct', label: 'Struct' },
  { id: 'mep', label: 'MEP' },
]

export const FLOOR_OPTIONS = [1, 2, 3, 4, 5] as const

/** Building components by discipline */
export const COMPONENTS: CatalogComponent[] = [
  // —— Arch ——
  { id: 'arch-external', label: 'External', discipline: 'arch' },
  { id: 'arch-internal', label: 'Internal', discipline: 'arch' },
  { id: 'arch-roof', label: 'Roof', discipline: 'arch' },
  { id: 'arch-floor', label: 'Floor', discipline: 'arch' },
  { id: 'arch-doors', label: 'Doors', discipline: 'arch' },
  { id: 'arch-windows', label: 'Windows', discipline: 'arch' },
  { id: 'arch-curtain-wall', label: 'Curtain wall', discipline: 'arch' },
  { id: 'arch-partitions', label: 'Partitions', discipline: 'arch' },
  { id: 'arch-ceilings', label: 'Ceilings', discipline: 'arch' },
  { id: 'arch-railings', label: 'Railings / balustrades', discipline: 'arch' },
  { id: 'arch-cladding', label: 'Cladding', discipline: 'arch' },
  { id: 'arch-wet-areas', label: 'Wet areas', discipline: 'arch' },

  // —— Struct ——
  { id: 'struct-columns', label: 'Columns', discipline: 'struct' },
  { id: 'struct-beams', label: 'Beams', discipline: 'struct' },
  { id: 'struct-slabs', label: 'Slabs', discipline: 'struct' },
  { id: 'struct-walls', label: 'Shear / retaining walls', discipline: 'struct' },
  { id: 'struct-foundations', label: 'Foundations', discipline: 'struct' },
  { id: 'struct-stairs', label: 'Stairs', discipline: 'struct' },
  { id: 'struct-steel', label: 'Structural steel', discipline: 'struct' },
  { id: 'struct-cores', label: 'Cores / shafts', discipline: 'struct' },

  // —— MEP ——
  { id: 'mep-hvac', label: 'HVAC', discipline: 'mep' },
  { id: 'mep-electrical', label: 'Electrical', discipline: 'mep' },
  { id: 'mep-plumbing', label: 'Plumbing', discipline: 'mep' },
  { id: 'mep-fire', label: 'Fire fighting', discipline: 'mep' },
  { id: 'mep-drainage', label: 'Drainage', discipline: 'mep' },
  { id: 'mep-elv', label: 'ELV / low voltage', discipline: 'mep' },
  { id: 'mep-ducts', label: 'Ducts', discipline: 'mep' },
  { id: 'mep-piping', label: 'Piping', discipline: 'mep' },

  // —— Civil & Infra ——
  { id: 'civil-roads', label: 'Roads / paving', discipline: 'civil' },
  { id: 'civil-earthworks', label: 'Earthworks', discipline: 'civil' },
  { id: 'civil-drainage', label: 'Site drainage', discipline: 'civil' },
  { id: 'civil-utilities', label: 'Utilities', discipline: 'civil' },
  { id: 'civil-landscaping', label: 'Landscaping', discipline: 'civil' },
  { id: 'civil-boundary', label: 'Boundary walls / fencing', discipline: 'civil' },
  { id: 'civil-parking', label: 'Parking', discipline: 'civil' },
  { id: 'civil-stormwater', label: 'Stormwater', discipline: 'civil' },
]

/** Materials + variants keyed by component id */
export const MATERIALS_BY_COMPONENT: Record<string, CatalogMaterial[]> = {
  // Arch — External
  'arch-external': [
    {
      id: 'ext-gypsum',
      label: 'Gypsum board',
      variants: [
        { id: 'std', label: 'Standard 12.5mm' },
        { id: 'mr', label: 'Moisture resistant' },
        { id: 'fr', label: 'Fire rated' },
        { id: 'acoustic', label: 'Acoustic' },
      ],
    },
    {
      id: 'ext-cement-board',
      label: 'Cement board',
      variants: [
        { id: '6mm', label: '6mm' },
        { id: '9mm', label: '9mm' },
        { id: '12mm', label: '12mm' },
        { id: 'fibre', label: 'Fibre cement' },
      ],
    },
    {
      id: 'ext-render',
      label: 'External render',
      variants: [
        { id: 'acrylic', label: 'Acrylic' },
        { id: 'silicone', label: 'Silicone' },
        { id: 'mineral', label: 'Mineral' },
      ],
    },
    {
      id: 'ext-stone',
      label: 'Stone cladding',
      variants: [
        { id: 'natural', label: 'Natural stone' },
        { id: 'engineered', label: 'Engineered' },
        { id: 'veneer', label: 'Thin veneer' },
      ],
    },
  ],

  // Arch — Internal
  'arch-internal': [
    {
      id: 'int-gypsum',
      label: 'Gypsum board',
      variants: [
        { id: 'std', label: 'Standard' },
        { id: 'mr', label: 'Moisture resistant' },
        { id: 'fr', label: 'Fire rated' },
        { id: 'impact', label: 'Impact resistant' },
      ],
    },
    {
      id: 'int-paint',
      label: 'Paint / finish',
      variants: [
        { id: 'emulsion', label: 'Emulsion' },
        { id: 'enamel', label: 'Enamel' },
        { id: 'texture', label: 'Texture' },
      ],
    },
    {
      id: 'int-tiles',
      label: 'Wall tiles',
      variants: [
        { id: 'ceramic', label: 'Ceramic' },
        { id: 'porcelain', label: 'Porcelain' },
        { id: 'mosaic', label: 'Mosaic' },
      ],
    },
  ],

  'arch-roof': [
    {
      id: 'roof-membrane',
      label: 'Waterproof membrane',
      variants: [
        { id: 'bitumen', label: 'Bituminous' },
        { id: 'tpo', label: 'TPO' },
        { id: 'pvc', label: 'PVC' },
      ],
    },
    {
      id: 'roof-metal',
      label: 'Metal roofing',
      variants: [
        { id: 'gi', label: 'GI sheet' },
        { id: 'alu', label: 'Aluminium' },
        { id: 'standing', label: 'Standing seam' },
      ],
    },
    {
      id: 'roof-tile',
      label: 'Roof tiles',
      variants: [
        { id: 'clay', label: 'Clay' },
        { id: 'concrete', label: 'Concrete' },
      ],
    },
  ],

  'arch-floor': [
    {
      id: 'flr-tile',
      label: 'Floor tiles',
      variants: [
        { id: 'porcelain', label: 'Porcelain' },
        { id: 'ceramic', label: 'Ceramic' },
        { id: 'vitrified', label: 'Vitrified' },
      ],
    },
    {
      id: 'flr-wood',
      label: 'Wood / laminate',
      variants: [
        { id: 'engineered', label: 'Engineered wood' },
        { id: 'laminate', label: 'Laminate' },
        { id: 'solid', label: 'Solid wood' },
      ],
    },
    {
      id: 'flr-epoxy',
      label: 'Epoxy / resin',
      variants: [
        { id: 'self-level', label: 'Self-levelling' },
        { id: 'flakes', label: 'Decorative flakes' },
      ],
    },
  ],

  'arch-doors': [
    {
      id: 'door-aluminium',
      label: 'Aluminium door',
      variants: [
        { id: 'swing', label: 'Swing' },
        { id: 'sliding', label: 'Sliding' },
        { id: 'pivot', label: 'Pivot' },
        { id: 'folding', label: 'Folding' },
      ],
    },
    {
      id: 'door-timber',
      label: 'Timber door',
      variants: [
        { id: 'flush', label: 'Flush' },
        { id: 'panel', label: 'Panelled' },
        { id: 'fire', label: 'Fire rated' },
      ],
    },
    {
      id: 'door-glass',
      label: 'Glass door',
      variants: [
        { id: 'frameless', label: 'Frameless' },
        { id: 'framed', label: 'Framed' },
      ],
    },
  ],

  'arch-windows': [
    {
      id: 'win-aluminium',
      label: 'Aluminium window',
      variants: [
        { id: 'casement', label: 'Casement' },
        { id: 'sliding', label: 'Sliding' },
        { id: 'fixed', label: 'Fixed' },
        { id: 'awning', label: 'Awning' },
      ],
    },
    {
      id: 'win-upvc',
      label: 'uPVC window',
      variants: [
        { id: 'casement', label: 'Casement' },
        { id: 'sliding', label: 'Sliding' },
      ],
    },
    {
      id: 'win-glazing',
      label: 'Glazing type',
      variants: [
        { id: 'sg', label: 'Single glazed' },
        { id: 'dg', label: 'Double glazed' },
        { id: 'tg', label: 'Triple glazed' },
        { id: 'laminated', label: 'Laminated' },
      ],
    },
  ],

  'arch-curtain-wall': [
    {
      id: 'cw-system',
      label: 'Curtain wall system',
      variants: [
        { id: 'stick', label: 'Stick' },
        { id: 'unitized', label: 'Unitized' },
        { id: 'semi', label: 'Semi-unitized' },
      ],
    },
    {
      id: 'cw-finish',
      label: 'Profile finish',
      variants: [
        { id: 'anodized', label: 'Anodized' },
        { id: 'powder', label: 'Powder coated' },
        { id: 'pvdf', label: 'PVDF' },
      ],
    },
  ],

  'arch-partitions': [
    {
      id: 'part-gypsum',
      label: 'Gypsum partition',
      variants: [
        { id: 'single', label: 'Single board' },
        { id: 'double', label: 'Double board' },
        { id: 'acoustic', label: 'Acoustic' },
      ],
    },
    {
      id: 'part-glass',
      label: 'Glass partition',
      variants: [
        { id: 'clear', label: 'Clear' },
        { id: 'frosted', label: 'Frosted' },
        { id: 'switchable', label: 'Switchable' },
      ],
    },
  ],

  'arch-ceilings': [
    {
      id: 'ceil-gypsum',
      label: 'Gypsum ceiling',
      variants: [
        { id: 'flush', label: 'Flush' },
        { id: 'coffered', label: 'Coffered' },
        { id: 'perforated', label: 'Perforated' },
      ],
    },
    {
      id: 'ceil-grid',
      label: 'Grid / tile ceiling',
      variants: [
        { id: 'mineral', label: 'Mineral fibre' },
        { id: 'metal', label: 'Metal tile' },
        { id: 'wood', label: 'Wood tile' },
      ],
    },
  ],

  'arch-railings': [
    {
      id: 'rail-ss',
      label: 'Stainless steel',
      variants: [
        { id: '304', label: 'SS 304' },
        { id: '316', label: 'SS 316' },
      ],
    },
    {
      id: 'rail-glass',
      label: 'Glass balustrade',
      variants: [
        { id: 'frameless', label: 'Frameless' },
        { id: 'standoff', label: 'Standoff' },
      ],
    },
    {
      id: 'rail-alu',
      label: 'Aluminium railing',
      variants: [
        { id: 'powder', label: 'Powder coated' },
        { id: 'anodized', label: 'Anodized' },
      ],
    },
  ],

  'arch-cladding': [
    {
      id: 'clad-acp',
      label: 'ACP / aluminium composite',
      variants: [
        { id: '3mm', label: '3mm' },
        { id: '4mm', label: '4mm' },
        { id: 'fr', label: 'Fire rated core' },
      ],
    },
    {
      id: 'clad-hpl',
      label: 'HPL cladding',
      variants: [
        { id: '6mm', label: '6mm' },
        { id: '8mm', label: '8mm' },
      ],
    },
  ],

  'arch-wet-areas': [
    {
      id: 'wet-tile',
      label: 'Wet area tiling',
      variants: [
        { id: 'ceramic', label: 'Ceramic' },
        { id: 'porcelain', label: 'Porcelain' },
      ],
    },
    {
      id: 'wet-wp',
      label: 'Waterproofing',
      variants: [
        { id: 'cementitious', label: 'Cementitious' },
        { id: 'liquid', label: 'Liquid applied' },
      ],
    },
  ],

  // Struct
  'struct-columns': [
    {
      id: 'col-rcc',
      label: 'RCC column',
      variants: [
        { id: 'm25', label: 'M25' },
        { id: 'm30', label: 'M30' },
        { id: 'm40', label: 'M40' },
      ],
    },
    {
      id: 'col-steel',
      label: 'Steel column',
      variants: [
        { id: 'uc', label: 'UC section' },
        { id: 'box', label: 'Box section' },
      ],
    },
  ],
  'struct-beams': [
    {
      id: 'beam-rcc',
      label: 'RCC beam',
      variants: [
        { id: 'm25', label: 'M25' },
        { id: 'm30', label: 'M30' },
        { id: 'm35', label: 'M35' },
      ],
    },
    {
      id: 'beam-steel',
      label: 'Steel beam',
      variants: [
        { id: 'ub', label: 'UB section' },
        { id: 'plate', label: 'Plate girder' },
      ],
    },
  ],
  'struct-slabs': [
    {
      id: 'slab-rcc',
      label: 'RCC slab',
      variants: [
        { id: 'solid', label: 'Solid slab' },
        { id: 'waffle', label: 'Waffle' },
        { id: 'pt', label: 'Post-tensioned' },
      ],
    },
    {
      id: 'slab-deck',
      label: 'Metal deck slab',
      variants: [
        { id: 'composite', label: 'Composite' },
        { id: 'non-comp', label: 'Non-composite' },
      ],
    },
  ],
  'struct-walls': [
    {
      id: 'wall-rcc',
      label: 'RCC wall',
      variants: [
        { id: 'shear', label: 'Shear wall' },
        { id: 'retaining', label: 'Retaining' },
      ],
    },
    {
      id: 'wall-block',
      label: 'Blockwork',
      variants: [
        { id: 'aac', label: 'AAC' },
        { id: 'concrete', label: 'Concrete block' },
      ],
    },
  ],
  'struct-foundations': [
    {
      id: 'fnd-isolated',
      label: 'Isolated footing',
      variants: [
        { id: 'm25', label: 'M25' },
        { id: 'm30', label: 'M30' },
      ],
    },
    {
      id: 'fnd-raft',
      label: 'Raft foundation',
      variants: [
        { id: 'plain', label: 'Plain raft' },
        { id: 'ribbed', label: 'Ribbed raft' },
      ],
    },
    {
      id: 'fnd-pile',
      label: 'Piles',
      variants: [
        { id: 'bored', label: 'Bored cast-in-situ' },
        { id: 'driven', label: 'Driven' },
      ],
    },
  ],
  'struct-stairs': [
    {
      id: 'stair-rcc',
      label: 'RCC stair',
      variants: [
        { id: 'dogleg', label: 'Dog-legged' },
        { id: 'spiral', label: 'Spiral' },
      ],
    },
    {
      id: 'stair-steel',
      label: 'Steel stair',
      variants: [
        { id: 'open', label: 'Open riser' },
        { id: 'pan', label: 'Pan stair' },
      ],
    },
  ],
  'struct-steel': [
    {
      id: 'stl-grade',
      label: 'Steel grade',
      variants: [
        { id: 's275', label: 'S275' },
        { id: 's355', label: 'S355' },
      ],
    },
    {
      id: 'stl-conn',
      label: 'Connections',
      variants: [
        { id: 'bolted', label: 'Bolted' },
        { id: 'welded', label: 'Welded' },
      ],
    },
  ],
  'struct-cores': [
    {
      id: 'core-rcc',
      label: 'RCC core',
      variants: [
        { id: 'lift', label: 'Lift core' },
        { id: 'stair', label: 'Stair core' },
      ],
    },
  ],

  // MEP
  'mep-hvac': [
    {
      id: 'hvac-system',
      label: 'HVAC system',
      variants: [
        { id: 'vrf', label: 'VRF' },
        { id: 'chiller', label: 'Chilled water' },
        { id: 'split', label: 'Split DX' },
        { id: 'ahu', label: 'AHU / FCU' },
      ],
    },
    {
      id: 'hvac-duct',
      label: 'Duct material',
      variants: [
        { id: 'gi', label: 'GI' },
        { id: 'pi', label: 'Pre-insulated' },
        { id: 'flexible', label: 'Flexible' },
      ],
    },
  ],
  'mep-electrical': [
    {
      id: 'elec-cable',
      label: 'Cabling',
      variants: [
        { id: 'xlpe', label: 'XLPE' },
        { id: 'pvc', label: 'PVC' },
        { id: 'fire', label: 'Fire resistant' },
      ],
    },
    {
      id: 'elec-db',
      label: 'Distribution',
      variants: [
        { id: 'mdb', label: 'MDB' },
        { id: 'smdb', label: 'SMDB' },
        { id: 'db', label: 'DB' },
      ],
    },
  ],
  'mep-plumbing': [
    {
      id: 'plumb-pipe',
      label: 'Pipe material',
      variants: [
        { id: 'ppr', label: 'PPR' },
        { id: 'cpvc', label: 'CPVC' },
        { id: 'copper', label: 'Copper' },
        { id: 'pex', label: 'PEX' },
      ],
    },
    {
      id: 'plumb-fixture',
      label: 'Fixtures',
      variants: [
        { id: 'wc', label: 'WC' },
        { id: 'basin', label: 'Basin' },
        { id: 'shower', label: 'Shower' },
      ],
    },
  ],
  'mep-fire': [
    {
      id: 'fire-system',
      label: 'Fire system',
      variants: [
        { id: 'sprinkler', label: 'Sprinkler' },
        { id: 'hydrant', label: 'Hydrant' },
        { id: 'alarm', label: 'Fire alarm' },
      ],
    },
    {
      id: 'fire-pipe',
      label: 'Fire pipe',
      variants: [
        { id: 'gi', label: 'GI' },
        { id: 'ms', label: 'MS' },
      ],
    },
  ],
  'mep-drainage': [
    {
      id: 'drain-pipe',
      label: 'Drainage pipe',
      variants: [
        { id: 'upvc', label: 'uPVC' },
        { id: 'hdpe', label: 'HDPE' },
        { id: 'ci', label: 'Cast iron' },
      ],
    },
  ],
  'mep-elv': [
    {
      id: 'elv-system',
      label: 'ELV system',
      variants: [
        { id: 'cctv', label: 'CCTV' },
        { id: 'access', label: 'Access control' },
        { id: 'data', label: 'Data / structured cabling' },
      ],
    },
  ],
  'mep-ducts': [
    {
      id: 'duct-gi',
      label: 'GI duct',
      variants: [
        { id: 'rect', label: 'Rectangular' },
        { id: 'round', label: 'Round' },
      ],
    },
  ],
  'mep-piping': [
    {
      id: 'pipe-chilled',
      label: 'Chilled water pipe',
      variants: [
        { id: 'ms', label: 'MS' },
        { id: 'copper', label: 'Copper' },
      ],
    },
  ],

  // Civil
  'civil-roads': [
    {
      id: 'road-asphalt',
      label: 'Asphalt',
      variants: [
        { id: 'binder', label: 'Binder course' },
        { id: 'wearing', label: 'Wearing course' },
      ],
    },
    {
      id: 'road-paving',
      label: 'Interlock / paving',
      variants: [
        { id: '60mm', label: '60mm' },
        { id: '80mm', label: '80mm' },
      ],
    },
  ],
  'civil-earthworks': [
    {
      id: 'earth-cut',
      label: 'Cut / fill',
      variants: [
        { id: 'cut', label: 'Excavation' },
        { id: 'fill', label: 'Backfill' },
        { id: 'compaction', label: 'Compaction' },
      ],
    },
  ],
  'civil-drainage': [
    {
      id: 'site-drain',
      label: 'Site drain',
      variants: [
        { id: 'pipe', label: 'Pipe drain' },
        { id: 'channel', label: 'Open channel' },
      ],
    },
  ],
  'civil-utilities': [
    {
      id: 'util-trench',
      label: 'Utility trench',
      variants: [
        { id: 'power', label: 'Power' },
        { id: 'water', label: 'Water' },
        { id: 'telecom', label: 'Telecom' },
      ],
    },
  ],
  'civil-landscaping': [
    {
      id: 'land-soft',
      label: 'Softscape',
      variants: [
        { id: 'turf', label: 'Turf' },
        { id: 'shrubs', label: 'Shrubs' },
        { id: 'trees', label: 'Trees' },
      ],
    },
    {
      id: 'land-hard',
      label: 'Hardscape',
      variants: [
        { id: 'paving', label: 'Paving' },
        { id: 'kerbs', label: 'Kerbs' },
      ],
    },
  ],
  'civil-boundary': [
    {
      id: 'bound-wall',
      label: 'Boundary wall',
      variants: [
        { id: 'block', label: 'Blockwork' },
        { id: 'precast', label: 'Precast' },
        { id: 'fence', label: 'Fence' },
      ],
    },
  ],
  'civil-parking': [
    {
      id: 'park-surface',
      label: 'Parking surface',
      variants: [
        { id: 'asphalt', label: 'Asphalt' },
        { id: 'interlock', label: 'Interlock' },
        { id: 'concrete', label: 'Concrete' },
      ],
    },
  ],
  'civil-stormwater': [
    {
      id: 'storm-system',
      label: 'Stormwater',
      variants: [
        { id: 'pipe', label: 'Pipe network' },
        { id: 'soakaway', label: 'Soakaway' },
        { id: 'tank', label: 'Detention tank' },
      ],
    },
  ],
}

export function componentsForDisciplines(disciplines: DisciplineId[]): CatalogComponent[] {
  const set = new Set(disciplines)
  return COMPONENTS.filter((c) => set.has(c.discipline))
}

export function materialsForComponent(componentId: string): CatalogMaterial[] {
  return MATERIALS_BY_COMPONENT[componentId] ?? []
}

export function componentLabel(id: string): string {
  return COMPONENTS.find((c) => c.id === id)?.label ?? id
}

export function disciplineLabel(id: DisciplineId): string {
  return DISCIPLINES.find((d) => d.id === id)?.label ?? id
}
