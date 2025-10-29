import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import './ViewerPage.css';

export default function ViewerPage() {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();
  const modelId = searchParams.get('model');
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mainScriptRef = useRef(false);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [statusPanelVisible, setStatusPanelVisible] = useState(false);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [treePanelVisible, setTreePanelVisible] = useState(false);

  // Initialize the 3D viewer when container is attached
  const initializeViewer = async (containerElement: HTMLDivElement) => {
    if (mainScriptRef.current) {
      console.log('⏭️ Skipping: viewer already initialized');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
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
      // Import and call the initialization function
      const { initializeViewer } = await import('./main');
      
      // Add timeout to prevent infinite loading
      const initializationPromise = initializeViewer('container');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Viewer initialization timeout after 60 seconds')), 60000);
      });
      
      console.log('⏳ Starting viewer initialization with 60s timeout...');
      const viewerInstance = await Promise.race([initializationPromise, timeoutPromise]);
      
      console.log('✅ Viewer initialized successfully:', viewerInstance);
      
      // Additional delay to ensure UI is fully rendered
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsLoading(false);
      console.log('🎯 Loading overlay removed');
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
    } catch (err) {
      console.error('❌ Failed to load viewer:', err);
      setError(err instanceof Error ? err.message : 'Failed to load viewer');
      setIsLoading(false);
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      mainScriptRef.current = false;
    }
  };

  // Initialize viewer when component mounts
  useEffect(() => {
    console.log('🔗 useEffect triggered, checking container...');
    console.log('📍 containerRef.current:', containerRef.current);
    console.log('📍 mainScriptRef.current:', mainScriptRef.current);

    // Fallback: Remove loading overlay after maximum time regardless of initialization status
    fallbackTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ Fallback: Removing loading overlay after 45 seconds');
      setIsLoading(false);
    }, 45000);

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

  // Cleanup on unmount
  useLayoutEffect(() => {
    return () => {
      console.log('🧹 Component cleanup');
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
    const panel = document.getElementById('status-panel');
    if (panel) {
      panel.classList.toggle('panel-hidden');
    }
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

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(10, 10, 10, 0.95)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          zIndex: 9999
        }}>
          <div className="loading-spinner" style={{ width: '60px', height: '60px', marginBottom: '20px' }}></div>
          <p style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#ffffff' }}>Loading 3D Viewer...</p>
          <p style={{ color: '#00ffff' }}>Initializing That Open Engine</p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(10, 10, 10, 0.95)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          zIndex: 9999
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ fontSize: '2rem', marginBottom: '10px', color: '#ffffff' }}>Viewer Error</h2>
          <p style={{ marginBottom: '20px', color: '#ff6b6b' }}>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div id="toolbar">
        <button id="tree-toggle-btn" className="toolbar-button">
          <i className="fas fa-sitemap"></i>
          <span className="tooltip">Model Structure</span>
        </button>
        <h1 id="modelName"><span>Uni</span>Qube</h1>
        <button id="status-toggle-btn" className="toolbar-button">
          <i className="fas fa-tags"></i>
          <span className="tooltip">Status</span>
        </button>
        <button id="groups-toggle-btn" className="toolbar-button">
          <i className="fas fa-layer-group"></i>
          <span className="tooltip">Groups</span>
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
        <div id="statusPanelContent" className="info-content">
          <div className="status-actions">
            <button id="create-status-btn" className="btn-primary">
              <i className="fas fa-plus"></i> Create Status
            </button>
          </div>
          <div id="statusListContent" className="status-list-content">
            {/* Status items will be populated here */}
          </div>
        </div>
      </div>

      {/* Groups Panel */}
      <div id="groupsPanel" className="info-panel panel-hidden">
        <div id="groupsPanelHeader">
          <h3>Groups Management</h3>
          <button id="groups-close-btn"><i className="fas fa-times"></i></button>
        </div>
        <div id="groupsPanelContent" className="info-content">
          <div className="status-actions">
            <button id="add-group-btn" className="btn-primary">
              <i className="fas fa-plus"></i> Create Group
            </button>
          </div>
          <div id="groupsListContent" className="status-list-content">
            {/* Group items will be populated here */}
          </div>
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
    </div>
  );
};