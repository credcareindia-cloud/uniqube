import React, { useEffect, useRef, useState } from 'react';
import { DxfViewer } from 'dxf-viewer';
import type { BrowserDrawing } from './ProjectBrowserPanel';
import './CadDrawingViewer.css';

type Props = {
  open: boolean;
  projectId: string;
  drawing: BrowserDrawing | null;
  onClose: () => void;
  /** Leave space for the right Project Browser dock */
  dockRight?: boolean;
  /** Show CAD beside the 3D scene instead of covering it */
  splitView?: boolean;
  onToggleSplit?: () => void;
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function waitForSize(el: HTMLElement, tries = 60): Promise<{ w: number; h: number }> {
  for (let i = 0; i < tries; i++) {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w > 32 && h > 32) return { w, h };
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
  // Last resort — never return 0 (breaks dxf-viewer SetSize / FitView)
  return {
    w: Math.max(el.clientWidth, 800),
    h: Math.max(el.clientHeight, 560),
  };
}

/** Minimal Color duck-type so we don't conflict with the app's three@0.175 vs dxf-viewer@0.161 */
function makeClearColor(hex: number) {
  return {
    isColor: true,
    getHex: () => hex,
    getHexString: () => hex.toString(16).padStart(6, '0'),
  };
}

export function CadDrawingViewer({
  open,
  projectId,
  drawing,
  onClose,
  dockRight,
  splitView = false,
  onToggleSplit,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<DxfViewer | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<
    Array<{ name: string; displayName: string; visible: boolean; hasGeometry: boolean }>
  >([]);
  const [dwgUrl, setDwgUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [entityHint, setEntityHint] = useState('');
  const [layerSearch, setLayerSearch] = useState('');
  const [layersOpen, setLayersOpen] = useState(true);

  useEffect(() => {
    if (!open) {
      destroyViewer();
      return;
    }
    return () => destroyViewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !drawing || !projectId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setLayers([]);
      setDwgUrl(null);
      setEntityHint('');
      setStatus('Fetching drawing…');

      try {
        const apiBase =
          typeof window !== 'undefined'
            ? `${window.location.origin}/api`
            : (import.meta as any).env?.VITE_API_BASE_URL || '/api';

        if (!drawing.hasDxf) {
          if (drawing.hasDwg) {
            const dwgRes = await fetch(
              `${apiBase}/projects/${projectId}/drawings/${drawing.id}/download-url?format=dwg`,
              { headers: authHeaders() }
            );
            if (dwgRes.ok) {
              const dwgData = await dwgRes.json();
              if (!cancelled) setDwgUrl(dwgData.url);
            }
            throw new Error(
              'This drawing has DWG only. In-browser viewer needs DXF — download DWG, or republish from Revit.'
            );
          }
          throw new Error('No DXF/DWG available for this drawing.');
        }

        const fileRes = await fetch(
          `${apiBase}/projects/${projectId}/drawings/${drawing.id}/file?format=dxf`,
          { headers: authHeaders() }
        );
        if (!fileRes.ok) throw new Error(`DXF download failed (${fileRes.status})`);
        const blob = await fileRes.blob();
        if (blob.size < 32) {
          throw new Error('DXF file is empty — Revit export may have failed for this view.');
        }

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        if (drawing.hasDwg) {
          try {
            const dwgRes = await fetch(
              `${apiBase}/projects/${projectId}/drawings/${drawing.id}/download-url?format=dwg`,
              { headers: authHeaders() }
            );
            if (dwgRes.ok) {
              const dwgData = await dwgRes.json();
              if (!cancelled) setDwgUrl(dwgData.url);
            }
          } catch {
            /* optional */
          }
        }

        if (cancelled) return;
        await mountAndLoad(blobUrl);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load CAD drawing');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, drawing?.id, projectId]);

  function destroyViewer(options?: { revokeBlob?: boolean }) {
    if (resizeObsRef.current) {
      try {
        resizeObsRef.current.disconnect();
      } catch {
        /* ignore */
      }
      resizeObsRef.current = null;
    }
    try {
      viewerRef.current?.Destroy();
    } catch {
      /* ignore */
    }
    viewerRef.current = null;
    if (hostRef.current) hostRef.current.innerHTML = '';
    if (options?.revokeBlob !== false && blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }

  function fitToContent(viewer: DxfViewer) {
    const bounds = viewer.GetBounds();
    if (!bounds) return false;
    const origin = viewer.GetOrigin();
    if (!origin) return false;

    // FitView expects scene-local coords (absolute − origin)
    const minX = bounds.minX - origin.x;
    const maxX = bounds.maxX - origin.x;
    const minY = bounds.minY - origin.y;
    const maxY = bounds.maxY - origin.y;
    const w = maxX - minX;
    const h = maxY - minY;
    if (!Number.isFinite(w) || !Number.isFinite(h) || (Math.abs(w) < 1e-9 && Math.abs(h) < 1e-9)) {
      return false;
    }

    // Guard against 0 canvas size (NaN aspect)
    const anyViewer = viewer as any;
    if (!anyViewer.canvasWidth || !anyViewer.canvasHeight) {
      return false;
    }

    viewer.FitView(minX, maxX, minY, maxY, 0.12);
    viewer.Render();
    return true;
  }

  function safeSetSize(viewer: DxfViewer, w: number, h: number) {
    const anyViewer = viewer as any;
    // If internal size is still 0, seed it before SetSize (avoids Infinity scale)
    if (!anyViewer.canvasWidth || !anyViewer.canvasHeight) {
      anyViewer.canvasWidth = w;
      anyViewer.canvasHeight = h;
      try {
        anyViewer.renderer?.setSize(w, h, false);
      } catch {
        /* ignore */
      }
    }
    viewer.SetSize(w, h);
  }

  async function mountAndLoad(url: string) {
    const host = hostRef.current;
    if (!host) return;

    destroyViewer({ revokeBlob: false });

    setStatus('Preparing canvas…');
    const { w, h } = await waitForSize(host);

    // autoResize:false — we manage size; autoResize + 0×0 host breaks the camera permanently
    const viewer = new DxfViewer(host, {
      canvasWidth: w,
      canvasHeight: h,
      autoResize: false,
      clearColor: makeClearColor(0x1a1a1a) as any,
      clearAlpha: 1,
      antialias: true,
      colorCorrection: true,
      blackWhiteInversion: true,
      sceneOptions: {
        suppressPaperSpace: false,
        wireframeMesh: true,
      },
    });
    viewerRef.current = viewer;

    if (!viewer.HasRenderer()) {
      throw new Error('WebGL renderer failed to start. Reload the page and try again.');
    }

    viewer.Subscribe('message', (e: any) => {
      const detail = e?.detail || e;
      const msg = detail?.message || String(detail);
      console.warn('[CadDrawingViewer]', msg);
      if (String(msg).toLowerCase().includes('empty')) {
        setEntityHint(String(msg));
      }
    });

    setStatus('Parsing DXF…');
    // Text/MTEXT (grid bubbles, tags, notes) are skipped unless fonts are provided
    const fontBase = `${window.location.origin}/fonts`;
    await viewer.Load({
      url,
      fonts: [
        `${fontBase}/Roboto-Regular.ttf`,
        `${fontBase}/Roboto-Bold.ttf`,
      ],
      progressCbk: (phase, processed, total) => {
        const pct = total ? Math.round((processed / total) * 100) : 0;
        setStatus(`${phase} ${pct}%`);
      },
    });

    if ((viewer as any).hasMissingChars) {
      setEntityHint(
        'Some characters could not be drawn (missing glyphs in font). Geometry and Latin text should still appear.'
      );
    }

    const size = await waitForSize(host);
    safeSetSize(viewer, size.w, size.h);
    const ok = fitToContent(viewer);

    // Own resize observer (safe SetSize + refit)
    resizeObsRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !viewerRef.current) return;
      const rw = Math.floor(entry.contentRect.width);
      const rh = Math.floor(entry.contentRect.height);
      if (rw < 8 || rh < 8) return;
      safeSetSize(viewerRef.current, rw, rh);
      fitToContent(viewerRef.current);
    });
    resizeObsRef.current.observe(host);

    const layerList: Array<{
      name: string;
      displayName: string;
      visible: boolean;
      hasGeometry: boolean;
    }> = [];
    let nonEmpty = 0;
    const nonEmptyNames = new Set<string>();
    for (const layer of viewer.GetLayers(true)) {
      nonEmpty += 1;
      nonEmptyNames.add(layer.name);
      layerList.push({
        name: layer.name,
        displayName: layer.displayName || layer.name,
        visible: true,
        hasGeometry: true,
      });
    }
    for (const layer of viewer.GetLayers(false)) {
      if (nonEmptyNames.has(layer.name)) continue;
      layerList.push({
        name: layer.name,
        displayName: layer.displayName || layer.name,
        visible: true,
        hasGeometry: false,
      });
    }
    layerList.sort((a, b) => {
      if (a.hasGeometry !== b.hasGeometry) return a.hasGeometry ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
    setLayers(layerList);
    setLayerSearch('');

    for (const layer of layerList) {
      viewer.ShowLayer(layer.name, true);
    }

    // Debug: scene object count
    const scene = viewer.GetScene();
    const childCount = scene?.children?.length ?? 0;
    console.log('[CadDrawingViewer] bounds', viewer.GetBounds(), 'origin', viewer.GetOrigin(), {
      layers: layerList.length,
      nonEmptyLayers: nonEmpty,
      sceneChildren: childCount,
      canvas: { w: size.w, h: size.h },
      dxfBytes: blobUrlRef.current ? 'blob' : null,
    });

    if (!ok || (nonEmpty === 0 && childCount === 0)) {
      setEntityHint(
        'DXF has layer names but little/no drawable geometry. Try Download DWG, or open a Sheet view.'
      );
    }

    requestAnimationFrame(() => {
      const s2 = host.clientWidth;
      const s2h = host.clientHeight;
      if (s2 > 8 && s2h > 8) {
        safeSetSize(viewer, s2, s2h);
        fitToContent(viewer);
      }
      viewer.Render();
    });

    setStatus(ok ? 'Ready' : 'Loaded');
  }

  const toggleLayer = (name: string, show: boolean) => {
    viewerRef.current?.ShowLayer(name, show);
    viewerRef.current?.Render();
    setLayers((prev) =>
      prev.map((l) => (l.name === name ? { ...l, visible: show } : l))
    );
  };

  const setAllLayers = (show: boolean) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setLayers((prev) => {
      for (const l of prev) viewer.ShowLayer(l.name, show);
      viewer.Render();
      return prev.map((l) => ({ ...l, visible: show }));
    });
  };

  const fitAll = () => {
    const viewer = viewerRef.current;
    const host = hostRef.current;
    if (!viewer || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w > 8 && h > 8) safeSetSize(viewer, w, h);
    const ok = fitToContent(viewer);
    if (!ok) setEntityHint('Nothing to fit — drawing may have no geometry in model space.');
  };

  // Re-size / refit DXF when toggling side-by-side View or browser dock
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const viewer = viewerRef.current;
      const host = hostRef.current;
      if (!viewer || !host) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 8 && h > 8) {
        safeSetSize(viewer, w, h);
        fitToContent(viewer);
      }
    }, 80);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, splitView, dockRight]);

  const visibleCount = layers.filter((l) => l.visible).length;
  const geomCount = layers.filter((l) => l.hasGeometry).length;
  const filteredLayers = layers.filter((l) => {
    const q = layerSearch.trim().toLowerCase();
    if (!q) return true;
    return l.displayName.toLowerCase().includes(q) || l.name.toLowerCase().includes(q);
  });

  if (!open || !drawing) return null;

  const sheetLabel = drawing.sheetNumber || null;
  const typeLabel = drawing.viewType || drawing.kind;

  return (
    <div
      className={`cad-overlay ${dockRight ? 'with-browser' : ''} ${
        layersOpen ? 'layers-open' : ''
      } ${splitView ? 'split-view' : ''}`}
    >
      <header className="cad-toolbar">
        <div className="cad-title">
          <div className="cad-title-row">
            {sheetLabel && <span className="cad-sheet-badge">{sheetLabel}</span>}
            <strong title={drawing.name}>{drawing.name}</strong>
          </div>
          <div className="cad-meta-row">
            <span className="cad-type-pill">{typeLabel}</span>
            {!loading && !error && layers.length > 0 && (
              <span className="cad-meta-quiet">
                {geomCount}/{layers.length} layers with geometry
              </span>
            )}
            {loading && <span className="cad-meta-quiet">{status || 'Loading…'}</span>}
            {error && <span className="cad-meta-quiet cad-meta-err">Failed to load</span>}
          </div>
        </div>

        <div className="cad-actions">
          {onToggleSplit && (
            <button
              type="button"
              className={`cad-tool-btn ${splitView ? 'active' : ''}`}
              onClick={onToggleSplit}
              title={
                splitView
                  ? 'Exit side-by-side — show drawing over the scene'
                  : 'View drawing beside the 3D scene'
              }
            >
              <i className="fas fa-columns" />
              <span>View</span>
            </button>
          )}
          <button
            type="button"
            className={`cad-tool-btn ${layersOpen ? 'active' : ''}`}
            onClick={() => setLayersOpen((v) => !v)}
            title={layersOpen ? 'Hide layers' : 'Show layers'}
          >
            <i className="fas fa-layer-group" />
            <span>Layers</span>
          </button>
          <button
            type="button"
            className="cad-tool-btn"
            onClick={fitAll}
            disabled={loading}
            title="Fit drawing to view"
          >
            <i className="fas fa-expand" />
            <span>Fit</span>
          </button>
          {dwgUrl && (
            <a
              className="cad-tool-btn"
              href={dwgUrl}
              download={`${drawing.stableKey}.dwg`}
              title="Download DWG"
            >
              <i className="fas fa-download" />
              <span>DWG</span>
            </a>
          )}
          <button
            type="button"
            className="cad-tool-btn cad-tool-close"
            onClick={onClose}
            title="Close"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      </header>

      <div className="cad-main">
        {layersOpen && (
          <aside className="cad-layers" aria-label="Drawing layers">
            <div className="cad-layers-head">
              <div>
                <h4>Layers</h4>
                <p>
                  {visibleCount} visible · {layers.length} total
                </p>
              </div>
              <div className="cad-layers-actions">
                <button type="button" onClick={() => setAllLayers(true)} title="Show all">
                  All
                </button>
                <button type="button" onClick={() => setAllLayers(false)} title="Hide all">
                  None
                </button>
              </div>
            </div>

            <div className="cad-layer-search">
              <i className="fas fa-search" />
              <input
                type="search"
                placeholder="Filter layers…"
                value={layerSearch}
                onChange={(e) => setLayerSearch(e.target.value)}
              />
            </div>

            <div className="cad-layer-list">
              {filteredLayers.length === 0 && (
                <p className="cad-muted">{loading ? 'Loading…' : 'No layers match'}</p>
              )}
              {filteredLayers.map((layer) => (
                <label
                  key={layer.name}
                  className={`cad-layer-row ${layer.visible ? '' : 'off'} ${
                    layer.hasGeometry ? '' : 'empty'
                  }`}
                  title={layer.name}
                >
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={(e) => toggleLayer(layer.name, e.target.checked)}
                  />
                  <span className="cad-layer-name">{layer.displayName}</span>
                  {!layer.hasGeometry && <span className="cad-layer-tag">empty</span>}
                </label>
              ))}
            </div>
          </aside>
        )}

        <div className="cad-canvas-wrap">
          {error && <div className="cad-toast cad-error">{error}</div>}
          {!error && entityHint && <div className="cad-toast cad-warn">{entityHint}</div>}
          {loading && !error && (
            <div className="cad-toast cad-loading">
              <i className="fas fa-circle-notch fa-spin" />
              Loading CAD drawing…
            </div>
          )}
          <div ref={hostRef} className="cad-canvas-host" />
        </div>
      </div>
    </div>
  );
}
