import React, { useEffect, useMemo, useState } from 'react';
import './ProjectBrowserPanel.css';
import { getBrowserApiBase } from '@/config/browserApi';

export type BrowserDrawing = {
  id: string;
  stableKey: string;
  kind: 'VIEW' | 'SHEET';
  name: string;
  sheetNumber?: string | null;
  viewType?: string | null;
  revitElementId?: number | null;
  hasDxf: boolean;
  hasDwg: boolean;
  sizeBytes: number;
};

export type BrowserSnapshot = {
  schemaVersion?: number;
  projectInfo?: Record<string, any>;
  levels?: Array<{ id: number; name: string; elevation: number }>;
  phases?: Array<{ id: number; name: string }>;
  links?: Array<{ id: number; name: string; status: string; path: string }>;
  views?: Array<{ id: number; name: string; viewType: string; discipline?: string }>;
  sheets?: Array<{
    id: number;
    number: string;
    name: string;
    viewports?: Array<{ viewId: number; viewName: string; viewType: string }>;
  }>;
  schedules?: Array<{
    id: number;
    name: string;
    table?: { columns: string[]; rows: string[][]; error?: string };
  }>;
  legends?: Array<{ id: number; name: string; viewType: string }>;
  viewTemplates?: Array<{ id: number; name: string; viewType: string }>;
  familiesSummary?: Record<string, number>;
};

export type BrowserSelection =
  | { kind: 'drawing'; drawing: BrowserDrawing; detail?: any }
  | { kind: 'schedule'; schedule: NonNullable<BrowserSnapshot['schedules']>[number] }
  | { kind: 'detail'; title: string; data: Record<string, any> }
  | null;

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  revisionId: string;
  onOpenDrawing: (drawing: BrowserDrawing) => void;
  onOpenSchedule: (schedule: NonNullable<BrowserSnapshot['schedules']>[number]) => void;
  onOpenDetail?: (detail: { title: string; data: Record<string, any> }) => void;
  /** Focus a panel in the 3D viewer (used by Tree → 3D list) */
  onSelectPanel?: (panel: {
    id: string;
    name: string;
    modelId?: string | null;
    expressId?: number | null;
  }) => void;
};

type TreePanel = {
  id: string;
  name: string;
  tag?: string | null;
  modelId?: string | null;
  modelName?: string | null;
  expressId?: number | null;
  mark: string;
};

type DiscKey = 'mep' | 'structure' | 'architecture';

type BimsfTreePanel = {
  key: string;
  displayName: string;
  disciplines: DiscKey[];
};

type TabId = 'tree' | 'views' | 'sheets' | 'schedules' | 'links' | 'info';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'tree', label: 'Tree', icon: 'fa-sitemap' },
  { id: 'views', label: 'Views', icon: 'fa-eye' },
  { id: 'sheets', label: 'Sheets', icon: 'fa-file-alt' },
  { id: 'schedules', label: 'Schedules', icon: 'fa-table' },
  { id: 'links', label: 'Links', icon: 'fa-link' },
  { id: 'info', label: 'Info', icon: 'fa-info-circle' },
];

/** Project Browser tree: discipline → view kinds (A → M → S) */
const PROJECT_TREE: Array<{
  id: 'structure' | 'mep' | 'architecture';
  label: string;
  children: Array<{ id: string; label: string; viewTypes: string[] }>;
}> = [
  {
    id: 'architecture',
    label: 'Architecture',
    children: [
      { id: '3d', label: '3D', viewTypes: ['ThreeD'] },
      { id: 'connectors', label: 'Connectors', viewTypes: [] },
      { id: 'elevations', label: 'Elevations', viewTypes: ['Elevation'] },
      { id: 'floor-plan', label: 'Floor plan', viewTypes: ['FloorPlan', 'EngineeringPlan'] },
      { id: 'sections', label: 'Sections', viewTypes: ['Section'] },
    ],
  },
  {
    id: 'mep',
    label: 'MEP',
    children: [
      { id: '3d', label: '3D', viewTypes: ['ThreeD'] },
      { id: 'connectors', label: 'Connectors', viewTypes: [] },
      { id: 'elevations', label: 'Elevations', viewTypes: ['Elevation'] },
      { id: 'floor-plan', label: 'Floor plan', viewTypes: ['FloorPlan', 'EngineeringPlan'] },
      { id: 'sections', label: 'Sections', viewTypes: ['Section'] },
    ],
  },
  {
    id: 'structure',
    label: 'Structure',
    children: [
      { id: '3d', label: '3D', viewTypes: ['ThreeD'] },
      { id: 'connectors', label: 'Connectors', viewTypes: [] },
      { id: 'elevations', label: 'Elevations', viewTypes: ['Elevation'] },
      { id: 'floor-plan', label: 'Floor plan', viewTypes: ['FloorPlan', 'EngineeringPlan'] },
      { id: 'sections', label: 'Sections', viewTypes: ['Section'] },
    ],
  },
];

/**
 * Tree naming convention (view name prefix):
 * - only names starting with UQ are shown
 * - UQ_S…     → Structure
 * - UQ_MEP…   → MEP
 * - UQ_A…     → Architecture (UQ_AA / UQ_ADW ACP & Door-Window views go under Floor plan)
 */
function viewNameBranch(
  name: string | undefined
): 'structure' | 'mep' | 'architecture' | null {
  const n = (name || '').trim();
  if (!/^uq/i.test(n)) return null;
  // Longer tokens first (MEP before A/S)
  if (/^uq[_-]?mep(?:[_-]|$)/i.test(n)) return 'mep';
  if (/^uq[_-]?s(?:[_-]|$)/i.test(n)) return 'structure';
  // UQ_A, UQ_AA, UQ_ADW, UQ_A-…
  if (/^uq[_-]?a/i.test(n)) return 'architecture';
  return null;
}

/** UQ_AA (ACP) and UQ_ADW (Door & Window) — listed under Architecture → Floor plan. */
function isArchitectureFloorPlanPrefix(name: string | undefined): boolean {
  const n = (name || '').trim();
  return /^uq[_-]?aa(?:[_-]|$)/i.test(n) || /^uq[_-]?adw(?:[_-]|$)/i.test(n);
}

/** Foundation → Level 1 → Level 2 → … → everything else (alpha) */
function compareTreeViewNames(a: string, b: string): number {
  const rank = (name: string): [number, number] => {
    const n = name.toLowerCase();
    if (/foundation/i.test(n)) return [0, 0];
    const m = n.match(/level\s*(\d+)/i);
    if (m) return [1, parseInt(m[1], 10)];
    return [2, 0];
  };
  const [ra, la] = rank(a);
  const [rb, lb] = rank(b);
  if (ra !== rb) return ra - rb;
  if (la !== lb) return la - lb;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Map model file/category → tree branch */
function modelFileBranch(
  filename: string | undefined | null
): 'structure' | 'mep' | 'architecture' | null {
  const f = (filename || '').toLowerCase();
  if (!f) return null;
  if (f.includes('mep')) return 'mep';
  if (f.includes('struct')) return 'structure';
  if (f.includes('arch')) return 'architecture';
  return null;
}

/** BIMSF marks for fasteners — listed under Connectors, not 3D panels. */
function isBimsfConnectorMark(displayOrKey: string): boolean {
  const name = String(displayOrKey || '')
    .toLowerCase()
    .replace(/^\*/, '')
    .trim();
  if (!name) return false;
  if (/^[a-z]{1,4}[-_]?\d{2,8}$/i.test(name)) return false;
  if (/foundation/i.test(name)) return false;
  if (/\banchor\s*bolts?\b/i.test(name)) return true;
  if (/^connectors?$/i.test(name)) return true;
  if (/\bconnectors?\b/i.test(name)) return true;
  return false;
}

/** Prefer short marks like LB1001 from name/tag/metadata */
function extractPanelMark(p: {
  name?: string | null;
  tag?: string | null;
  metadata?: Record<string, any> | null;
}): string {
  const meta = p.metadata || {};
  const candidates = [
    meta.BIMSF_Container,
    meta.bimsf,
    meta.mark,
    meta.Mark,
    meta.panelMark,
    meta.PanelMark,
    p.tag,
    p.name,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim());

  for (const c of candidates) {
    if (/^[A-Z]{1,4}\d{2,8}$/i.test(c)) return c.toUpperCase();
    const m = c.match(/\b([A-Z]{1,4}\d{2,8})\b/i);
    if (m) return m[1].toUpperCase();
  }

  // Revit-style Family:Type:Id — keep readable tail when no mark
  const parts = (p.name || '').split(':').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const maybe = parts[parts.length - 2];
    if (/^[A-Z]{1,4}\d/i.test(maybe)) return maybe.toUpperCase();
  }
  return (p.name || p.tag || 'Panel').trim();
}

function isShortPanelMark(mark: string): boolean {
  return /^[A-Z]{1,4}\d{2,8}$/i.test(mark.trim());
}

const VIEW_TYPE_FOLDERS: Record<string, string> = {
  FloorPlan: 'Floor Plans',
  CeilingPlan: 'Ceiling Plans',
  Elevation: 'Elevations',
  Section: 'Sections',
  EngineeringPlan: 'Engineering Plans',
  ThreeD: '3D Views',
  Detail: 'Details',
  AreaPlan: 'Area Plans',
  DraftingView: 'Drafting Views',
};

const INFO_LABELS: Record<string, string> = {
  title: 'File title',
  name: 'Project name',
  number: 'Project number',
  client: 'Client',
  address: 'Address',
  status: 'Status',
  author: 'Author',
  buildingName: 'Building',
  path: 'File path',
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function shortPath(p: string) {
  if (!p) return '—';
  const parts = p.replace(/\//g, '\\').split('\\');
  if (parts.length <= 2) return p;
  return `…\\${parts.slice(-2).join('\\')}`;
}

export function ProjectBrowserPanel({
  open,
  onClose,
  projectId,
  revisionId,
  onOpenDrawing,
  onOpenSchedule,
  onOpenDetail,
  onSelectPanel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<BrowserSnapshot | null>(null);
  const [drawings, setDrawings] = useState<BrowserDrawing[]>([]);
  const [treePanels, setTreePanels] = useState<TreePanel[]>([]);
  const [bimsfPanels, setBimsfPanels] = useState<BimsfTreePanel[]>([]);
  const [bimsfChecked, setBimsfChecked] = useState<Record<string, DiscKey[]>>({});
  const [bimsfNeighborFocus, setBimsfNeighborFocus] = useState<string | null>(null);
  const [bimsfConnectorFocus, setBimsfConnectorFocus] = useState<Record<string, boolean>>(
    {}
  );
  const [tab, setTab] = useState<TabId>('tree');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedKey, setSelectedKey] = useState('');
  const [selection, setSelection] = useState<BrowserSelection>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const apiBase = getBrowserApiBase();
        const q = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : '';
        const [browserRes, panelsRes, bimsfRes] = await Promise.all([
          fetch(`${apiBase}/projects/${projectId}/browser${q}`, {
            headers: authHeaders(),
          }),
          fetch(`${apiBase}/panels/${projectId}/all`, {
            headers: authHeaders(),
          }),
          fetch(`${apiBase}/projects/${projectId}/bimsf-panels`, {
            headers: authHeaders(),
          }),
        ]);
        if (!browserRes.ok) throw new Error(`Browser API ${browserRes.status}`);
        const data = await browserRes.json();
        if (cancelled) return;
        setSnapshot(data.snapshot || null);
        setDrawings(data.drawings || []);

        if (panelsRes.ok) {
          const pdata = await panelsRes.json();
          const list: TreePanel[] = (pdata.panels || []).map((p: any) => {
            const expressRaw =
              p.element?.expressId ??
              p.metadata?.ifcElementId ??
              null;
            const expressId =
              expressRaw != null && expressRaw !== ''
                ? Number(expressRaw)
                : null;
            return {
              id: p.id,
              name: p.name,
              tag: p.tag,
              modelId: p.modelId || p.model?.id || null,
              modelName: p.model?.originalFilename || null,
              expressId: Number.isFinite(expressId as number) ? expressId : null,
              mark: extractPanelMark(p),
            };
          });
          setTreePanels(list);
        } else {
          setTreePanels([]);
        }

        if (bimsfRes.ok) {
          const bdata = await bimsfRes.json();
          const list: BimsfTreePanel[] = (bdata.panels || []).map((p: any) => {
            const byCat = p.byCategory || {};
            const disciplines: DiscKey[] = [];
            const catKeys = Object.keys(byCat);
            for (const c of catKeys) {
              const low = String(c).toLowerCase();
              if ((low === 'mep' || low === 'electrical') && (byCat[c] || 0) > 0) {
                if (!disciplines.includes('mep')) disciplines.push('mep');
              } else if (
                (low === 'structure' || low === 'structural') &&
                (byCat[c] || 0) > 0
              ) {
                if (!disciplines.includes('structure')) disciplines.push('structure');
              } else if (
                (low === 'architecture' || low === 'architectural' || low === 'arch') &&
                (byCat[c] || 0) > 0
              ) {
                if (!disciplines.includes('architecture')) disciplines.push('architecture');
              }
            }
            // Also trust modelIds from viewer if API categories missing
            if (!disciplines.length && catKeys.length === 0) {
              // Floor trusses / panels from Structure publish often need a home branch
              disciplines.push('structure');
            }
            return {
              key: String(p.displayName || p.id || '')
                .replace(/^\*/, '')
                .trim()
                .toLowerCase(),
              displayName: String(p.displayName || p.id || '').replace(/^\*/, '').trim(),
              disciplines,
            };
          }).filter((p: BimsfTreePanel) => p.key && p.displayName);
          setBimsfPanels(list);
        } else {
          setBimsfPanels([]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load Project Browser');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, revisionId]);

  useEffect(() => {
    setSearch('');
  }, [tab]);

  // After FRAG load, merge viewer BIMSF index into API list (do not drop unmatched panels like FT-*)
  useEffect(() => {
    if (!open) return;
    const pull = () => {
      try {
        const api = (window as any).__uniqubeViewer;
        const keys = api?.getBimsfPanelKeys?.();
        if (Array.isArray(keys) && keys.length > 0) {
          setBimsfPanels((prev) => {
            const map = new Map<string, BimsfTreePanel>();
            for (const p of prev) {
              map.set(p.key, { ...p, disciplines: [...p.disciplines] });
            }
            for (const k of keys) {
              const key = String(k.key || '').toLowerCase();
              if (!key) continue;
              const discs = (k.disciplines || []).filter(
                (d: string): d is DiscKey =>
                  d === 'mep' || d === 'structure' || d === 'architecture'
              );
              const existing = map.get(key);
              if (existing) {
                for (const d of discs) {
                  if (!existing.disciplines.includes(d)) existing.disciplines.push(d);
                }
                if (k.display) existing.displayName = String(k.display);
              } else {
                map.set(key, {
                  key,
                  displayName: String(k.display || k.key || ''),
                  disciplines: discs.length ? discs : (['structure'] as DiscKey[]),
                });
              }
            }
            // Panels only in API (not yet matched in FRAG) — keep and default Structure if empty
            for (const p of map.values()) {
              if (!p.disciplines.length) p.disciplines.push('structure');
            }
            return [...map.values()].sort((a, b) =>
              a.displayName.localeCompare(b.displayName, undefined, {
                numeric: true,
                sensitivity: 'base',
              })
            );
          });
        }
        const checked = api?.getBimsfChecked?.();
        if (checked && typeof checked === 'object') setBimsfChecked(checked);
        const focus = api?.getBimsfNeighborFocus?.();
        setBimsfNeighborFocus(typeof focus === 'string' ? focus : null);
      } catch {
        /* ignore */
      }
    };
    pull();
    const id = window.setInterval(pull, 1500);
    return () => window.clearInterval(id);
  }, [open]);

  const drawingByRevitId = useMemo(() => {
    const map = new Map<number, BrowserDrawing>();
    for (const d of drawings) {
      if (d.revitElementId != null) map.set(d.revitElementId, d);
    }
    return map;
  }, [drawings]);

  /** Tree: UQ_S / UQ_A / UQ_MEP name prefix → view-kind → views */
  const treeViews = useMemo(() => {
    const views = (snapshot?.views || []).filter((v) => !(v as any).isTemplate);
    const byBranch: Record<
      string,
      Record<string, NonNullable<BrowserSnapshot['views']>>
    > = {};

    for (const branch of PROJECT_TREE) {
      byBranch[branch.id] = {};
      for (const child of branch.children) {
        byBranch[branch.id][child.id] = [];
      }
    }

    for (const v of views) {
      const branchId = viewNameBranch(v.name);
      if (!branchId) continue;
      const bucket = byBranch[branchId];
      if (!bucket) continue;
      const branch = PROJECT_TREE.find((b) => b.id === branchId);
      if (!branch) continue;

      // Architecture: UQ_AA (ACP) + UQ_ADW (Door & Window) → Floor plan
      if (branchId === 'architecture' && isArchitectureFloorPlanPrefix(v.name)) {
        if (bucket['floor-plan']) {
          bucket['floor-plan'].push(v);
          continue;
        }
      }

      const vt = v.viewType || '';
      for (const child of branch.children) {
        if (child.viewTypes.includes(vt)) {
          bucket[child.id].push(v);
          break;
        }
      }
    }

    // Stable order: Foundation → Level N → others
    for (const branchId of Object.keys(byBranch)) {
      for (const kindId of Object.keys(byBranch[branchId])) {
        byBranch[branchId][kindId].sort((a, b) => compareTreeViewNames(a.name, b.name));
      }
    }

    return byBranch;
  }, [snapshot]);

  /** Tree → 3D: unique BIMSF panel marks per discipline, with cross M/S/A availability */
  const treePanelsByBranch = useMemo(() => {
    const byBranch: Record<DiscKey, BimsfTreePanel[]> = {
      architecture: [],
      mep: [],
      structure: [],
    };

    // Prefer publish BIMSF map aggregation
    if (bimsfPanels.length > 0) {
      // Enrich disciplines from viewer index when API byCategory is incomplete
      const viewerApi = typeof window !== 'undefined' ? (window as any).__uniqubeViewer : null;
      for (const p of bimsfPanels) {
        let discs = [...p.disciplines];
        try {
          const fromViewer: string[] = viewerApi?.getBimsfAvailableDisciplines?.(p.key) || [];
          for (const d of fromViewer) {
            if (
              (d === 'mep' || d === 'structure' || d === 'architecture') &&
              !discs.includes(d)
            ) {
              discs.push(d);
            }
          }
        } catch {
          /* ignore */
        }
        const row = { ...p, disciplines: discs };
        for (const d of discs) {
          byBranch[d].push(row);
        }
      }
    } else {
      // Fallback: unique short marks from Panel DB rows
      const markMap = new Map<string, BimsfTreePanel>();
      for (const p of treePanels) {
        const branch = modelFileBranch(p.modelName);
        if (!branch || !isShortPanelMark(p.mark)) continue;
        const key = p.mark.replace(/^\*/, '').trim().toLowerCase();
        let row = markMap.get(key);
        if (!row) {
          row = { key, displayName: p.mark.toUpperCase(), disciplines: [] };
          markMap.set(key, row);
        }
        if (!row.disciplines.includes(branch)) row.disciplines.push(branch);
      }
      for (const row of markMap.values()) {
        for (const d of row.disciplines) byBranch[d].push(row);
      }
    }

    for (const key of Object.keys(byBranch) as DiscKey[]) {
      byBranch[key].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
    }

    return byBranch;
  }, [bimsfPanels, treePanels]);

  const syncBimsfCheckedFromViewer = () => {
    try {
      const api = (window as any).__uniqubeViewer;
      const checked = api?.getBimsfChecked?.();
      if (checked && typeof checked === 'object') setBimsfChecked(checked);
      const focus = api?.getBimsfNeighborFocus?.();
      setBimsfNeighborFocus(typeof focus === 'string' ? focus : null);
      const connFocus: string[] = api?.getBimsfConnectorFocus?.() || [];
      const connMap: Record<string, boolean> = {};
      for (const k of connFocus) connMap[k] = true;
      setBimsfConnectorFocus(connMap);
    } catch {
      /* ignore */
    }
  };

  const togglePanelNeighbors = async (panelKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const api = (window as any).__uniqubeViewer;
    if (!api?.highlightBimsfNeighbors) {
      console.warn('BIMSF neighbor API not ready — wait for models to finish loading');
      return;
    }
    const result = await api.highlightBimsfNeighbors(panelKey);
    syncBimsfCheckedFromViewer();
    setSelectedKey(`bimsf:${panelKey}`);
    if (result?.neighbors?.length === 0 && result?.focus) {
      console.warn('No adjacent panels found for', panelKey);
    }
  };

  const togglePanelConnectors = async (panelKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const api = (window as any).__uniqubeViewer;
    if (!api?.toggleBimsfConnectors) {
      console.warn('BIMSF connectors API not ready — wait for models to finish loading');
      return;
    }
    const nextOn = !bimsfConnectorFocus[panelKey];
    const result = await api.toggleBimsfConnectors(panelKey, nextOn);
    syncBimsfCheckedFromViewer();
    setSelectedKey(`bimsf:${panelKey}`);
    if (nextOn && result?.connectors?.length === 0 && !(result?.count > 0)) {
      console.warn('No connected connectors found for', panelKey);
    }
  };

  const togglePanelDiscipline = async (
    panelKey: string,
    disc: DiscKey,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const api = (window as any).__uniqubeViewer;
    if (!api?.toggleBimsfDiscipline) {
      console.warn('BIMSF viewer API not ready — wait for models to finish loading');
      return;
    }
    const current = new Set(bimsfChecked[panelKey] || []);
    const nextOn = !current.has(disc);
    await api.toggleBimsfDiscipline(panelKey, disc, nextOn);
    syncBimsfCheckedFromViewer();
    setSelectedKey(`bimsf:${panelKey}`);
  };

  const selectPanelAllDisciplines = async (panel: BimsfTreePanel, exclusive: boolean) => {
    const api = (window as any).__uniqubeViewer;
    if (api?.selectBimsfPanelAllDisciplines) {
      await api.selectBimsfPanelAllDisciplines(panel.key, exclusive);
      syncBimsfCheckedFromViewer();
      setSelectedKey(`bimsf:${panel.key}`);
      return;
    }
    // Fallback: first matching DB panel expressId (home discipline only)
    const home = panel.disciplines[0];
    const match = treePanels.find(
      (p) =>
        modelFileBranch(p.modelName) === home &&
        p.mark.replace(/^\*/, '').trim().toLowerCase() === panel.key
    );
    if (match?.expressId != null) {
      onSelectPanel?.({
        id: match.id,
        name: panel.displayName,
        modelId: match.modelId,
        expressId: match.expressId,
      });
    }
  };

  const viewsByType = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups: Record<string, NonNullable<BrowserSnapshot['views']>> = {};
    for (const v of snapshot?.views || []) {
      if (q && !v.name.toLowerCase().includes(q) && !(v.viewType || '').toLowerCase().includes(q)) {
        continue;
      }
      const folder = VIEW_TYPE_FOLDERS[v.viewType] || v.viewType || 'Other';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(v);
    }
    return groups;
  }, [snapshot, search]);

  const filteredSheets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (snapshot?.sheets || []).filter((s) => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.number || '').toLowerCase().includes(q)
      );
    });
  }, [snapshot, search]);

  const filteredSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (snapshot?.schedules || []).filter((s) => {
      if (s.name.startsWith('<Revision Schedule')) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q);
    });
  }, [snapshot, search]);

  const counts = {
    views: snapshot?.views?.length || 0,
    sheets: snapshot?.sheets?.length || 0,
    schedules: (snapshot?.schedules || []).filter((s) => !s.name.startsWith('<Revision Schedule'))
      .length,
    links: snapshot?.links?.length || 0,
  };

  const toggleGroup = (key: string, defaultOpen = true) =>
    setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultOpen) }));

  const isGroupOpen = (key: string, defaultOpen = true) =>
    expanded[key] ?? defaultOpen;

  const selectDrawing = (d: BrowserDrawing, detail?: any) => {
    setSelectedKey(`drawing:${d.id}`);
    setSelection({ kind: 'drawing', drawing: d, detail });
    onOpenDrawing(d);
  };

  const selectDetail = (title: string, data: Record<string, any>, key: string) => {
    setSelectedKey(key);
    setSelection({ kind: 'detail', title, data });
    onOpenDetail?.({ title, data });
  };

  if (!open) return null;

  return (
    <aside className="pb-panel" id="project-browser-panel" aria-label="Project Browser">
      <header className="pb-header">
        <div className="pb-header-text">
          <h3>Project Browser</h3>
          <p className="pb-header-sub">
            {snapshot?.projectInfo?.title || snapshot?.projectInfo?.name || 'Revit publish'}
          </p>
        </div>
        <button type="button" className="pb-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-times" />
        </button>
      </header>

      <nav className="pb-tabs" role="tablist" aria-label="Browser sections">
        {TABS.map((t) => {
          const count =
            t.id === 'views'
              ? counts.views
              : t.id === 'sheets'
                ? counts.sheets
                : t.id === 'schedules'
                  ? counts.schedules
                  : t.id === 'links'
                    ? counts.links
                    : undefined;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`pb-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              title={t.label}
            >
              <i className={`fas ${t.icon}`} />
              <span className="pb-tab-label">{t.label}</span>
              {count !== undefined && <span className="pb-tab-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      {tab !== 'info' && tab !== 'tree' && (
        <div className="pb-search-wrap">
          <i className="fas fa-search" />
          <input
            type="search"
            className="pb-search"
            placeholder={`Search ${tab}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="pb-body" role="tabpanel">
        {loading && <div className="pb-status">Loading…</div>}
        {error && <div className="pb-error">{error}</div>}
        {!loading && !error && !snapshot && drawings.length === 0 && tab !== 'tree' && (
          <div className="pb-empty">
            <i className="fas fa-folder-open" />
            <p>No browser data for this revision.</p>
            <span>Republish from Revit to capture views and sheets.</span>
          </div>
        )}

        {!loading && !error && tab === 'tree' && (
          <div className="pb-list pb-tree">
            {PROJECT_TREE.map((node) => {
              const key = `tree:${node.id}`;
              const openNode = isGroupOpen(key, false);
              const branchViews = treeViews[node.id] || {};
              const branchPanels = treePanelsByBranch[node.id] || [];
              const branchTotal =
                Object.entries(branchViews).reduce((n, [kind, list]) => {
                  if (kind === '3d') return n;
                  return n + list.length;
                }, 0) + branchPanels.length;
              return (
                <div key={node.id} className="pb-group pb-tree-branch">
                  <button
                    type="button"
                    className="pb-group-btn pb-tree-node"
                    onClick={() => toggleGroup(key, false)}
                    aria-expanded={openNode}
                  >
                    <i className={`fas fa-chevron-${openNode ? 'down' : 'right'}`} />
                    <span>{node.label}</span>
                    <span className="pb-group-count">{branchTotal}</span>
                  </button>
                  {openNode && (
                    <div className="pb-group-items pb-tree-children">
                      {node.children.map((child) => {
                        const childKey = `tree:${node.id}:${child.id}`;
                        const childOpen = isGroupOpen(childKey, false);
                        const is3d = child.id === '3d';
                        const isConnectors = child.id === 'connectors';
                        const list = is3d || isConnectors ? [] : branchViews[child.id] || [];
                        const panels = is3d
                          ? branchPanels.filter(
                              (p) =>
                                !isBimsfConnectorMark(p.displayName) &&
                                !isBimsfConnectorMark(p.key)
                            )
                          : isConnectors
                            ? branchPanels.filter(
                                (p) =>
                                  isBimsfConnectorMark(p.displayName) ||
                                  isBimsfConnectorMark(p.key)
                              )
                            : [];
                        if (isConnectors && panels.length === 0) return null;
                        const count = is3d || isConnectors ? panels.length : list.length;
                        return (
                          <div key={child.id} className="pb-tree-kind">
                            <button
                              type="button"
                              className="pb-group-btn pb-tree-kind-btn"
                              onClick={() => toggleGroup(childKey, false)}
                              aria-expanded={childOpen}
                            >
                              <i
                                className={`fas fa-chevron-${childOpen ? 'down' : 'right'}`}
                              />
                              <span>{child.label}</span>
                              <span className="pb-group-count">{count}</span>
                            </button>
                            {childOpen && (
                              <div className="pb-tree-views">
                                {is3d || isConnectors ? (
                                  <>
                                    {panels.length === 0 && (
                                      <div className="pb-empty-inline">
                                        {isConnectors
                                          ? 'No connector BIMSF marks'
                                          : 'No BIMSF panels — publish Structure/MEP with BIMSF_Container'}
                                      </div>
                                    )}
                                    {panels.map((p) => {
                                      const checked = new Set(bimsfChecked[p.key] || []);
                                      const active = checked.size > 0;
                                      const connOn = !!bimsfConnectorFocus[p.key];
                                      const isConnItem = isConnectors;
                                      return (
                                        <div
                                          key={`${node.id}:${child.id}:${p.key}`}
                                          className={`pb-item pb-bimsf-row ${
                                            selectedKey === `bimsf:${p.key}` || active
                                              ? 'active'
                                              : ''
                                          } ${isConnItem ? 'is-connector' : ''}`}
                                          title={p.displayName}
                                        >
                                          <button
                                            type="button"
                                            className="pb-bimsf-name"
                                            onClick={(ev) => {
                                              void selectPanelAllDisciplines(
                                                p,
                                                !(ev.ctrlKey || ev.metaKey)
                                              );
                                            }}
                                          >
                                            <span className="pb-item-title">{p.displayName}</span>
                                          </button>
                                          {!isConnItem && (
                                            <button
                                              type="button"
                                              className={`pb-bimsf-branch ${
                                                bimsfNeighborFocus === p.key ? 'is-on' : ''
                                              }`}
                                              title="Show connected panels — Structure in light yellow, MEP keeps its colours"
                                              onClick={(e) => {
                                                void togglePanelNeighbors(p.key, e);
                                              }}
                                            >
                                              <i className="fas fa-code-branch" aria-hidden />
                                            </button>
                                          )}
                                          <span
                                            className="pb-bimsf-msa"
                                            title="M=MEP S=Structure A=Architecture C=Connectors"
                                          >
                                            {(
                                              [
                                                ['mep', 'M'],
                                                ['structure', 'S'],
                                                ['architecture', 'A'],
                                              ] as Array<[DiscKey, string]>
                                            ).map(([disc, letter]) => {
                                              const has = p.disciplines.includes(disc);
                                              const on = checked.has(disc);
                                              return (
                                                <button
                                                  key={disc}
                                                  type="button"
                                                  className={`pb-msa-btn ${on ? 'is-on' : ''}`}
                                                  data-disc={disc}
                                                  disabled={!has}
                                                  title={
                                                    has
                                                      ? `Toggle ${disc}`
                                                      : `No ${disc} for this panel`
                                                  }
                                                  onClick={(e) => {
                                                    if (!has) return;
                                                    void togglePanelDiscipline(p.key, disc, e);
                                                  }}
                                                >
                                                  {letter}
                                                </button>
                                              );
                                            })}
                                            {!isConnItem && (
                                              <button
                                                type="button"
                                                className={`pb-msa-btn ${connOn ? 'is-on' : ''}`}
                                                data-disc="connectors"
                                                title="Show connectors / anchor bolts linked to this panel"
                                                onClick={(e) => {
                                                  void togglePanelConnectors(p.key, e);
                                                }}
                                              >
                                                C
                                              </button>
                                            )}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </>
                                ) : (
                                  <>
                                    {list.length === 0 && (
                                      <div className="pb-empty-inline">No views</div>
                                    )}
                                    {list.map((v) => {
                                      const drawing = drawingByRevitId.get(v.id);
                                      return (
                                        <button
                                          key={v.id}
                                          type="button"
                                          className={`pb-item ${
                                            selectedKey === `view:${v.id}` ? 'active' : ''
                                          }`}
                                          onClick={() => {
                                            if (drawing) selectDrawing(drawing, v);
                                            else {
                                              selectDetail(
                                                v.name,
                                                { ...v, hasDrawing: false },
                                                `view:${v.id}`
                                              );
                                            }
                                          }}
                                        >
                                          <span className="pb-item-main">
                                            <span className="pb-item-title">{v.name}</span>
                                          </span>
                                          {drawing?.hasDxf ? (
                                            <span className="pb-chip cad">CAD</span>
                                          ) : (
                                            <span className="pb-chip muted">Info</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && tab === 'views' && (
          <div className="pb-list">
            {Object.keys(viewsByType).length === 0 && (
              <div className="pb-empty-inline">No views match</div>
            )}
            {Object.entries(viewsByType).map(([folder, list]) => (
              <div key={folder} className="pb-group">
                <button
                  type="button"
                  className="pb-group-btn"
                  onClick={() => toggleGroup(`v:${folder}`)}
                >
                  <i className={`fas fa-chevron-${isGroupOpen(`v:${folder}`) ? 'down' : 'right'}`} />
                  <span>{folder}</span>
                  <span className="pb-group-count">{list.length}</span>
                </button>
                {isGroupOpen(`v:${folder}`) && (
                  <div className="pb-group-items">
                    {list.map((v) => {
                      const drawing = drawingByRevitId.get(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={`pb-item ${selectedKey === `view:${v.id}` ? 'active' : ''}`}
                          onClick={() => {
                            if (drawing) selectDrawing(drawing, v);
                            else {
                              selectDetail(v.name, { ...v, hasDrawing: false }, `view:${v.id}`);
                            }
                          }}
                        >
                          <span className="pb-item-main">
                            <span className="pb-item-title">{v.name}</span>
                            {v.discipline && (
                              <span className="pb-item-meta">{v.discipline}</span>
                            )}
                          </span>
                          {drawing?.hasDxf ? (
                            <span className="pb-chip cad">CAD</span>
                          ) : (
                            <span className="pb-chip muted">Info</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && tab === 'sheets' && (
          <div className="pb-list">
            {filteredSheets.length === 0 && (
              <div className="pb-empty-inline">No sheets match</div>
            )}
            {filteredSheets.map((s) => {
              const drawing = drawingByRevitId.get(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`pb-item sheet ${selectedKey === `sheet:${s.id}` ? 'active' : ''}`}
                  onClick={() => {
                    if (drawing) selectDrawing(drawing, s);
                    else {
                      selectDetail(`${s.number} ${s.name}`, s, `sheet:${s.id}`);
                    }
                  }}
                >
                  <span className="pb-sheet-no">{s.number || '—'}</span>
                  <span className="pb-item-main">
                    <span className="pb-item-title">{s.name}</span>
                    <span className="pb-item-meta">
                      {(s.viewports || []).length} viewport
                      {(s.viewports || []).length === 1 ? '' : 's'}
                    </span>
                  </span>
                  {drawing?.hasDxf ? (
                    <span className="pb-chip cad">CAD</span>
                  ) : (
                    <span className="pb-chip muted">Info</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!loading && !error && tab === 'schedules' && (
          <div className="pb-list">
            {filteredSchedules.length === 0 && (
              <div className="pb-empty-inline">No schedules match</div>
            )}
            {filteredSchedules.map((sch) => (
              <button
                key={sch.id}
                type="button"
                className={`pb-item ${selectedKey === `schedule:${sch.id}` ? 'active' : ''}`}
                onClick={() => {
                  setSelectedKey(`schedule:${sch.id}`);
                  setSelection({ kind: 'schedule', schedule: sch });
                  onOpenSchedule(sch);
                }}
              >
                <span className="pb-item-main">
                  <span className="pb-item-title">{sch.name}</span>
                  <span className="pb-item-meta">
                    {(sch.table?.rows || []).length} rows
                  </span>
                </span>
                {(sch.table?.rows || []).length > 0 && (
                  <span className="pb-chip data">Table</span>
                )}
              </button>
            ))}
          </div>
        )}

        {!loading && !error && tab === 'links' && (
          <div className="pb-list">
            {(snapshot?.links || []).length === 0 && (
              <div className="pb-empty-inline">No RVT links</div>
            )}
            {(snapshot?.links || []).map((link) => {
              const loaded = (link.status || '').toLowerCase().includes('load');
              return (
                <button
                  key={link.id}
                  type="button"
                  className={`pb-item ${selectedKey === `link:${link.id}` ? 'active' : ''}`}
                  onClick={() => {
                    selectDetail(link.name, link, `link:${link.id}`);
                  }}
                >
                  <span className="pb-item-main">
                    <span className="pb-item-title">{link.name}</span>
                    <span className="pb-item-meta" title={link.path}>
                      {shortPath(link.path)}
                    </span>
                  </span>
                  <span className={`pb-chip ${loaded ? 'ok' : 'warn'}`}>
                    {link.status || 'Unknown'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!loading && !error && tab === 'info' && (
          <div className="pb-info">
            <section className="pb-info-card">
              <h4>Project</h4>
              <dl className="pb-dl">
                {Object.entries(snapshot?.projectInfo || {}).map(([k, v]) => (
                  <div key={k} className="pb-dl-row">
                    <dt>{INFO_LABELS[k] || k}</dt>
                    <dd title={String(v || '')}>
                      {k === 'path' ? shortPath(String(v || '')) : String(v || '—')}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="pb-info-card">
              <h4>Levels</h4>
              {(snapshot?.levels || []).length === 0 && (
                <p className="pb-muted">No levels</p>
              )}
              <ul className="pb-level-list">
                {(snapshot?.levels || []).map((lvl) => (
                  <li key={lvl.id}>
                    <span>{lvl.name}</span>
                    <span className="pb-level-elev">{lvl.elevation}</span>
                  </li>
                ))}
              </ul>
            </section>

            {(snapshot?.phases || []).length > 0 && (
              <section className="pb-info-card">
                <h4>Phases</h4>
                <div className="pb-chips">
                  {(snapshot?.phases || []).map((ph) => (
                    <span key={ph.id} className="pb-chip muted">
                      {ph.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <footer className="pb-footer">
        {!selection && (
          <p className="pb-muted">Select a view or sheet with CAD to open the drawing.</p>
        )}
        {selection?.kind === 'drawing' && (
          <div className="pb-footer-sel">
            <strong>{selection.drawing.name}</strong>
            <span>
              {selection.drawing.kind}
              {selection.drawing.viewType ? ` · ${selection.drawing.viewType}` : ''}
              {selection.drawing.hasDxf ? ' · DXF ready' : ''}
            </span>
          </div>
        )}
        {selection?.kind === 'schedule' && (
          <div className="pb-footer-sel">
            <strong>{selection.schedule.name}</strong>
            <span>Schedule table opened</span>
          </div>
        )}
        {selection?.kind === 'detail' && (
          <div className="pb-footer-sel">
            <strong>{selection.title}</strong>
            <span>Details only — no CAD file</span>
          </div>
        )}
      </footer>
    </aside>
  );
}

export function ScheduleTable({
  schedule,
  onClose,
  dockRight,
}: {
  schedule: NonNullable<BrowserSnapshot['schedules']>[number];
  onClose: () => void;
  dockRight?: boolean;
}) {
  const cols = schedule.table?.columns || [];
  const rows = schedule.table?.rows || [];
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.some((cell) => String(cell || '').toLowerCase().includes(q)));
  }, [rows, query]);

  return (
    <div className={`pb-doc-overlay ${dockRight ? 'with-browser' : ''}`}>
      <header className="pb-doc-toolbar">
        <div className="pb-doc-title">
          <div className="pb-doc-title-row">
            <span className="pb-doc-badge">Schedule</span>
            <strong title={schedule.name}>{schedule.name}</strong>
          </div>
          <div className="pb-doc-meta">
            <span>
              {filtered.length}
              {filtered.length !== rows.length ? ` / ${rows.length}` : ''} rows
              {cols.length ? ` · ${cols.length} columns` : ''}
            </span>
          </div>
        </div>
        <div className="pb-doc-actions">
          <button type="button" className="pb-doc-btn pb-doc-close" onClick={onClose} title="Close">
            <i className="fas fa-times" />
          </button>
        </div>
      </header>

      {schedule.table?.error && (
        <div className="pb-doc-banner err">
          Schedule extract error: {schedule.table.error}
        </div>
      )}

      <div className="pb-doc-search-wrap">
        <i className="fas fa-search" />
        <input
          type="search"
          placeholder="Filter rows…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="pb-doc-body">
        {rows.length === 0 ? (
          <div className="pb-doc-empty">
            <i className="fas fa-table" />
            <p>No table data in this schedule</p>
            <span>Revit may not have exported schedule cells for this view.</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="pb-doc-empty">
            <i className="fas fa-search" />
            <p>No rows match your filter</p>
          </div>
        ) : (
          <div className="pb-doc-table-wrap">
            <table className="pb-doc-table">
              <thead>
                <tr>
                  <th className="pb-doc-rownum">#</th>
                  {cols.map((c, i) => (
                    <th key={i}>{c || `Col ${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, ri) => (
                  <tr key={ri}>
                    <td className="pb-doc-rownum">{ri + 1}</td>
                    {(cols.length ? cols : row).map((_, ci) => (
                      <td key={ci}>{row[ci] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const DETAIL_LABELS: Record<string, string> = {
  ...INFO_LABELS,
  id: 'Element ID',
  name: 'Name',
  status: 'Status',
  path: 'Path',
  typeId: 'Type ID',
  viewType: 'View type',
  discipline: 'Discipline',
  number: 'Sheet number',
  hasDrawing: 'Has CAD drawing',
  viewports: 'Viewports',
};

export function DetailPanel({
  title,
  data,
  onClose,
  dockRight,
}: {
  title: string;
  data: Record<string, any>;
  onClose: () => void;
  dockRight?: boolean;
}) {
  const entries = Object.entries(data || {}).filter(([k]) => k !== 'table');

  return (
    <div className={`pb-doc-overlay ${dockRight ? 'with-browser' : ''}`}>
      <header className="pb-doc-toolbar">
        <div className="pb-doc-title">
          <div className="pb-doc-title-row">
            <span className="pb-doc-badge">Details</span>
            <strong title={title}>{title}</strong>
          </div>
          <div className="pb-doc-meta">
            <span>{entries.length} properties</span>
          </div>
        </div>
        <div className="pb-doc-actions">
          <button type="button" className="pb-doc-btn pb-doc-close" onClick={onClose} title="Close">
            <i className="fas fa-times" />
          </button>
        </div>
      </header>

      <div className="pb-doc-body pb-doc-detail-body">
        {entries.length === 0 ? (
          <div className="pb-doc-empty">
            <i className="fas fa-info-circle" />
            <p>No details available</p>
          </div>
        ) : (
          <dl className="pb-doc-detail-dl">
            {entries.map(([k, v]) => (
              <div key={k} className="pb-doc-detail-row">
                <dt>{DETAIL_LABELS[k] || k}</dt>
                <dd>
                  {Array.isArray(v) ? (
                    v.length === 0 ? (
                      '—'
                    ) : typeof v[0] === 'object' ? (
                      <ul className="pb-doc-detail-list">
                        {v.map((item, i) => (
                          <li key={i}>
                            {item.viewName
                              ? `${item.viewName}${item.viewType ? ` (${item.viewType})` : ''}`
                              : JSON.stringify(item)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      v.join(', ')
                    )
                  ) : typeof v === 'boolean' ? (
                    v ? 'Yes' : 'No'
                  ) : v == null || v === '' ? (
                    '—'
                  ) : (
                    String(v)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
