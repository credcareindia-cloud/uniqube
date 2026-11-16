import {
  boardSheets,
  d4,
  heightFitWastage,
  liningHeight,
  paintLitres,
  quantity,
  revealPerimeter,
  screwRate,
  surfaceNetArea,
  type Opening,
  type QuantityResult,
} from './calc.ts'
import { ARCH_SPEC, archWastage } from './spec.ts'

export interface ExampleLine extends QuantityResult {
  item: string
}

/** The specification's worked example: one 10 m external bedroom wall with a window and a door. */
export function runWorkedExample(): ExampleLine[] {
  const { wall, openings: rawOpenings } = ARCH_SPEC.worked_example.inputs
  const openings: Opening[] = rawOpenings.map((o) => ({ kind: o.kind, width: o.width_m, height: o.height_m, sillBoard: o.sill_board }))
  const boardWastage = archWastage('Wall and ceiling boards')
  const smallWastage = archWastage('Screws and small fixings')
  const wetWastage = archWastage('Render, paint, adhesives, compounds')
  const beadWastage = archWastage('Beads, trims, skirting, coping')
  const lines: ExampleLine[] = []
  const push = (item: string, q: QuantityResult) => lines.push({ item, ...q })

  const cementSheet = { widthMm: 1220, lengthMm: 2440 }
  const outer = surfaceNetArea({ length: wall.outer_face_length_m, height: wall.facade_height_m, openings, face: 'outer', returnsIntoReveal: true })
  push('Cement board 12 mm', boardSheets(outer, heightFitWastage(boardWastage, wall.facade_height_m, cementSheet.lengthMm / 1000), cementSheet))
  const cementScrews = screwRate(cementSheet, 'width', wall.stud_spacing_mm, 200).ratePerM2
  push('Screws, cement board', quantity(outer * cementScrews, smallWastage, 500))
  push('Breather membrane', quantity(outer, archWastage('Sheet membranes, laps included'), 75))
  push('Render basecoat', quantity(outer * 4.5, wetWastage, 25))
  push('Reinforcing mesh', quantity(outer * 1.1, 0, 50))
  push('Render finish coat', quantity(outer * 2.5, wetWastage, 25))
  const outerReveals = openings.reduce((sum, o) => sum + revealPerimeter(o, 'outer'), 0)
  push('Corner bead, external', quantity(outerReveals, beadWastage, 3))

  const cavity = surfaceNetArea({ length: wall.centreline_length_m, height: wall.stud_height_m, openings, face: 'inner', returnsIntoReveal: false })
  push('Rockwool 100 mm', quantity(cavity, archWastage('Insulation'), 5.76))

  const gypsumSheet = { widthMm: 1200, lengthMm: 3000 }
  const lining = liningHeight(wall.ceiling_height_m)
  const inner = surfaceNetArea({ length: wall.room_side_length_m, height: lining, openings, face: 'inner', returnsIntoReveal: true })
  push('Gypsum board 12.5 mm', boardSheets(inner, heightFitWastage(boardWastage, lining, gypsumSheet.lengthMm / 1000), gypsumSheet))
  const gypsumScrews = screwRate(gypsumSheet, 'width', wall.stud_spacing_mm, 300).ratePerM2
  push('Screws, gypsum board', quantity(inner * gypsumScrews, smallWastage, 1000))
  push('Joint tape', quantity(inner * 1.5, wetWastage, 75))
  push('Jointing compound', quantity(inner * 0.5, wetWastage, 25))
  const innerReveals = openings.reduce((sum, o) => sum + revealPerimeter(o, 'inner'), 0)
  push('Corner bead, internal', quantity(innerReveals, beadWastage, 3))

  const paintArea = surfaceNetArea({ length: wall.room_side_length_m, height: wall.ceiling_height_m, openings, face: 'inner', returnsIntoReveal: true })
  push('Paint primer', quantity(paintLitres(paintArea, 1, 10), wetWastage, 4))
  push('Paint top coat', quantity(paintLitres(paintArea, 2, 10), wetWastage, 4))

  return lines.map((line) => ({ ...line, net: d4(line.net), gross: d4(line.gross) }))
}
