import { screwRate, sealantMetresPerCartridge } from '../src/studio/lib/architecture/calc.ts'
import { ARCH_SCREW_RATES, ARCH_SPEC, ARCH_SPEC_LABEL } from '../src/studio/lib/architecture/spec.ts'
import { runWorkedExample } from '../src/studio/lib/architecture/workedExample.ts'

const failures: string[] = []
const close = (a: number, b: number) => Math.abs(a - b) < 0.00011

const expected = ARCH_SPEC.worked_example.results
const actual = runWorkedExample()
for (const want of expected) {
  const got = actual.find((line) => line.item === want.item)
  if (!got) {
    failures.push(`${want.item}: not produced`)
    continue
  }
  const checks: Array<[string, number, number]> = [
    ['net', got.net, want.net],
    ['wastage', got.wastagePct, want.wastage_pct],
    ['gross', got.gross, want.gross],
    ['purchase', got.purchase, want.purchase_quantity],
  ]
  for (const [field, g, w] of checks) {
    if (!close(g, w)) failures.push(`${want.item}: ${field} ${g}, expected ${w}`)
  }
}

for (const row of ARCH_SCREW_RATES) {
  const got = screwRate({ widthMm: row.sheet_width_mm, lengthMm: row.sheet_length_mm }, row.dimension_across_supports, row.support_spacing_mm, row.screw_spacing_mm)
  if (got.perSheet !== row.screws_per_sheet || got.ratePerM2 !== row.rate_per_m2) {
    failures.push(`DP-01 ${row.board} at ${row.support_spacing_mm} mm: ${got.perSheet}/sheet ${got.ratePerM2}/m2, expected ${row.screws_per_sheet}/sheet ${row.rate_per_m2}/m2`)
  }
}

if (sealantMetresPerCartridge() !== 12) failures.push(`DP-06: ${sealantMetresPerCartridge()} m per cartridge, expected 12`)

console.log(ARCH_SPEC_LABEL)
console.log(`Worked example: ${expected.length} lines · screw table: ${ARCH_SCREW_RATES.length} rows · sealant: 1 check`)
if (failures.length) {
  console.error(`\n${failures.length} mismatch${failures.length === 1 ? '' : 'es'}:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('All checks match the specification.')
