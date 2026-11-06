import type { FixtureRow, MepBoqLine, MepFlag, MepInputs, MepModule, MepResult, MepSettings } from './types'

export const DEFAULT_SETTINGS: MepSettings = {
  conduitMaterial: 'PVC',
  boxMaterial: 'plastic',
  wallConduitMm: 25,
  ceilingConduitMm: 25,
  wallDropM: 3,
  ceilingRunM: 4,
  allowancePct: 20,
  undergroundInScope: false,
  undergroundLengthM: null,
  undergroundConduitMm: 25,
  mechanicalInScope: true,
  coolingWm2: null,
  occupancy: null,
  freshAirLsPerPerson: null,
  wetAirChanges: null,
  plumbingInScope: true,
  sanitary: { wc: null, basin: null, shower: null, sink: null },
  wasteRunM: null,
  fireInScope: true,
}

export function isPlaceholder(description: string) {
  return description.trim().toLowerCase().startsWith('confirm this symbol')
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function material(base: number, pct: number, whole: boolean) {
  const extra = round2(base * (pct / 100))
  const raw = base + extra
  const final = whole ? Math.ceil(raw - 1e-9) : round2(raw)
  return { base: round2(base), extra, final }
}

function floorTag(floor: string) {
  const words = floor.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  if (words.includes('ground') && words.includes('roof')) return 'GF-RF'
  if (words[0] === 'ground') return 'GF'
  if (words[0] === 'first') return 'FF'
  if (words[0] === 'roof') return 'RF'
  return (words[0] ?? 'plan').slice(0, 6).toUpperCase()
}

function sumFixtures(rows: FixtureRow[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, row.count), 0)
}

function boxesFor(row: FixtureRow) {
  const gang = Math.max(1, Math.round(row.gang) || 1)
  return Math.ceil(Math.max(0, row.count) / gang)
}

export function runMep(inputs: MepInputs): MepResult {
  const settings = { ...DEFAULT_SETTINGS, ...inputs.settings }
  const pct = Number.isFinite(settings.allowancePct) ? Math.max(0, settings.allowancePct) : 20
  const wall = inputs.fixtures.filter((row) => row.module === 'wall' && row.count > 0)
  const ceiling = inputs.fixtures.filter((row) => row.module === 'ceiling' && row.count > 0)
  const mechanical = inputs.fixtures.filter((row) => row.module === 'mechanical' && row.count > 0)
  const plumbing = inputs.fixtures.filter((row) => row.module === 'plumbing' && row.count > 0)
  const fire = inputs.fixtures.filter((row) => row.module === 'fire' && row.count > 0)
  const boq: MepBoqLine[] = []
  const flags: MepFlag[] = []

  const tradeOf = (module: MepModule): MepBoqLine['module'] => {
    if (module === 'wall') return 'Wall'
    if (module === 'ceiling') return 'Ceiling'
    if (module === 'mechanical') return 'Mechanical'
    if (module === 'plumbing') return 'Plumbing'
    if (module === 'fire') return 'Fire'
    return 'Underground'
  }
  const prefixOf = (module: MepModule) => {
    if (module === 'wall') return 'W'
    if (module === 'ceiling') return 'C'
    if (module === 'mechanical') return 'ME'
    if (module === 'plumbing') return 'PL'
    if (module === 'fire') return 'FA'
    return 'U'
  }

  for (const drawing of inputs.drawings) {
    if (drawing.module === 'unknown') {
      const looksElectrical = /EL-|EP-|LIGHT|POWER|ELECTR/i.test(`${drawing.name} ${drawing.title}`)
      flags.push({
        id: `EL-DRAW-${drawing.id}`,
        level: looksElectrical ? 'red' : 'amber',
        text: looksElectrical
          ? `${drawing.name} looks electrical and has no module. Mark it Wall, Ceiling or Underground before the bill is issued.`
          : `${drawing.name} is not a lighting, power or underground sheet, so it stays out of this bill.`,
      })
    }
  }

  for (const row of inputs.fixtures) {
    if (row.count > 0 && isPlaceholder(row.description)) {
      flags.push({ id: `EL-SYM-${row.id}`, level: 'red', text: `${row.code} × ${row.count} is still unmatched. Set the legend description before approval.` })
    }
  }

  if (sumFixtures(wall) + sumFixtures(ceiling) === 0 && !(settings.undergroundInScope && (settings.undergroundLengthM ?? 0) > 0)) {
    flags.push({ id: 'EL-EMPTY', level: 'amber', text: 'No electrical fixtures are confirmed yet. Lighting and power stay out of the bill until the sheets are read or the counts are typed.' })
  }

  for (const row of [...wall, ...ceiling, ...mechanical, ...plumbing, ...fire]) {
    boq.push({
      code: `${prefixOf(row.module)}-FX-${row.code}${row.floor ? `-${floorTag(row.floor)}` : ''}`,
      module: tradeOf(row.module),
      description: row.description,
      base: row.count,
      extra: 0,
      final: row.count,
      unit: 'nr',
      kind: 'fixture',
      basis: row.source === 'manual' ? 'manual' : 'counted',
    })
  }

  const wallCount = sumFixtures(wall)
  if (wallCount > 0) {
    const boxCount = wall.reduce((sum, row) => sum + boxesFor(row), 0)
    const drop = settings.wallDropM > 0 ? settings.wallDropM : 3
    const conduit = material(wallCount * drop, pct, true)
    const scale = drop / 3
    const supports = material(wallCount * 3 * scale, pct, true)
    const pair = material(wallCount * 2 * scale, pct, true)
    const boxes = material(boxCount, pct, true)
    boq.push(
      { code: 'W-BOX', module: 'Wall', description: `${settings.boxMaterial} back box`, ...boxes, unit: 'nr', kind: 'material', basis: 'calculated' },
      { code: 'W-COND', module: 'Wall', description: `${settings.wallConduitMm} mm ${settings.conduitMaterial} conduit, vertical drop`, ...conduit, unit: 'm', kind: 'material', basis: 'estimated' },
      { code: 'W-SUP', module: 'Wall', description: 'Supports and saddles', ...supports, unit: 'nr', kind: 'material', basis: 'estimated' },
      { code: 'W-CPL', module: 'Wall', description: 'Couplings', ...pair, unit: 'nr', kind: 'material', basis: 'estimated' },
      { code: 'W-BND', module: 'Wall', description: 'Bends', ...pair, unit: 'nr', kind: 'material', basis: 'estimated' },
      { code: 'W-CON', module: 'Wall', description: 'Connectors', ...pair, unit: 'nr', kind: 'material', basis: 'estimated' },
    )
    flags.push({ id: 'EL-WALL-EST', level: 'amber', text: `Wall conduit uses ${drop} m per fixture. That length is Estimated until a measured drop replaces it.` })
  }

  const ceilingCount = sumFixtures(ceiling)
  if (ceilingCount > 0) {
    const run = settings.ceilingRunM > 0 ? settings.ceilingRunM : 4
    const conduit = material(ceilingCount * run, pct, true)
    const scale = run / 4
    const pair = material(ceilingCount * 2 * scale, pct, true)
    const supports = material(ceilingCount * 4 * scale, pct, true)
    boq.push(
      { code: 'C-COND', module: 'Ceiling', description: `${settings.ceilingConduitMm} mm ${settings.conduitMaterial} conduit, horizontal`, ...conduit, unit: 'm', kind: 'material', basis: 'estimated' },
      { code: 'C-BND', module: 'Ceiling', description: 'Bends', ...pair, unit: 'nr', kind: 'material', basis: 'estimated' },
      { code: 'C-CPL', module: 'Ceiling', description: 'Couplings', ...pair, unit: 'nr', kind: 'material', basis: 'estimated' },
      { code: 'C-CON', module: 'Ceiling', description: 'Connectors', ...pair, unit: 'nr', kind: 'material', basis: 'estimated' },
      { code: 'C-JB', module: 'Ceiling', description: 'Junction boxes', ...pair, unit: 'nr', kind: 'material', basis: 'estimated' },
      { code: 'C-SUP', module: 'Ceiling', description: 'Supports', ...supports, unit: 'nr', kind: 'material', basis: 'estimated' },
    )
    flags.push({ id: 'EL-CEIL-EST', level: 'amber', text: `Ceiling conduit uses ${run} m per fixture because the route is not measured. Shared runs are not drawn, so this is Estimated.` })
  }

  if (settings.undergroundInScope) {
    const length = settings.undergroundLengthM
    if (length == null || length <= 0) {
      flags.push({ id: 'EL-UG-LEN', level: 'red', text: 'Underground is in scope and has no length. Enter the measured or overridden length, or turn underground off.' })
    } else {
      const conduit = material(length, pct, true)
      boq.push({
        code: 'U-COND',
        module: 'Underground',
        description: `${settings.undergroundConduitMm} mm ${settings.conduitMaterial} underground conduit`,
        ...conduit,
        unit: 'm',
        kind: 'material',
        basis: 'manual',
      })
    }
  }

  const building = inputs.building
  const fixtureCount = (rows: FixtureRow[], code: string) => rows.filter((row) => row.code === code).reduce((sum, row) => sum + row.count, 0)
  if (settings.mechanicalInScope) {
    const area = building?.occupiedM2 ?? null
    const indoor = fixtureCount(mechanical, 'FCU')
    if ((area == null || area <= 0) && indoor === 0) {
      flags.push({ id: 'ME-AREA', level: 'red', text: 'Mechanical is in scope and the occupied floor area is not measured. Approve architecture, or turn mechanical off.' })
    } else if (settings.coolingWm2 == null || settings.coolingWm2 <= 0) {
      flags.push({ id: 'ME-RATE', level: indoor ? 'amber' : 'red', text: 'Cooling needs a W/m² rate from the engineer. Indoor units stay on the bill; capacity is omitted until the rate is set.' })
    } else if (area != null && area > 0) {
      boq.push({
        code: 'ME-COOL',
        module: 'Mechanical',
        description: `Cooling capacity, ${area} m² at ${settings.coolingWm2} W/m²`,
        base: round2((area * settings.coolingWm2) / 1000),
        extra: 0,
        final: round2((area * settings.coolingWm2) / 1000),
        unit: 'kW',
        kind: 'material',
        basis: 'calculated',
      })
    }
    if (indoor > 0) {
      const duct = material(indoor * 6, pct, true)
      const refrigerant = material(indoor * 8, pct, true)
      boq.push(
        { code: 'ME-DUCT', module: 'Mechanical', description: 'Supply and return duct, 6 m per indoor unit', ...duct, unit: 'm', kind: 'material', basis: 'estimated' },
        { code: 'ME-REF', module: 'Mechanical', description: 'Refrigerant pipe, 8 m per indoor unit', ...refrigerant, unit: 'm', kind: 'material', basis: 'estimated' },
      )
      flags.push({ id: 'ME-DUCT', level: 'amber', text: 'Duct and refrigerant lengths are Estimated from the indoor-unit count. A measured route replaces them.' })
    }
    const people = settings.occupancy
    const fresh = settings.freshAirLsPerPerson
    if (people != null && people > 0 && fresh != null && fresh > 0) {
      boq.push({
        code: 'ME-FRESH',
        module: 'Mechanical',
        description: `Fresh air, ${people} people at ${fresh} L/s`,
        base: round2(people * fresh),
        extra: 0,
        final: round2(people * fresh),
        unit: 'L/s',
        kind: 'material',
        basis: 'calculated',
      })
    } else {
      flags.push({ id: 'ME-FRESH', level: 'amber', text: 'Fresh air is omitted until occupancy and L/s per person are both entered.' })
    }
    const wet = building?.wetM2 ?? null
    const changes = settings.wetAirChanges
    const height = building?.meanWallHeightM ?? null
    if (wet != null && wet > 0 && changes != null && changes > 0 && height != null && height > 0) {
      const flow = round2(wet * changes * height)
      boq.push({
        code: 'ME-AIR',
        module: 'Mechanical',
        description: `Wet-area exhaust, ${wet} m² at ${changes} air changes per hour`,
        base: flow,
        extra: 0,
        final: flow,
        unit: 'm3/h',
        kind: 'material',
        basis: 'calculated',
      })
    } else if (settings.mechanicalInScope) {
      flags.push({ id: 'ME-EXH', level: 'amber', text: 'Wet-area exhaust flow is omitted until the wet area, the air changes and the wall height are all known. Extract fans stay on the plan.' })
    }
  }

  if (settings.plumbingInScope) {
    const sanitary = { wc: null, basin: null, shower: null, sink: null, ...settings.sanitary }
    const fromPlan = [
      ['PL-WC', 'Water closets', sanitary.wc, fixtureCount(plumbing, 'WC')],
      ['PL-BAS', 'Basins', sanitary.basin, fixtureCount(plumbing, 'BAS')],
      ['PL-SHW', 'Showers', sanitary.shower, fixtureCount(plumbing, 'SHW')],
      ['PL-SNK', 'Sinks', sanitary.sink, fixtureCount(plumbing, 'SNK')],
    ] as const
    const used = fromPlan
      .map(([code, description, typed, counted]) => {
        if (typed != null && typed > 0) return { code, description, qty: typed, basis: 'manual' as const }
        if (counted > 0) return { code, description, qty: counted, basis: 'counted' as const }
        return null
      })
      .filter((item): item is { code: string; description: string; qty: number; basis: 'manual' | 'counted' } => Boolean(item))
    if (!used.length) {
      flags.push({ id: 'PL-COUNT', level: 'red', text: 'Plumbing is in scope and no sanitary fittings are on the plan or typed. Count the wet rooms, or turn plumbing off.' })
    } else {
      const points = used.reduce((sum, item) => sum + item.qty, 0)
      for (const item of used) {
        if (item.basis === 'manual') {
          boq.push({
            code: item.code,
            module: 'Plumbing',
            description: `${item.description} (typed)`,
            base: item.qty,
            extra: 0,
            final: item.qty,
            unit: 'nr',
            kind: 'fixture',
            basis: 'manual',
          })
        }
      }
      const wasteRun = settings.wasteRunM != null && settings.wasteRunM > 0 ? settings.wasteRunM : 4
      const waste = material(points * wasteRun, pct, true)
      const cold = material(points * 4, pct, true)
      const hot = material(points * 3, pct, true)
      const stacks = material(Math.max(1, plumbing.filter((row) => row.code === 'WC').length) * 3, pct, true)
      boq.push(
        { code: 'PL-WASTE', module: 'Plumbing', description: `Waste pipe, ${wasteRun} m per fitting`, ...waste, unit: 'm', kind: 'material', basis: 'estimated' },
        { code: 'PL-COLD', module: 'Plumbing', description: 'Cold-water pipe, 4 m per fitting', ...cold, unit: 'm', kind: 'material', basis: 'estimated' },
        { code: 'PL-HOT', module: 'Plumbing', description: 'Hot-water pipe, 3 m per fitting', ...hot, unit: 'm', kind: 'material', basis: 'estimated' },
        { code: 'PL-STACK', module: 'Plumbing', description: 'Soil and vent stack, 3 m per WC group', ...stacks, unit: 'm', kind: 'material', basis: 'estimated' },
      )
      flags.push({ id: 'PL-WASTE', level: 'amber', text: 'Waste, cold, hot and stack lengths are Estimated from the fitting count. A measured route replaces them.' })
    }
  }

  if (settings.fireInScope) {
    if (!fire.length) {
      flags.push({ id: 'FA-EMPTY', level: 'amber', text: 'Fire is in scope and no detectors or extinguishers are on the plan yet.' })
    } else {
      const devices = sumFixtures(fire)
      const cable = material(devices * 8, pct, true)
      boq.push({
        code: 'FA-CABLE',
        module: 'Fire',
        description: 'Fire-alarm cable, 8 m per device',
        ...cable,
        unit: 'm',
        kind: 'material',
        basis: 'estimated',
      })
      flags.push({ id: 'FA-CABLE', level: 'amber', text: 'Fire-alarm cable is Estimated from the device count. A measured loop replaces it.' })
    }
  }

  if (!boq.length) {
    flags.push({ id: 'MEP-EMPTY', level: 'red', text: 'Nothing is in the bill yet. Read the electrical sheets, or enter the cooling rate and the sanitary counts.' })
  }

  return { boq, flags, ranAt: new Date().toISOString() }
}

export function mepBlocked(result: MepResult) {
  return result.flags.some((flag) => flag.level === 'red')
}
