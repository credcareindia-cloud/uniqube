/** Superstructure Logic Specification v1.0 — rule registry shown on the Rules view. */
export interface SuperRule {
  id: string
  module: string
  name: string
  logic: string
}

const R = (id: string, module: string, name: string, logic: string): SuperRule => ({ id, module, name, logic })

export const SUPER_RULES: SuperRule[] = [
  R('SS-I1', 'Inputs', 'From the substructure stage', 'Zones (framing direction, spans, support walls), walls (LB / NLB / shear, stacking on the wall below, stacked length) and the number of floors come from the approved foundation run.'),
  R('SS-I2', 'Inputs', 'Project settings', 'Stud spacing s = 450 or 600 mm project-wide; project type panelised or volumetric modular; pitched roof covering; flat roof covering (flat deck or sheeting on purlins); lowest level on slab or suspended.'),
  R('SS-I3', 'Inputs', 'Level row', 'Per level: LB wall section, NLB wall section, framing type carried on the walls (truss, C-joist, flat roof truss, flat roof C-joist, pitched roof), framing section, reinforcing studs (trusses), parapet section (roof row).'),
  R('SS-I4', 'Inputs', 'Typical plans', 'A level set to "same as below" repeats the plan under it. A level with no plan raises F-LEVEL-MISSING and produces no quantities.'),
  R('SS-H0', 'Wall height', 'Floor-to-floor height', 'FFH is read from the sections and entered per level. With no sections the engine asks; it never assumes a height.'),
  R('SS-H1', 'Wall height', 'Stud height', 'H = FFH − D_above − build-up. D = 600 under trusses and flat roof trusses, 305 under 1200S350, 356 under 1400S350; a pitched roof deducts nothing (FFL to eaves).'),
  R('SS-H2', 'Wall height', 'Height flags', 'F-HEIGHT-CONFLICT when sections disagree by more than 50 mm; F-HEIGHT-RANGE outside 2100–4500 mm; F-HEIGHT-LOCAL for double-height or split-level areas.'),
  R('SS-W1', 'Walls', 'Wall run and panels', 'A run is a continuous straight wall end to end or corner to corner; T and X junctions do not split the through wall. n_p = ceil(L_run / 2400), L_p = L_run / n_p.'),
  R('SS-W2', 'Walls', 'Studs', 'Regular studs n_p × (ceil(L_p / s) + 1); jamb studs 2 per side of every opening; junction studs L +1, T +2, X +2 counted once on the through wall. Every stud is cut at H.'),
  R('SS-W3', 'Walls', 'Tracks, nogging and tiers', 'Tracks 2 × L_run; nogging rows floor((H − 1) / 1200) each L_run; above 12 m of height an extra track pair per tier. Tracks and nogging use the stud section.'),
  R('SS-W4', 'Walls', 'Weight and openings', 'Weight = total mm / 1000 × kg/m of the level section. No deduction for openings; an opening wider than a panel raises F-OPENING-PANEL; 3048 mm or wider adds an HRS header suggestion.'),
  R('SS-F1', 'Floor trusses', 'Geometry', '600 mm deep Pratt truss, 600 mm panels, members on the weak axis; vertical 518 mm, diagonal 793 mm.'),
  R('SS-F2', 'Floor trusses', 'Truss lines and the cut rule', 'Trusses sit at s from a common grid line; spans crossed in the same direction join into a line. A piece extends over the next span while piece + span < 12 000 mm, otherwise it is cut at that wall.'),
  R('SS-F3', 'Floor trusses', 'Members per piece', 'p = Σ ceil(span / 600); chords 2 × L, verticals (p + 1) × 518, diagonals p × 793, reinforcing 2 × L when the level toggle is on.'),
  R('SS-F4', 'Floor trusses', 'Blocking trusses', 'Same section and configuration: one line along each piece end, two at a cut, one along each intermediate support. Lines over 12 m split into equal pieces.'),
  R('SS-J1', 'C-joists', 'Joists', 'Single span per zone: N = ceil(W / s) + 1 joists of length L_j.'),
  R('SS-J2', 'C-joists', 'Blocking', 'Rows r = ceil(L_j / 1200) − 1; blocking length r × (N − 1) × s in the joist section.'),
  R('SS-J3', 'C-joists', 'Rims and stiffeners', 'Rim beams 2 × W per zone (two at a shared bearing wall). Web stiffeners are an allowance row.'),
  R('SS-V1', 'Voids', 'Stair and service voids', 'No deduction from floor steel. A void wider than 1524 mm in one direction adds an HRS trimmer suggestion.'),
  R('SS-B1', 'Balconies', 'Members', 'Cantilever c ≤ 914 mm: N = ceil(L_bal / s) + 1 members of length c + 1.5c in the level floor type, section and spacing.'),
  R('SS-B2', 'Balconies', 'Edges and limits', 'Rim beam or blocking truss along the free edge and both ends: L_bal + 2c. Over 914 mm: F-CANTILEVER, HRS cantilever suggestion, balcony excluded. Framing parallel to the supporting wall: F-BACKSPAN.'),
  R('SS-R1', 'Roof', 'Flat roofs', 'Framed as floors with the roof row section (D = 600 for trusses). Flat deck: no purlins or bracing. Sheeting on purlins: purlins and roof plane bracing apply.'),
  R('SS-R2', 'Roof', 'PR2 common truss', 'Count ceil(ridge / s) + 1. Bottom chord Lt; top chord 2 × (Lt/2 + O) / cos θ; verticals at x = 0, 600 … < Lt/2 on each half plus the apex, v(x) = hh + x tan θ − 2 × 41.3; one diagonal per panel √(panel² + v_outer²).'),
  R('SS-R3', 'Roof', 'PR3 eaves and PR4 verge', 'Fascia member along eaves with an overhang; O > 914 → F-OVERHANG. Rake = (Lt/2 + O) / cos θ; outriggers ceil(rake / s) + 1 per rake, each 2.5 G; verge member per rake; G > 914 → F-OVERHANG.'),
  R('SS-R4', 'Roof', 'PR5 hip end', 'Commons stop at B/2; ridge = L − B. Two hip rafters per end, true length √2 × (B/2 + O) × √(1 + ½ tan² θ), two-ply. End jacks ceil(B / s) − 1 spanning min(y, B − y); side jacks ceil((B/2) / s) − 1 per side spanning x; jacks under 600 mm count as a top-chord piece.'),
  R('SS-R5', 'Roof', 'PR6 valley', 'Secondary commons stop at the main eaves. Valley trusses floor((W2/2) / s), the k-th spanning W2 − 2ks (skip under 600); valley member plan (W2/2) √2 with rise (W2/2) tan θ along each valley.'),
  R('SS-R6', 'Roof', 'PR7 flags', 'F-ROOF-SHAPE for unequal pitches, Dutch gables, dormers, curves or box gutters; F-PITCH outside 5–45°; F-SPAN on a roof span over 6 m with no support; F-ROOF-PLAN when a pitched roof has no roof plan.'),
  R('SS-R8', 'Roof', 'Purlins', '362S162-33 at 1200 mm: length = A_slope / 1.2 + L_eaves, with A_slope = A_plan (overhangs included) / cos θ. Flat on purlins uses θ = 0.'),
  R('SS-R9', 'Roof', 'Strap bracing', 'STRAP-50×1.2 X-bracing per slope: bays = ceil(L_section / 12 000) + 1, strap per bay 2√2 × S. Bottom chord plane the same on two halves of Lt/2 (on by default). Web restraint off by default.'),
  R('SS-P1', 'Parapets', 'Parapet framing', 'Flat roofs with a parapet in the sections: NLB wall rules at height = top of parapet − top of roof framing, L-corner studs, no openings, no anchors or rods. Section from the roof row or the top-level NLB section.'),
  R('SS-A1', 'Anchors and rods', 'Lowest level LB', 'M10 × 200 at 300 mm: ceil(L_run / 0.3) + 1 per LB run. Door openings are not deducted.'),
  R('SS-A2', 'Anchors and rods', 'Lowest level NLB', 'M8 × 100 at 300 mm: ceil(L_run / 0.3) + 1 per NLB run.'),
  R('SS-A3', 'Anchors and rods', 'Upper external rods', 'M16 rods with two nuts: every corner (convex and re-entrant) plus Σ (ceil(L_run / 4.572) − 1) over the external runs of each upper level.'),
  R('SS-A4', 'Anchors and rods', 'Upper internal rods and rod length', 'Stacked internal LB walls: ceil(L_stacked / 6.096) + 1 rods with one at each end. Rod length = floor zone depth + 2 × 75 (750 mm in a 600 zone). Suspended lowest level: anchor rules off, F-SUSPENDED.'),
  R('SS-H1', 'HRS', 'Suggested markups', 'F-STACK → transfer beam; span over 6 m with no wall → intermediate beam; opening ≥ 3048 → header; void > 1524 → trimmers; cantilever > 914 → cantilever beams; roof span > 6 m → roof beam. Unresolved suggestions raise F-HRS-PENDING.'),
  R('SS-H2', 'HRS', 'Weight', 'Markup kg = length m × kg/m × quantity × 1.05 connections × 1.05 wastage. Manual direct kg × 1.05 wastage only.'),
  R('SS-H4', 'HRS', 'Section and kg/m', 'An accepted markup needs a designation and the supplier kg/m. UB / UC / PFC designations prefill the nominal kg/m from the name (UB 305x165x40 → 40). A kg/m outside 1–634 (the heaviest catalogue UC), a section with no letters, or a zero length or quantity blocks the run as a missing input.'),
  R('SS-H3', 'HRS', 'Load path loop', 'An accepted beam becomes a support line: the zone is split and the floor re-run. Each beam end on an LGS wall gets a stud pack of 3 studs in the wall below on every level to the foundation and passes a pad footing to the substructure.'),
  R('SS-C1', 'Totals', 'Calculated LGS', 'Sum of walls, floors, balconies, roof framing, purlins, bracing and parapets (plus modular frames).'),
  R('SS-C2', 'Totals', 'Allowances and net', 'Allowance rows on calculated LGS: wall strap bracing %, LGS staircase % or kg per flight, C-joist web stiffeners % or kg, transport bracing kg per module, other. Net = calculated + allowances.'),
  R('SS-C3', 'Totals', 'Screws and connectors', 'Screws = 7 × net kg; connectors = 0.1 AED × net kg.'),
  R('SS-C4', 'Totals', 'Gross LGS', 'Gross = net × 1.05 wastage.'),
  R('SS-C5', 'Totals', 'HRS and counted items', 'HRS weight is reported separately from LGS. Anchors and rods are counted items outside the LGS weight and both factors.'),
  R('SS-C6', 'Totals', 'kg/m² and calibration', 'kg/m² per level is reported for every run. F-KGM2 fires once the calibrated range per building type is filled from completed projects.'),
  R('SS-G1', 'Gate', 'Flag policy', 'Red flags block the issue of the estimate; amber flags need engineer acknowledgement before approval. The section limit table flags only (F-SECTION-LIMIT) and never resizes.'),
  R('SS-G2', 'Gate', 'Rates', 'All rates are null except connectors at 0.1 AED/kg. Quantities are issued without prices until UNIQUBE fills the rate table.'),
]
