import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './ViewerPage.css';
import { FloorSelector } from './FloorSelector';
import { Cube } from '@/components/ui/Cube';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [treePanelVisible, setTreePanelVisible] = useState(false);

  // 2D Views state
  const [viewer, setViewer] = useState<any>(null);
  const [is2DMode, setIs2DMode] = useState(false);
  const [currentFloor, setCurrentFloor] = useState<string | null>(null);

  // Sync UI with 2D mode changes (works for toolbar toggle and internal FloorSelector changes)
  useEffect(() => {
    if (is2DMode) {
      // Add body guard class
      document.body.classList.add('mode-2d');

      // Click close buttons where available to trigger native handlers
      const treeClose = document.getElementById('tree-close-btn');
      const statusClose = document.getElementById('status-close-btn');
      const groupsClose = document.getElementById('groups-close-btn');
      treeClose?.click();
      statusClose?.click();
      groupsClose?.click();

      // Ensure selection tool is off
      const selectionBtn = document.getElementById('selection-tool-btn');
      if (selectionBtn && selectionBtn.classList.contains('active')) {
        selectionBtn.click();
      }

      // Disable toolbar buttons
      ['tree-toggle-btn', 'status-toggle-btn', 'groups-toggle-btn', 'selection-tool-btn'].forEach(id => {
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
      // Mirror state for React-driven panels
      setTreePanelVisible(false);
      setStatusPanelVisible(false);
    } else {
      // Remove body guard class
      document.body.classList.remove('mode-2d');

      // Re-enable toolbar buttons
      ['tree-toggle-btn', 'status-toggle-btn', 'groups-toggle-btn', 'selection-tool-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.remove('disabled-in-2d');
          el.removeAttribute('disabled');
        }
      });

      // Reset any forced styles on panels
      ['tree-panel', 'statusPanel', 'groupsPanel', 'infoPanel'].forEach(id => {
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

    window.addEventListener('viewer-loading' as any, handleViewerLoading);

    return () => {
      window.removeEventListener('viewer-loading' as any, handleViewerLoading);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

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

  // Draggable resize for the Model Structure (tree) panel
  // -------------------------------------------------
  useEffect(() => {
    const panel = document.getElementById('tree-panel');
    const resizer = panel?.querySelector('.tree-resizer') as HTMLElement | null;
    if (!panel || !resizer) return;

    let startX = 0;
    let startWidth = 0;
    const minWidth = 320; // px
    const maxWidth = 600; // px

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = panel.getBoundingClientRect().width;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      let newWidth = startWidth + dx;
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      panel.style.width = `${newWidth}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    resizer.addEventListener('mousedown', onMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Toggle panels
  const toggleTreePanel = () => {
    setTreePanelVisible(!treePanelVisible);
    const panel = document.getElementById('tree-panel');
    if (panel) {
      panel.classList.toggle('panel-hidden');
    }
  };

  const toggleStatusPanel = () => {
    setStatusPanelVisible(!statusPanelVisible);
    if (!statusPanelVisible) {
      setTreePanelVisible(false);
    }
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
      // Update React state mirrors
      setTreePanelVisible(false);
      setStatusPanelVisible(false);

      // Forcibly hide panels via DOM classes (authoritative)
      const treePanelEl = document.getElementById('tree-panel');
      const statusPanelEl = document.getElementById('statusPanel');
      const groupsPanelEl = document.getElementById('groupsPanel');
      const infoPanelEl = document.getElementById('infoPanel');

      if (treePanelEl && !treePanelEl.classList.contains('panel-hidden')) {
        treePanelEl.classList.add('panel-hidden');
        console.log('✅ Closed tree panel');
      }
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
        'tree-toggle-btn',
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
        'tree-toggle-btn',
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
        'tree-panel',
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
        ['tree-toggle-btn', 'status-toggle-btn', 'groups-toggle-btn', 'selection-tool-btn'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.classList.remove('disabled-in-2d');
            el.removeAttribute('disabled');
          }
        });

        // Reset panel styles immediately
        ['tree-panel', 'statusPanel', 'groupsPanel', 'infoPanel'].forEach(id => {
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



  return (
    <div className="viewer-container">
      {/* Main 3D Container */}
      <div
        id="container"
        ref={containerRef}
        style={{
          width: '100%',
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

        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-700 rounded-lg flex items-center justify-center shadow-sm">
          <img src="/uniQube.png" alt="UniQube Logo" className="w-8 h-8 sm:w-12 sm:h-8" />
        </div>

        <h1 className="text-lg sm:text-xl font-bold text-slate-900">
          UniQube <span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">3D</span>
        </h1>

        {/* Back Button */}
        <button
          className="toolbar-button"
          onClick={() => {
            const elementId = searchParams.get('element');
            if (elementId) {
              window.location.href = `/projects/${projectId}/element-report#${elementId}`;
            } else {
              window.location.href = `/projects/${projectId}`;
            }
          }}
          title=""
          style={{ marginLeft: '12px', marginRight: 'auto' }}
        >
          <i className="fas fa-arrow-left"></i>
          <span className="tooltip">{searchParams.get('element') ? 'Back to Report' : 'Back to Project'}</span>
        </button>

        <button id="tree-toggle-btn" className="toolbar-button">
          <i className="fas fa-sitemap"></i>
          <span className="tooltip">Model Structure</span>
        </button>
        <button id="selection-tool-btn" className="toolbar-button">
          <i className="fas fa-mouse-pointer"></i>
          <span className="tooltip">Selection Tool</span>
        </button>
        <button
          id="plan-toggle-btn"
          className={`toolbar-button ${is2DMode ? 'active' : ''}`}
          onClick={toggle2DMode}
          disabled={isLoading}
        >
          <i className={`fas fa-${is2DMode ? 'cube' : 'map'}`}></i>
          <span className="tooltip">{is2DMode ? '3D View' : '2D Plan Mode'}</span>
        </button>
        <button id="status-toggle-btn" className="toolbar-button">
          <i className="fas fa-tags"></i>
          <span className="tooltip">Status</span>
        </button>
        <button id="groups-toggle-btn" className="toolbar-button">
          <i className="fas fa-layer-group"></i>
          <span className="tooltip">Groups</span>
        </button>

        {/* Element Type Filters */}
        <div className="toolbar-divider"></div>
        <button id="filter-mep-btn" className="toolbar-button filter-btn" data-filter="MEP">
          <i data-lucide="wrench"></i>
          <span className="tooltip">Filter MEP</span>
        </button>
        <button id="filter-doors-windows-btn" className="toolbar-button filter-btn" data-filter="DOORS_WINDOWS">
          <i data-lucide="door-open"></i>
          <span className="tooltip">Filter Doors & Windows</span>
        </button>
        <button id="filter-frames-btn" className="toolbar-button filter-btn" data-filter="FRAMES">
          <i data-lucide="frame"></i>
          <span className="tooltip">Filter Frames</span>
        </button>
        <button id="filter-structural-btn" className="toolbar-button filter-btn" data-filter="STRUCTURAL">
          <i data-lucide="building-2"></i>
          <span className="tooltip">Filter Structural</span>
        </button>
        <button id="filter-clear-btn" className="toolbar-button">
          <i data-lucide="x-circle"></i>
          <span className="tooltip">Clear Filters</span>
        </button>

        <button id="tree-reset-btn" className="toolbar-button">
          <i className="fas fa-home"></i>
          <span className="tooltip">Reset View</span>
        </button>
      </div>

      {/* Tree Panel */}
      <div id="tree-panel" className="tree-panel panel-hidden">
        <div id="treeViewHeader">
          <h3>Model Structure</h3>
          <button id="tree-close-btn"><i className="fas fa-times"></i></button>
        </div>
        <input
          id="tree-search"
          type="text"
          placeholder="Search..."
          className="tree-search-input"
        />
        <div id="tree-container" className="tree-container"></div>
        {/* Resizer handle */}
        <div className="tree-resizer" />
      </div>

      {/* Info Panel */}
      <div id="infoPanel" className="info-panel panel-hidden">
        <div id="infoPanelHeader">
          <h3>Element Information</h3>
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

      {/* Add Members Modal */}
      <div id="membersModal" className="modal" style={{ display: 'none' }}>
        <div className="modal-content modal-large">
          <div className="modal-header">
            <h3>Add Members to Group</h3>
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
        <div id="stats">
          <div className="stat">
            <i className="fas fa-cube"></i>
            <span id="objectCount">0 objects</span>
          </div>
        </div>
      </div>

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
    </div >
  );
};