import type {
  BuildUp,
  BuildUpLayer,
  Commercials,
  FloorSpec,
  Measurement,
  PageScale,
  PriceSheetRow,
  ProjectContext,
  TakeoffLine,
} from '../types'

export type ElementGroup =
  | 'substructure'
  | 'superstructure'
  | 'walls'
  | 'floors'
  | 'ceilings'
  | 'roof'
  | 'openings'

/** Client-facing BOQ system a line is billed under. Mirrors the UNIQUBE offer sections. */
export type SystemId =
  | 'steel'
  | 'wall'
  | 'roof'
  | 'ceiling'
  | 'floor'
  | 'openings'
  | 'mep'
  | 'additional'
  | 'foundation'

export type ElementMeasure = 'length' | 'area' | 'count'

export type ElementUnit = 'm' | 'm²' | 'm³' | 'nr'

export type ElementSize = 'height' | 'width' | 'depth' | 'thickness'

export type LayerSeed = {
  id: string
  name: string
  /** Words that must appear in a price-sheet row for it to price this layer. */
  rateQuery: string
  thicknessMm: number
}

export interface ElementDef {
  id: string
  group: ElementGroup
  system: SystemId
  label: string
  /** How the element is normally taken off a plan. */
  measure: ElementMeasure
  /** Billed unit of the primary line. */
  unit: ElementUnit
  /** Extra sizes that turn the drawn quantity into the billed one. */
  sizes: ElementSize[]
  /** Default layers. Each layer becomes its own canvas line. */
  layers: LayerSeed[]
  /** Short takeoff note shown to the estimator and the model. */
  hint: string
  /** Price-sheet component that holds this element's rates. */
  componentId: string
  /** Short code used in auto labels, e.g. EW-GF-1. */
  code: string
  /** Included in a new project by default. Substructure is normally outside the UNIQUBE scope. */
  defaultOn: boolean
}

export const ELEMENT_GROUPS: Array<{ id: ElementGroup; label: string }> = [
  { id: 'walls', label: 'Walls' },
  { id: 'floors', label: 'Floors and stairs' },
  { id: 'ceilings', label: 'Ceilings' },
  { id: 'roof', label: 'Roof' },
  { id: 'openings', label: 'Doors and windows' },
  { id: 'superstructure', label: 'Superstructure (hot-rolled / LGS members)' },
  { id: 'substructure', label: 'Substructure (normally by main contractor)' },
]

export const SYSTEMS: Array<{ id: SystemId; label: string; boqText: string }> = [
  {
    id: 'steel',
    label: 'Steel Structural System',
    boqText:
      'Steel Structural System – Supply, fabrication, delivery and installation of the light gauge steel (LGS) load-bearing frame with hot-rolled steel members, connectors, anchors and fixings.',
  },
  {
    id: 'roof',
    label: 'Roofing System',
    boqText: 'Roofing System – Supply and installation of the complete insulated roof build-up on LGS roof trusses.',
  },
  {
    id: 'wall',
    label: 'Wall System',
    boqText:
      'Wall System – Supply and installation of the complete external and internal wall build-up: boards, insulation, vapour barrier and finishes on LGS framing.',
  },
  {
    id: 'ceiling',
    label: 'Ceiling System',
    boqText: 'Ceiling System – Supply and installation of gypsum board ceilings with framing and fittings.',
  },
  {
    id: 'floor',
    label: 'Floor System',
    boqText:
      'Floor System – Supply and installation of the complete floor system comprising floor trusses, metal decking and chequer plate at stairs (lightweight concrete by others).',
  },
  {
    id: 'openings',
    label: 'Aluminium Doors & Windows',
    boqText: 'Aluminium Doors & Windows – Supply, fabrication, glazing, delivery and installation as per schedule.',
  },
  {
    id: 'mep',
    label: 'MEP Installation Works',
    boqText: 'MEP Installation Works – Installation of client-supplied MEP first-fix items on LGS walls.',
  },
  {
    id: 'additional',
    label: 'Additional Works',
    boqText: 'Supply, fabricate and install mild steel (MS) staircase handrails, balustrades and other additional works.',
  },
  {
    id: 'foundation',
    label: 'Foundation Works',
    boqText: 'Foundation Works – Concrete footings, ground beams and slabs as measured (only when in scope).',
  },
]

export const ELEMENTS: ElementDef[] = [
  {
    id: 'ext-wall',
    group: 'walls',
    system: 'wall',
    label: 'External wall',
    code: 'EW',
    measure: 'length',
    unit: 'm²',
    sizes: ['height'],
    defaultOn: true,
    layers: [
      { id: 'ext', name: '12 mm cement board (external face)', rateQuery: 'cement board 12', thicknessMm: 12 },
      { id: 'render', name: 'Terraco render / external finish', rateQuery: 'terraco render', thicknessMm: 0 },
      { id: 'vapour', name: 'Vapour barrier', rateQuery: 'vapour barrier', thicknessMm: 0 },
      { id: 'ins', name: '150 mm rockwool 60 kg/m³ one-side foil', rateQuery: 'rockwool 150 60', thicknessMm: 150 },
      { id: 'int-1', name: '12.5 mm gypsum board FR (internal)', rateQuery: 'gypsum 12.5 fr', thicknessMm: 12.5 },
      { id: 'int-2', name: '15 mm gypsum board FR (internal, 2nd layer)', rateQuery: 'gypsum 15 fr', thicknessMm: 15 },
    ],
    hint: 'Run along the external elevation. Length × floor height gives the elevation area; take doors and windows off as deductions.',
    componentId: 'uniqube-walls',
  },
  {
    id: 'int-wall',
    group: 'walls',
    system: 'wall',
    label: 'Internal wall',
    code: 'IW',
    measure: 'length',
    unit: 'm²',
    sizes: ['height'],
    defaultOn: true,
    layers: [
      { id: 'side-a', name: '15 mm gypsum board FR (side A)', rateQuery: 'gypsum 15 fr', thicknessMm: 15 },
      { id: 'ins', name: '150 mm rockwool 45 kg/m³ one-side foil', rateQuery: 'rockwool 150 45', thicknessMm: 150 },
      { id: 'side-b', name: '15 mm gypsum board FR (side B)', rateQuery: 'gypsum 15 fr', thicknessMm: 15 },
    ],
    hint: 'Run along the internal partitions. Length × floor height, minus doors. Both faces are boarded.',
    componentId: 'uniqube-walls',
  },
  {
    id: 'bath-wall',
    group: 'walls',
    system: 'wall',
    label: 'Bathroom wall',
    code: 'BW',
    measure: 'length',
    unit: 'm²',
    sizes: ['height'],
    defaultOn: true,
    layers: [
      { id: 'mr', name: '12 mm gypsum board MR (wet side, protects LGS)', rateQuery: 'gypsum 12 mr', thicknessMm: 12 },
      { id: 'cb', name: '12 mm cement board (tile substrate)', rateQuery: 'cement board 12', thicknessMm: 12 },
      { id: 'tile', name: '600 × 600 wall tiles', rateQuery: 'tiles 600x600', thicknessMm: 10 },
      { id: 'ins', name: '150 mm rockwool 45 kg/m³ one-side foil', rateQuery: 'rockwool 150 45', thicknessMm: 150 },
      { id: 'dry', name: '15 mm gypsum board FR (dry side)', rateQuery: 'gypsum 15 fr', thicknessMm: 15 },
    ],
    hint: 'Run along the wet-area partitions. The wet side takes MR gypsum, cement board and tiles.',
    componentId: 'uniqube-walls',
  },
  {
    id: 'floor',
    group: 'floors',
    system: 'floor',
    label: 'Floor (upper floors)',
    code: 'FL',
    measure: 'area',
    unit: 'm²',
    sizes: [],
    defaultOn: true,
    layers: [
      { id: 'deck', name: 'Metal decking with mesh (LWC by others)', rateQuery: 'metal decking', thicknessMm: 0.9 },
      { id: 'ins', name: '150 mm rockwool 45 kg/m³ one-side foil', rateQuery: 'rockwool 150 45', thicknessMm: 150 },
    ],
    hint: 'Trace each upper floor plate (ground floor slab is by others). Stairs and voids come off as deductions. This area also feeds the built-up area.',
    componentId: 'uniqube-floors',
  },
  {
    id: 'staircase',
    group: 'floors',
    system: 'floor',
    label: 'Staircase (chequer plate)',
    code: 'ST',
    measure: 'area',
    unit: 'm²',
    sizes: [],
    defaultOn: true,
    layers: [{ id: 'plate', name: 'Chequer plate treads and landings', rateQuery: 'chequer plate', thicknessMm: 5 }],
    hint: 'Trace the flights and landings in plan. Stair length × width gives the plate area.',
    componentId: 'uniqube-floors',
  },
  {
    id: 'railing',
    group: 'floors',
    system: 'additional',
    label: 'MS handrail / balustrade',
    code: 'HR',
    measure: 'length',
    unit: 'm',
    sizes: [],
    defaultOn: true,
    layers: [],
    hint: 'Run along the stair flights and balcony edges that take a railing.',
    componentId: 'uniqube-additional',
  },
  {
    id: 'ceiling',
    group: 'ceilings',
    system: 'ceiling',
    label: 'Ceiling (dry areas)',
    code: 'CD',
    measure: 'area',
    unit: 'm²',
    sizes: [],
    defaultOn: true,
    layers: [{ id: 'board', name: '12.5 mm gypsum board FR ceiling', rateQuery: 'gypsum 12.5 fr', thicknessMm: 12.5 }],
    hint: 'Trace the rooms with a gypsum ceiling. Wet rooms go under Ceiling (wet areas).',
    componentId: 'uniqube-ceilings',
  },
  {
    id: 'wet-ceiling',
    group: 'ceilings',
    system: 'ceiling',
    label: 'Ceiling (wet areas)',
    code: 'CW',
    measure: 'area',
    unit: 'm²',
    sizes: [],
    defaultOn: true,
    layers: [{ id: 'board', name: '12 mm gypsum board MR ceiling', rateQuery: 'gypsum 12 mr', thicknessMm: 12 }],
    hint: 'Trace bathrooms, kitchens and other wet rooms.',
    componentId: 'uniqube-ceilings',
  },
  {
    id: 'roof',
    group: 'roof',
    system: 'roof',
    label: 'Roof',
    code: 'RF',
    measure: 'area',
    unit: 'm²',
    sizes: [],
    defaultOn: true,
    layers: [
      { id: 'panel', name: 'Aluminium sandwich panel 100 mm', rateQuery: 'sandwich panel 100', thicknessMm: 100 },
      { id: 'ins', name: '150 mm rockwool 45 kg/m³ one-side foil', rateQuery: 'rockwool 150 45', thicknessMm: 150 },
      { id: 'joints', name: 'Moisture protection at panel joints', rateQuery: 'moisture protection joints', thicknessMm: 0 },
    ],
    hint: 'Trace the roof plan. Add a slope factor in the notes when the roof is pitched.',
    componentId: 'uniqube-roof',
  },
  {
    id: 'roof-deck',
    group: 'roof',
    system: 'roof',
    label: 'Roof (metal deck + waterproofing)',
    code: 'RD',
    measure: 'area',
    unit: 'm²',
    sizes: [],
    defaultOn: false,
    layers: [
      { id: 'deck', name: 'Metal decking with mesh', rateQuery: 'metal decking', thicknessMm: 0.9 },
      { id: 'wp', name: 'TPO membrane 2 mm with PIR insulation', rateQuery: 'tpo membrane', thicknessMm: 50 },
    ],
    hint: 'Flat roof areas that take a concrete topping and membrane instead of sandwich panels.',
    componentId: 'uniqube-roof',
  },
  {
    id: 'window',
    group: 'openings',
    system: 'openings',
    label: 'Window',
    code: 'W',
    measure: 'count',
    unit: 'nr',
    sizes: ['width', 'height'],
    defaultOn: true,
    layers: [],
    hint: 'Count by schedule tag (W1, W2 …). Width × height per piece gives the glazed area; the rate is per m² of opening.',
    componentId: 'uniqube-openings',
  },
  {
    id: 'door',
    group: 'openings',
    system: 'openings',
    label: 'Door',
    code: 'D',
    measure: 'count',
    unit: 'nr',
    sizes: ['width', 'height'],
    defaultOn: true,
    layers: [],
    hint: 'Count by schedule tag (D1, D2 …). Width × height per piece gives the area; the rate is per m² of opening.',
    componentId: 'uniqube-openings',
  },
  {
    id: 'column',
    group: 'superstructure',
    system: 'steel',
    label: 'Hot-rolled column',
    code: 'C',
    measure: 'count',
    unit: 'nr',
    sizes: ['width', 'depth', 'height'],
    defaultOn: false,
    layers: [],
    hint: 'Count the hot-rolled columns when the structural drawings call them. Weight goes through the steel allowance.',
    componentId: 'uniqube-superstructure',
  },
  {
    id: 'beam',
    group: 'superstructure',
    system: 'steel',
    label: 'Hot-rolled beam',
    code: 'B',
    measure: 'length',
    unit: 'm',
    sizes: ['width', 'depth'],
    defaultOn: false,
    layers: [],
    hint: 'Run along hot-rolled beams called on the structural drawings.',
    componentId: 'uniqube-superstructure',
  },
  {
    id: 'struct-wall',
    group: 'superstructure',
    system: 'steel',
    label: 'LGS shear wall panel',
    code: 'SW',
    measure: 'length',
    unit: 'm²',
    sizes: ['height', 'thickness'],
    defaultOn: false,
    layers: [],
    hint: 'Run along braced LGS wall panels when the engineer prices them separately.',
    componentId: 'uniqube-superstructure',
  },
  {
    id: 'iso-footing',
    group: 'substructure',
    system: 'foundation',
    label: 'Isolated footing',
    code: 'IF',
    measure: 'count',
    unit: 'm³',
    sizes: ['width', 'depth'],
    defaultOn: false,
    layers: [],
    hint: 'Count the footings. Length × width × depth per footing gives concrete volume.',
    componentId: 'uniqube-substructure',
  },
  {
    id: 'ground-beam',
    group: 'substructure',
    system: 'foundation',
    label: 'Ground beam',
    code: 'GB',
    measure: 'length',
    unit: 'm³',
    sizes: ['width', 'depth'],
    defaultOn: false,
    layers: [],
    hint: 'Run along the beam centreline. Width × depth from the section.',
    componentId: 'uniqube-substructure',
  },
  {
    id: 'strip-footing',
    group: 'substructure',
    system: 'foundation',
    label: 'Strip footing',
    code: 'SF',
    measure: 'length',
    unit: 'm³',
    sizes: ['width', 'depth'],
    defaultOn: false,
    layers: [],
    hint: 'Run along the footing centreline. Width × depth from the section.',
    componentId: 'uniqube-substructure',
  },
  {
    id: 'grid-footing',
    group: 'substructure',
    system: 'foundation',
    label: 'Grid footing',
    code: 'GF',
    measure: 'length',
    unit: 'm³',
    sizes: ['width', 'depth'],
    defaultOn: false,
    layers: [],
    hint: 'Run along every grid line that carries a footing. Width × depth from the section.',
    componentId: 'uniqube-substructure',
  },
  {
    id: 'ground-slab',
    group: 'substructure',
    system: 'foundation',
    label: 'Ground slab',
    code: 'GS',
    measure: 'area',
    unit: 'm²',
    sizes: ['thickness'],
    defaultOn: false,
    layers: [],
    hint: 'Trace the slab outline. Thickness from the section gives volume.',
    componentId: 'uniqube-substructure',
  },
]

const ELEMENT_BY_ID = new Map(ELEMENTS.map((element) => [element.id, element]))

export function elementById(id: string | undefined | null): ElementDef | null {
  if (!id) return null
  return ELEMENT_BY_ID.get(id) ?? null
}

export function elementLabel(id: string | undefined | null): string {
  return elementById(id)?.label ?? (id || '')
}

export function elementIds(): string[] {
  return ELEMENTS.map((element) => element.id)
}

export function systemLabel(id: SystemId | string): string {
  return SYSTEMS.find((system) => system.id === id)?.label ?? id
}

/** Square feet per square metre; UNIQUBE sheets bill boards per sqft. */
export const SQFT_PER_M2 = 10.7639

/**
 * UNIQUBE rate library. Direct rates in AED per unit = material + fabrication/installation labour,
 * taken from the estimator Data Sheet (material AED/m², labour AED/sqft × 10.7639). Markups are
 * applied later by the commercial stack, so these are cost rates, not selling rates.
 */
export const ELEMENT_RATE_SEEDS: PriceSheetRow[] = [
  // boards
  rate('uniqube-boards', 'Boards', 'cement-board', 'Cement board', 'cb-6', 'Cement board 6 mm', 'm²', 19.1, 10.0),
  rate('uniqube-boards', 'Boards', 'cement-board', 'Cement board', 'cb-9', 'Cement board 9 mm', 'm²', 17.95, 10.0),
  rate('uniqube-boards', 'Boards', 'cement-board', 'Cement board', 'cb-12', 'Cement board 12 mm', 'm²', 21.77, 12.0),
  rate('uniqube-boards', 'Boards', 'cement-board', 'Cement board', 'cb-15', 'Cement board 15 mm', 'm²', 30.56, 15.0),
  rate('uniqube-boards', 'Boards', 'cement-board', 'Cement board', 'cb-18', 'Cement board 18 mm', 'm²', 35.52, 15.0),
  rate('uniqube-boards', 'Boards', 'gypsum', 'Gypsum board', 'gy-12-nr', 'Gypsum 12 mm NR', 'm²', 4.97, 10.0),
  rate('uniqube-boards', 'Boards', 'gypsum', 'Gypsum board', 'gy-9-fr', 'Gypsum 9 mm FR', 'm²', 7.64, 10.0),
  rate('uniqube-boards', 'Boards', 'gypsum', 'Gypsum board', 'gy-12.5-fr', 'Gypsum 12.5 mm FR', 'm²', 8.68, 10.0),
  rate('uniqube-boards', 'Boards', 'gypsum', 'Gypsum board', 'gy-15-fr', 'Gypsum 15 mm FR', 'm²', 10.76, 10.0),
  rate('uniqube-boards', 'Boards', 'gypsum', 'Gypsum board', 'gy-18-fr', 'Gypsum 18 mm FR', 'm²', 14.06, 10.0),
  rate('uniqube-boards', 'Boards', 'gypsum', 'Gypsum board', 'gy-12-mr', 'Gypsum 12 mm MR', 'm²', 8.68, 10.0),
  rate('uniqube-boards', 'Boards', 'gypsum', 'Gypsum board', 'gy-15-mr', 'Gypsum 15 mm MR', 'm²', 9.17, 10.0),
  rate('uniqube-boards', 'Boards', 'gypsum', 'Gypsum board', 'gy-18-mr', 'Gypsum 18 mm MR', 'm²', 14.51, 10.0),
  rate('uniqube-boards', 'Boards', 'glass-dense', 'Glass-mat dense board', 'gd-13', 'Dens glass 13 mm', 'm²', 32.0, 12.0),
  rate('uniqube-boards', 'Boards', 'plywood', 'Plywood', 'ply-18', 'Plywood 18 mm', 'm²', 45.0, 12.0),
  // insulation
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-89-35', 'Rockwool 89 mm 35 kg/m³', 'm²', 13.2, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-89-35-foil', 'Rockwool 89 mm 35 kg/m³ one-side foil', 'm²', 15.2, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-89-45', 'Rockwool 89 mm 45 kg/m³', 'm²', 17.0, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-89-45-foil', 'Rockwool 89 mm 45 kg/m³ one-side foil', 'm²', 19.0, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-89-120', 'Rockwool 89 mm 120 kg/m³', 'm²', 45.5, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-150-35', 'Rockwool 150 mm 35 kg/m³', 'm²', 22.5, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-150-45', 'Rockwool 150 mm 45 kg/m³', 'm²', 29.0, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-150-45-foil', 'Rockwool 150 mm 45 kg/m³ one-side foil', 'm²', 31.0, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-150-60-foil', 'Rockwool 150 mm 60 kg/m³ one-side foil', 'm²', 60.5, 2.0),
  rate('uniqube-insulation', 'Insulation', 'rockwool', 'Rockwool', 'rw-150-120', 'Rockwool 150 mm 120 kg/m³', 'm²', 76.5, 2.0),
  rate('uniqube-insulation', 'Insulation', 'glass-wool', 'Glass wool', 'gw-50', 'Glass wool 50 mm', 'm²', 13.0, 2.0),
  // membranes and finishes
  rate('uniqube-finishes', 'Finishes', 'vapour-barrier', 'Vapour barrier', 'vb-ext', 'Vapour barrier for external walls', 'm²', 15.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'render', 'Terraco render', 'terraco', 'Terraco external render system', 'm²', 28.0, 12.0),
  rate('uniqube-finishes', 'Finishes', 'paint', 'Paint', 'emulsion', 'Emulsion paint (7 + 4 coats)', 'm²', 20.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'paint', 'Paint', 'textured', 'Textured water-based paint', 'm²', 9.93, 10.0),
  rate('uniqube-finishes', 'Finishes', 'tiles', 'Tiles', 't-300', 'Tiles 300x300 RAK glazed', 'm²', 35.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'tiles', 'Tiles', 't-600', 'Tiles 600x600 RAK glazed', 'm²', 40.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'tiles', 'Tiles', 't-600x1200', 'Tiles 600x1200 RAK glazed', 'm²', 60.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'tiles', 'Tiles', 't-1200', 'Tiles 1200x1200 RAK glazed', 'm²', 162.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'flooring', 'Soft flooring', 'carpet', 'Carpet tiles', 'm²', 28.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'flooring', 'Soft flooring', 'lvt', 'LVT flooring', 'm²', 55.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'flooring', 'Soft flooring', 'vinyl', 'Vinyl flooring', 'm²', 12.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'flooring', 'Soft flooring', 'eng-wood', 'Engineered wood 14 mm parquet', 'm²', 265.0, 10.0),
  rate('uniqube-finishes', 'Finishes', 'moisture', 'Moisture protection', 'joints', 'Moisture protection at roof panel joints', 'm²', 20.0, 0),
  rate('uniqube-finishes', 'Finishes', 'moisture', 'Moisture protection', 'wet-wp', 'Bathroom floor and wall waterproofing', 'm²', 24.2, 5.0),
  rate('uniqube-finishes', 'Finishes', 'moisture', 'Moisture protection', 'tpo', 'TPO membrane 2 mm with PIR insulation', 'm²', 210.0, 30.0),
  // roof and deck
  rate('uniqube-roofing', 'Roofing and decking', 'sandwich-panel', 'Aluminium sandwich panel', 'sp-100', 'Sandwich panel 100 mm', 'm²', 140.0, 10.0),
  rate('uniqube-roofing', 'Roofing and decking', 'sandwich-panel', 'Aluminium sandwich panel', 'sp-125', 'Sandwich panel 125 mm', 'm²', 155.0, 10.0),
  rate('uniqube-roofing', 'Roofing and decking', 'sandwich-panel', 'Aluminium sandwich panel', 'sp-150', 'Sandwich panel 150 mm', 'm²', 170.0, 10.0),
  rate('uniqube-roofing', 'Roofing and decking', 'metal-deck', 'Metal decking', 'deck-mesh', 'Metal decking with mesh', 'm²', 45.0, 10.0),
  rate('uniqube-roofing', 'Roofing and decking', 'chequer-plate', 'Chequer plate', 'cp-5', 'Chequer plate 5 mm for staircases', 'm²', 160.0, 15.0),
  // steel
  rate('uniqube-steel', 'Steel', 'lgs', 'LGS structure', 'lgs-kg', 'Light gauge steel frame (per kg)', 'kg', 3.5, 2.4),
  rate('uniqube-steel', 'Steel', 'hrs', 'Hot-rolled steel', 'hrs-kg', 'Hot-rolled steel incl. installation (per kg)', 'kg', 14.0, 0),
  rate('uniqube-steel', 'Steel', 'fixings', 'Fixings', 'screw', 'Self-drilling screw', 'nr', 0.17, 0),
  rate('uniqube-steel', 'Steel', 'fixings', 'Fixings', 'anchor', 'Anchor bolt', 'nr', 10.0, 0),
  rate('uniqube-steel', 'Steel', 'paint', 'Steel paint', 'paint-kg', 'Base frame paint (per kg)', 'kg', 1.05, 0.75),
  // openings (rate per m² of opening, from the aluminium unit costing)
  rate('uniqube-openings', 'Aluminium doors and windows', 'window', 'Window', 'w-hinged', 'Top-hung / hinged window, PEF coated, DGU', 'm²', 725.0, 0),
  rate('uniqube-openings', 'Aluminium doors and windows', 'window', 'Window', 'w-sliding', 'Sliding window (1 fixed + 1 sliding), DGU', 'm²', 775.0, 0),
  rate('uniqube-openings', 'Aluminium doors and windows', 'window', 'Window', 'w-fixed', 'Fixed window / vent', 'm²', 1000.0, 0),
  rate('uniqube-openings', 'Aluminium doors and windows', 'door', 'Door', 'd-glazed', 'Single-leaf hinged glazed door', 'm²', 670.0, 0),
  rate('uniqube-openings', 'Aluminium doors and windows', 'door', 'Door', 'd-panelled', 'Single-leaf hinged panelled door', 'm²', 850.0, 0),
  rate('uniqube-openings', 'Aluminium doors and windows', 'door', 'Door', 'd-double', 'Double-leaf glazed door', 'm²', 720.0, 0),
  // additional
  rate('uniqube-additional', 'Additional works', 'railing', 'MS handrail', 'ms-rail', 'MS staircase railing / balustrade', 'm', 520.0, 0),
  rate('uniqube-additional', 'Additional works', 'mep', 'MEP first fix', 'panel', 'First-fix installation per LGS panel (material by others)', 'nr', 0, 30.0),
  // superstructure and substructure
  rate('uniqube-superstructure', 'Superstructure', 'column', 'Hot-rolled column', 'hrs-col', 'HRS column incl. base plate (per nr)', 'nr', 1800.0, 0),
  rate('uniqube-superstructure', 'Superstructure', 'beam', 'Hot-rolled beam', 'hrs-beam', 'HRS beam (per m)', 'm', 420.0, 0),
  rate('uniqube-superstructure', 'Superstructure', 'struct-wall', 'LGS shear wall panel', 'lgs-shear', 'LGS shear wall panel', 'm²', 240.0, 0),
  rate('uniqube-substructure', 'Substructure', 'iso-footing', 'Isolated footing', 'c30', 'C30 concrete incl. formwork and rebar', 'm³', 520.0, 0),
  rate('uniqube-substructure', 'Substructure', 'ground-beam', 'Ground beam', 'c30', 'C30 concrete incl. formwork and rebar', 'm³', 560.0, 0),
  rate('uniqube-substructure', 'Substructure', 'strip-footing', 'Strip footing', 'c30', 'C30 concrete incl. formwork and rebar', 'm³', 480.0, 0),
  rate('uniqube-substructure', 'Substructure', 'grid-footing', 'Grid footing', 'c30', 'C30 concrete incl. formwork and rebar', 'm³', 520.0, 0),
  rate('uniqube-substructure', 'Substructure', 'ground-slab', 'Ground slab', 'c30-150', 'C30 slab 150 mm on DPM', 'm²', 140.0, 0),
]

function rate(
  componentId: string,
  componentLabel: string,
  materialId: string,
  materialLabel: string,
  variantId: string,
  variantLabel: string,
  unit: string,
  materialCost: number,
  labourCost: number,
): PriceSheetRow {
  const discipline = componentId.includes('substructure') || componentId.includes('superstructure') || componentId.includes('steel') ? 'struct' : 'arch'
  const installing = /openings|railing|additional|substructure|superstructure|hrs/.test(componentId + variantId)
  return {
    id: `${componentId}__${materialId}__${variantId}`,
    discipline,
    componentId,
    componentLabel,
    materialId,
    materialLabel,
    variantId,
    variantLabel,
    unit,
    unitPrice: round2(materialCost + labourCost),
    materialCost: round2(materialCost),
    fabCost: installing ? 0 : round2(labourCost),
    installCost: installing ? round2(labourCost) : 0,
    currency: 'AED',
    notes: 'UNIQUBE direct rate (material + labour) from the estimator data sheet. Markups are applied in the summary.',
    status: 'listed',
    rateSource: 'UNIQUBE estimator data sheet',
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

/** Append the element rates a sheet is missing, keyed by row id. */
export function withElementRates(rows: PriceSheetRow[]): PriceSheetRow[] {
  const have = new Set(rows.map((row) => row.id))
  const missing = ELEMENT_RATE_SEEDS.filter((row) => !have.has(row.id))
  return missing.length ? [...rows, ...missing] : rows
}

/** UNIQUBE commercial defaults as used on the Zuha Island estimates. */
export function defaultCommercials(): Commercials {
  return {
    currency: 'AED',
    usdRate: 3.67,
    overheadPct: 15,
    marginPct: 15,
    financePct: 2,
    contingencyPct: 2,
    designPct: 2,
    commissionPct: 7,
    customsPct: 0,
    corporateTaxPct: 0,
    lgsKgPerM2: 50,
    hrsKgPerM2: 12,
    lgsRatePerKg: 5.9,
    hrsRatePerKg: 14,
    screwsPerM2: 200,
    screwRate: 0.17,
    connectorsPerKgLgs: 0.2,
    anchorsCount: 800,
    anchorRate: 10,
    installPerM2: 75,
    m2PerContainer: 60,
    trailerPerContainer: 2000,
    palletPerContainer: 2850,
    prelimsPct: 4,
    prelimsLumpSum: 0,
    mepPanelsPerM2: 0.2,
    mepRatePerPanel: 30,
    includeSteelAllowance: true,
    includeInstallation: true,
    includeLogistics: true,
    includePrelims: true,
    includeMep: true,
    importedMaterialPct: 100,
    labourDayRate: 160,
    ratesReviewedAt: '',
  }
}

/** Margin and commission as shares of the final selling price, kept below 95% together. */
export function priceShares(c: Commercials): { marginShare: number; commissionShare: number } {
  const marginShare = Math.min(0.9, Math.max(0, c.marginPct / 100))
  const commissionShare = Math.min(0.95 - marginShare, Math.max(0, c.commissionPct / 100))
  return { marginShare, commissionShare }
}

/**
 * Direct cost → selling price multiplier, before customs (which depends on the imported material share).
 * Contingency and design on direct cost, finance on that, overhead on the cost subtotal,
 * then margin and commission as shares of the selling price. Corporate tax is not a price item.
 */
export function sellMultiplier(c: Commercials): number {
  const { marginShare, commissionShare } = priceShares(c)
  const cost = (1 + (c.contingencyPct + c.designPct) / 100) * (1 + c.financePct / 100) * (1 + c.overheadPct / 100)
  return cost / (1 - marginShare - commissionShare)
}

export function emptyProjectContext(): ProjectContext {
  return {
    buildingType: '',
    location: '',
    description: '',
    units: 'mm',
    floors: [{ level: 1, name: 'Ground floor', heightMm: 3500 }],
    elements: ELEMENTS.filter((element) => element.defaultOn).map((element) => element.id),
    buildUps: {},
    scopeNotes: '',
    client: '',
    consultant: '',
    projectNumber: '',
    commercials: defaultCommercials(),
    jobInputs: {
      doorHeightMm: null,
      windowHeightMm: null,
      plinthAboveNglMm: null,
      soilBearingKpa: null,
      lineLoadKnM: null,
      coolingWm2: null,
      measurementUnit: 'm2',
      quoteValidUntil: '',
    },
  }
}

export function floorName(level: number): string {
  if (level === 0) return 'Substructure'
  if (level === 1) return 'Ground floor'
  if (level === 2) return 'First floor'
  if (level === 3) return 'Second floor'
  if (level === 4) return 'Third floor'
  return `Level ${level - 1}`
}

export function floorsFromCount(count: number, current: FloorSpec[]): FloorSpec[] {
  const total = Math.max(0, Math.min(60, Math.floor(count)))
  const next: FloorSpec[] = []
  for (let level = 1; level <= total; level++) {
    const existing = current.find((floor) => floor.level === level)
    next.push(existing ?? { level, name: floorName(level), heightMm: current[current.length - 1]?.heightMm || 3000 })
  }
  return next
}

export function defaultBuildUp(element: ElementDef): BuildUp {
  return {
    layers: element.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      thicknessMm: layer.thicknessMm,
    })),
    notes: '',
  }
}

export function buildUpFor(ctx: ProjectContext, element: ElementDef): BuildUp {
  const custom = ctx.buildUps[element.id]
  if (custom) return custom
  return defaultBuildUp(element)
}

function floorHeight(ctx: ProjectContext, floor: number | null): number | undefined {
  if (floor == null) return ctx.floors[0]?.heightMm
  return ctx.floors.find((item) => item.level === floor)?.heightMm ?? ctx.floors[0]?.heightMm
}

function wordsMatch(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const hay = text.toLowerCase()
  return words.every((word) => hay.includes(word))
}

/** The price-sheet row for one layer: the picked row first, then a word match on the layer's rate query. */
export function rateForLayer(
  priceSheet: PriceSheetRow[],
  layer: BuildUpLayer,
  seed: LayerSeed | undefined,
): PriceSheetRow | null {
  if (layer.priceRowId) {
    const picked = priceSheet.find((row) => row.id === layer.priceRowId)
    if (picked) return picked
  }
  const queries = [seed?.rateQuery, layer.name].filter((item): item is string => Boolean(item))
  for (const query of queries) {
    const hit = priceSheet.find((row) =>
      wordsMatch(`${row.componentLabel} ${row.materialLabel} ${row.variantLabel}`, query),
    )
    if (hit) return hit
  }
  return null
}

export function rateForElement(priceSheet: PriceSheetRow[], element: ElementDef, buildUp: BuildUp): PriceSheetRow | null {
  const picked = buildUp.layers[0]?.priceRowId
  if (picked) {
    const row = priceSheet.find((item) => item.id === picked)
    if (row) return row
  }
  return (
    priceSheet.find((row) => row.componentId === element.componentId && row.materialId === element.id) ??
    priceSheet.find((row) => wordsMatch(`${row.componentLabel} ${row.materialLabel}`, element.label)) ??
    null
  )
}

// ——— geometry helpers used by quantities ———

export function polylineLengthPt(points: Array<{ x: number; y: number }>, closed = false): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  if (closed && points.length > 2) {
    const first = points[0]
    const last = points[points.length - 1]
    total += Math.hypot(first.x - last.x, first.y - last.y)
  }
  return total
}

export function polygonAreaPt2(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

// ——— quantities ———

export interface Quantities {
  lengthMm?: number
  widthMm?: number
  heightMm?: number
  depthMm?: number
  thicknessMm?: number
  count?: number
  grossM2?: number
  netM2?: number
  volumeM3?: number
  perimeterMm?: number
  /** Billed quantity and unit for the primary line. */
  qty: number
  unit: ElementUnit
  /** Lengths came from the drawing and the page has no scale. */
  needsScale: boolean
  basis: string
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function mm(value: number | undefined) {
  return value == null ? '' : `${round(value / 1000, 2)} m`
}

/**
 * Turn a measurement into billed quantities. Drawn points are read through the page scale;
 * stated dims fill in what the plan does not show.
 */
export function computeQuantities(
  measurement: Measurement,
  ctx: ProjectContext,
  scale: PageScale | null,
): Quantities {
  const element = elementById(measurement.elementId)
  const measure = element?.measure ?? 'count'
  const unit: ElementUnit = element?.unit ?? 'nr'
  const buildUp = element ? buildUpFor(ctx, element) : { layers: [], notes: '' }
  const dims = measurement.dims
  const pts = measurement.points
  const s = scale?.mmPerPt ?? null
  const drawn = measurement.kind !== 'dims' && pts.length > 0
  const needsScale = drawn && s == null && measurement.kind !== 'count'

  let lengthMm = dims.lengthMm
  let widthMm = dims.widthMm ?? buildUp.widthMm
  const heightMm = dims.heightMm ?? buildUp.heightMm ?? (element?.sizes.includes('height') ? floorHeight(ctx, measurement.floor) : undefined)
  const depthMm = dims.depthMm ?? buildUp.depthMm
  const thicknessMm = dims.thicknessMm ?? buildUp.thicknessMm
  let count = dims.count
  let areaMm2: number | undefined
  let perimeterMm: number | undefined

  if (drawn && s != null) {
    if (measurement.kind === 'length') {
      lengthMm = polylineLengthPt(pts) * s
    } else if (measurement.kind === 'area') {
      areaMm2 = polygonAreaPt2(pts) * s * s
      perimeterMm = polylineLengthPt(pts, true) * s
    } else if (measurement.kind === 'rect' && pts.length >= 2) {
      const w = Math.abs(pts[1].x - pts[0].x) * s
      const h = Math.abs(pts[1].y - pts[0].y) * s
      lengthMm = Math.max(w, h)
      widthMm = Math.min(w, h)
      areaMm2 = w * h
      perimeterMm = 2 * (w + h)
    }
  }
  if (measurement.kind === 'count') count = pts.length || count || 1
  if (count == null && (measure === 'count' || measurement.kind === 'dims')) count = count ?? 1

  if (areaMm2 == null && lengthMm != null && widthMm != null && measure === 'area') {
    areaMm2 = lengthMm * widthMm
  }

  const deductM2 = Math.max(0, measurement.deductM2 || 0)
  let grossM2: number | undefined
  let netM2: number | undefined
  let volumeM3: number | undefined
  let qty = 0
  let basis = ''
  const n = count ?? 1

  if (measure === 'length') {
    if (lengthMm != null) {
      basis = `L ${mm(lengthMm)}`
      if (unit === 'm²' && heightMm != null) {
        grossM2 = (lengthMm / 1000) * (heightMm / 1000)
        netM2 = Math.max(0, grossM2 - deductM2)
        qty = netM2
        basis += ` × H ${mm(heightMm)}${deductM2 ? ` − ${round(deductM2, 2)} m² openings` : ''}`
      } else if (unit === 'm³' && widthMm != null && depthMm != null) {
        volumeM3 = (lengthMm / 1000) * (widthMm / 1000) * (depthMm / 1000)
        qty = volumeM3
        basis += ` × W ${mm(widthMm)} × D ${mm(depthMm)}`
      } else {
        qty = lengthMm / 1000
        if (unit === 'm³' || unit === 'm²') basis += ' · section size missing'
      }
    }
  } else if (measure === 'area') {
    if (areaMm2 != null) {
      grossM2 = areaMm2 / 1e6
      netM2 = Math.max(0, grossM2 - deductM2)
      qty = netM2
      basis = `A ${round(grossM2, 2)} m²${deductM2 ? ` − ${round(deductM2, 2)} m²` : ''}`
      if (thicknessMm != null) {
        volumeM3 = netM2 * (thicknessMm / 1000)
        basis += ` × T ${mm(thicknessMm)}`
      }
    }
  } else {
    // count
    count = n
    basis = `${n} nr`
    if (widthMm != null && heightMm != null && (element?.group === 'openings' || element?.id === 'column')) {
      grossM2 = n * (widthMm / 1000) * (heightMm / 1000)
      netM2 = grossM2
      basis += ` × ${mm(widthMm)} × ${mm(heightMm)}`
    }
    if (unit === 'm³' && lengthMm != null && widthMm != null && depthMm != null) {
      volumeM3 = n * (lengthMm / 1000) * (widthMm / 1000) * (depthMm / 1000)
      basis += ` × ${mm(lengthMm)} × ${mm(widthMm)} × ${mm(depthMm)}`
      qty = volumeM3
    } else {
      qty = n
    }
  }

  const billedUnit: ElementUnit =
    measure === 'length' && unit === 'm²' && heightMm == null
      ? 'm'
      : measure === 'length' && unit === 'm³' && (widthMm == null || depthMm == null)
        ? 'm'
        : measure === 'count' && unit === 'm³' && volumeM3 == null
          ? 'nr'
          : unit

  return {
    lengthMm: lengthMm != null ? round(lengthMm, 0) : undefined,
    widthMm: widthMm != null ? round(widthMm, 0) : undefined,
    heightMm: heightMm != null ? round(heightMm, 0) : undefined,
    depthMm: depthMm != null ? round(depthMm, 0) : undefined,
    thicknessMm,
    count,
    grossM2: grossM2 != null ? round(grossM2, 3) : undefined,
    netM2: netM2 != null ? round(netM2, 3) : undefined,
    volumeM3: volumeM3 != null ? round(volumeM3, 3) : undefined,
    perimeterMm: perimeterMm != null ? round(perimeterMm, 0) : undefined,
    qty: round(qty, 3),
    unit: billedUnit,
    needsScale,
    basis: needsScale ? 'Scale not set for this sheet' : basis,
  }
}

export type DerivedLine = Omit<TakeoffLine, 'id' | 'confirmed'>

/** Canvas lines for a measurement: one per build-up layer, or one line when the element has no layers. */
export function linesForMeasurement(
  measurement: Measurement,
  quantities: Quantities,
  ctx: ProjectContext,
  priceSheet: PriceSheetRow[],
): DerivedLine[] {
  const element = elementById(measurement.elementId)
  if (!element) return []
  const buildUp = buildUpFor(ctx, element)
  const label = measurement.label.trim() || element.label
  const floorText = measurement.floor == null ? '' : ` · ${floorName(measurement.floor)}`
  const where = `${measurement.fileName} p${measurement.pageNumber}`
  const baseNotes = [quantities.basis, measurement.notes.trim(), where].filter(Boolean).join(' · ')
  const common = {
    system: element.label,
    widthMm: quantities.widthMm ?? 0,
    heightMm: quantities.heightMm ?? 0,
    source: 'measure' as const,
    pageRef: measurement.pageNumber,
    element: element.id,
    floor: measurement.floor,
    lengthMm: quantities.lengthMm,
    areaM2: quantities.netM2,
    measurementId: measurement.id,
    fileId: measurement.fileId,
  }

  const layerArea = quantities.netM2
  if (buildUp.layers.length && layerArea != null) {
    return buildUp.layers.map((layer) => {
      const seed = element.layers.find((item) => item.id === layer.id)
      const row = rateForLayer(priceSheet, layer, seed)
      return {
        ...common,
        tag: `${label} · ${layer.name}`,
        type: layer.name,
        quantity: layerArea,
        unit: 'm²',
        unitPrice: row?.unitPrice ?? 0,
        rateRowId: row?.id,
        notes: [
          baseNotes + floorText,
          layer.thicknessMm ? `${layer.thicknessMm} mm` : '',
          row ? `Rate: ${row.materialLabel} / ${row.variantLabel}` : 'No rate matched',
        ]
          .filter(Boolean)
          .join(' · '),
      }
    })
  }

  const row = rateForElement(priceSheet, element, buildUp)
  const normalizedUnit = row ? row.unit.replace('nos', 'nr').replace('lm', 'm') : ''
  const unitMatches = row ? normalizedUnit === quantities.unit : false
  // Openings carry a rate per m² of opening; the piece price is that rate × W × H.
  const perPieceM2 = quantities.count && quantities.grossM2 ? quantities.grossM2 / quantities.count : undefined
  const areaPriced = element.group === 'openings' && row && normalizedUnit === 'm²' && perPieceM2
  const unitPrice = areaPriced ? Math.round(row.unitPrice * perPieceM2 * 100) / 100 : row && unitMatches ? row.unitPrice : 0
  return [
    {
      ...common,
      tag: label,
      type: element.label,
      quantity: quantities.qty,
      unit: quantities.unit,
      unitPrice,
      rateRowId: row?.id,
      notes: [
        baseNotes + floorText,
        row
          ? areaPriced
            ? `Rate: ${row.variantLabel} @ ${row.unitPrice}/m² × ${Math.round(perPieceM2 * 100) / 100} m² per piece`
            : unitMatches
              ? `Rate: ${row.materialLabel} / ${row.variantLabel}`
              : `Rate ${row.materialLabel} is per ${row.unit}; check`
          : 'No rate matched',
      ]
        .filter(Boolean)
        .join(' · '),
    },
  ]
}

/** Prompt block describing the job for the model. */
export function projectContextBlock(ctx: ProjectContext, priceSheet: PriceSheetRow[]): string {
  const lines: string[] = []
  if (ctx.buildingType || ctx.location || ctx.description) {
    lines.push(
      `Building: ${[ctx.buildingType, ctx.location].filter(Boolean).join(', ') || '(not stated)'}${ctx.description ? ` — ${ctx.description}` : ''}`,
    )
  }
  const refs = [
    ctx.projectNumber ? `Job ${ctx.projectNumber}` : '',
    ctx.client ? `Client ${ctx.client}` : '',
    ctx.consultant ? `Consultant ${ctx.consultant}` : '',
  ].filter(Boolean)
  if (refs.length) lines.push(refs.join(' · '))
  lines.push(`Drawing units: ${ctx.units}`)
  lines.push(
    `Floors (${ctx.floors.length}): ${ctx.floors
      .map((floor) => `${floor.level} ${floor.name} H ${floor.heightMm} mm${floor.areaM2 ? ` · ${floor.areaM2} m² built-up` : ''}`)
      .join('; ')}`,
  )
  const c = ctx.commercials
  lines.push(
    `Commercials: rates on the price sheet are DIRECT cost (material + labour). Selling price = direct × ${sellMultiplier(c).toFixed(3)} (OH ${c.overheadPct}%, margin ${c.marginPct}% of price, finance ${c.financePct}%, contingency ${c.contingencyPct}%, design ${c.designPct}%, commission ${c.commissionPct}%). Allowances per m² built-up: LGS ${c.lgsKgPerM2} kg, HRS ${c.hrsKgPerM2} kg, installation ${c.installPerM2} ${c.currency}/m², one container per ${c.m2PerContainer} m².`,
  )
  const chosen = ELEMENTS.filter((element) => ctx.elements.includes(element.id))
  lines.push('Elements in scope, with how each is measured and billed:')
  for (const element of chosen) {
    const buildUp = buildUpFor(ctx, element)
    const layers = buildUp.layers
      .map((layer) => {
        const seed = element.layers.find((item) => item.id === layer.id)
        const row = rateForLayer(priceSheet, layer, seed)
        return `${layer.name}${layer.thicknessMm ? ` ${layer.thicknessMm}mm` : ''}${row ? ` @ ${row.unitPrice} ${row.currency}/${row.unit}` : ''}`
      })
      .join(', ')
    const defaults = [
      buildUp.heightMm ? `H ${buildUp.heightMm}` : '',
      buildUp.widthMm ? `W ${buildUp.widthMm}` : '',
      buildUp.depthMm ? `D ${buildUp.depthMm}` : '',
      buildUp.thicknessMm ? `T ${buildUp.thicknessMm}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    lines.push(
      `- ${element.id} (${element.label}, ${element.measure} → ${element.unit}${element.sizes.length ? `, needs ${element.sizes.join('/')}` : ''})${layers ? `: ${layers}` : ''}${defaults ? ` [defaults ${defaults} mm]` : ''}${buildUp.notes ? ` — ${buildUp.notes}` : ''}`,
    )
  }
  if (ctx.scopeNotes.trim()) lines.push(`Scope notes: ${ctx.scopeNotes.trim()}`)
  return lines.join('\n')
}
