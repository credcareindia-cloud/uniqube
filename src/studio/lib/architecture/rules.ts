import type { EngineRule } from '../foundation/ruleText'

const R = (id: string, module: string, name: string, logic: string): EngineRule => ({ id, module, name, logic })

export const ARCH_RULES: EngineRule[] = [
  R('AR-01', 'Source', 'Measured plan', 'Architecture reads the sub structure walls, openings and rooms. With no sub structure result the run stops. An open sub structure review gate leaves the quantities provisional and does not stop the bill.'),
  R('AR-02', 'Height', 'Floor to floor', 'Wall height is the structure floor-to-floor height of that level. A missing height stops that level. No default storey height is applied.'),
  R('AR-03', 'Walls', 'Outside face', 'External wall area is the outside face: external length times floor-to-floor height, summed over every measured level.'),
  R('AR-04', 'Walls', 'Inside faces', 'Partition area is both faces of each internal wall, plus one inside face of each external wall. That line is gross. Net internal faces deduct each opening once on an external wall and twice on an internal wall, and the net line is omitted until the door and window heights are set.'),
  R('AR-05', 'Openings', 'Count from the plan', 'A door, window or gap is the opening already read on the wall. Counts are repeated once for each measured floor. With no measured floor the counts are omitted. The upper floor plan is the ground plan until a different plan is read.'),
  R('AR-06', 'Openings', 'Heights', 'Door area uses the door height the engineer enters. Window area uses the window height. A missing height keeps the count and stops the area. A gap is listed and is not billed as a door or a window.'),
  R('AR-07', 'Floors', 'Occupied area', 'Occupied floor area is habitable, wet, corridor and store rooms, summed and repeated per measured floor. Stairs, lifts, shafts and voids are excluded. With no rooms, the footprint is used and marked as such.'),
  R('AR-08', 'Wet areas', 'Measured rooms only', 'Wet area is the sum of rooms already classed as wet. No wet rooms means the waterproofing line is omitted, not entered as zero.'),
  R('AR-09', 'Facade', 'Net external', 'Facade area is the outside wall area minus doors and windows on external walls. It is omitted while an external opening height is missing, so gross wall is not issued as net facade.'),
  R('AR-10', 'Parapet', 'Structure height', 'Parapet area is the structure parapet length times its height. No parapet height means the line is omitted.'),
  R('AR-11', 'Ceiling', 'Match the floor', 'Ceiling area matches the occupied floor area of AR-07, one ceiling per measured floor. It is not a second measurement.'),
  R('AR-13', 'Skirting', 'Inside perimeter', 'Skirting length is both sides of each internal wall plus the inside of each external wall, repeated per measured floor, minus the door widths on the plan. Unmarked gaps are not deducted. No measured floor means the line is omitted.'),
  R('AR-12', 'Gate', 'Stop on a gap', 'A red flag blocks approval. Amber marks a repeated plan or an estimated basis. Changing a height re-opens the gate.'),
  R('AR-14', 'Openings', 'Leaf from width', 'A door under 1200 mm is a single leaf. 1200 mm and over is billed as a wide or double door. A window under 1200 mm is narrow, 1200 to 1800 mm is typical, and 1800 mm and over is wide.'),
  R('AR-15', 'Build-up', 'External wall', 'The external wall takes 12 mm cement board and a vapour barrier on the net facade, 150 mm foil-faced rockwool through the full outside face, and 12.5 mm plus 15 mm fire-rated gypsum on the inside face. These lines follow the measured wall, they are not a second measurement.'),
  R('AR-16', 'Build-up', 'Partitions', 'Each internal partition takes 15 mm fire-rated gypsum on both faces and 150 mm rockwool in the cavity. Length times floor-to-floor height, one copy per measured floor.'),
  R('AR-17', 'Build-up', 'Wet rooms', 'A room already classed as wet takes floor waterproofing, 12 mm cement board and 12 mm moisture-resistant gypsum on the room perimeter, and a moisture-resistant ceiling. Dry rooms take the fire-rated gypsum ceiling. No wet room means those lines are omitted.'),
]
