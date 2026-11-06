/** Rule registry for the load-bearing wall & foundation spec v0.1, for citations and getRules. */
export interface EngineRule {
  id: string
  module: string
  name: string
  logic: string
}

const R = (id: string, module: string, name: string, logic: string): EngineRule => ({ id, module, name, logic })

export const ENGINE_RULES: EngineRule[] = [
  R('PI-01', 'PDF ingestion', 'Page type', 'Classify each page as plan, section, elevation, schedule, cover or detail from its title block.'),
  R('PI-02', 'PDF ingestion', 'Vector or raster', 'Vector pages are read from their line work; raster pages need tracing and are flagged low confidence.'),
  R('PI-03', 'PDF ingestion', 'Units', 'Dimension strings are mm unless the sheet says otherwise; no strings → F-UNITS.'),
  R('PI-04', 'PDF ingestion', 'Scale cross-check', 'At least two written dimensions must agree with the page scale within P.scale_tol, else F-SCALE.'),
  R('PI-05', 'PDF ingestion', 'Walls', 'A wall is a pair of parallel lines P.wall_thk_min–P.wall_thk_max apart; centreline, thickness and length are recorded; a wall touching the outline is external.'),
  R('PI-06', 'PDF ingestion', 'Openings', 'Gaps along a wall centreline are door, window or gap openings; opening_ratio = Σ opening width / wall length.'),
  R('PI-07', 'PDF ingestion', 'Rooms', 'Closed cells bounded by walls, labelled by the room text inside and categorised by keyword (wet, corridor, stair, lift, shaft, balcony, store, habitable).'),
  R('PI-08', 'PDF ingestion', 'Stacking', 'Upper plans are aligned to the ground plan to find walls that stack; missing upper plans → F-NO-STACK.'),
  R('PI-09', 'PDF ingestion', 'Internal units', 'All engine coordinates are plan millimetres with the origin at the plan region top-left.'),
  R('SL-01', 'Support lines', 'External walls', 'Every external wall is a primary support line.'),
  R('SL-02', 'Support lines', 'Party walls', 'Party walls are primary support lines.'),
  R('SL-03', 'Support lines', 'Corridor walls', 'A wall with a corridor on one side and rooms on the other is a primary support line.'),
  R('SL-04', 'Support lines', 'Core walls', 'Walls enclosing stairs, lifts and shafts are primary support lines.'),
  R('SL-05', 'Support lines', 'Merge', 'Collinear support segments within P.node_snap_tol are merged into one line.'),
  R('FZ-01', 'Framing zones', 'Split', 'The footprint is split into zones by the support lines.'),
  R('FZ-02', 'Framing zones', 'Rectangles', 'Non-rectangular zones are decomposed into rectangles.'),
  R('FZ-03', 'Framing zones', 'Spans', 'Lx and Ly are measured centre to centre of the bounding support lines.'),
  R('FZ-04', 'Framing zones', 'Voids', 'Stairs, lifts, shafts and voids inside a zone are recorded against it.'),
  R('FD-01', 'Framing direction', 'Case A', 'Only one span ≤ P.span_max: frame across that span.'),
  R('FD-02', 'Framing direction', 'Case B', 'Both spans > P.span_max: search for an internal wall parallel to the long side covering ≥ P.int_wall_continuity % with no opening > P.int_wall_max_opening that splits the span; promote it and re-run, else F-SPAN (stop).'),
  R('FD-03', 'Framing direction', 'Case C, clear winner', 'Both spans ≤ P.span_max and they differ by more than P.span_ratio_tol %: the shorter span wins.'),
  R('FD-04', 'Framing direction', 'Case C, tie-break', 'Weighted score: bears on primary support 30, vertical continuity 25, bearing wall quality 15, consistency 15, avoids wet-area walls 10, shorter span 5.'),
  R('SA-01', 'Special areas', 'Corridors', 'Corridors are framed across their width.'),
  R('SA-02', 'Special areas', 'Balconies', 'Cantilevers over P.cantilever_max → F-CANT.'),
  R('SA-03', 'Special areas', 'Voids', 'Openings with a side over P.void_max → F-VOID.'),
  R('SA-04', 'Special areas', 'Sunken areas', 'Sunken or dropped slabs noted on the plan → F-SUNKEN.'),
  R('SA-05', 'Special areas', 'Roof', 'Roof framing is out of scope in v0.1; a single-storey plan has no floor to frame.'),
  R('RG-01', 'Review gate', 'Overlay', 'Zones are shown green (auto), amber (tie-break) and red (stop) with the joist direction arrow and span label.'),
  R('RG-02', 'Review gate', 'Edit', 'The engineer can flip or set a zone direction, mark a wall LB/NLB, promote a wall to a support line, or add a beam.'),
  R('RG-03', 'Review gate', 'Approval', 'The gate cannot be approved while a stop flag is open; quantities are provisional until approval.'),
  R('RG-04', 'Review gate', 'Change log', 'Every engineer change is logged with user, time, entity, before and after; a change re-opens the gate.'),
  R('WC-01', 'Wall classes', 'Receives joists', 'A wall receiving joists from an approved framing decision is load-bearing.'),
  R('WC-02', 'Wall classes', 'External', 'External walls are load-bearing for foundation purposes.'),
  R('WC-03', 'Wall classes', 'Back-span / trimmer', 'Walls supporting a cantilever back-span, a void trimmer or a promoted support line are load-bearing.'),
  R('WC-04', 'Wall classes', 'Shear walls', 'Per direction, the walls with solid length ≥ P.shear_wall_min_len and the lowest opening ratio on both sides of the plan centre are shear walls; none → F-LATERAL.'),
  R('WC-05', 'Wall classes', 'Transfer', 'A load-bearing wall with no wall below on a non-ground level → REVIEW + F-TRANSFER.'),
  R('WC-06', 'Wall classes', 'Non-load-bearing', 'Everything else is non-load-bearing.'),
  R('FT-01', 'Foundation type', 'Storey band', 'S1 = 1–2 storeys, S2 = 3 or more.'),
  R('FT-02', 'Foundation type', 'Type 3 limit', 'Type 3 is not allowed in band S2 → F-TYPE3.'),
  R('FT-03', 'Foundation type', 'Required inputs', 'P.plinth_above_NGL is required for every type; P.soil_bearing for Type 3; missing → F-INPUT.'),
  R('FT-04', 'Foundation type', 'Datum', 'TOP (top of plinth / slab) = 0; NGL = −plinth; footing top = −1500; founding = −(1500 + D).'),
  R('T1-01', 'Type 1', 'Excavation', 'area(E) × (1500 + D + pcc_footing − plinth), E = LB lines buffered W/2 + work_space.'),
  R('T1-02', 'Type 1', 'PCC under footing', 'area(F) × pcc_footing, F = LB lines buffered W/2 (union).'),
  R('T1-03', 'Type 1', 'Strip footing concrete', 'area(F) × D.'),
  R('T1-04', 'Type 1', 'Footing formwork', 'perimeter(F) × D.'),
  R('T1-05', 'Type 1', 'RCC wall concrete', 'area(WL) × 1500, WL = LB lines buffered t/2.'),
  R('T1-06', 'Type 1', 'Wall formwork', 'perimeter(WL) × 1500.'),
  R('T1-07', 'Type 1', 'Backfill', 'T1-01 − T1-02 − T1-03 − area(WL) × (1500 − plinth).'),
  R('T1-08', 'Type 1', 'Plinth fill', 'area(S) × (plinth − 150 − subbase), S = footprint − WL.'),
  R('T1-09', 'Type 1', 'Sub-base', 'area(S) × subbase_thk.'),
  R('T1-10', 'Type 1', 'PCC under slab', 'area(S) × pcc_slab.'),
  R('T1-11', 'Type 1', 'DPM', 'area(S).'),
  R('T1-12', 'Type 1', 'Slab on grade', 'area(S) × 150.'),
  R('T1-13', 'Type 1', 'Waterproofing', 'External wall face below NGL: external LB length × (1500 − plinth).'),
  R('T1-14', 'Type 1', 'Anti-termite', 'area(E) + area(S).'),
  R('T1-15', 'Type 1', 'Reinforcement', 'RB-01 footing, RB-03 wall, RB-02 slab; reported per element and diameter.'),
  R('T2-R1', 'Type 2 layout', 'Nodes', 'Corners, free ends, T-junctions and crossings of the LB line graph.'),
  R('T2-R2', 'Type 2 layout', 'Pads at nodes', 'A pad and stub column at every node.'),
  R('T2-R3', 'Type 2 layout', 'Intermediates', 'n = ceil(L / P.pad_spacing_max) − 1 intermediate pads at equal spacing along each edge.'),
  R('T2-R4', 'Type 2 layout', 'Merge', 'Pads closer than P.pad_spacing_min are merged.'),
  R('T2-R5', 'Type 2 layout', 'Beams', 'A ground beam along every edge between consecutive nodes.'),
  R('T2-R6', 'Type 2 layout', 'Tie beams', 'When the gap between perpendicular connections exceeds P.tie_beam_max, a tie beam runs to the nearest parallel line (a pad is added if none is within P.node_snap_tol).'),
  R('T2-R7', 'Type 2 layout', 'Clear spans', 'Beam lengths are measured between column faces.'),
  R('T2-01', 'Type 2', 'Pad excavation', 'N × (L + 600) × (B + 600) × (1500 + D + pcc − plinth).'),
  R('T2-02', 'Type 2', 'Beam trench', 'Σclear × (300 + 600) × (D_beam − plinth + pcc).'),
  R('T2-03', 'Type 2', 'PCC pads', 'N × L × B × pcc.'),
  R('T2-04', 'Type 2', 'PCC beams', 'Σclear × 300 × pcc.'),
  R('T2-05', 'Type 2', 'Pad concrete', 'N × L × B × D.'),
  R('T2-06', 'Type 2', 'Pad formwork', 'N × 2(L + B) × D.'),
  R('T2-07', 'Type 2', 'Column concrete', 'N × 0.35² × (1500 − D_beam).'),
  R('T2-08', 'Type 2', 'Column formwork', 'N × 4 × 0.35 × (1500 − D_beam).'),
  R('T2-09', 'Type 2', 'Beam concrete', '(Σclear + N_joints × 0.35) × 0.30 × D_beam.'),
  R('T2-10', 'Type 2', 'Beam formwork', 'Σclear × 2 × D_beam.'),
  R('T2-11', 'Type 2', 'Backfill', 'T2-01 + T2-02 − (concrete + PCC below NGL).'),
  R('T2-12', 'Type 2', 'Slab works', 'T2-12…T2-17 as T1-08…T1-14 with S = footprint − beam plan area.'),
  R('T2-18', 'Type 2', 'Reinforcement', 'RB-01 pads, RB-05 columns, RB-04 beams, RB-02 slab.'),
  R('T3-R3', 'Type 3', 'Bearing check', 'w = storeys × P.line_load_per_storey; w / 0.3 > P.soil_bearing → F-BEARING.'),
  R('T3-01', 'Type 3', 'Excavation', 'area(Ex) × max(0, 600 − plinth + pcc), Ex = beam lines buffered 150 + work_space.'),
  R('T3-02', 'Type 3', 'PCC under beams', 'area(B) × pcc_footing, B = beam lines buffered 150.'),
  R('T3-03', 'Type 3', 'Beam concrete', 'area(B) × (600 − 150).'),
  R('T3-04', 'Type 3', 'Slab', 'area(S) × 150, S = footprint.'),
  R('T3-05', 'Type 3', 'Edge formwork', 'perimeter(S) × 600.'),
  R('T3-06', 'Type 3', 'Plinth fill', '(S − B) × (plinth − 150 − subbase).'),
  R('T3-07', 'Type 3', 'Slab works', 'Sub-base, PCC, DPM and anti-termite on S − B.'),
  R('T3-08', 'Type 3', 'Reinforcement', 'RB-02 slab, RB-04 beams.'),
  R('RB-01', 'Reinforcement', 'Footings', 'As = 0.0018 × gross each way, bottom; spacing ≤ min(3h, 450) (ACI 318).'),
  R('RB-02', 'Reinforcement', 'Slab', 'As = 0.0018 × gross, single layer each way.'),
  R('RB-03', 'Reinforcement', 'RCC wall', 'Two layers; vertical ρ 0.0012, horizontal ρ 0.0020, split per face, spacing ≤ P.wall_bar_spacing_max.'),
  R('RB-04', 'Reinforcement', 'Beams', 'Top and bottom As ≥ (1.4 / fy) × b × d, min 2 bars; links ≤ d/2.'),
  R('RB-05', 'Reinforcement', 'Columns', '1 % of gross, min 4 bars; ties ≤ min(16 db, 48 dt, least width).'),
  R('BQ-01', 'BOQ', 'Row fields', 'boq_code, section, description, element_type, band, unit, net_qty, waste_pct, gross_qty, rule_ids, element_ids, flags.'),
  R('BQ-02', 'BOQ', 'Rebar rows', 'Reinforcement is reported per element and per bar diameter.'),
  R('BQ-03', 'BOQ', 'Rounding', 'm³ and m² to 2 dp, kg whole, only at output.'),
  R('BQ-05', 'BOQ', 'Header', 'Project, foundation type, band, parameter version, date and approver on every export.'),
  R('VC-01', 'Validation', 'Steel ratio', 'kg/m³ per element within ±30 % of the default schedule, else F-RATIO.'),
  R('VC-02', 'Validation', 'Inside footprint', 'Every foundation element lies within the footprint plus its projection.'),
  R('VC-03', 'Validation', 'Support', 'Every load-bearing line is supported along its full length.'),
  R('VC-04', 'Validation', 'Closure', 'Concrete + PCC below NGL + backfill = excavation within 1 %.'),
]

export const ENGINE_RULE_INDEX = new Map(ENGINE_RULES.map((r) => [r.id, r]))

export function engineRulesFor(ids: string[]): EngineRule[] {
  const out: EngineRule[] = []
  for (const raw of ids) {
    const id = raw.toUpperCase().trim()
    const hit = ENGINE_RULE_INDEX.get(id)
    if (hit) out.push(hit)
    else for (const r of ENGINE_RULES) if (r.id.startsWith(`${id}-`) || r.module.toUpperCase() === id) out.push(r)
  }
  return [...new Set(out)]
}
