/**
 * Floor Selector Component
 * 
 * A React component that provides a UI for navigating between floor plans
 * and switching between 2D and 3D views.
 * 
 * Usage:
 * import { FloorSelector } from './FloorSelector';
 * 
 * <FloorSelector views2d={viewer.views2d} />
 */

import React, { useState, useEffect } from 'react';
import { Views2DManager, StoreyInfo } from './views2d';

interface FloorSelectorProps {
  views2d: Views2DManager | null;
  onFloorChange?: (floorName: string) => void;
  onModeChange?: (is2D: boolean) => void;
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({ 
  views2d, 
  onFloorChange,
  onModeChange 
}) => {
  const [storeys, setStoreys] = useState<StoreyInfo[]>([]);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);
  const [is2DMode, setIs2DMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeOrientation, setActiveOrientation] = useState<string | null>(null);
  const [maxVisibleFloors, setMaxVisibleFloors] = useState<number>(6);

  // Initialize floor plans
  useEffect(() => {
    const initializeFloors = async () => {
      if (!views2d || isInitialized) return;

      setIsLoading(true);
      setError(null);

      try {
        // Wait a bit for models to load
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Create storey views
        await views2d.createStoreyViews();

        // Get storey list
        const storeyList = views2d.getStoreyList();
        setStoreys(storeyList);
        setIsInitialized(true);

        console.log('✅ Floor selector initialized with', storeyList.length, 'floors');
      } catch (err) {
        console.error('❌ Failed to initialize floor selector:', err);
        setError('Failed to load floor plans');
        
        // Fallback: try to create top view
        try {
          await views2d?.createTopView();
          setStoreys([{ name: 'Top View', elevation: 0, viewId: 'Top - Whole Model' }]);
          setIsInitialized(true);
        } catch {}
      } finally {
        setIsLoading(false);
      }
    };

    initializeFloors();
  }, [views2d, isInitialized]);

  // Responsive threshold for when the floor list becomes scrollable
  useEffect(() => {
    const calculateMaxVisibleFloors = () => {
      const vh = window.innerHeight || 800;
      // Heuristic: small screens -> 5, medium -> 6, large -> 7
      let max = 6;
      if (vh < 720) max = 5;
      else if (vh >= 900) max = 7;
      setMaxVisibleFloors(max);
    };

    calculateMaxVisibleFloors();
    window.addEventListener('resize', calculateMaxVisibleFloors);
    return () => window.removeEventListener('resize', calculateMaxVisibleFloors);
  }, []);

  // Nudge helpers for Top view
  const nudgeY = async (delta: number) => {
    if (!views2d || isLoading) return;
    setIsLoading(true);
    try {
      await views2d.nudgeTopView({ deltaY: delta });
      setIs2DMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const nudgeThickness = async (delta: number) => {
    if (!views2d || isLoading) return;
    setIsLoading(true);
    try {
      await views2d.nudgeTopView({ deltaRange: delta });
      setIs2DMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if floor has sufficient geometry for 2D view
  const hasInsufficientGeometry = (floorName: string): boolean => {
    const panelMatch = floorName.match(/:\s*(\d+)\s*panels?/i);
    const panelCount = panelMatch ? parseInt(panelMatch[1]) : 0;
    return panelCount > 0 && panelCount < 10; // Less than 10 panels
  };

  // Handle floor selection
  const handleFloorSelect = async (storey: StoreyInfo) => {
    if (!views2d || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Opening floor view:', storey.name);
      
      // Open the storey view using the correct method
      await views2d.openStoreyView(storey.viewId || storey.name);
      
      // Update UI state
      setActiveFloor(storey.name);
      setActiveOrientation(null); // Clear orientation when selecting floor
      setIs2DMode(true);
      
      // Notify parent components
      onFloorChange?.(storey.name);
      onModeChange?.(true);
      
      console.log('✅ Floor view opened:', storey.name);
    } catch (err) {
      console.error('❌ Failed to open floor view:', err);
      setError('Failed to open floor view');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle return to 3D
  const handleReturn3D = async () => {
    if (!views2d || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await views2d.close3DMode();
      setActiveFloor(null);
      setIs2DMode(false);
      
      onFloorChange?.('');
      onModeChange?.(false);

      console.log('✅ Returned to 3D mode');
    } catch (err) {
      console.error('❌ Failed to return to 3D:', err);
      setError('Failed to return to 3D mode');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle orientation view selection
  const handleOrientationView = async (orientation: string) => {
    if (!views2d || isLoading) return;
    
    setIsLoading(true);
    try {
      console.log(`🔄 Opening ${orientation} view...`);
      
      // Close any active floor view first
      if (views2d.isPlanModeActive()) {
        await views2d.close3DMode();
      }
      
      // Open the orientation view
      await views2d.openOrientationView(orientation);
      
      // Update UI state
      setActiveOrientation(orientation);
      setActiveFloor(null); // Clear floor selection when using orientation view
      setIs2DMode(true);
      onModeChange?.(true); // Set to 2D mode
      onFloorChange?.(`${orientation.charAt(0).toUpperCase() + orientation.slice(1)} View`);
      
      console.log(`✅ ${orientation} view opened successfully`);
    } catch (error) {
      console.error(`❌ Failed to open ${orientation} view:`, error);
      setError(`Failed to open ${orientation} view`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh floors
  const handleRefreshFloors = async () => {
    if (!views2d || isLoading) return;
    
    setIsLoading(true);
    try {
      console.log('🔄 Refreshing floor detection...');
      
      // Refresh floor views if the method exists
      if (typeof (views2d as any).refreshFloorViews === 'function') {
        await (views2d as any).refreshFloorViews();
      }
      
      // Get updated storey list
      const storeyList = views2d.getStoreyList();
      setStoreys(storeyList);
      
      console.log('✅ Refreshed floors:', storeyList.length);
    } catch (error) {
      console.error('❌ Failed to refresh floors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle toggle mode
  const handleToggleMode = async () => {
    if (!views2d || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await views2d.togglePlanMode();
      const newMode = views2d.isPlanModeActive();
      setIs2DMode(newMode);
      
      if (!newMode) {
        setActiveFloor(null);
      }
      
      onModeChange?.(newMode);

      console.log('✅ Toggled to', newMode ? '2D' : '3D', 'mode');
    } catch (err) {
      console.error('❌ Failed to toggle mode:', err);
      setError('Failed to toggle view mode');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if views2d not available
  if (!views2d) {
    return null;
  }

  return (
    <div className="floor-selector">
      <div className="panel-header">
        <h3>
          <i className="fas fa-layer-group"></i>
          Floor Plans
        </h3>
      </div>

      {/* Orientation controls */}
      <div className="panel-section">
        <h4 className="section-title">Orientation Views</h4>
        <div className="orient-group">
          <button 
            className={`orient-btn ${activeOrientation === 'top' ? 'active' : ''}`} 
            disabled={isLoading} 
            title="Top" 
            onClick={() => handleOrientationView('top')}
          >
            <i className="fas fa-arrow-up"></i>
            Top
          </button>
          <button 
            className={`orient-btn ${activeOrientation === 'front' ? 'active' : ''}`} 
            disabled={isLoading} 
            title="Front" 
            onClick={() => handleOrientationView('front')}
          >
            <i className="fas fa-eye"></i>
            Front
          </button>
          <button 
            className={`orient-btn ${activeOrientation === 'back' ? 'active' : ''}`} 
            disabled={isLoading} 
            title="Back" 
            onClick={() => handleOrientationView('back')}
          >
            <i className="fas fa-eye"></i>
            Back
          </button>
          <button 
            className={`orient-btn ${activeOrientation === 'left' ? 'active' : ''}`} 
            disabled={isLoading} 
            title="Left" 
            onClick={() => handleOrientationView('left')}
          >
            <i className="fas fa-arrow-left"></i>
            Left
          </button>
          <button 
            className={`orient-btn ${activeOrientation === 'right' ? 'active' : ''}`} 
            disabled={isLoading} 
            title="Right" 
            onClick={() => handleOrientationView('right')}
          >
            <i className="fas fa-arrow-right"></i>
            Right
          </button>
        </div>
      </div>





      {error && (
        <div className="floor-selector-error">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {isLoading && !isInitialized && (
        <div className="floor-selector-loading">
          <i className="fas fa-spinner fa-spin"></i>
          Loading floor plans...
        </div>
      )}

      {isInitialized && storeys.length === 0 && (
        <div className="floor-selector-empty">
          <i className="fas fa-info-circle"></i>
          No floors detected in this model
        </div>
      )}

      {/* Floor List */}
      {isInitialized && storeys.length > 0 && (
        <div
          className="panel-section"
          style={{ '--max-visible-floors': maxVisibleFloors } as React.CSSProperties}
        >
          <h4 className="section-title">Available Floors</h4>
          <div className={`floor-list ${storeys.length > maxVisibleFloors ? 'scrollable' : 'auto-height'}`}>
            {storeys.map((storey, index) => {
            const hasInsufficient = hasInsufficientGeometry(storey.name);
            return (
              <button
                key={`${storey.name}-${index}`}
                onClick={() => handleFloorSelect(storey)}
                disabled={isLoading || hasInsufficient}
                className={`floor-btn ${activeFloor === storey.name ? 'active' : ''} ${hasInsufficient ? 'insufficient-geometry' : ''}`}
                title={hasInsufficient ? `No 2D view available - insufficient geometry (${storey.name.match(/:\s*(\d+)\s*panels?/i)?.[1] || '0'} panels)` : ''}
              >
                <div className="floor-btn-content">
                  <span className="floor-name">
                    <i className={`fas ${hasInsufficient ? 'fa-exclamation-triangle' : 'fa-building'}`}></i>
                    {storey.name}
                  </span>
                  {/* <span className="floor-elevation">
                    {hasInsufficient ? 'No 2D view' : `${storey.elevation.toFixed(2)}m`}
                  </span> */}
                </div>
                {activeFloor === storey.name && !hasInsufficient && (
                  <i className="fas fa-check-circle floor-active-icon"></i>
                )}
                {hasInsufficient && (
                  <i className="fas fa-ban floor-disabled-icon"></i>
                )}
              </button>
            );
            })}
          </div>
        </div>
      )}

      {isLoading && isInitialized && (
        <div className="floor-selector-loading-overlay">
          <i className="fas fa-spinner fa-spin"></i>
        </div>
      )}

      <style>{`
        .floor-selector {
          width: 100%;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 16px 12px 16px;
          border-bottom: 1px solid var(--border-color);
          margin: 0;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .panel-section {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
          margin: 0;
        }

        .panel-section:last-child {
          border-bottom: none;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .section-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .orient-group {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }

        .orient-btn {
          background: var(--button-secondary-bg);
          border: 1px solid var(--button-secondary-border);
          color: var(--text-primary);
          padding: 10px 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .orient-btn:hover {
          background: var(--button-secondary-hover-bg);
          border-color: var(--primary);
          color: var(--primary);
        }

        .orient-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .orient-btn.active {
          background: var(--primary-bg);
          border-color: var(--primary);
          color: var(--primary);
          box-shadow: 0 0 8px rgba(71, 85, 105, 0.2);
        }





        .floor-selector-error {
          background: rgba(255, 59, 48, 0.1);
          border: 1px solid rgba(255, 59, 48, 0.3);
          color: #ff3b30;
          padding: 10px 16px;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          border-left: none;
          border-right: none;
          border-radius: 0;
        }

        .floor-selector-loading,
        .floor-selector-empty {
          padding: 32px 16px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          flex: 1;
          justify-content: center;
        }

        .floor-selector-loading i,
        .floor-selector-empty i {
          font-size: 24px;
          color: var(--primary);
        }

        .floor-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 8px;
          margin-right: -4px;
        }

        .floor-list.auto-height {
          flex: 1 1 auto;
          overflow: visible;
          min-height: 0; /* allow flexbox to compute height properly */
        }

        .floor-list.scrollable {
          /* Height = N items * itemHeight + gaps between items */
          max-height: calc((var(--max-visible-floors, 6) * var(--floor-item-height, 56px)) + ((var(--max-visible-floors, 6) - 1) * 8px));
          overflow-y: auto;
          flex: 0 1 auto;
          min-height: 0;
        }

        .floor-list::-webkit-scrollbar {
          width: 6px;
        }

        .floor-list::-webkit-scrollbar-track {
          background: var(--surface-secondary);
          border-radius: 3px;
        }

        .floor-list::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 3px;
        }

        .floor-list::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }

        .floor-btn {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--button-secondary-bg);
          border: 1px solid var(--button-secondary-border);
          color: var(--text-primary);
          padding: 10px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          position: relative;
          overflow: hidden;
          min-height: var(--floor-item-height, 56px);
        }

        .floor-btn::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 3px;
          background: var(--primary);
          transform: scaleY(0);
          transition: transform 0.2s;
        }

        .floor-btn:hover {
          background: var(--button-secondary-hover-bg);
          border-color: var(--primary);
          transform: translateX(4px);
        }

        .floor-btn:hover::before {
          transform: scaleY(1);
        }

        .floor-btn.active {
          background: var(--primary-bg);
          border-color: var(--primary);
          color: var(--primary);
          box-shadow: 0 0 20px rgba(71, 85, 105, 0.3);
        }

        .floor-btn.active::before {
          transform: scaleY(1);
        }

        .floor-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .floor-btn.insufficient-geometry {
          background: rgba(255, 193, 7, 0.1);
          border-color: rgba(255, 193, 7, 0.3);
          color: rgba(255, 193, 7, 0.8);
          cursor: not-allowed;
        }

        .floor-btn-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .floor-name {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .floor-elevation {
          color: var(--text-secondary);
          font-size: 12px;
          margin-left: 24px;
        }

        .floor-active-icon {
          color: var(--primary);
          font-size: 16px;
          margin-left: 8px;
        }

        .floor-disabled-icon {
          color: rgba(255, 193, 7, 0.8);
          font-size: 16px;
          margin-left: 8px;
        }

        .floor-selector-loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--overlay-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          backdrop-filter: blur(4px);
        }

        .floor-selector-loading-overlay i {
          font-size: 24px;
          color: var(--primary);
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .fa-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default FloorSelector;
