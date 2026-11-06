import type { ArchFlag, ArchLine, ArchResult, ArchSettings, ArchSource, ArchSummary } from './types'

const OCCUPIED = new Set(['habitable', 'wet', 'corridor', 'store'])

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function line(code: string, description: string, qty: number, unit: ArchLine['unit'], basis: ArchLine['basis'], group: ArchLine['group']): ArchLine {
  return { code, description, qty: round2(qty), unit, basis, group }
}

export function emptyArchSettings(): ArchSettings {
  return { doorHeightMm: null, windowHeightMm: null }
}

export function architectureBlocked(result: ArchResult) {
  return result.flags.some((flag) => flag.level === 'red')
}

export function openingCentre(wall: { axis: 'h' | 'v'; pos: number }, opening: { widthMm: number; position: number }) {
  const mid = opening.position + opening.widthMm / 2
  return wall.axis === 'h' ? { x: mid, y: wall.pos } : { x: wall.pos, y: mid }
}

function doorKind(widthMm: number) {
  return widthMm >= 1200 ? 'double' : 'single'
}

function windowKind(widthMm: number) {
  if (widthMm >= 1800) return 'wide'
  if (widthMm >= 1200) return 'typical'
  return 'narrow'
}

export function runArchitecture(source: ArchSource, settings: ArchSettings): ArchResult {
  const flags: ArchFlag[] = []
  const lines: ArchLine[] = []
  const emptySummary = (): ArchSummary => ({
    storeys: 0,
    occupiedM2: null,
    wetM2: null,
    dryM2: null,
    meanWallHeightM: null,
    doors: 0,
    windows: 0,
  })

  if (!source.foundationReady) {
    flags.push({ id: 'AR-NO-PLAN', level: 'red', text: 'Architecture reads the foundation plan. Run the foundation before measuring walls, rooms and openings.' })
    return { lines, flags, summary: emptySummary(), ranAt: new Date().toISOString() }
  }
  if (!source.foundationApproved) {
    flags.push({ id: 'AR-UNAPPROVED', level: 'amber', text: 'The sub structure review gate is still open. These quantities are provisional until that gate is approved.' })
  }

  const floors = source.levels.filter((level) => !level.isRoof)
  const measured = floors.filter((level) => (level.heightMm ?? 0) > 0)
  const missing = floors.filter((level) => !((level.heightMm ?? 0) > 0))
  if (!floors.length) {
    flags.push({ id: 'AR-NO-LEVEL', level: 'red', text: 'No floor levels are on the structure. Enter the floor-to-floor heights and run the structure.' })
  }
  for (const level of missing) {
    flags.push({ id: `AR-H-${level.id}`, level: 'red', text: `${level.name} has no floor-to-floor height, so its wall and floor areas are not calculated.` })
  }

  const storeys = measured.length
  const ext = source.walls.filter((wall) => wall.external)
  const internal = source.walls.filter((wall) => !wall.external)
  const extLen = ext.reduce((sum, wall) => sum + Math.max(0, wall.lengthMm), 0) / 1000
  const intLen = internal.reduce((sum, wall) => sum + Math.max(0, wall.lengthMm), 0) / 1000
  let extArea = 0
  let insideArea = 0
  let intFace = 0
  let heightSum = 0
  for (const level of measured) {
    const height = (level.heightMm ?? 0) / 1000
    heightSum += height
    extArea += extLen * height
    intFace += intLen * height
    insideArea += intLen * height * 2 + extLen * height
  }
  if (storeys > 0 && extLen + intLen > 0) {
    lines.push(line('AR-EXT', 'External wall, outside face', extArea, 'm2', 'calculated', 'measured'))
    lines.push(line('AR-INT', 'Internal wall faces, including the inside of external walls', insideArea, 'm2', 'calculated', 'measured'))
  } else if (source.foundationReady && storeys > 0) {
    flags.push({ id: 'AR-NO-WALL', level: 'red', text: 'The foundation plan has no wall lengths, so wall area cannot be calculated.' })
  }

  const openings = source.walls.flatMap((wall) => wall.openings)
  const doors = openings.filter((item) => item.type === 'door')
  const windows = openings.filter((item) => item.type === 'window')
  const gaps = openings.filter((item) => item.type === 'gap')
  const widthM = (kind: 'door' | 'window', external?: boolean) =>
    source.walls
      .filter((wall) => external == null || wall.external === external)
      .flatMap((wall) => wall.openings)
      .filter((item) => item.type === kind)
      .reduce((sum, item) => sum + Math.max(0, item.widthMm), 0) / 1000
  if (storeys > 1) {
    flags.push({ id: 'AR-REPEAT', level: 'amber', text: 'Door and window counts repeat the ground-floor plan on each measured floor. A different upper-floor plan is not read yet.' })
  }
  if (gaps.length) {
    flags.push({ id: 'AR-GAP', level: 'amber', text: `${gaps.length} opening${gaps.length === 1 ? '' : 's'} on the plan ${gaps.length === 1 ? 'is' : 'are'} unmarked. ${gaps.length === 1 ? 'It is' : 'They are'} not billed as a door or a window.` })
  }

  const copies = storeys
  const doorCount = doors.length * copies
  const windowCount = windows.length * copies
  if (doorCount > 0) {
    const single = doors.filter((item) => doorKind(item.widthMm) === 'single').length * copies
    const double = doors.filter((item) => doorKind(item.widthMm) === 'double').length * copies
    lines.push(line('AR-DOOR-NR', 'Doors', doorCount, 'nr', 'counted', 'openings'))
    if (single) lines.push(line('AR-DOOR-S', 'Single-leaf doors, clear width under 1200 mm', single, 'nr', 'counted', 'openings'))
    if (double) lines.push(line('AR-DOOR-D', 'Wide or double doors, clear width 1200 mm and over', double, 'nr', 'counted', 'openings'))
  }
  if (windowCount > 0) {
    const narrow = windows.filter((item) => windowKind(item.widthMm) === 'narrow').length * copies
    const typical = windows.filter((item) => windowKind(item.widthMm) === 'typical').length * copies
    const wide = windows.filter((item) => windowKind(item.widthMm) === 'wide').length * copies
    lines.push(line('AR-WIN-NR', 'Windows', windowCount, 'nr', 'counted', 'openings'))
    if (narrow) lines.push(line('AR-WIN-N', 'Narrow windows, under 1200 mm', narrow, 'nr', 'counted', 'openings'))
    if (typical) lines.push(line('AR-WIN-T', 'Typical windows, 1200 to 1800 mm', typical, 'nr', 'counted', 'openings'))
    if (wide) lines.push(line('AR-WIN-W', 'Wide windows, 1800 mm and over', wide, 'nr', 'counted', 'openings'))
  }
  if (copies > 0 && extLen + intLen > 0) {
    const skirt = Math.max(0, (intLen * 2 + extLen) * copies - widthM('door') * copies)
    lines.push(line('AR-SKIRT', 'Skirting, inside wall perimeter minus door widths', skirt, 'm', 'calculated', 'measured'))
  }

  const doorHeight = settings.doorHeightMm
  const windowHeight = settings.windowHeightMm
  const doorsReady = doors.length === 0 || Boolean(doorHeight && doorHeight > 0)
  const windowsReady = windows.length === 0 || Boolean(windowHeight && windowHeight > 0)
  if (copies > 0 && doors.length && !doorsReady) {
    flags.push({ id: 'AR-DOOR-H', level: 'red', text: 'Door height is not set, so door area is not calculated.' })
  } else if (doorCount > 0 && doorHeight) {
    lines.push(line('AR-DOOR-A', 'Door area', widthM('door') * (doorHeight / 1000) * copies, 'm2', 'calculated', 'openings'))
  }
  if (copies > 0 && windows.length && !windowsReady) {
    flags.push({ id: 'AR-WIN-H', level: 'red', text: 'Window height is not set, so window area and the net wall lines are not calculated.' })
  } else if (windowCount > 0 && windowHeight) {
    lines.push(line('AR-WIN-A', 'Window area', widthM('window') * (windowHeight / 1000) * copies, 'm2', 'calculated', 'openings'))
  }
  if (copies > 0 && insideArea > 0 && doorsReady && windowsReady) {
    const deducted =
      (widthM('door', false) * ((doorHeight ?? 0) / 1000) * 2 +
        widthM('door', true) * ((doorHeight ?? 0) / 1000) +
        widthM('window', false) * ((windowHeight ?? 0) / 1000) * 2 +
        widthM('window', true) * ((windowHeight ?? 0) / 1000)) *
      copies
    lines.push(line('AR-INT-NET', 'Internal wall faces, net of doors and windows', Math.max(0, insideArea - deducted), 'm2', 'calculated', 'measured'))
  }
  const extDoors = ext.flatMap((wall) => wall.openings).filter((item) => item.type === 'door')
  const extWindows = ext.flatMap((wall) => wall.openings).filter((item) => item.type === 'window')
  const facadeReady = (extDoors.length === 0 || doorsReady) && (extWindows.length === 0 || windowsReady)
  let facade = 0
  if (extArea > 0 && facadeReady) {
    const openingArea = (widthM('door', true) * ((doorHeight ?? 0) / 1000) + widthM('window', true) * ((windowHeight ?? 0) / 1000)) * copies
    facade = Math.max(0, extArea - openingArea)
    lines.push(line('AR-FACADE', extDoors.length + extWindows.length ? 'Facade, external wall minus doors and windows' : 'Facade, external wall with no openings on the plan', facade, 'm2', 'calculated', 'measured'))
  }

  const occupiedRooms = source.rooms.filter((room) => OCCUPIED.has(room.category) && room.areaM2 > 0)
  const wetRooms = source.rooms.filter((room) => room.category === 'wet' && room.areaM2 > 0)
  const floorRepeat = storeys
  let occupied = 0
  if (floorRepeat > 0 && occupiedRooms.length) {
    occupied = occupiedRooms.reduce((sum, room) => sum + room.areaM2, 0) * floorRepeat
    lines.push(line('AR-FLOOR', 'Occupied floor area', occupied, 'm2', 'calculated', 'measured'))
    lines.push(line('AR-CEIL', 'Ceiling to the occupied floor', occupied, 'm2', 'calculated', 'measured'))
  } else if (source.footprintM2 > 0 && floorRepeat > 0) {
    occupied = source.footprintM2 * floorRepeat
    lines.push(line('AR-FLOOR', 'Footprint repeated per measured floor', occupied, 'm2', 'calculated', 'measured'))
    lines.push(line('AR-CEIL', 'Ceiling to the footprint', occupied, 'm2', 'calculated', 'measured'))
    flags.push({ id: 'AR-FOOT', level: 'amber', text: 'No rooms were read, so floor and ceiling use the footprint. That area includes the wall zone.' })
  } else if (floorRepeat > 0) {
    flags.push({ id: 'AR-AREA', level: 'red', text: 'Neither rooms nor a footprint area are on the foundation plan, so floor and ceiling are not calculated.' })
  }

  let wet = 0
  if (wetRooms.length && floorRepeat > 0) {
    wet = wetRooms.reduce((sum, room) => sum + room.areaM2, 0) * floorRepeat
    lines.push(line('AR-WET', 'Wet-room floor area', wet, 'm2', 'calculated', 'measured'))
  } else if (source.rooms.length && floorRepeat > 0) {
    flags.push({ id: 'AR-WET', level: 'amber', text: 'No room is classed as wet, so waterproofing is omitted rather than entered as zero.' })
  }

  if (source.parapet && source.parapet.lengthMm > 0 && source.parapet.heightMm > 0) {
    lines.push(line('AR-PARAPET', 'Parapet, outside face', (source.parapet.lengthMm / 1000) * (source.parapet.heightMm / 1000), 'm2', 'calculated', 'measured'))
  }

  if (extArea > 0) {
    const face = facade > 0 ? facade : extArea
    lines.push(line('AR-EXT-CB', '12 mm cement board, external face', face, 'm2', 'calculated', 'finishes'))
    lines.push(line('AR-EXT-VB', 'Vapour barrier to the external wall', face, 'm2', 'calculated', 'finishes'))
    lines.push(line('AR-EXT-RW', '150 mm rockwool, one-side foil, in the external wall', extArea, 'm2', 'calculated', 'finishes'))
    lines.push(line('AR-EXT-GY12', '12.5 mm fire-rated gypsum, inside face of the external wall', extArea, 'm2', 'calculated', 'finishes'))
    lines.push(line('AR-EXT-GY15', '15 mm fire-rated gypsum, second inside layer', extArea, 'm2', 'calculated', 'finishes'))
  }
  if (intFace > 0) {
    lines.push(line('AR-INT-GY', '15 mm fire-rated gypsum, both faces of the partitions', intFace * 2, 'm2', 'calculated', 'finishes'))
    lines.push(line('AR-INT-RW', '150 mm rockwool in the partitions', intFace, 'm2', 'calculated', 'finishes'))
  }
  if (wet > 0 && floorRepeat > 0) {
    const wetPerim = wetRooms.reduce((sum, room) => {
      const w = Math.max(0, room.bbox.x1 - room.bbox.x0)
      const h = Math.max(0, room.bbox.y1 - room.bbox.y0)
      return sum + (2 * (w + h)) / 1000
    }, 0)
    const meanH = heightSum / Math.max(1, storeys)
    const wetWall = wetPerim * meanH * floorRepeat
    lines.push(line('AR-WET-WP', 'Waterproofing to the wet-room floor', wet, 'm2', 'calculated', 'finishes'))
    lines.push(line('AR-WET-CB', '12 mm cement board, tile substrate on wet-room walls', wetWall, 'm2', 'calculated', 'finishes'))
    lines.push(line('AR-WET-MR', '12 mm moisture-resistant gypsum on the wet side', wetWall, 'm2', 'calculated', 'finishes'))
    lines.push(line('AR-CEIL-MR', '12 mm moisture-resistant gypsum ceiling in wet rooms', wet, 'm2', 'calculated', 'finishes'))
  }
  const dry = Math.max(0, occupied - wet)
  if (dry > 0) {
    lines.push(line('AR-CEIL-GY', '12.5 mm fire-rated gypsum ceiling in dry rooms', dry, 'm2', 'calculated', 'finishes'))
  }

  const summary: ArchSummary = {
    storeys,
    occupiedM2: occupied > 0 ? round2(occupied) : null,
    wetM2: wet > 0 ? round2(wet) : null,
    dryM2: dry > 0 ? round2(dry) : null,
    meanWallHeightM: storeys > 0 ? round2(heightSum / storeys) : null,
    doors: doorCount,
    windows: windowCount,
  }
  return { lines, flags, summary, ranAt: new Date().toISOString() }
}
