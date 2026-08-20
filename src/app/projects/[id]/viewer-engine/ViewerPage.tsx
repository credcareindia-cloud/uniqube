import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './ViewerPage.css';
import { FloorSelector } from './FloorSelector';
import { Cube } from '@/components/ui/Cube';
import {
  ProjectBrowserPanel,
  ScheduleTable,
  DetailPanel,
  type BrowserDrawing,
  type BrowserSnapshot,
  type TabId,
} from './ProjectBrowserPanel';
import { CadDrawingViewer } from './CadDrawingViewer';
import { getBrowserApiBase } from '@/config/browserApi';

// Import custom error types
import type { ProjectNotFoundError, NetworkError, ModelLoadError, WebGLError } from './main';

export default function ViewerPage() {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();
  const modelId = searchParams.get('model');

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingTitle, setLoadingTitle] = useState('Loading Viewer');
  const [loadingSubtitle, setLoadingSubtitle] = useState('Initializing Uniqube Engine');
  const [loadingStatus, setLoadingStatus] = useState('Initializing viewer...');
  const containerRef = useRef<HTMLDivElement>(null);
  const mainScriptRef = useRef(false);
  const [statusPanelVisible, setStatusPanelVisible] = useState(false);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  // 2D Views state
  const [viewer, setViewer] = useState<any>(null);
  const [is2DMode, setIs2DMode] = useState(false);
  const [currentFloor, setCurrentFloor] = useState<string | null>(null);

  // Publish revision selector
  type PublishRevision = {
    id: string;
    label: string;
    version: number;
    isLatest: boolean;
    createdAt: string;
    categories: string[];
    models: Array<{ id: string; category: string; version: number; name: string; originalFilename: string }>;
  };
  const [revisions, setRevisions] = useState<PublishRevision[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>('');
  const [revisionSwitching, setRevisionSwitching] = useState(false);
  const appliedRevisionRef = useRef<string | null>(null);
  const [hideMenuOpen, setHideMenuOpen] = useState(false);
  const [hideSheathing, setHideSheathing] = useState(false);
  const [hideWalls, setHideWalls] = useState(false);
  const [hideFloors, setHideFloors] = useState(false);
  const [hideAcp, setHideAcp] = useState(false);
  const [hideDoorsWindows, setHideDoorsWindows] = useState(false);
  const [hideBusy, setHideBusy] = useState(false);
  const hideMenuRef = useRef<HTMLDivElement>(null);

  // Installation sequencing mode
  const [installMode, setInstallMode] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [installStep, setInstallStep] = useState<{
    index: number;
    total: number;
    display: string;
    isFirst: boolean;
    isLast: boolean;
    playing?: boolean;
    isComplete?: boolean;
    previous: Array<{ key: string; display: string }>;
    upcoming: Array<{ key: string; display: string }>;
    current: {
      key: string;
      display: string;
      container: string;
      elementCount: number;
      structureCount: number;
      mepCount: number;
      architectureCount: number;
      disciplines: string[];
      sizeLabel: string | null;
      adjacentCount: number;
      adjacentNames: string[];
      pallet: string | null;
      material: string | null;
      weight: string | null;
      location: string | null;
      objectType: string | null;
      floor?: number;
      connectors?: { total: number; byMark: Record<string, number> };
    } | null;
    connectorsProject: Array<{ mark: string; count: number }>;
  } | null>(null);
  const [seqDetailsExpanded, setSeqDetailsExpanded] = useState(false);

  // Project Browser + CAD drawings
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserTab, setBrowserTab] = useState<TabId>('tree');
  const [activeDrawing, setActiveDrawing] = useState<BrowserDrawing | null>(null);
  const [cadOpen, setCadOpen] = useState(false);
  const [cadSplit, setCadSplit] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<
    NonNullable<BrowserSnapshot['schedules']>[number] | null
  >(null);
  const [activeDetail, setActiveDetail] = useState<{
    title: string;
    data: Record<string, any>;
  } | null>(null);

  // Sync UI with 2D mode changes (works for toolbar toggle and internal FloorSelector changes)
  useEffect(() => {
    if (is2DMode) {
      // Add body guard class
      document.body.classList.add('mode-2d');

      // Click close buttons where available to trigger native handlers
      const statusClose = document.getElementById('status-close-btn');
      const groupsClose = document.getElementById('groups-close-btn');
      statusClose?.click();
      groupsClose?.click();

      // Ensure selection tool is off
      const selectionBtn = document.getElementById('selection-tool-btn');
      if (selectionBtn && selectionBtn.classList.contains('active')) {
        selectionBtn.click();
      }

      // Disable toolbar buttons
      ['status-toggle-btn', 'groups-toggle-btn', 'selection-tool-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('active');
          el.removeAttribute('aria-expanded');
          el.removeAttribute('aria-pressed');
          el.classList.add('disabled-in-2d');
          el.setAttribute('disabled', 'true');
        }
      });

      // Floor panel visible in 2D
      setFloorPanelVisible(true);
      setStatusPanelVisible(false);
    } else {
      // Remove body guard class
      document.body.classList.remove('mode-2d');

      // Re-enable toolbar buttons
      ['status-toggle-btn', 'groups-toggle-btn', 'selection-tool-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('disabled-in-2d');
          el.removeAttribute('disabled');
        }
      });

      // Reset any forced styles on panels
      ['statusPanel', 'groupsPanel', 'infoPanel'].forEach(id => {
        const panel = document.getElementById(id) as HTMLElement | null;
        if (panel) {
          panel.style.transform = '';
          panel.style.pointerEvents = '';
        }
      });

      // Hide floor panel in 3D
      setFloorPanelVisible(false);
    }
  }, [is2DMode]);
  const [floorPanelVisible, setFloorPanelVisible] = useState(false);
  // Initialize Lucide icons when error state changes
  useEffect(() => {
    if (error && (window as any).lucide) {
      setTimeout(() => {
        (window as any).lucide.createIcons();
      }, 100);
    }
  }, [error]);

  // Initialize Lucide icons when loading state changes
  useEffect(() => {
    if (isLoading && (window as any).lucide) {
      setTimeout(() => {
        (window as any).lucide.createIcons();
      }, 100);
    }
  }, [isLoading]);

  // Ref to track the reset timeout
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for custom loading events from main.ts
  useEffect(() => {
    const handleViewerLoading = (event: CustomEvent) => {
      const { isLoading: loading, status, title, subtitle, progress } = event.detail;

      // If starting a new load, clear any pending reset
      if (loading === true && resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }

      if (loading !== undefined) setIsLoading(loading);
      if (status) setLoadingStatus(status);
      if (title) setLoadingTitle(title);
      if (subtitle) setLoadingSubtitle(subtitle);
      if (progress !== undefined) setLoadingProgress(progress);

      // Reset titles to default when loading finishes
      if (loading === false) {
        // Clear any existing timeout first
        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current);
        }

        // Small delay to let the animation finish
        resetTimeoutRef.current = setTimeout(() => {
          setLoadingTitle('Loading Viewer');
          setLoadingSubtitle('Initializing Uniqube Engine');
          setLoadingProgress(0);
          resetTimeoutRef.current = null;
        }, 500);
      }
    };

    const handleProgress = (event: CustomEvent) => {
      if (event.detail?.progress !== undefined) {
        setLoadingProgress(Math.min(event.detail.progress, 99));
      }
      if (event.detail?.status) {
        setLoadingStatus(event.detail.status);
      }
    };

    window.addEventListener('viewer-loading' as any, handleViewerLoading);
    window.addEventListener('viewer-progress' as any, handleProgress);

    return () => {
      window.removeEventListener('viewer-loading' as any, handleViewerLoading);
      window.removeEventListener('viewer-progress' as any, handleProgress);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  // Load publish revisions once per project (do not re-run on isLoading —
  // that was resetting the selector to Latest and blocking re-select).
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const apiBase = getBrowserApiBase();
        const res = await fetch(`${apiBase}/projects/${projectId}/publish-revisions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list: PublishRevision[] = data.revisions || [];
        setRevisions(list);
        const urlRev = searchParams.get('revision');
        const stored = projectId
          ? sessionStorage.getItem(`uq_publish_revision_${projectId}`)
          : null;
        setSelectedRevisionId((prev) => {
          if (prev && list.some((r) => r.id === prev)) return prev;
          if (urlRev && list.some((r) => r.id === urlRev)) return urlRev;
          if (stored && list.some((r) => r.id === stored)) return stored;
          const latest = list.find((r) => r.isLatest) || list[0];
          return latest?.id || '';
        });
      } catch (e) {
        console.warn('Failed to load publish revisions:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const handleRevisionChange = async (revisionId: string) => {
    const rev = revisions.find((r) => r.id === revisionId);
    if (!rev) return;
    const api = (window as any).__uniqubeViewer;
    if (!api?.loadRevisionModels) {
      console.warn('Viewer revision API not ready');
      return;
    }
    setSelectedRevisionId(revisionId);
    setRevisionSwitching(true);
    setCadOpen(false);
    setActiveDrawing(null);
    setActiveSchedule(null);
    setActiveDetail(null);
    try {
      await api.loadRevisionModels(
        rev.models.map((m) => ({
          id: m.id,
          name: m.originalFilename || m.name,
          category: m.category,
        }))
      );
    } catch (e) {
      console.error(e);
      setError('Failed to load selected version');
    } finally {
      setRevisionSwitching(false);
    }
  };

  useEffect(() => {
    if (!hideMenuOpen) return;
    const placeMenu = () => {
      const btn = document.getElementById('hide-layers-btn');
      const wrap = hideMenuRef.current;
      if (!btn || !wrap) return;
      const r = btn.getBoundingClientRect();
      wrap.style.setProperty('--layers-menu-top', `${Math.round(r.bottom + 6)}px`);
      wrap.style.setProperty('--layers-menu-right', `${Math.round(window.innerWidth - r.right)}px`);
    };
    placeMenu();
    const onPointer = (e: MouseEvent) => {
      if (!hideMenuRef.current?.contains(e.target as Node)) {
        setHideMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHideMenuOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointer);
    }, 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', placeMenu);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', placeMenu);
    };
  }, [hideMenuOpen]);

  useEffect(() => {
    const onReset = () => {
      setHideSheathing(false);
      setHideWalls(false);
      setHideFloors(false);
      setHideAcp(false);
      setHideDoorsWindows(false);
    };
    window.addEventListener('uniqube-hide-layers-reset', onReset);
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setHideSheathing(!!detail.sheathing);
      setHideWalls(!!detail.walls);
      setHideFloors(!!detail.floors);
      setHideAcp(!!detail.acp);
      setHideDoorsWindows(!!detail.doorsWindows);
    };
    window.addEventListener('uniqube-hide-layers-sync', onSync as EventListener);
    return () => {
      window.removeEventListener('uniqube-hide-layers-reset', onReset);
      window.removeEventListener('uniqube-hide-layers-sync', onSync as EventListener);
    };
  }, []);

  useEffect(() => {
    if ((window as any).lucide?.createIcons) {
      (window as any).lucide.createIcons();
    }
  }, [hideMenuOpen]);

  type HideLayer = 'sheathing' | 'walls' | 'floors' | 'acp' | 'doorsWindows';

  const applyHideLayer = async (layer: HideLayer, hidden: boolean) => {
    const api = (window as any).__uniqubeViewer;
    if (!api?.setHideLayer) {
      console.warn('Viewer not ready — cannot hide layers yet');
      return false;
    }
    setHideBusy(true);
    try {
      const result = await api.setHideLayer(layer, hidden);
      if (!result?.ok && hidden) {
        console.warn(`No ${layer} elements found to hide`);
        return false;
      }
      return true;
    } catch (e) {
      console.error(`Failed to toggle hide ${layer}:`, e);
      return false;
    } finally {
      setHideBusy(false);
    }
  };

  const applyInstallState = (state: any) => {
    if (!state) return;
    if (state.active) {
      setInstallMode(true);
      setInstallStep({
        index: state.index ?? 0,
        total: state.total ?? 0,
        display: state.display || '',
        isFirst: !!state.isFirst,
        isLast: !!state.isLast,
        previous: Array.isArray(state.previous) ? state.previous : [],
        upcoming: Array.isArray(state.upcoming) ? state.upcoming : [],
        current: state.current || null,
        connectorsProject: Array.isArray(state.connectorsProject)
          ? state.connectorsProject
          : [],
        playing: !!state.playing,
        isComplete: !!state.isComplete,
      });
      document.body.classList.add('mode-install');
    } else {
      setInstallMode(false);
      setInstallStep(null);
      setSeqDetailsExpanded(false);
      document.body.classList.remove('mode-install');
    }
  };

  const enterInstallMode = async () => {
    const api = (window as any).__uniqubeViewer;
    if (!api?.enterInstallSequence) {
      console.warn('Install sequence API not ready');
      return;
    }
    setInstallBusy(true);
    try {
      // Close side panels for a focused “game” view
      setBrowserOpen(false);
      setCadOpen(false);
      const result = await api.enterInstallSequence();
      if (!result?.ok) {
        alert(result?.error || 'No panels available for install sequence');
        return;
      }
      applyInstallState(result);
    } catch (e) {
      console.error('Failed to enter install sequence:', e);
    } finally {
      setInstallBusy(false);
    }
  };

  const exitInstallMode = async () => {
    const api = (window as any).__uniqubeViewer;
    if (!api?.exitInstallSequence) return;
    api.pauseInstallSequence?.();
    setInstallBusy(true);
    try {
      const result = await api.exitInstallSequence();
      applyInstallState(result);
    } catch (e) {
      console.error('Failed to exit install sequence:', e);
      setInstallMode(false);
      setInstallStep(null);
      setSeqDetailsExpanded(false);
      document.body.classList.remove('mode-install');
    } finally {
      setInstallBusy(false);
    }
  };

  const stepInstall = async (direction: 'next' | 'prev') => {
    const api = (window as any).__uniqubeViewer;
    if (!api?.goInstallSequence || installBusy) return;
    api.pauseInstallSequence?.();
    setInstallBusy(true);
    try {
      const result = await api.goInstallSequence(direction);
      if (result?.ok) applyInstallState(result);
    } catch (e) {
      console.error('Install step failed:', e);
    } finally {
      setInstallBusy(false);
    }
  };

  const toggleInstallPlay = async () => {
    const api = (window as any).__uniqubeViewer;
    if (!api?.playInstallSequence || installBusy) return;
    if (installStep?.playing) {
      api.pauseInstallSequence?.();
      return;
    }
    try {
      await api.playInstallSequence();
    } catch (e) {
      console.error('Install play failed:', e);
    }
  };

  const finishInstall = async () => {
    await exitInstallMode();
  };

  useEffect(() => {
    const onSeq = (e: Event) => {
      applyInstallState((e as CustomEvent).detail);
    };
    window.addEventListener('uniqube-install-sequence', onSeq as EventListener);
    return () => {
      window.removeEventListener('uniqube-install-sequence', onSeq as EventListener);
      document.body.classList.remove('mode-install');
    };
  }, []);

  useEffect(() => {
    if (!installMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        void toggleInstallPlay();
        return;
      }
      if (installBusy) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (installStep?.isLast) void finishInstall();
        else void stepInstall('next');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void stepInstall('prev');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        void exitInstallMode();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [installMode, installBusy, installStep?.isLast, installStep?.playing]);

  useEffect(() => {
    if (!viewer || isLoading || !selectedRevisionId || !revisions.length) return;
    if (appliedRevisionRef.current === selectedRevisionId) return;
    const rev = revisions.find((r) => r.id === selectedRevisionId);
    if (!rev) return;
    appliedRevisionRef.current = selectedRevisionId;
    if (rev.isLatest) return;
    void handleRevisionChange(rev.id);
  }, [viewer, isLoading, selectedRevisionId, revisions]);

  // Initialize the 3D viewer when container is attached
  const initializeViewer = async (containerElement: HTMLDivElement) => {
    if (mainScriptRef.current) {
      console.log('⏭️ Skipping: viewer already initialized');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setLoadingProgress(0);
      setLoadingStatus('Initializing viewer...');
      setLoadingTitle('Loading Viewer');
      setLoadingSubtitle('Initializing Uniqube Engine');
      mainScriptRef.current = true;


      console.log('🔄 Starting viewer initialization...');
      console.log('📍 Container element:', containerElement);
      console.log('📍 Container ID:', containerElement.id);

      // Clear any existing content and WebGL contexts
      const existingCanvases = containerElement.querySelectorAll('canvas');
      existingCanvases.forEach(canvas => {
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (gl && gl.getExtension('WEBGL_lose_context')) {
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
      });
      containerElement.innerHTML = '';

      // Ensure the container has the correct ID that main.ts expects
      containerElement.id = 'container';

      // Set URL parameters for the main script to use
      const urlParams = new URLSearchParams();
      if (modelId) {
        urlParams.set('model', modelId);
      }

      const elementId = searchParams.get('element');
      if (elementId) {
        urlParams.set('element', elementId);
      }

      // Update the URL search params for the main script
      const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
      window.history.replaceState({}, '', newUrl);

      // Wait a bit more to ensure DOM is fully ready
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify container is accessible
      const verifyContainer = document.getElementById('container');
      console.log('🔍 Verifying container accessibility:', !!verifyContainer);

      if (!verifyContainer) {
        throw new Error('Container element not accessible in DOM');
      }

      console.log('📦 Importing and initializing viewer...');

      // Setup progress listener before import
      const handleProgress = (event: CustomEvent) => {
        setLoadingProgress(Math.min(event.detail.progress, 99));
        setLoadingStatus(event.detail.status);
      };

      window.addEventListener('viewer-progress' as any, handleProgress);

      // Import and call the initialization function
      const { initializeViewer } = await import('./main');

      console.log('⏳ Starting viewer initialization...');
      const viewerInstance = await initializeViewer('container');

      console.log('✅ Viewer initialized successfully:', viewerInstance);

      // Store viewer instance for 2D views access
      setViewer(viewerInstance);

      // Final progress update
      setLoadingProgress(100);
      setLoadingStatus('Finalizing...');

      // Shorter delay - no need to wait so long
      await new Promise(resolve => setTimeout(resolve, 300));

      setIsLoading(false);
      console.log('🎯 Loading overlay removed');

      // Cleanup progress listener
      window.removeEventListener('viewer-progress' as any, handleProgress);
    } catch (err) {
      console.error('❌ Failed to load viewer:', err);

      // Determine error type and set appropriate message
      let errorMsg = 'Failed to load viewer';
      let errType = 'unknown';

      if (err && typeof err === 'object' && 'name' in err) {
        const errorName = (err as any).name;

        if (errorName === 'ProjectNotFoundError') {
          errType = 'project_not_found';
          errorMsg = err instanceof Error ? err.message : 'Project not found';
        } else if (errorName === 'NetworkError') {
          errType = 'network';
          errorMsg = err instanceof Error ? err.message : 'Network error occurred';
        } else if (errorName === 'ModelLoadError') {
          errType = 'model_load';
          errorMsg = err instanceof Error ? err.message : 'Failed to load 3D models';
        } else if (errorName === 'WebGLError') {
          errType = 'webgl';
          errorMsg = err instanceof Error ? err.message : 'WebGL not supported';
        } else if (err instanceof Error) {
          errorMsg = err.message;
        }
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      setError(errorMsg);
      setErrorType(errType);
      setIsLoading(false);
      mainScriptRef.current = false;

      // Cleanup progress listener
      window.removeEventListener('viewer-progress' as any, () => { });
    }
  };

  // Load Lucide icons script
  useEffect(() => {
    // Add Lucide vanilla JS library
    const lucideScript = document.createElement('script');
    lucideScript.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
    lucideScript.async = true;
    lucideScript.onload = () => {
      console.log('✅ Lucide icons library loaded');
      // Make lucide available globally for main.ts
      (window as any).lucide = (window as any).lucide;
    };
    document.head.appendChild(lucideScript);

    return () => {
      // Cleanup on unmount
      if (lucideScript.parentNode) {
        lucideScript.parentNode.removeChild(lucideScript);
      }
    };
  }, []);

  // Initialize viewer when component mounts
  useEffect(() => {
    console.log('🔗 useEffect triggered, checking container...');
    console.log('📍 containerRef.current:', containerRef.current);
    console.log('📍 mainScriptRef.current:', mainScriptRef.current);

    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max wait time

    const tryInitialize = () => {
      const containerElement = document.getElementById('container') as HTMLDivElement;
      console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries} - Container (ref):`, !!containerRef.current, 'Container (DOM):', !!containerElement, 'Initialized:', mainScriptRef.current);

      if (containerElement && !mainScriptRef.current) {
        console.log('⏰ Container found via DOM, initializing viewer...');
        initializeViewer(containerElement);
        return; // Exit the retry loop after initialization attempt
      } else if (mainScriptRef.current) {
        console.log('✅ Initialization already attempted, stopping retry loop');
        return; // Exit if already initialized
      } else if (retryCount < maxRetries) {
        retryCount++;
        console.log(`❌ Container not ready, retrying in 100ms... (${retryCount}/${maxRetries})`);
        setTimeout(tryInitialize, 100);
      } else {
        document.body.classList.remove('mode-2d');
        console.error('💥 Failed to initialize viewer: Container never became available');
        setError('Failed to initialize 3D viewer: Container not found');
        setIsLoading(false);
      }
    };

    // Use multiple approaches to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(tryInitialize, 50); // Small initial delay
    });
  }, []); // Empty dependency array means this runs once on mount

  // Wire up 2D toggle button
  useEffect(() => {
    if (!viewer?.views2d) return;

    // 2D toggle button is now handled by React onClick - no need for manual event listener
    console.log('✅ 2D toggle button wired up via React onClick');
  }, [viewer]);

  // Cleanup on unmount
  useLayoutEffect(() => {
    return () => {
      console.log('🧹 Component cleanup');

      // Dispose 2D views
      if (viewer?.views2d) {
        try {
          viewer.views2d.dispose();
        } catch (e) {
          console.warn('Failed to dispose 2D views:', e);
        }
      }

      const container = document.getElementById('container') as HTMLDivElement;
      if (container) {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
          if (gl && gl.getExtension('WEBGL_lose_context')) {
            gl.getExtension('WEBGL_lose_context')?.loseContext();
          }
        }
        container.innerHTML = '';
      }
      mainScriptRef.current = false;
    };
  }, []);

  // Reset view function
  const resetView = () => {
    const resetBtn = document.getElementById('tree-reset-btn');
    if (resetBtn) {
      resetBtn.click();
    }
  };

  const toggleStatusPanel = () => {
    setStatusPanelVisible(!statusPanelVisible);
  };

  // Toggle 2D/3D mode and Floor Plans panel
  const toggle2DMode = async () => {
    if (!viewer?.views2d) {
      console.warn('⚠️ 2D views not available');
      return;
    }

    const newMode = !is2DMode;
    setIs2DMode(newMode);
    setFloorPanelVisible(newMode);

    // When entering 2D mode, close and disable other panels
    if (newMode) {
      // Add body guard class to enforce hiding via CSS too
      document.body.classList.add('mode-2d');
      setStatusPanelVisible(false);

      // Forcibly hide panels via DOM classes (authoritative)
      const statusPanelEl = document.getElementById('statusPanel');
      const groupsPanelEl = document.getElementById('groupsPanel');
      const infoPanelEl = document.getElementById('infoPanel');

      if (statusPanelEl && !statusPanelEl.classList.contains('panel-hidden')) {
        statusPanelEl.classList.add('panel-hidden');
        console.log('✅ Closed status panel');
      }
      if (groupsPanelEl && !groupsPanelEl.classList.contains('panel-hidden')) {
        groupsPanelEl.classList.add('panel-hidden');
        console.log('✅ Closed groups panel');
      }
      if (infoPanelEl && !infoPanelEl.classList.contains('panel-hidden')) {
        infoPanelEl.classList.add('panel-hidden');
        console.log('✅ Closed info panel');
      }

      // Explicitly disable selection tool if it is active
      const selectionBtn = document.getElementById('selection-tool-btn');
      if (selectionBtn && selectionBtn.classList.contains('active')) {
        // Click to trigger main.ts handler to remove canvas listener
        selectionBtn.click();
        console.log('🛑 Selection tool deactivated');
      }

      // Disable toolbar buttons for other panels
      const buttonsToDisable = [
        'selection-tool-btn',
        'status-toggle-btn',
        'groups-toggle-btn'
      ];

      buttonsToDisable.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
          button.classList.remove('active');
          button.removeAttribute('aria-expanded');
          button.removeAttribute('aria-pressed');
          button.classList.add('disabled-in-2d');
          button.setAttribute('disabled', 'true');
        }
      });

      console.log('🔒 Other panels disabled and closed for 2D mode');
    } else {
      // Remove body guard class
      document.body.classList.remove('mode-2d');

      // When exiting 2D mode, re-enable toolbar buttons
      const buttonsToEnable = [
        'selection-tool-btn',
        'status-toggle-btn',
        'groups-toggle-btn'
      ];

      buttonsToEnable.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
          button.classList.remove('disabled-in-2d');
          button.removeAttribute('disabled');
        }
      });

      // Reset panel transforms to allow normal operation
      const panelsToReset = [
        'statusPanel',
        'groupsPanel',
        'infoPanel'
      ];

      panelsToReset.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
          // Remove any inline transform styles that might override CSS
          panel.style.transform = '';
          panel.style.pointerEvents = '';
        }
      });

      console.log('🔓 Other panels re-enabled for 3D mode');
    }

    try {
      if (newMode) {
        // Switch to 2D mode - open full model 2D view
        await viewer.views2d.openFullModel2DView();
      } else {
        // Switch to 3D mode - COMPLETELY turn off 2D
        await viewer.views2d.close3DMode();
        setCurrentFloor(null);
        setFloorPanelVisible(false);

        // Force remove mode-2d class and ensure UI is reset
        document.body.classList.remove('mode-2d');

        // Re-enable all toolbar buttons immediately
        ['status-toggle-btn', 'groups-toggle-btn', 'selection-tool-btn'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.classList.remove('disabled-in-2d');
            el.removeAttribute('disabled');
          }
        });

        // Reset panel styles immediately
        ['statusPanel', 'groupsPanel', 'infoPanel'].forEach(id => {
          const panel = document.getElementById(id) as HTMLElement | null;
          if (panel) {
            panel.style.transform = '';
            panel.style.pointerEvents = '';
          }
        });
      }
      console.log('✅ 2D Mode toggled:', newMode ? 'ON' : 'OFF');
    } catch (error) {
      console.error('❌ Failed to toggle 2D mode:', error);
      // Even on error, if turning off 2D, force UI reset
      if (!newMode) {
        setCurrentFloor(null);
        setFloorPanelVisible(false);
        document.body.classList.remove('mode-2d');
      }
    }
  };

  // Handle floor change from FloorSelector
  const handleFloorChange = (floorName: string) => {
    setCurrentFloor(floorName);
    setIs2DMode(true);
    console.log('📍 Current floor:', floorName);
  };

  // Handle mode change from FloorSelector
  const handleModeChange = (is2D: boolean) => {
    setIs2DMode(is2D);
    if (!is2D) {
      setCurrentFloor(null);
    }
    console.log('🔄 View mode:', is2D ? '2D' : '3D');
  };



  // Keep 3D + DXF canvases sized when entering/leaving side-by-side View
  useEffect(() => {
    if (!cadOpen) {
      setCadSplit(false);
      return;
    }
    const kick = () => window.dispatchEvent(new Event('resize'));
    const t1 = window.setTimeout(kick, 40);
    const t2 = window.setTimeout(kick, 200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [cadOpen, cadSplit, browserOpen]);

  return (
    <div
      className={`viewer-container${cadOpen && cadSplit ? ' cad-split-active' : ''}${
        browserOpen ? ' browser-open' : ''
      }`}
    >
      {/* Main 3D Container */}
      <div
        id="container"
        ref={containerRef}
        style={{
          width: cadOpen && cadSplit ? undefined : '100%',
          height: '100%',
          position: 'relative'
        }}
      ></div>

      {/* Modern Glassmorphism Loading Overlay */}
      {isLoading && (
        <div className={`viewer-overlay ${['Filtering Elements', 'Clearing Filters', 'Removing Filter'].includes(loadingTitle) ? 'transparent' : ''}`}>
          <div className="loading-content">
            <div className="loader-card">
              <div className="loader-icon-container">
                <div className="loader-spinner"></div>
                <div className="loader-logo" style={{ animation: 'none' }}>
                  <Cube size={40} color="slate" />
                </div>
              </div>

              <h1 className="loader-title">{loadingTitle}</h1>
              <p className="loader-subtitle">{loadingSubtitle}</p>

              {!['Filtering Elements', 'Clearing Filters', 'Removing Filter'].includes(loadingTitle) && (
                <>
                  <p className="loader-status">{loadingStatus}</p>

                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>

                  <div className="progress-stats">
                    <span className="progress-label">Progress</span>
                    <span className="progress-value">{Math.round(loadingProgress)}%</span>
                  </div>
                </>
              )}
            </div>

            {!['Filtering Elements', 'Clearing Filters', 'Removing Filter'].includes(loadingTitle) && (
              <div className="loading-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modern Glassmorphism Error Overlay */}
      {error && (
        <div className="viewer-overlay">
          <div className="error-card">
            <div className="error-icon">
              <i data-lucide={
                errorType === 'project_not_found' ? 'folder-x' :
                  errorType === 'network' ? 'wifi-off' :
                    errorType === 'model_load' ? 'package-x' :
                      errorType === 'webgl' ? 'monitor-x' :
                        'alert-triangle'
              }></i>
            </div>

            <h2 className="error-title">
              {errorType === 'project_not_found' ? 'Project Not Found' :
                errorType === 'network' ? 'Connection Error' :
                  errorType === 'model_load' ? 'Model Load Failed' :
                    errorType === 'webgl' ? 'WebGL Not Supported' :
                      'Failed to Load Viewer'}
            </h2>

            <div className="error-message">
              {error}
            </div>

            <div className="error-actions">
              {/* Conditional buttons based on error type */}
              {errorType === 'network' && (
                <button
                  className="btn-reload"
                  onClick={() => window.location.reload()}
                >
                  <i data-lucide="refresh-cw"></i>
                  Reload Viewer
                </button>
              )}

              {errorType === 'project_not_found' && (
                <>
                  <button
                    className="btn-reload btn-secondary"
                    onClick={() => window.history.back()}
                  >
                    <i data-lucide="arrow-left"></i>
                    Go Back
                  </button>
                  <button
                    className="btn-reload"
                    onClick={() => window.location.href = '/'}
                  >
                    <i data-lucide="home"></i>
                    Projects
                  </button>
                </>
              )}

              {errorType === 'model_load' && (
                <>
                  <button
                    className="btn-reload btn-secondary"
                    onClick={() => window.location.reload()}
                  >
                    <i data-lucide="refresh-cw"></i>
                    Retry
                  </button>
                  <button
                    className="btn-reload"
                    onClick={() => window.location.href = `/projects/${projectId}`}
                  >
                    <i data-lucide="upload"></i>
                    Upload Model
                  </button>
                </>
              )}

              {errorType === 'webgl' && (
                <button
                  className="btn-reload"
                  onClick={() => window.open('https://get.webgl.org/', '_blank')}
                >
                  <i data-lucide="external-link"></i>
                  Learn More
                </button>
              )}

              {/* Default fallback for unknown errors */}
              {!errorType || errorType === 'unknown' && (
                <button
                  className="btn-reload"
                  onClick={() => window.location.reload()}
                >
                  <i data-lucide="refresh-cw"></i>
                  Reload Viewer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div id="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-brand">
            <div className="toolbar-brand-mark">
              <img src="/uniQube.png" alt="" className="toolbar-brand-logo" />
            </div>
            <h1 className="toolbar-brand-title">
              UNIQUBE<span className="toolbar-brand-accent">-3D</span>
            </h1>
          </div>
          {installMode && (
            <span className="seq-header-mode-badge" aria-live="polite">
              Sequence
            </span>
          )}
          <button
            className="toolbar-button toolbar-text-btn toolbar-back-btn"
            onClick={() => {
              const elementId = searchParams.get('element');
              if (elementId) {
                window.location.href = `/projects/${projectId}/element-report#${elementId}`;
              } else {
                window.location.href = `/projects/${projectId}`;
              }
            }}
          >
            <i className="fas fa-arrow-left toolbar-icon" aria-hidden="true"></i>
            <span className="toolbar-label">
              {searchParams.get('element') ? 'Report' : 'Back'}
            </span>
          </button>
        </div>

        <div className="toolbar-actions">
          <div className="toolbar-group">
            <button
              id="project-browser-btn"
              className={`toolbar-button toolbar-text-btn ${browserOpen ? 'active' : ''}`}
              onClick={() => setBrowserOpen((v) => !v)}
              disabled={isLoading}
            >
              <i className="fas fa-project-diagram toolbar-icon" aria-hidden="true"></i>
              <span className="toolbar-label">Browser</span>
            </button>
            <button id="selection-tool-btn" className="toolbar-button toolbar-text-btn">
              <i className="fas fa-mouse-pointer toolbar-icon" aria-hidden="true"></i>
              <span className="toolbar-label">Select</span>
            </button>
            <button id="status-toggle-btn" className="toolbar-button toolbar-text-btn">
              <i className="fas fa-tags toolbar-icon" aria-hidden="true"></i>
              <span className="toolbar-label">Status</span>
            </button>
            <button id="groups-toggle-btn" className="toolbar-button toolbar-text-btn">
              <i className="fas fa-layer-group toolbar-icon" aria-hidden="true"></i>
              <span className="toolbar-label">Groups</span>
            </button>
          </div>

          <div className="toolbar-group">
            <button
              type="button"
              className={`toolbar-button toolbar-text-btn header-2d-btn ${browserOpen && browserTab === '2d' ? 'active' : ''}`}
              onClick={() => {
                if (browserOpen && browserTab === '2d') {
                  setBrowserOpen(false);
                  return;
                }
                setBrowserTab('2d');
                setBrowserOpen(true);
              }}
              disabled={isLoading}
            >
              <i className="fas fa-drafting-compass toolbar-icon" aria-hidden="true"></i>
              <span className="toolbar-label">2D</span>
            </button>
            <button
              id="install-sequence-btn"
              className={`toolbar-button toolbar-text-btn sequence-btn ${installMode ? 'active' : ''}`}
              type="button"
              disabled={isLoading || installBusy}
              onClick={() => {
                if (installMode) void exitInstallMode();
                else void enterInstallMode();
              }}
            >
              <i className="fas fa-list-ol toolbar-icon" aria-hidden="true"></i>
              <span className="toolbar-label sequence-label">
                {installMode ? 'Exit Sequence' : 'Sequence'}
              </span>
            </button>
          </div>

          <div className="toolbar-group">
            <button
              id="discipline-arch-btn"
              className="toolbar-button discipline-btn active"
              data-discipline="architecture"
              type="button"
            >
              <i className="fas fa-building toolbar-icon" aria-hidden="true"></i>
              <span className="discipline-label">Architecture</span>
            </button>
            <button
              id="discipline-mep-btn"
              className="toolbar-button discipline-btn active"
              data-discipline="mep"
              type="button"
            >
              <i className="fas fa-bolt toolbar-icon" aria-hidden="true"></i>
              <span className="discipline-label">MEP</span>
            </button>
            <button
              id="discipline-str-btn"
              className="toolbar-button discipline-btn active"
              data-discipline="structure"
              type="button"
            >
              <i className="fas fa-cube toolbar-icon" aria-hidden="true"></i>
              <span className="discipline-label">Structure</span>
            </button>
          </div>

          <div className="toolbar-group">
            <div className={`hide-layers-wrap ${hideMenuOpen ? 'open' : ''}`} ref={hideMenuRef}>
              <button
                id="hide-layers-btn"
                className={`toolbar-button toolbar-text-btn ${
                  hideSheathing || hideWalls || hideFloors || hideAcp || hideDoorsWindows
                    ? 'active'
                    : ''
                }`}
                type="button"
                aria-expanded={hideMenuOpen}
                aria-haspopup="true"
                aria-label="Layers"
                onClick={(e) => {
                  e.stopPropagation();
                  setHideMenuOpen((v) => !v);
                }}
              >
                <i className="fas fa-eye toolbar-icon" aria-hidden="true"></i>
                <span className="toolbar-label">Layers</span>
              </button>
              {hideMenuOpen && (
                <div
                  className="hide-layers-menu"
                  role="menu"
                  aria-label="Layer visibility"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="hide-layers-title">Visibility</div>

                  <div className="hide-layers-section">
                    <div className="hide-layers-section-label">Architecture</div>
                    <label className="hide-layers-item">
                      <input
                        id="hide-layer-acp"
                        type="checkbox"
                        checked={!hideAcp}
                        disabled={hideBusy}
                        onChange={async (e) => {
                          const hidden = !e.target.checked;
                          const ok = await applyHideLayer('acp', hidden);
                          setHideAcp(ok ? hidden : false);
                        }}
                      />
                      <span>ACP</span>
                    </label>
                    <label className="hide-layers-item">
                      <input
                        id="hide-layer-doors-windows"
                        type="checkbox"
                        checked={!hideDoorsWindows}
                        disabled={hideBusy}
                        onChange={async (e) => {
                          const hidden = !e.target.checked;
                          const ok = await applyHideLayer('doorsWindows', hidden);
                          setHideDoorsWindows(ok ? hidden : false);
                        }}
                      />
                      <span>Doors & Windows</span>
                    </label>
                    <label className="hide-layers-item">
                      <input
                        id="hide-layer-floors"
                        type="checkbox"
                        checked={!hideFloors}
                        disabled={hideBusy}
                        onChange={async (e) => {
                          const hidden = !e.target.checked;
                          const ok = await applyHideLayer('floors', hidden);
                          setHideFloors(ok ? hidden : false);
                        }}
                      />
                      <span>Floors</span>
                    </label>
                    <label className="hide-layers-item">
                      <input
                        id="hide-layer-sheathing"
                        type="checkbox"
                        checked={!hideSheathing}
                        disabled={hideBusy}
                        onChange={async (e) => {
                          const hidden = !e.target.checked;
                          const ok = await applyHideLayer('sheathing', hidden);
                          setHideSheathing(ok ? hidden : false);
                        }}
                      />
                      <span>Sheathing</span>
                    </label>
                    <label className="hide-layers-item">
                      <input
                        id="hide-layer-walls"
                        type="checkbox"
                        checked={!hideWalls}
                        disabled={hideBusy}
                        onChange={async (e) => {
                          const hidden = !e.target.checked;
                          const ok = await applyHideLayer('walls', hidden);
                          setHideWalls(ok ? hidden : false);
                        }}
                      />
                      <span>Walls</span>
                    </label>
                  </div>

                  <div className="hide-layers-section">
                    <div className="hide-layers-section-label">MEP</div>
                    <div className="hide-layers-empty">No layer filters yet</div>
                  </div>

                  <div className="hide-layers-section">
                    <div className="hide-layers-section-label">Structure</div>
                    <div className="hide-layers-empty">No layer filters yet</div>
                  </div>
                </div>
              )}
            </div>
            <button id="tree-reset-btn" className="toolbar-button toolbar-text-btn">
              <i className="fas fa-undo toolbar-icon" aria-hidden="true"></i>
              <span className="toolbar-label">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div id="infoPanel" className="info-panel panel-hidden">
        <div id="infoPanelHeader">
          <h3>Panel Information</h3>
          <button id="info-close-btn"><i className="fas fa-times"></i></button>
        </div>
        <div id="infoPanelContent" className="info-content">
          {/* Basic Info */}
          <div className="info-section">
            <div className="info-row">
              <div className="info-label">Name</div>
              <div className="info-value">-</div>
            </div>
            <div className="info-row">
              <div className="info-label">ID</div>
              <div className="info-value">-</div>
            </div>
            <div className="info-row">
              <div className="info-label">Active Status</div>
              <div className="info-value">
                <select id="element-active-status" className="status-select">
                  <option value="">No status assigned</option>
                </select>
              </div>
            </div>
            <div className="info-actions">
              <button id="show-qr-btn" className="info-action-btn" title="Show QR Code">
                <i className="fas fa-qrcode"></i>
              </button>
              <button id="show-submissions-btn" className="info-action-btn" title="View Submissions">
                <i className="fas fa-bell"></i>
                <span id="submission-count" className="notification-badge">0</span>
              </button>
            </div>
          </div>

          {/* Groups Section */}
          <div className="info-section">
            <div className="info-section-header">
              <h4>Groups</h4>
            </div>
            <div id="element-groups-list" className="element-groups-list">
              {/* Groups will be populated here */}
            </div>
          </div>

          {/* Status Section */}
          <div className="info-section">
            <div className="info-section-header">
              <h4>Status</h4>
            </div>
            <div id="element-status-list" className="element-status-list">
              {/* Status will be populated here */}
            </div>
          </div>
        </div>
      </div>

      {/* Status Panel */}
      <div id="statusPanel" className="info-panel panel-hidden">
        <div id="statusPanelHeader">
          <h3>Status Management</h3>
          <button id="status-close-btn"><i className="fas fa-times"></i></button>
        </div>
        <div className="status-actions">
          <button id="add-status-btn" className="add-status-btn">
            <i className="fas fa-plus"></i> Add New Status
          </button>
        </div>
        <div id="statusListContent" className="status-list-content">
          {/* Status items will be populated here */}
        </div>
      </div>

      {/* Groups Panel */}
      <div id="groupsPanel" className="info-panel panel-hidden">
        <div id="groupsPanelHeader">
          <h3>Groups Management</h3>
          <button id="groups-close-btn"><i className="fas fa-times"></i></button>
        </div>
        <div className="status-actions">
          <button id="add-group-btn" className="add-status-btn">
            <i className="fas fa-plus"></i> Add New Group
          </button>
        </div>
        <div id="groupsListContent" className="status-list-content">
          {/* Group items will be populated here */}
        </div>
      </div>

      {/* Add/Edit Group Modal */}
      <div id="groupModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 id="groupModalTitle">Create New Group</h3>
            <button id="group-modal-close-btn"><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>Group Name</label>
              <input type="text" id="group-name-input" placeholder="Enter group name" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea id="group-description-input" placeholder="Enter group description"></textarea>
            </div>
            <div className="form-group">
              <label>Color</label>
              <div className="color-picker-wrapper">
                <input type="color" id="group-color-input" defaultValue="#3B82F6" />
                <input type="text" id="group-color-text" defaultValue="#3B82F6" readOnly />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button id="cancel-group-btn" className="btn-secondary">Cancel</button>
            <button id="save-group-btn" className="btn-primary">
              <i className="fas fa-check"></i> <span id="save-group-text">Create</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Panels Modal */}
      <div id="membersModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content modal-large">
          <div className="modal-header">
            <h3>Add Panels to Group</h3>
            <button id="members-modal-close-btn"><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div id="members-tree-container" className="tree-container">
              {/* Tree for selecting members will be populated here */}
            </div>
          </div>
          <div className="modal-footer">
            <button id="cancel-members-btn" className="btn-secondary">Cancel</button>
            <button id="done-members-btn" className="btn-primary">
              <i className="fas fa-check"></i> Done (<span id="selected-count">0</span>)
            </button>
          </div>
        </div>
      </div>

      {/* Select Groups Modal */}
      <div id="selectGroupsModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Add to Groups</h3>
            <button id="select-groups-modal-close-btn"><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div id="select-groups-list" className="select-groups-list">
              {/* Groups with checkboxes will be populated here */}
            </div>
          </div>
          <div className="modal-footer">
            <button id="cancel-select-groups-btn" className="btn-secondary">Cancel</button>
            <button id="done-select-groups-btn" className="btn-primary">
              <i className="fas fa-check"></i> Done
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      <div id="qrModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Element QR Code</h3>
            <button id="qr-modal-close-btn"><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div className="qr-container">
              <canvas id="qr-canvas"></canvas>
            </div>
            <div className="qr-info">
              <p>Scan this QR code to view element details and submit reports</p>
            </div>
          </div>
          <div className="modal-footer">
            <button id="close-qr-btn" className="btn-secondary">Close</button>
          </div>
        </div>
      </div>

      {/* Submissions Modal */}
      <div id="submissionsModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content modal-large">
          <div className="modal-header">
            <h3>Element Submissions</h3>
            <button id="submissions-modal-close-btn"><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div id="submissions-list" className="submissions-list">
              {/* Submissions will be populated here */}
            </div>
          </div>
          <div className="modal-footer">
            <button id="close-submissions-btn" className="btn-secondary">Close</button>
          </div>
        </div>
      </div>

      {/* Submission Detail Modal */}
      <div id="submissionDetailModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Submission Details</h3>
            <button id="submission-detail-modal-close-btn"><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div id="submission-detail-content">
              {/* Detail content will be populated here */}
            </div>
          </div>
          <div className="modal-footer">
            <button id="close-submission-detail-btn" className="btn-secondary">Close</button>
          </div>
        </div>
      </div>

      {/* Select Status Modal */}
      <div id="selectStatusModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Assign Status</h3>
            <button id="select-status-modal-close-btn"><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div id="select-status-list" className="select-status-list">
              {/* Status with checkboxes will be populated here */}
            </div>
          </div>
          <div className="modal-footer">
            <button id="cancel-select-status-btn" className="btn-secondary">Cancel</button>
            <button id="done-select-status-btn" className="btn-primary">
              <i className="fas fa-check"></i> Done
            </button>
          </div>
        </div>
      </div>

      {/* Add Status Modal */}
      <div id="statusModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Create New Status</h3>
            <button id="modal-close-btn"><i className="fas fa-times"></i></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>Status Name</label>
              <input type="text" id="status-name-input" placeholder="Enter status name" />
            </div>
            <div className="form-group">
              <label>Icon</label>
              <div className="icon-select-wrapper">
                <button type="button" id="icon-select-btn" className="icon-select-btn">
                  <span id="selected-icon-display">Select an icon</span>
                  <i className="fas fa-chevron-down"></i>
                </button>
                <div id="icon-dropdown" className="icon-dropdown">
                  <input type="text" id="icon-search" className="icon-search" placeholder="Search icons..." />
                  <div id="icon-list" className="icon-list"></div>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Color</label>
              <div className="color-picker-wrapper">
                <input type="color" id="status-color-input" defaultValue="#3B82F6" />
                <input type="text" id="status-color-text" defaultValue="#3B82F6" readOnly />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button id="cancel-status-btn" className="btn-secondary">Cancel</button>
            <button id="create-status-btn" className="btn-primary">
              <i className="fas fa-check"></i> Create
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div id="statusBar">
        <div id="status">
          <i className="fas fa-circle"></i> Ready
        </div>
        <div id="selection-summary" className="selection-summary panel-hidden">
          <i className="fas fa-check-double"></i>
          <span id="selection-count-text">0 panels selected</span>
          <button id="clear-selection-btn" type="button" title="Clear selection (Esc)">
            Clear
          </button>
        </div>
        <div id="stats">
          <div className="stat">
            <i className="fas fa-cube"></i>
            <span id="objectCount">0 objects</span>
          </div>
        </div>
      </div>

      {/* Install sequence HUD */}
      {installMode && installStep && (
        <>
          <button
            type="button"
            className="install-seq-exit"
            disabled={installBusy}
            onClick={() => void exitInstallMode()}
            title="Exit sequence (Esc)"
            aria-label="Exit sequence"
          >
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>

          {/* Left gaming annotation — panel connectors for current step */}
          <aside
            className="seq-conn-hud"
            aria-label="Panel connectors"
            key={`conn-hud-${installStep.index}-${installStep.current?.key || ''}`}
          >
            <div className="seq-conn-hud-rail" aria-hidden="true" />
            <div className="seq-conn-hud-card">
              <div className="seq-conn-hud-top">
                <span className="seq-conn-hud-tag">{installStep.isComplete ? 'ALL' : 'OBJ'}</span>
                <span className="seq-conn-hud-step">
                  {installStep.isComplete
                    ? 'FINAL'
                    : `STEP ${String(installStep.index + 1).padStart(2, '0')}`}
                </span>
              </div>
              <div className="seq-conn-hud-label">
                {installStep.isComplete ? 'Building' : 'Connectors'}
              </div>
              <div className="seq-conn-hud-total">
                {installStep.isComplete
                  ? '100%'
                  : (installStep.current?.connectors?.total ?? 0)}
              </div>
              {(installStep.current?.connectors?.total ?? 0) > 0 ? (
                <ul className="seq-conn-hud-list">
                  {Object.entries(installStep.current!.connectors!.byMark)
                    .sort(([a], [b]) =>
                      a.localeCompare(b, undefined, { sensitivity: 'base' })
                    )
                    .map(([mark, count]) => (
                      <li key={mark}>
                        <span className="seq-conn-hud-mark">{mark}</span>
                        <span className="seq-conn-hud-count">×{count}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="seq-conn-hud-none">No fasteners on this panel</div>
              )}
              <div className="seq-conn-hud-target" aria-hidden="true">
                <span />
              </div>
            </div>
          </aside>

          <aside
            className={`seq-detail-panel${seqDetailsExpanded ? ' is-expanded' : ''}`}
            aria-label="Panel details"
          >
            <button
              type="button"
              className="seq-detail-mobile-toggle"
              aria-expanded={seqDetailsExpanded}
              onClick={() => setSeqDetailsExpanded((v) => !v)}
            >
              <span className="seq-detail-mobile-toggle-main">
                <span className="seq-detail-tag">{installStep.isComplete ? 'Final' : 'Target'}</span>
                <span className="seq-detail-mobile-name">
                  {installStep.current?.display || installStep.display || 'Panel'}
                </span>
              </span>
              <span className="seq-detail-mobile-meta">
                {String(installStep.index + 1).padStart(2, '0')}/
                {String(installStep.total).padStart(2, '0')}
                <i
                  className={`fas fa-chevron-${seqDetailsExpanded ? 'down' : 'up'}`}
                  aria-hidden="true"
                />
              </span>
            </button>
            <div className="seq-detail-stack">
              {/* Previous (up to 3) */}
              <div className="seq-detail-context seq-detail-previous">
                <div className="seq-section-tag">Prev</div>
                {installStep.previous.length === 0 ? (
                  <div className="seq-context-empty">Start of sequence</div>
                ) : (
                  installStep.previous.map((item) => (
                    <div key={item.key} className="seq-context-row">
                      <span className="seq-context-mark">{item.display}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Current panel details */}
              <div className="seq-detail-current">
                <div className="seq-detail-top">
                  <span className="seq-detail-tag">{installStep.isComplete ? 'Final' : 'Target'}</span>
                  <span className="seq-detail-eyebrow">
                    {installStep.isComplete
                      ? 'FULL BUILDING'
                      : `STEP ${String(installStep.index + 1).padStart(2, '0')} / ${String(installStep.total).padStart(2, '0')}`}
                  </span>
                </div>
                <h2 className="seq-detail-heading">
                  {installStep.current?.display || installStep.display || 'Panel'}
                </h2>

                <div className="seq-detail-chips">
                  {(installStep.current?.disciplines || []).map((d) => (
                    <span key={d} className={`seq-chip seq-chip-${d}`}>
                      {d === 'structure' ? 'STR' : d === 'mep' ? 'MEP' : d === 'architecture' ? 'ARCH' : d}
                    </span>
                  ))}
                </div>

                {installStep.current?.connectors &&
                installStep.current.connectors.total > 0 ? (
                  <div className="seq-conn-block">
                    <div className="seq-conn-title">
                      This panel
                      <span className="seq-conn-total">
                        {installStep.current.connectors.total}
                      </span>
                    </div>
                    <ul className="seq-conn-list">
                      {Object.entries(installStep.current.connectors.byMark).map(
                        ([mark, count]) => (
                          <li key={mark}>
                            <span className="seq-conn-mark">{mark}</span>
                            <span className="seq-conn-count">×{count}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                ) : null}
                {installStep.connectorsProject.length > 0 && (
                  <div className="seq-conn-block">
                    <div className="seq-conn-title">
                      Project inventory
                      <span className="seq-conn-total">
                        {installStep.connectorsProject.reduce((s, r) => s + r.count, 0)}
                      </span>
                    </div>
                    <ul className="seq-conn-list">
                      {installStep.connectorsProject.map((row) => (
                        <li key={row.mark}>
                          <span className="seq-conn-mark">{row.mark}</span>
                          <span className="seq-conn-count">×{row.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {installStep.isComplete ? (
                  <dl className="seq-detail-grid">
                    <div className="seq-detail-row seq-detail-row-full">
                      <dt>Status</dt>
                      <dd>Full building visible — no layer filters, all disciplines on</dd>
                    </div>
                    <div className="seq-detail-row">
                      <dt>Scope</dt>
                      <dd>Architecture · MEP · Structure</dd>
                    </div>
                  </dl>
                ) : (
                <dl className="seq-detail-grid">
                  <div className="seq-detail-row">
                    <dt>Container</dt>
                    <dd>{installStep.current?.container || installStep.display || '—'}</dd>
                  </div>
                  <div className="seq-detail-row">
                    <dt>Pallet</dt>
                    <dd>{installStep.current?.pallet || '—'}</dd>
                  </div>
                  <div className="seq-detail-row">
                    <dt>Elements</dt>
                    <dd>
                      {installStep.current?.elementCount ?? 0}
                      {installStep.current &&
                      (installStep.current.structureCount ||
                        installStep.current.mepCount ||
                        installStep.current.architectureCount) ? (
                        <span className="seq-detail-sub">
                          {[
                            installStep.current.structureCount
                              ? `${installStep.current.structureCount} S`
                              : null,
                            installStep.current.mepCount
                              ? `${installStep.current.mepCount} M`
                              : null,
                            installStep.current.architectureCount
                              ? `${installStep.current.architectureCount} A`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="seq-detail-row">
                    <dt>Size</dt>
                    <dd>{installStep.current?.sizeLabel || '—'}</dd>
                  </div>
                  <div className="seq-detail-row">
                    <dt>Location</dt>
                    <dd>{installStep.current?.location || '—'}</dd>
                  </div>
                  <div className="seq-detail-row">
                    <dt>Material</dt>
                    <dd>{installStep.current?.material || '—'}</dd>
                  </div>
                  <div className="seq-detail-row">
                    <dt>Weight</dt>
                    <dd>{installStep.current?.weight || '—'}</dd>
                  </div>
                  <div className="seq-detail-row">
                    <dt>Type</dt>
                    <dd>{installStep.current?.objectType || '—'}</dd>
                  </div>
                  <div className="seq-detail-row seq-detail-row-full">
                    <dt>Adjacent</dt>
                    <dd>
                      {installStep.current?.adjacentNames?.length
                        ? installStep.current.adjacentNames.join(', ')
                        : '—'}
                    </dd>
                  </div>
                </dl>
                )}
              </div>

              {/* Upcoming (up to 3) */}
              <div className="seq-detail-context seq-detail-upcoming">
                <div className="seq-section-tag">Next</div>
                {installStep.upcoming.length === 0 ? (
                  <div className="seq-context-empty">
                    {installStep.isComplete ? 'Build complete' : 'End of sequence'}
                  </div>
                ) : (
                  installStep.upcoming.map((item) => (
                    <div key={item.key} className="seq-context-row">
                      <span className="seq-context-mark">{item.display}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          <div className="install-sequence-bar" role="group" aria-label="Install sequence">
            <button
              type="button"
              className="install-seq-btn install-seq-prev"
              disabled={installBusy || installStep.isFirst || !!installStep.playing}
              onClick={() => void stepInstall('prev')}
              title="Previous panel (←)"
            >
              <i className="fas fa-chevron-left" aria-hidden="true"></i>
              <span>Prev</span>
            </button>

            <button
              type="button"
              className={`install-seq-btn install-seq-play${installStep.playing ? ' is-playing' : ''}`}
              disabled={installBusy}
              onClick={() => void toggleInstallPlay()}
              title={installStep.playing ? 'Pause sequence (Space)' : 'Play sequence (Space)'}
              aria-pressed={!!installStep.playing}
            >
              <i
                className={`fas ${installStep.playing ? 'fa-pause' : 'fa-play'}`}
                aria-hidden="true"
              />
              <span>{installStep.playing ? 'Pause' : 'Play'}</span>
            </button>

            <div className="install-seq-center">
              <div className="install-seq-label">
                <span className="install-seq-mode-tag">Mode</span>
                Install sequence
              </div>
              <div className="install-seq-panel">
                {installStep.isComplete ? 'Complete building' : installStep.display || 'Panel'}
              </div>
              <div className="install-seq-progress">
                <span>
                  {String(installStep.index + 1).padStart(2, '0')} /{' '}
                  {String(installStep.total).padStart(2, '0')}
                </span>
                <div className="install-seq-track" aria-hidden="true">
                  <div
                    className="install-seq-fill"
                    style={{
                      width: `${
                        installStep.total
                          ? ((installStep.index + 1) / installStep.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {installStep.isLast ? (
              <button
                type="button"
                className="install-seq-btn install-seq-finish"
                disabled={installBusy || !!installStep.playing}
                onClick={() => void finishInstall()}
                title="Finish and restore full model"
              >
                <span>Clear</span>
                <i className="fas fa-check" aria-hidden="true"></i>
              </button>
            ) : (
              <button
                type="button"
                className="install-seq-btn install-seq-next"
                disabled={installBusy || !!installStep.playing}
                onClick={() => void stepInstall('next')}
                title="Next panel (→)"
              >
                <span>Next</span>
                <i className="fas fa-chevron-right" aria-hidden="true"></i>
              </button>
            )}

          </div>
        </>
      )}

      {/* Floor Plans Panel */}
      {
        floorPanelVisible && viewer?.views2d && (
          <div className="floor-plans-panel">
            <FloorSelector
              views2d={viewer.views2d}
              onFloorChange={handleFloorChange}
              onModeChange={handleModeChange}
            />
          </div>
        )
      }

      {/* Current Floor Indicator */}
      {
        currentFloor && (
          <div className="current-floor-indicator">
            <i className="fas fa-building"></i>
            <span>{currentFloor}</span>
            <span className="mode-badge">
              {is2DMode ? '2D Plan' : '3D View'}
            </span>
          </div>
        )
      }

      {projectId && (
        <ProjectBrowserPanel
          open={browserOpen}
          onClose={() => setBrowserOpen(false)}
          projectId={projectId}
          revisionId={selectedRevisionId}
          activeTab={browserTab}
          onTabChange={setBrowserTab}
          onOpenDrawing={(d) => {
            setActiveDrawing(d);
            setCadOpen(true);
            setActiveSchedule(null);
            setActiveDetail(null);
          }}
          onOpenSchedule={(sch) => {
            setActiveSchedule(sch);
            setCadOpen(false);
            setActiveDrawing(null);
            setActiveDetail(null);
          }}
          onOpenDetail={(detail) => {
            setActiveDetail(detail);
            setCadOpen(false);
            setActiveDrawing(null);
            setActiveSchedule(null);
          }}
          onSelectPanel={(panel) => {
            setCadOpen(false);
            setActiveDrawing(null);
            setActiveSchedule(null);
            setActiveDetail(null);
            const api = (window as any).__uniqubeViewer;
            if (!api?.selectPanelByExpressId) {
              console.warn('Viewer select API not ready');
              return;
            }
            if (panel.expressId == null) {
              console.warn('Panel has no expressId — cannot highlight in 3D', panel);
              return;
            }
            void api.selectPanelByExpressId(panel.expressId, panel.modelId || undefined, {
              id: panel.id,
              name: panel.name,
              modelId: panel.modelId,
              element: { expressId: panel.expressId },
            });
          }}
        />
      )}

      {activeSchedule && (
        <ScheduleTable
          schedule={activeSchedule}
          dockRight={browserOpen}
          onClose={() => setActiveSchedule(null)}
        />
      )}

      {activeDetail && (
        <DetailPanel
          title={activeDetail.title}
          data={activeDetail.data}
          dockRight={browserOpen}
          onClose={() => setActiveDetail(null)}
        />
      )}

      {projectId && (
        <CadDrawingViewer
          open={cadOpen}
          projectId={projectId}
          drawing={activeDrawing}
          dockRight={browserOpen}
          splitView={cadSplit}
          onToggleSplit={() => setCadSplit((v) => !v)}
          onClose={() => {
            setCadOpen(false);
            setCadSplit(false);
            setActiveDrawing(null);
          }}
        />
      )}
    </div >
  );
};