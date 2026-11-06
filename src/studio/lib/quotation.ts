import type { SystemId } from './elements'
import { roundedBoq } from './foundation/engine'
import { foundationTypeName } from './foundation/rules'
import type { EngineResult } from './foundation/types'

/** Descriptions from the UNIQUBE quotation (shell and core). Amounts are never stored here. */
const OFFER_COPY: Partial<Record<SystemId, string>> = {
  steel:
    'Steel Structural System – Supply, fabrication, delivery and installation of the complete Light Gauge Steel (LGS) and Hot Rolled Steel (HRS) structural framing system, including anchors, connectors, brackets, fasteners and all associated components required for the complete structural works in accordance with the Contract Drawings, Specifications and Approved Shop Drawings.',
  roof:
    'Roofing System – Supply and installation of the complete insulated roofing system comprising aluminum sandwich roof panels of 100 mm thick, flashings, capping, trims, closures, sealants, fixing accessories and all associated components required to provide a complete weatherproof roofing system.',
  wall:
    'External Wall System – Supply and installation of the complete external wall system comprising of 12 mm cement boards, vapour barrier and internal gypsum boards of 12 mm and 15 mm, fixing accessories, sealants and all associated components required to achieve the specified structural, thermal and weather performance. (steel structure considered separately) Internal Partition Wall System – Supply and installation of complete internal partition wall system comprising steel framing, 12 mm fire-rated gypsum boards on both sides, insulation, fixing accessories, joint treatment and all associated components complete. (steel structure considered separately)',
  ceiling:
    'Ceiling System – Supply and installation of complete suspended ceiling system comprising fire-rated and moisture-resistant gypsum boards of 12 mm including accessories, joint treatment and all associated works complete. (steel structure considered separately)',
  openings:
    'Aluminum Doors & Windows – Supply, fabrication, glazing, delivery and installation of complete aluminum doors, windows, ironmongery, sealants, glazing accessories and all associated components in accordance with the approved drawings and specifications. Non-thermal aluminum profiles with double glass: 6 mm low performance glass + 12 mm air spacer + 6 mm clear tempered glass.',
  mep:
    'MEP Installation Works – Installation of Client-supplied MEP first fix elements on panels/modules including unloading, handling, positioning, fixing, coordination with other trades and all associated installation works required for complete installation.',
}

const OFFER_ORDER: SystemId[] = ['steel', 'roof', 'wall', 'ceiling', 'floor', 'openings', 'mep', 'additional', 'foundation']

export const PAYMENT_TERMS = [
  '10% on order confirmation',
  '20% on submission of the design drawings',
  '30% on design approvals / commencement of production',
  '40% upon progress of work.',
]

/** Standard inclusion list. `included` matches the quotation template. */
export const INCLUSIONS: Array<{ description: string; included: boolean }> = [
  ['HRS - Supply and installation', true],
  ['LGS frames - Supply and installation', true],
  ['Supply and installation. External finish: 12 mm thick cement board. Internal finish: 12 and 15 mm thick gypsum board. Infill: rockwool insulation', true],
  ['Ceiling - Supply and installation of gypsum boards', true],
  ['Aluminium sandwich panel for roofing', true],
  ['MEP works – material supply', false],
  ['MEP works – first fix installation on LGS walls', true],
  ['Aluminum doors & windows', true],
  ['Foundation works', false],
  ['Block works', false],
  ['Any other type of acoustic insulation', false],
  ['Concrete or screed works', false],
  ['Waterproofing', false],
  ['Finishing works – tiling, painting etc.', false],
  ['External envelope finish', false],
  ['Wooden / steel doors', false],
  ['Sanitary wares - supply and installation', false],
  ['HVAC: ducts, insulation, units, refrigerant pipe', false],
  ['Carpentry or joinery works', false],
  ['Furniture, fixtures & equipment (FF&E).', false],
  ['Lighting fixtures', false],
  ['External & site materials', false],
  ['Manholes, drainage pipes.', false],
  ['Utility connection materials (water, sewer, electrical).', false],
  ['Pavers, stones, asphalt, parking materials.', false],
  ['Boundary walls, fencing & landscaping materials', false],
  ['Heavy equipment like cranes, lifters etc.', false],
  ['Scaffolding', false],
  ['Storage area', false],
  ['Electricity, water to the site', false],
  ['Dubai Municipality approvals', false],
  ['Test reports, certifications not related to supplied materials', false],
].map(([description, included]) => ({ description: description as string, included: included as boolean }))

export type QuoteRow = {
  no: string
  description: string
  qty: number | null
  unit: string
  unitAmount: number | null
  totalAmount: number | null
  measured: boolean
}

export type ShareQuotation = {
  date: string
  to: string
  project: string
  location: string
  building: string
  subject: string
  currency: string
  total: number | null
  rows: QuoteRow[]
  approver: string
  foundationNote: string
  fileSlug: string
}

function money(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function qtyText(value: number, unit: string) {
  if (unit === 'kg') return Math.round(value).toLocaleString('en-US')
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function unitLabel(unit: string) {
  if (unit === 'm3') return 'm³'
  if (unit === 'm2') return 'm²'
  return unit
}

function stamp(iso: string | null) {
  const date = iso ? new Date(iso) : new Date()
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()}`
}

export function buildShareQuotation(input: {
  projectName: string
  client: string
  location: string
  buildingType: string
  currency: string
  approvedAt: string | null
  approver: string | null
  priced: Array<{ system: SystemId; text: string; amount: number }>
  foundation: EngineResult | null
}): ShareQuotation {
  const bySystem = new Map(input.priced.filter((row) => row.amount > 0).map((row) => [row.system, row]))
  const rows: QuoteRow[] = []
  OFFER_ORDER.forEach((id) => {
    const line = bySystem.get(id)
    if (!line) return
    rows.push({
      no: String(rows.length + 1),
      description: OFFER_COPY[id] ?? line.text,
      qty: 1,
      unit: 'LS',
      unitAmount: line.amount,
      totalAmount: line.amount,
      measured: false,
    })
  })
  const foundationRows = input.foundation ? roundedBoq(input.foundation) : []
  for (const row of foundationRows) {
    rows.push({
      no: row.boqCode,
      description: `${row.section} – ${row.description}`,
      qty: row.grossQty,
      unit: unitLabel(row.unit),
      unitAmount: null,
      totalAmount: null,
      measured: true,
    })
  }
  const total = rows.some((row) => row.totalAmount != null) ? rows.reduce((sum, row) => sum + (row.totalAmount ?? 0), 0) : null
  const building = input.buildingType || input.projectName || 'the building'
  const result = input.foundation
  const foundationNote = result
    ? `Type ${result.foundationType} — ${foundationTypeName(result.foundationType)} · band ${result.band} · ${result.level.drawingNo ?? 'plan'} p${result.level.sourcePage} · ${result.scale.label} · ${result.parameterSetVersion}`
    : 'No foundation quantity schedule on this approval.'
  const slug = (input.projectName || 'quotation').replace(/[^\w-]+/g, '_')
  return {
    date: stamp(input.approvedAt),
    to: input.client.trim(),
    project: input.projectName.trim() || 'Project',
    location: input.location.trim(),
    building,
    subject: 'Proposal - Supply and installation of Steel Structural building (Shell and Core)',
    currency: input.currency || 'AED',
    total,
    rows,
    approver: input.approver?.trim() || '—',
    foundationNote,
    fileSlug: slug,
  }
}

function esc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function amountCell(value: number | null) {
  return value == null ? '' : money(value)
}

export function quotationInnerHtml(quote: ShareQuotation, logoSrc = '/UniQube_Logo.png') {
  const place = quote.location ? ` located in ${esc(quote.location)}` : ''
  const address = quote.location || '—'
  const offerRows = quote.rows
    .map(
      (row) => `<tr>
        <td>${esc(row.no)}</td>
        <td>${esc(row.description)}</td>
        <td class="num">${row.qty == null ? '' : esc(row.unit === 'LS' ? '1' : qtyText(row.qty, row.unit))}</td>
        <td>${esc(row.unit)}</td>
        <td class="num">${esc(amountCell(row.unitAmount))}</td>
        <td class="num">${esc(amountCell(row.totalAmount))}</td>
      </tr>`,
    )
    .join('')
  const totalRow =
    quote.total == null
      ? ''
      : `<tr class="total"><td colspan="5">TOTAL AMOUNT EXCLUDING VAT</td><td class="num">${esc(quote.currency)} ${esc(money(quote.total))}</td></tr>`
  const inclusions = INCLUSIONS.map(
    (row, index) => `<tr>
      <td>${index + 1}</td>
      <td>${esc(row.description)}</td>
      <td class="tick">${row.included ? '√' : ''}</td>
      <td class="tick">${row.included ? '' : '√'}</td>
    </tr>`,
  ).join('')
  const terms = [
    'The price shown on this quotation applies to the enquired quantities. In case of any change of quantities, UNIQUBE has the right to revise the price.',
    'Any other scope of work not quoted in the BOQ will be considered extra.',
    'Any foundation, laboratory testing, third party inspection and authority approvals are excluded, except measured foundation quantities listed in the bill where a unit amount is blank.',
    'Any CCTV, IT/cabling, FLS system, or any civil work is excluded.',
    'Any electrical equipment is excluded.',
    'Kitchen cabinets, wardrobes, vanities and all joinery works are excluded.',
    'Site office, rest area, power and water shall be provided by the main contractor free of charge.',
    'Equipment on the roof is not considered in the design and no provision is included.',
    'Any third-party design review is excluded.',
    'This offer is prepared based on the drawings received for this project. If any design changes, a variation will be applicable.',
    'VAT is excluded.',
  ]
  const scope = [
    ['Superstructure – phased execution', 'Our scope includes installation of all load-bearing walls, floor truss, and external cement boards.'],
    ['', 'First-fix MEP services will be coordinated through wall framing.'],
    ['', 'Final MEP installation shall be completed by the MEP contractor.'],
    ['', 'Internal finishing boards will be fixed only after MEP completion and necessary approvals.'],
    ['', 'All brickwork is excluded from our scope.'],
    ['Flooring works (not in our scope)', 'Tiling, screeding, and waterproofing on the floor area will be by the main contractor.'],
    ['Roofing works', 'Our scope includes installation of roof trusses and aluminum sandwich panel of 100 mm thick.'],
    ['Ceiling works', 'Our scope includes installation of gypsum board ceiling with necessary framings and fittings.'],
    ['Aluminum works', 'Our scope includes installation of polyester powder coated (PEF) non-thermal aluminum profiles with double glazed windows, and external and internal doors infilled with aluminum sandwich panels.'],
    ['Material transportation', quote.location ? `Transportation of all materials is included up to ${quote.location} only.` : 'Transportation of all materials is included up to the agreed delivery point only.'],
    ['', 'Transportation beyond that point is excluded and is arranged by the main contractor.'],
    ['Site logistics', 'Transportation, food, and accommodation for site workers shall be provided by the main contractor.'],
  ]
  return `
    <header class="uq-head">
      <div>
        <img class="uq-logo" src="${esc(logoSrc)}" alt="UNIQUBE" />
        <p>UNIQUBE Unitized Building System<br>Post Box No. 42642P<br>Hamriyah Freezone<br>Sharjah, United Arab Emirates</p>
      </div>
      <p>Date: ${esc(quote.date)}</p>
    </header>
    <p>To: ${esc(quote.to)}</p>
    <p>Project: ${esc(quote.project)}</p>
    <p>Subject: ${esc(quote.subject)}</p>
    <p>Dear Sir,</p>
    <p>We are pleased to submit this proposal for ${esc(quote.building)} for the project${place}. This document outlines the scope of work, estimated costs, and terms for the project. We are committed to delivering the highest quality service and ensuring a successful outcome for your project.</p>
    ${quote.total == null ? '<p><strong>TOTAL AMOUNT (EXCLUDING VAT): not stated. Measured lines below have no selling rate on this estimate.</strong></p>' : `<p><strong>TOTAL AMOUNT (EXCLUDING VAT)-: ${esc(quote.currency)}. ${esc(money(quote.total))}</strong></p>`}
    <p class="sign">Yours Faithfully</p>
    <p class="sign-name">Arbab Khan<br>CEO</p>
    <h2>1. Project Overview</h2>
    <p>Project Name: ${esc(quote.building)}</p>
    <p>Project Address: ${esc(address)}</p>
    <p>This proposal includes the Supply and installation of Steel Structural building (Shell and Core).</p>
    <h2>2. Estimated Project Costs</h2>
    <p class="note">${esc(quote.foundationNote)}. Approved by ${esc(quote.approver)}. Lines with a blank unit amount are measured quantities and are not added into the total.</p>
    <table class="uq-table">
      <thead>
        <tr><th>Sl No.</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Amount (${esc(quote.currency)})</th><th>Total Amount (${esc(quote.currency)})</th></tr>
      </thead>
      <tbody>
        ${offerRows || '<tr><td colspan="6">No bill lines on this approval.</td></tr>'}
        ${totalRow}
      </tbody>
    </table>
    <h2>3. Payment Terms</h2>
    <ul>${PAYMENT_TERMS.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
    <h2>4. Terms and Conditions</h2>
    ${terms.map((line) => `<p>${esc(line)}</p>`).join('')}
    ${scope.map(([title, line]) => `${title ? `<p><strong>${esc(title)}</strong></p>` : ''}<p>${esc(line)}</p>`).join('')}
    <h2>5. Quote Inclusion &amp; Exclusion List</h2>
    <table class="uq-table">
      <thead><tr><th>Sl. No.</th><th>Description</th><th>Included</th><th>Excluded</th></tr></thead>
      <tbody>${inclusions}</tbody>
    </table>
    <p>Thank you for considering UNIQUBE for your contracting needs.</p>
    <p>We look forward to working with you on this exciting project.</p>
  `
}

const WORD_STYLE = `
  body { font-family: Calibri, sans-serif; font-size: 11pt; color: #1c1c1c; }
  h1 { font-size: 16pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 16pt 0 6pt; border-bottom: 1px solid #1c1c1c; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #666; padding: 4pt 6pt; vertical-align: top; }
  th { background: #f1f1f1; }
  td.num, th:nth-child(n+3) { text-align: right; }
  tr.total td { font-weight: bold; }
  .sign { margin-top: 18pt; }
  .sign-name { margin-top: 28pt; }
  .uq-logo { height: 72px; width: auto; }
`

async function logoDataUrl() {
  const response = await fetch('/UniQube_Logo.png')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return `data:image/png;base64,${btoa(binary)}`
}

export async function quotationWordHtml(quote: ShareQuotation) {
  const logo = await logoDataUrl().catch(() => '/UniQube_Logo.png')
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>UNIQUBE quotation ${esc(quote.project)}</title><style>${WORD_STYLE}</style></head>
<body>${quotationInnerHtml(quote, logo)}</body>
</html>`
}

function xml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function cell(value: string | number | null, kind: 'String' | 'Number') {
  if (value == null || value === '') return '<Cell><Data ss:Type="String"></Data></Cell>'
  return `<Cell><Data ss:Type="${kind}">${kind === 'Number' ? value : xml(String(value))}</Data></Cell>`
}

function row(values: Array<string | number | null>, kinds: Array<'String' | 'Number'>) {
  return `<Row>${values.map((value, index) => cell(value, kinds[index] ?? 'String')).join('')}</Row>`
}

export function quotationWorkbookXml(quote: ShareQuotation) {
  const header = row(['Sl No.', 'Description', 'Qty', 'Unit', `Unit Amount (${quote.currency})`, `Total Amount (${quote.currency})`], ['String', 'String', 'String', 'String', 'String', 'String'])
  const body = quote.rows
    .map((line) =>
      row(
        [line.no, line.description, line.qty, line.unit, line.unitAmount, line.totalAmount],
        ['String', 'String', 'Number', 'String', 'Number', 'Number'],
      ),
    )
    .join('')
  const total = quote.total == null ? '' : row(['', 'TOTAL AMOUNT EXCLUDING VAT', '', '', '', quote.total], ['String', 'String', 'String', 'String', 'String', 'Number'])
  const inclusionHeader = row(['Sl. No.', 'Description', 'Included', 'Excluded'], ['String', 'String', 'String', 'String'])
  const inclusionBody = INCLUSIONS.map((line, index) => row([index + 1, line.description, line.included ? '√' : '', line.included ? '' : '√'], ['Number', 'String', 'String', 'String'])).join('')
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="BOQ"><Table>${header}${body}${total}</Table></Worksheet>
<Worksheet ss:Name="Inclusions"><Table>${inclusionHeader}${inclusionBody}</Table></Worksheet>
</Workbook>`
}

export function downloadText(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
