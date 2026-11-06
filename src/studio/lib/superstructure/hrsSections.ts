/**
 * Hot rolled steel designations offered as a pick-list for HRS markups.
 * UB / UC / PFC designations carry their nominal mass per metre as the last number
 * (BS 4-1), so the kg/m shown is read from the name, never guessed. It is labelled
 * "nominal" and the engineer can overwrite it with the supplier value.
 */

export type HrsFamily = 'UB' | 'UC' | 'PFC'

export interface HrsSection {
  designation: string
  family: HrsFamily
  /** Nominal mass per metre from the designation, kg/m. */
  kgPerM: number
}

const UB = [
  '127x76x13',
  '152x89x16',
  '178x102x19',
  '203x102x23',
  '203x133x25',
  '203x133x30',
  '254x102x22',
  '254x102x25',
  '254x102x28',
  '254x146x31',
  '254x146x37',
  '254x146x43',
  '305x102x25',
  '305x102x28',
  '305x102x33',
  '305x127x37',
  '305x127x42',
  '305x127x48',
  '305x165x40',
  '305x165x46',
  '305x165x54',
  '356x127x33',
  '356x127x39',
  '356x171x45',
  '356x171x51',
  '356x171x57',
  '356x171x67',
  '406x140x39',
  '406x140x46',
  '406x178x54',
  '406x178x60',
  '406x178x67',
  '406x178x74',
  '457x152x52',
  '457x152x60',
  '457x152x67',
  '457x152x74',
  '457x152x82',
  '457x191x67',
  '457x191x74',
  '457x191x82',
  '457x191x89',
  '457x191x98',
  '533x210x82',
  '533x210x92',
  '533x210x101',
  '533x210x109',
  '533x210x122',
]
const UC = ['152x152x23', '152x152x30', '152x152x37', '203x203x46', '203x203x52', '203x203x60', '203x203x71', '203x203x86', '254x254x73', '254x254x89', '254x254x107']
const PFC = ['100x50x10', '125x65x15', '150x75x18', '180x75x20', '200x75x23', '230x75x26', '260x75x28', '300x90x41', '380x100x54']

const nominal = (d: string) => Number(d.split('x').pop())

export const HRS_SECTIONS: HrsSection[] = [
  ...UB.map((d) => ({ designation: `UB ${d}`, family: 'UB' as const, kgPerM: nominal(d) })),
  ...UC.map((d) => ({ designation: `UC ${d}`, family: 'UC' as const, kgPerM: nominal(d) })),
  ...PFC.map((d) => ({ designation: `PFC ${d}`, family: 'PFC' as const, kgPerM: nominal(d) })),
]

/** Nominal kg/m when the text is a UB / UC / PFC designation (either "x" or "×"), else null. */
export function nominalKgPerM(section: string | null | undefined): number | null {
  if (!section) return null
  const m = /^\s*(UB|UC|PFC|UKB|UKC|UKPFC)\s*(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(section)
  return m ? Number(m[4]) : null
}

/** Normalise "ub 305×165×40" to the library spelling when it matches, else return the text as typed. */
export function normaliseSection(section: string): string {
  const m = /^\s*(UB|UC|PFC)\s*(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(section)
  if (!m) return section.trim()
  return `${m[1].toUpperCase()} ${m[2]}x${m[3]}x${m[4]}`
}
