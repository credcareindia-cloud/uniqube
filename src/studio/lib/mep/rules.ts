import type { EngineRule } from '../foundation/ruleText'

const R = (id: string, module: string, name: string, logic: string): EngineRule => ({ id, module, name, logic })

export const MEP_RULES: EngineRule[] = [
  R('EL-01', 'Drawings', 'Classify the sheet', 'A lighting or ceiling sheet is the Ceiling module. A power sheet is the Wall module. An underground or duct sheet is Underground. A sheet with no readable title is flagged and not treated as its own floor.'),
  R('EL-02', 'Legend', 'Confirm the symbol', 'A repeated text tag becomes a fixture only with its code. The description stays open until the engineer matches it to the legend. An unknown symbol is not given a guessed name.'),
  R('EL-03', 'Fixtures', 'Count separately', 'Fixture counts stay separate from material quantities and from the material allowance.'),
  R('EL-04', 'Wall', 'Back box', 'Every wall fixture gets a back box. Fixtures that share a multi-gang box count as one assembly, not one box each.'),
  R('EL-05', 'Wall', 'Vertical conduit', 'Only the drop from the fixture to the ceiling route is in the Wall bill. The default is 3 m per fixture and is marked Estimated. Horizontal conduit is not counted here.'),
  R('EL-06', 'Wall', 'Accessories per 3 m', 'Each 3 m in-wall run starts at 3 supports, 2 couplings, 2 bends and 2 connectors. A different drop length scales that set. The figures stay editable.'),
  R('EL-07', 'Ceiling', 'Horizontal conduit', 'Where the route is not measured, length is fixture count times the assumed run, default 4 m, and is marked Estimated. Vertical drops already in the Wall bill are not counted again.'),
  R('EL-08', 'Ceiling', 'Accessories per 4 m', 'Each 4 m ceiling run starts at 2 bends, 2 couplings, 2 connectors, 2 junction boxes and 4 supports.'),
  R('EL-09', 'Underground', 'In scope switch', 'Underground is off until the project turns it on. With it off, underground lines are left out. With it on, a missing length is a missing input, not a guessed length.'),
  R('EL-10', 'Allowance', '20% once', 'Extra quantity is base quantity times the allowance, default 20%. Final quantity is base plus extra, rounded up to the next whole unit for materials. Fixture counts are not increased. The allowance is applied once.'),
  R('EL-11', 'Trace', 'Label the basis', 'Every line is Counted, Estimated, Calculated or Manual. Estimated lines stay visible at approval.'),
  R('ME-01', 'Mechanical', 'Scope', 'Mechanical is on until the engineer turns it off. With it on, a missing occupied floor area or a missing cooling rate stops the run. The area comes from the architecture bill.'),
  R('ME-02', 'Mechanical', 'Cooling', 'Cooling capacity is occupied floor area times the engineer’s W/m², reported in kW. No rate is assumed. The electrical allowance is not applied to the capacity.'),
  R('ME-03', 'Mechanical', 'Fresh air', 'Fresh air is occupancy times L/s per person. Either figure missing omits the line. Occupancy is not taken from the room count.'),
  R('ME-04', 'Mechanical', 'Exhaust', 'Wet-area exhaust is wet floor area times air changes per hour times the mean wall height, in m³/h. A missing air-change rate, wet area or wall height omits the line.'),
  R('PL-01', 'Plumbing', 'Scope', 'Plumbing is on until the engineer turns it off. Fittings are counted from wet rooms on the plan. A typed count replaces the plan count for that fitting.'),
  R('PL-02', 'Plumbing', 'Fittings', 'WC, basin, shower and sink stay as the counts from the plan or the typed override. The allowance is not applied to fitting counts.'),
  R('PL-03', 'Plumbing', 'Pipes', 'Waste, cold water, hot water and the soil stack are Estimated from the fitting count until a measured route is entered.'),
  R('PL-04', 'Gate', 'One approval', 'Electrical, mechanical, plumbing and fire share one review gate. Any red flag, including an empty mechanical or plumbing input that is still in scope, blocks approval.'),
  R('ME-05', 'Mechanical', 'Units', 'An occupied room of 4 m² or more takes indoor units at one per 35 m². Wet rooms take an extract fan. Outdoor units are one per three indoor units, placed at the building corners.'),
  R('ME-06', 'Mechanical', 'Routes', 'Duct is 6 m per indoor unit and refrigerant pipe is 8 m per indoor unit, both Estimated until a measured route is entered.'),
  R('FA-01', 'Fire', 'Scope', 'Fire is on until the engineer turns it off. Smoke detectors sit in occupied rooms, sounders on corridors, and call points and extinguishers on stairs and at two corners of the plan.'),
  R('FA-02', 'Fire', 'Cable', 'Alarm cable is 8 m per device and is marked Estimated until a measured loop is entered.'),
]
