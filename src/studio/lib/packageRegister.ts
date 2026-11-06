import seed from '../data/packageRegister.json'
import { apiJson } from './api'

export const SQFT_PER_M2 = 10.7639

export interface WorkPackage {
  id: string
  code: string
  name: string
  unit: string
  costAed: number | null
  offerAed: number | null
  description: string
}

export interface LibraryItem {
  id: string
  group: string
  description: string
  unit: string
  rateAed: number | null
  labourPerSqft: number | null
  labourPerM2: number | null
  notes: string
}

export interface LabourRate {
  id: string
  description: string
  unit: string
  rateAed: number | null
  perM2: number | null
  basis: string
}

export interface SubcontractRate {
  id: string
  trade: string
  description: string
  unit: string
  rateAed: number | null
  qty: number | null
  basis: string
}

export interface AssemblyPart {
  name: string
  amountAed: number | null
}

export interface Assembly {
  id: string
  code: string
  description: string
  system: string
  widthMm: number | null
  heightMm: number | null
  areaM2: number | null
  unit: string
  qty: number | null
  parts: AssemblyPart[]
  totalAed: number | null
}

export interface PackageRegister {
  source: string
  currency: string
  packages: WorkPackage[]
  library: LibraryItem[]
  labour: LabourRate[]
  subcontract: SubcontractRate[]
  assemblies: Assembly[]
}

export const PACKAGE_SEED = seed as PackageRegister

export function assemblyTotal(parts: AssemblyPart[]): number {
  return Math.round(parts.reduce((sum, part) => sum + (part.amountAed ?? 0), 0) * 100) / 100
}

export function asPackageRegister(value: unknown): PackageRegister | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Partial<PackageRegister>
  if (!Array.isArray(body.packages) || !Array.isArray(body.library) || !Array.isArray(body.labour)) return null
  return {
    source: typeof body.source === 'string' ? body.source : PACKAGE_SEED.source,
    currency: 'AED',
    packages: body.packages as WorkPackage[],
    library: body.library as LibraryItem[],
    labour: body.labour as LabourRate[],
    subcontract: Array.isArray(body.subcontract) ? (body.subcontract as SubcontractRate[]) : [],
    assemblies: Array.isArray(body.assemblies) ? (body.assemblies as Assembly[]) : [],
  }
}

export async function loadPackageRegister(): Promise<PackageRegister> {
  const remote = await apiJson<unknown>('/api/package-register')
  return asPackageRegister(remote) ?? PACKAGE_SEED
}

export async function savePackageRegister(register: PackageRegister) {
  await apiJson('/api/package-register', { method: 'PUT', body: JSON.stringify(register) })
}
