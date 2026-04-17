/**
 * 2D Views Module for That Open Engine
 * Handles floor plans, elevations, and sections for IFC models
 * 
 * Features:
 * - Automatic storey detection from IFC models
 * - Floor plan views for all building levels
 * - Elevation views (North, South, East, West)
 * - Custom section views
 * - Plan mode toggle (2D/3D switching)
 */

import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";

export interface Views2DConfig {
  components: OBC.Components;
  world: OBC.World;
  fragments: FRAGS.FragmentsModels;
  obcFragments: OBC.FragmentsManager;
  models: Map<string, FRAGS.FragmentsModel>;
  /**
   * Invoked after `ensureModelsVisible` resets highlights on FRAGS models.
   * Use this to re-apply the same ghost + selection styling in 2D (and 3D) so
   * floor-plan / ortho views match the current tree or canvas selection.
   */
  onAfterEnsureModelsVisible?: (mode: '2d' | '3d') => Promise<void>;
}

export interface StoreyInfo {
  name: string;
  elevation: number;
  viewId: string | null;
}

export class Views2DManager {
  private views: OBC.Views;
  private components: OBC.Components;
  private world: OBC.World;
  private fragments: FRAGS.FragmentsModels;
  private obcFragments: OBC.FragmentsManager;
  private models: Map<string, FRAGS.FragmentsModel>;
  private config: Views2DConfig;
  private ifcProperties: any; 
  private planModeActive: boolean = false;
  private storeyViewsInitialized: boolean = false;
  private storeyList: StoreyInfo[] = [];
  private originalCameraSnapshot?: { position: THREE.Vector3; target: THREE.Vector3; projection: 'Perspective' | 'Orthographic' };
  private baseCameraSnapshot?: { position: THREE.Vector3; target: THREE.Vector3 };
  private _dblclickHandler?: (e: MouseEvent) => void;
  // 2D framing padding (per side) used by camera-controls.fitToBox when centering plans
  // Increase to zoom out (reduce plan size on screen)
  private fitPadding2D: number = 0.60;
  // Extra bias padding to keep plan clear of UI (e.g. top navbar, right panel)
  private fitPaddingTopBias: number = 0.22;
  private fitPaddingRightBias: number = 0.30;
  // Cache control state so we can disable rotation in 2D and restore in 3D
  private controlsPrevState: { 
    enableRotate?: any; 
    azimuthRotateSpeed?: number; 
    polarRotateSpeed?: number; 
    mouseButtons?: any;
    minPolarAngle?: number; maxPolarAngle?: number; 
    minAzimuthAngle?: number; maxAzimuthAngle?: number;
  } | null = null;
  
  constructor(config: Views2DConfig) {
    this.config = config;
    this.components = config.components;
    this.world = config.world;
    this.fragments = config.fragments;
    this.obcFragments = config.obcFragments;
    this.models = config.models;
    
    // Initialize Views component with proper configuration
    this.views = this.components.get(OBC.Views);
    this.views.world = this.world;
    
    // Ensure camera controls are available
    this.ensureCameraControls();
    
    // Configure Views for 2D rendering
    this.setupViewsComponent();
    
    // Capture the initial 3D camera as baseline to restore when leaving 2D
    void this.captureBaseCameraSnapshot();
    
    // Try to get IfcPropertiesManager (may not be available in all OBC versions)
    try {
      this.ifcProperties = this.components.get((OBC as any).IfcPropertiesManager);
    } catch {
      console.warn('⚠️ IfcPropertiesManager not available - will use synthetic floors');
    }
    console.log('✅ Views2DManager initialized');
  }

  /**
   * Capture the very first 3D camera as baseline (position + target)
   */
  private async captureBaseCameraSnapshot(): Promise<void> {
    try {
      if (this.baseCameraSnapshot) return;
      const cam = this.world?.camera as any;
      if (!cam?.three) return;
      const pos = (cam.three.position as THREE.Vector3).clone();
      const target = new THREE.Vector3();
      try {
        if (cam.controls && typeof cam.controls.getTarget === 'function') {
          cam.controls.getTarget(target);
        } else {
          const union = await this.computeUnionBox();
          if (union) union.getCenter(target);
        }
      } catch {}
      this.baseCameraSnapshot = { position: pos, target };
      console.log('📸 Captured base 3D camera snapshot');
    } catch (e) {
      console.warn('⚠️ Failed to capture base camera snapshot:', e);
    }
  }

  /** Restore baseline 3D camera snapshot if available */
  private async restoreBaseCameraSnapshot(): Promise<boolean> {
    try {
      if (!this.baseCameraSnapshot) return false;
      const cam = this.world?.camera as any;
      const controls = cam?.controls;
      if (controls && typeof controls.setLookAt === 'function') {
        const p = this.baseCameraSnapshot.position;
        const t = this.baseCameraSnapshot.target;
        controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true);
        console.log('📸 Restored base 3D camera snapshot');
        return true;
      }
    } catch (e) {
      console.warn('⚠️ Failed to restore base camera snapshot:', e);
    }
    return false;
  }

  /**
   * Open an orientation view (Top, Front, Back, Left, Right). Aliases supported: 'roof' -> 'top'
   */
  // NOTE: The actual implementation is further below; this top-level declaration was removed to avoid duplication.

  /**
   * Wait until OBC FragmentsManager has at least one model loaded
   */
  private async waitForObcModelsLoaded(timeoutMs: number = 120000): Promise<void> {
    try {
      const start = Date.now();
      
      // Fast path: check if models already loaded
      if ((this.obcFragments as any)?.list?.size && (this.obcFragments as any).list.size > 0) {
        return;
      }
      
      await new Promise<void>((resolve, reject) => {
        let resolved = false;
        
        const onSet = () => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve();
          }
        };
        
        const cleanup = () => {
          try {
            (this.obcFragments as any).list?.onItemSet?.remove?.(onSet);
          } catch {}
        };
        
        try {
          (this.obcFragments as any).list?.onItemSet?.add?.(() => {
            console.log('[2D] OBC model registered');
            onSet();
          });
        } catch {}
        
        const check = () => {
          if ((this.obcFragments as any)?.list?.size && (this.obcFragments as any).list.size > 0) {
            onSet();
          } else if (Date.now() - start > timeoutMs) {
            cleanup();
            reject(new Error('Timeout waiting for OBC FragmentsManager models'));
          } else {
            setTimeout(check, 200);
          }
        };
        
        check();
      });
    } catch (e) {
      console.warn('waitForObcModelsLoaded:', e);
      throw e;
    }
  }

  /**
   * Ensure camera controls are properly initialized
   */
  private ensureCameraControls(): void {
    try {
      const camera = this.world.camera;
      if (camera && !camera.controls) {
        console.warn('⚠️ Camera controls not found, attempting to initialize...');
        // Try to initialize camera controls if they don't exist
        if (typeof (camera as any).init === 'function') {
          (camera as any).init();
        }
      }
      console.log('✅ Camera controls verified');
    } catch (e) {
      console.warn('⚠️ Camera controls check failed:', e);
    }
  }

  /**
   * Save current camera position, target and projection to restore after leaving 2D
   */
  private async saveCameraSnapshot(): Promise<void> {
    try {
      if (this.originalCameraSnapshot) return; // save only once on first enter to 2D
      const cam = this.world?.camera as any;
      if (!cam?.three) return;
      const pos = (cam.three.position as THREE.Vector3).clone();
      let target = new THREE.Vector3(0, 0, 0);
      try {
        if (cam.controls && typeof cam.controls.getTarget === 'function') {
          // camera-controls API
          const out = new THREE.Vector3();
          cam.controls.getTarget(out);
          target.copy(out);
        } else {
          // Fallback to model center
          const union = await this.computeUnionBox();
          if (union) {
            union.getCenter(target);
          }
        }
      } catch {}
      const projection: 'Perspective' | 'Orthographic' = cam.three.type === 'OrthographicCamera' ? 'Orthographic' : 'Perspective';
      this.originalCameraSnapshot = { position: pos, target, projection };
      console.log('📸 Saved camera snapshot for 3D restore');
    } catch (e) {
      console.warn('⚠️ Failed to save camera snapshot:', e);
    }
  }

  /**
   * Restore previously saved camera snapshot
   * Returns true if restored, false otherwise
   */
  private async restoreCameraSnapshot(): Promise<boolean> {
    try {
      if (!this.originalCameraSnapshot) return false;
      const cam = this.world?.camera as any;
      if (cam?.controls && typeof cam.controls.setLookAt === 'function') {
        const p = this.originalCameraSnapshot.position;
        const t = this.originalCameraSnapshot.target;
        // Smooth restore to previous view
        cam.controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true);
        console.log('📸 Restored camera snapshot');
        this.originalCameraSnapshot = undefined;
        return true;
      }
    } catch (e) {
      console.warn('⚠️ Failed to restore camera snapshot:', e);
    }
    return false;
  }

  /**
   * Clear any clipping applied during 2D
   */
  private clearClipping(): void {
    try {
      if (this.world?.renderer?.three) {
        this.world.renderer.three.localClippingEnabled = false;
      }
    } catch {}
    // Try to clear clipping planes on materials for both FRAGS and OBC models
    try {
      for (const [, m] of this.models.entries()) {
        try {
          m.object?.traverse((obj: any) => {
            const mat = obj?.material;
            if (!mat) return;
            const mats: any[] = Array.isArray(mat) ? mat : [mat];
            mats.forEach(mm => {
              if (mm) {
                mm.clippingPlanes = [];
                mm.clipShadows = false;
                mm.needsUpdate = true;
              }
            });
          });
        } catch {}
      }
    } catch {}
    try {
      const list = (this.obcFragments as any)?.list;
      if (list && typeof list[Symbol.iterator] === 'function') {
        for (const [, m] of list) {
          try {
            m.object?.traverse((obj: any) => {
              const mat = obj?.material;
              if (!mat) return;
              const mats: any[] = Array.isArray(mat) ? mat : [mat];
              mats.forEach(mm => {
                if (mm) {
                  mm.clippingPlanes = [];
                  mm.clipShadows = false;
                  mm.needsUpdate = true;
                }
              });
            });
          } catch {}
        }
      }
    } catch {}
    console.log('✂️ Cleared clipping and disabled local clipping');
  }

  /**
   * Setup Views component for proper 2D rendering
   */
  private setupViewsComponent(): void {
    try {
      // Set default range for crisp floor plans (matching original implementation)
      OBC.Views.defaultRange = 2.0; // Start with 2.0, will be reduced to 0.35 after creation
      
      // Ensure the views component is properly configured
      if (this.views) {
        console.log('✅ Views component configured for 2D rendering');
      }
    } catch (e) {
      console.error('❌ Failed to setup Views component:', e);
    }
  }

  /**
   * Ensure all models are visible and properly configured
   */
  private async ensureModelsVisible(mode: '2d' | '3d' | 'auto' = 'auto'): Promise<void> {
    const is2D = mode === '2d' ? true : mode === '3d' ? false : this.planModeActive;
    console.log(`🎨 Ensuring model visibilities for ${is2D ? '2D' : '3D'}...`);

    try {
      // FRAGS models: Real 3D geometry - ALWAYS visible (used in both 2D and 3D)
      for (const [, m] of this.models.entries()) {
        try {
          if (m?.object) {
            m.object.visible = true;
            m.object.traverse((child: any) => {
              if (child.isMesh || child.isLine || child.isPoints) {
                child.visible = true;
              }
            });
            // Reset any highlights that might hide geometry
            await m.resetHighlight?.(undefined);
          }
        } catch {}
      }
      await this.fragments.update(true);
    } catch {}

    try {
      await this.config.onAfterEnsureModelsVisible?.(is2D ? '2d' : '3d');
    } catch (e) {
      console.warn('⚠️ onAfterEnsureModelsVisible failed:', e);
    }

    try {
      // OBC models: 2D helper models - hide them as we use FRAGS for actual geometry
      const list = (this.obcFragments as any)?.list;
      if (list && typeof list[Symbol.iterator] === 'function') {
        for (const [, m] of list) {
          try {
            if (m?.object) {
              // Keep OBC models hidden - we render FRAGS models in 2D views
              m.object.visible = false;
            }
          } catch {}
        }
        try {
          (this.obcFragments as any).core?.update?.(true);
        } catch {}
      }
    } catch {}

    console.log('✅ Model visibilities updated');
  }

  /**
   * Force refresh floor views (clears existing and recreates)
   */
  async refreshFloorViews(): Promise<void> {
    console.log('🔄 Force refreshing floor views...');
    
    // Clear existing views and state
    this.storeyViewsInitialized = false;
    this.storeyList = [];
    
    // Clear all existing views
    try {
      const keys = Array.from(this.views.list?.keys?.() || []);
      for (const key of keys) {
        (this.views.list as any)?.delete?.(key);
      }
    } catch {}
    
    // Recreate views
    await this.createStoreyViews();
  }

  /**
   * Create storey views from IFC data or fallback to synthetic views
   */
  async createStoreyViews(options?: { modelIds?: RegExp[] }): Promise<void> {
    if (this.storeyViewsInitialized) return;

    try {
      console.log('🏗️ Creating storey views...');
      
      // Ensure OBC models are loaded
      await this.waitForObcModelsLoaded();

      // First try to use That Open Engine's native IFC storey creation
      try {
        console.log('🏗️ Attempting to create views from IFC storeys...');
        await this.views.createFromIfcStoreys({});
        
        // Optimize the created views (matching original implementation)
        const keys = Array.from(this.views.list?.keys?.() || []);
        console.log('📋 IFC storey views created:', keys);
        
        for (const key of keys) {
          const view: any = (this.views as any).list?.get?.(key);
          if (view) {
            // Use intelligent range based on building structure
            if (typeof view.range === 'number') {
              // Calculate optimal range for floor plans (typically 3-4m floor height)
              const minRange = 3.0; // Minimum 3m to capture full floor
              const maxRange = 6.0; // Maximum 6m to avoid showing too many floors
              view.range = Math.min(Math.max(view.range, minRange), maxRange);
            }
            // Hide helpers for cleaner view
            if ('helpersVisible' in view) {
              view.helpersVisible = false;
            }
            
            // Add to our storey list (include all floors, filtering will be done in UI)
            this.storeyList.push({
              name: key,
              elevation: view.position?.y || 0,
              viewId: key
            });
            
            console.log(`📋 Created IFC storey view: ${key} at ${(view.position?.y || 0).toFixed(2)}m with ${view.range}m range`);
          }
        }
        
        if (keys.length > 0) {
          this.storeyViewsInitialized = true;
          console.log('✅ IFC storey views created successfully:', this.storeyList.map(s => `${s.name} (${s.elevation.toFixed(2)}m)`));
          return;
        }
      } catch (e) {
        console.warn('⚠️ Could not create storey views from IFC data:', e);
      }

      // Fallback: Extract floor names from database tree structure
      const databaseFloors = this.extractDatabaseFloors();
      
      if (databaseFloors.length > 0) {
        console.log('📋 Using database floors:', databaseFloors);
        await this.createFloorViewsFromDatabase(databaseFloors);
      } else {
        console.log('📋 No database floors found, creating synthetic floors');
        await this.createSyntheticFloorViews();
      }

      // Sort storey list by elevation
      this.storeyList.sort((a, b) => a.elevation - b.elevation);
      
      this.storeyViewsInitialized = true;
      console.log('✅ Storey views created:', this.storeyList.map(s => `${s.name} (${s.elevation.toFixed(2)}m)`));
      
    } catch (e) {
      console.error('❌ Failed to create storey views:', e);
      
      // Fallback: create at least a top view
      try {
        await this.createTopView();
        this.storeyList.push({
          name: 'Top View',
          elevation: 0,
          viewId: 'Top - Whole Model'
        });
        this.storeyViewsInitialized = true;
      } catch {}
      
      throw e;
    }
  }

  /**
   * Check if a database entry represents an actual floor with geometry
   */
  private isActualFloor(name: string): boolean {
    const lowerName = name.toLowerCase();
    
    // Extract panel count from the name (e.g., "B1-BASEMENT 1-FFL (A2): 1 panels")
    const panelMatch = name.match(/:\s*(\d+)\s*panels?/i);
    const panelCount = panelMatch ? parseInt(panelMatch[1]) : 0;
    
    // Minimum panel count for a meaningful floor plan (exclude floors with very few panels)
    const MIN_PANELS_FOR_FLOOR = 10;
    if (panelCount > 0 && panelCount < MIN_PANELS_FOR_FLOOR) {
      console.log(`🚫 Excluding floor with insufficient geometry: ${name} (${panelCount} panels < ${MIN_PANELS_FOR_FLOOR} minimum)`);
      return false;
    }
    
    // Include entries that contain floor indicators
    const floorKeywords = [
      'floor', 'ffl', 'level', 'storey', 'story',
      'basement', 'ground', 'roof', 'top',
      'b1', 'b2', 'gf', 'l1', 'l2', 'l3', 'l4', 'l5',
      '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'
    ];
    
    // Exclude entries that are clearly folders/categories
    const excludeKeywords = [
      'folder', 'group', 'category', 'collection',
      'set', 'assembly', 'component', 'element',
      'system', 'zone', 'area', 'space'
    ];
    
    // Check for exclusions first
    for (const exclude of excludeKeywords) {
      if (lowerName.includes(exclude)) {
        return false;
      }
    }
    
    // Check for floor indicators
    for (const keyword of floorKeywords) {
      if (lowerName.includes(keyword)) {
        return true;
      }
    }
    
    // If no clear indicators, exclude to be safe
    return false;
  }

  /**
   * Extract floor names from the database tree structure in the DOM
   */
  private extractDatabaseFloors(): string[] {
    const floors: string[] = [];
    
    try {
      // Wait a bit for DOM to be ready
      const treeContainer = document.querySelector('.tree-container');
      if (!treeContainer) {
        console.warn('⚠️ Tree container not found, using hardcoded floors');
        return ['1ST FLOOR', '2ND FLOOR', '3RD FLOOR'];
      }
      
      // Look for all tree labels that contain "FLOOR"
      const allLabels = treeContainer.querySelectorAll('.tree-label');
      console.log(`🔍 Found ${allLabels.length} tree labels`);
      
      allLabels.forEach((label, index) => {
        const text = label.textContent?.trim();
        console.log(`Label ${index}: "${text}"`);
        if (text && text.includes('FLOOR') && this.isActualFloor(text)) {
          floors.push(text);
        } else if (text && text.includes('FLOOR')) {
          console.log(`🚫 Filtered out floor: ${text}`);
        }
      });
      
      // If still no floors found, use hardcoded based on your screenshot
      if (floors.length === 0) {
        console.warn('⚠️ No floors found in DOM, using hardcoded floors');
        return ['1ST FLOOR', '2ND FLOOR', '3RD FLOOR'];
      }
      
      console.log('🔍 Extracted database floors:', floors);
      return [...new Set(floors)]; // Remove duplicates
      
    } catch (e) {
      console.warn('⚠️ Failed to extract database floors:', e);
      // Fallback to hardcoded floors from your screenshot
      return ['1ST FLOOR', '2ND FLOOR', '3RD FLOOR'];
    }
  }

  /**
   * Create floor views using exact database floor names
   */
  private async createFloorViewsFromDatabase(floorNames: string[]): Promise<void> {
    console.log('🏗️ Creating views for database floors:', floorNames);
    
    // First try to use IFC storey detection with OBC
    try {
      await this.views.createFromIfcStoreys({});
      const ifcKeys = Array.from(this.views.list?.keys?.() || []);
      
      if (ifcKeys.length > 0) {
        console.log('📋 Using IFC storey views:', ifcKeys);
        
        // Map IFC views to database floor names
        for (let i = 0; i < Math.min(ifcKeys.length, floorNames.length); i++) {
          const ifcKey = ifcKeys[i];
          const floorName = floorNames[i];
          const view: any = (this.views as any).list?.get?.(ifcKey);
          
          if (view) {
            // Rename the view to match database
            (this.views as any).list?.delete?.(ifcKey);
            (this.views as any).list?.set?.(floorName, view);
            
            view.helpersVisible = false;
            
            this.storeyList.push({
              name: floorName,
              elevation: view.position?.y || 0,
              viewId: floorName
            });
            
            console.log(`✅ Mapped IFC view "${ifcKey}" to "${floorName}" at ${(view.position?.y || 0).toFixed(2)}m`);
          }
        }
        
        // If we have more database floors than IFC views, create synthetic ones
        if (floorNames.length > ifcKeys.length) {
          await this.createAdditionalFloors(floorNames.slice(ifcKeys.length), ifcKeys.length);
        }
        
        return;
      }
    } catch (e) {
      console.warn('⚠️ IFC storey detection failed:', e);
    }
    
    // Fallback: create geometric floors
    await this.createGeometricFloors(floorNames);
  }
  
  /**
   * Create additional floors beyond what IFC provides
   */
  private async createAdditionalFloors(remainingFloors: string[], startIndex: number): Promise<void> {
    const union = await this.computeUnionBox();
    if (!union) return;
    
    const minY = union.min.y;
    const maxY = union.max.y;
    const heightRange = maxY - minY;
    
    const up = new THREE.Vector3(0, 1, 0);
    const center = new THREE.Vector3();
    union.getCenter(center);
    
    for (let i = 0; i < remainingFloors.length; i++) {
      const floorName = remainingFloors[i];
      const totalFloors = startIndex + remainingFloors.length;
      const floorIndex = startIndex + i;
      const y = minY + ((floorIndex + 1) / totalFloors) * heightRange;
      
      const position = new THREE.Vector3(center.x, y, center.z);
      
      const view = this.views.create(up, position, {
        id: floorName,
        world: this.world
      });
      
      view.range = 1.5;
      view.helpersVisible = false;
      
      this.storeyList.push({
        name: floorName,
        elevation: y,
        viewId: floorName
      });
      
      console.log(`✅ Created additional floor: ${floorName} at ${y.toFixed(2)}m`);
    }
  }
  
  /**
   * Create floors based on geometry when IFC data is not available
   */
  private async createGeometricFloors(floorNames: string[]): Promise<void> {
    console.log('🔧 Creating geometric floors for:', floorNames);
    
    const union = await this.computeUnionBox();
    if (!union) {
      console.warn('⚠️ No geometry found for floor views');
      return;
    }
    
    const size = new THREE.Vector3();
    union.getSize(size);
    const center = new THREE.Vector3();
    union.getCenter(center);
    
    const minY = union.min.y;
    const maxY = union.max.y;
    const heightRange = maxY - minY;
    
    console.log(`📐 Model height: ${heightRange.toFixed(2)}m (${minY.toFixed(2)}m to ${maxY.toFixed(2)}m)`);
    
    // Create views for each database floor with proper architectural cutting heights
    const up = new THREE.Vector3(0, 1, 0);
    
    for (let i = 0; i < floorNames.length; i++) {
      const floorName = floorNames[i];
      
      // Filter out floors with insufficient geometry
      if (!this.isActualFloor(floorName)) {
        console.log(`🚫 Skipping geometric floor with insufficient geometry: ${floorName}`);
        continue;
      }
      
      // Calculate proper floor cutting height
      // Use standard architectural section height (1.2m above floor level)
      const floorLevel = minY + (i / Math.max(1, floorNames.length - 1)) * (heightRange * 0.85); // Use 85% of height to avoid roof
      const cuttingHeight = floorLevel + 1.2; // 1.2m above floor for door/window cuts
      
      const position = new THREE.Vector3(center.x, cuttingHeight, center.z);
      
      const view = this.views.create(up, position, {
        id: floorName,
        world: this.world
      });
      
      // Use proper range for architectural floor plans (captures walls, doors, windows)
      view.range = 2.0; // Increased range to capture more geometry
      view.helpersVisible = false;
      
      // Store with the cutting height as elevation
      this.storeyList.push({
        name: floorName,
        elevation: cuttingHeight,
        viewId: floorName
      });
      
      console.log(`✅ Created geometric floor: ${floorName} at ${cuttingHeight.toFixed(2)}m (floor level: ${floorLevel.toFixed(2)}m)`);
    }
    
    console.log(`✅ Created ${floorNames.length} geometric floor views`);
  }

  /**
   * Create synthetic floor views by analyzing model geometry
   * Used when database floors are not available
   */
  private async createSyntheticFloorViews(): Promise<void> {
    console.log('🔧 Creating synthetic floor views from geometry...');
    
    const union = await this.computeUnionBox();
    if (!union) {
      console.warn('⚠️ No geometry found for synthetic floors');
      return;
    }
    
    const size = new THREE.Vector3();
    union.getSize(size);
    const center = new THREE.Vector3();
    union.getCenter(center);
    
    // Detect distinct Y levels by sampling the model
    const levels: number[] = [];
    const minY = union.min.y;
    const maxY = union.max.y;
    const heightRange = maxY - minY;
    
    // Fallback floor names
    const floorNames = ['1ST FLOOR', '2ND FLOOR', '3RD FLOOR', '4TH FLOOR', '5TH FLOOR'];
    
    // If building is very flat, just create one level
    if (heightRange < 1.0) {
      levels.push(minY + 1.2); // Standard door height for proper 2D cuts
    } else {
      // Create levels every ~3 meters (typical floor height)
      const floorHeight = 3.0;
      const numFloors = Math.min(floorNames.length, Math.max(1, Math.ceil(heightRange / floorHeight)));
      
      for (let i = 0; i < numFloors; i++) {
        const y = minY + (i * floorHeight) + 1.2; // Cut at door height (1.2m above slab)
        if (y < maxY - 0.5) { // Leave space for roof
          levels.push(y);
        }
      }
      
      console.log(`📐 Creating ${levels.length} floors at:`, levels.map(y => `${y.toFixed(2)}m`));
    }
    
    // Create a view for each level with fallback names
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < levels.length; i++) {
      const y = levels[i];
      const floorName = floorNames[i] || `${i + 1}ST FLOOR`;
      const position = new THREE.Vector3(center.x, y, center.z);
      
      const view = this.views.create(up, position, {
        id: floorName,
        world: this.world
      });
      
      // Use smaller range for crisper floor plans (1.5m captures walls/doors)
      view.range = 1.5;
      view.helpersVisible = false;
      
      this.storeyList.push({
        name: floorName,
        elevation: y,
        viewId: floorName
      });
      
      console.log(`✅ Created synthetic floor: ${floorName} at ${y.toFixed(2)}m`);
    }
    
    console.log(`✅ Created ${levels.length} synthetic floor views`);
  }

  // Compute union bounding box across loaded models
  private async computeUnionBox(): Promise<THREE.Box3 | null> {
    const union = new THREE.Box3();
    let hasAny = false;
    for (const [, m] of this.models.entries()) {
      try {
        const b = await (m as any).getMergedBox?.();
        if (b && !b.isEmpty()) {
          union.union(b);
          hasAny = true;
        } else if (m?.object) {
          const fb = new THREE.Box3().setFromObject(m.object);
          if (!fb.isEmpty()) { union.union(fb); hasAny = true; }
        }
      } catch {
        if (m?.object) {
          const fb = new THREE.Box3().setFromObject(m.object);
          if (!fb.isEmpty()) { union.union(fb); hasAny = true; }
        }
      }
    }
    return hasAny ? union : null;
  }

  /**
   * Center and frame the current 2D view on the model center
   */
  private async center2DOnModelCenter(targetY?: number): Promise<void> {
    try {
      const ctrl: any = this.world.camera?.controls as any;
      if (!ctrl) return;
      try {
        if (typeof (this.world.camera as any).setProjection === 'function') {
          (this.world.camera as any).setProjection('Orthographic');
        }
      } catch {}
      const union = await this.computeUnionBox();
      if (!union) return;
      const size = new THREE.Vector3();
      union.getSize(size);
      const center = new THREE.Vector3();
      union.getCenter(center);
      const y = typeof targetY === 'number' ? targetY : center.y;
      // Frame to bounds first, maintaining current direction
      if (typeof ctrl.fitToBox === 'function') {
        const p = this.get2DPadding();
        await ctrl.fitToBox(union, true, p);
      }
      const height = Math.max(size.x, size.z) * 0.5;
      ctrl.setLookAt(center.x, y + height, center.z, center.x, y, center.z, true);
      try { ctrl.update(0); } catch {}
    } catch (e) {
      console.warn('⚠️ center2DOnModelCenter failed:', e);
    }
  }

  // Compute asymmetric padding to avoid UI overlays
  private get2DPadding(): { paddingLeft: number; paddingRight: number; paddingTop: number; paddingBottom: number } {
    return {
      paddingLeft: this.fitPadding2D,
      paddingRight: this.fitPadding2D + this.fitPaddingRightBias,
      paddingTop: this.fitPadding2D + this.fitPaddingTopBias,
      paddingBottom: this.fitPadding2D,
    };
  }

  // Disable rotation in 2D, restore on 3D exit
  private lock2DRotate(lock: boolean): void {
    try {
      const controls: any = this.world.camera?.controls as any;
      if (!controls) return;
      if (lock) {
        if (!this.controlsPrevState) {
          this.controlsPrevState = {
            enableRotate: (controls as any).enableRotate,
            azimuthRotateSpeed: (controls as any).azimuthRotateSpeed,
            polarRotateSpeed: (controls as any).polarRotateSpeed,
            mouseButtons: controls.mouseButtons ? { ...controls.mouseButtons } : undefined,
            minPolarAngle: controls.minPolarAngle,
            maxPolarAngle: controls.maxPolarAngle,
            minAzimuthAngle: controls.minAzimuthAngle,
            maxAzimuthAngle: controls.maxAzimuthAngle,
          };
        }
        if ('enableRotate' in controls) (controls as any).enableRotate = false;
        if ('azimuthRotateSpeed' in controls) (controls as any).azimuthRotateSpeed = 0;
        if ('polarRotateSpeed' in controls) (controls as any).polarRotateSpeed = 0;
        // Clamp current azimuth/polar to freeze orientation
        try {
          const target = new THREE.Vector3();
          if (controls.getTarget) controls.getTarget(target);
          const cam: any = this.world.camera.three as any;
          const dir = target.clone().sub(cam.position).normalize();
          // Compute angles relative to Y-up
          const polar = Math.acos(Math.min(1, Math.max(-1, dir.y * -1))); // approximate clamp
          const azimuth = Math.atan2(dir.x, dir.z);
          if ('minPolarAngle' in controls) controls.minPolarAngle = polar;
          if ('maxPolarAngle' in controls) controls.maxPolarAngle = polar;
          if ('minAzimuthAngle' in controls) controls.minAzimuthAngle = azimuth;
          if ('maxAzimuthAngle' in controls) controls.maxAzimuthAngle = azimuth;
        } catch {}
      } else {
        if (this.controlsPrevState) {
          if ('enableRotate' in controls && this.controlsPrevState.enableRotate !== undefined) {
            (controls as any).enableRotate = this.controlsPrevState.enableRotate;
          }
          if ('azimuthRotateSpeed' in controls && this.controlsPrevState.azimuthRotateSpeed !== undefined) {
            (controls as any).azimuthRotateSpeed = this.controlsPrevState.azimuthRotateSpeed;
          }
          if ('polarRotateSpeed' in controls && this.controlsPrevState.polarRotateSpeed !== undefined) {
            (controls as any).polarRotateSpeed = this.controlsPrevState.polarRotateSpeed;
          }
          if (controls.mouseButtons && this.controlsPrevState.mouseButtons) {
            controls.mouseButtons = { ...this.controlsPrevState.mouseButtons };
          }
          if ('minPolarAngle' in controls && this.controlsPrevState.minPolarAngle !== undefined) controls.minPolarAngle = this.controlsPrevState.minPolarAngle;
          if ('maxPolarAngle' in controls && this.controlsPrevState.maxPolarAngle !== undefined) controls.maxPolarAngle = this.controlsPrevState.maxPolarAngle;
          if ('minAzimuthAngle' in controls && this.controlsPrevState.minAzimuthAngle !== undefined) controls.minAzimuthAngle = this.controlsPrevState.minAzimuthAngle;
          if ('maxAzimuthAngle' in controls && this.controlsPrevState.maxAzimuthAngle !== undefined) controls.maxAzimuthAngle = this.controlsPrevState.maxAzimuthAngle;
        }
        this.controlsPrevState = null;
      }
      try { controls.update?.(0); } catch {}
    } catch {}
  }

  /**
   * Adjust the Top view section plane position (deltaY in meters) and thickness (deltaRange)
   */
  async nudgeTopView(options: { deltaY?: number; deltaRange?: number }): Promise<void> {
    const id = 'Top - Whole Model';
    if (!(this.views.list as any)?.has?.(id)) {
      await this.createTopView();
    }
    const view: any = (this.views as any).list?.get?.(id);
    if (!view) return;
    const union = await this.computeUnionBox();
    if (!union) return;
    // Position Y
    if (typeof options.deltaY === 'number' && view.position) {
      const nextY = view.position.y + options.deltaY;
      // Clamp within a reasonable band around the model
      const minY = union.min.y - 2;
      const maxY = union.max.y + 2;
      view.position = new THREE.Vector3(view.position.x, Math.max(minY, Math.min(maxY, nextY)), view.position.z);
    }
    // Thickness
    if (typeof options.deltaRange === 'number') {
      const nextRange = (view.range ?? 0.5) + options.deltaRange;
      view.range = Math.max(0.1, Math.min(3.0, nextRange));
    }
    // Ensure models are visible
    await this.ensureModelsVisible('2d');
    this.planModeActive = true;
  }

  /**
   * Create a top-down view of the entire model (roof view)
   */
  async createTopView(): Promise<void> {
    try {
      const id = 'Top - Whole Model';
      
      // Check if view already exists
      if ((this.views.list as any)?.has?.(id)) {
        console.log('⚠️ Top view already exists');
        return;
      }
      
      // Compute bounding box union of all models
      const union = await this.computeUnionBox();
      if (!union) {
        console.warn('⚠️ No models found to create top view');
        return;
      }
      
      // Calculate center and size
      const center = new THREE.Vector3();
      union.getCenter(center);
      const size = new THREE.Vector3();
      union.getSize(size);
      
      // Create view looking down from above the roof (true top view)
      const up = new THREE.Vector3(0, 1, 0);
      const cutHeight = union.max.y - 0.3; // Cut near the top for roof view
      const planePos = new THREE.Vector3(center.x, cutHeight, center.z);
      const view = this.views.create(
        up,
        planePos,
        { id, world: this.world }
      );
      
      // Use thinner slice for roof view
      view.range = 1.0;
      view.helpersVisible = false;
      
      console.log(`📐 Top view: cutting at ${cutHeight.toFixed(2)}m with ${view.range}m thickness`);
      
      console.log('✅ Created top view');
      
    } catch (e) {
      console.error('❌ Failed to create top view:', e);
      throw e;
    }
  }

  /**
   * Create a custom section view at a specific position and direction
   */
  createCustomView(
    normal: THREE.Vector3, 
    position: THREE.Vector3, 
    options?: { 
      id?: string; 
      range?: number; 
      showHelpers?: boolean 
    }
  ): void {
    try {
      const id = options?.id || `Custom View - ${this.views.list.size + 1}`;
      
      const view = this.views.create(normal, position, {
        id,
        world: this.world
      });
      
      if (options?.range !== undefined) {
        view.range = options.range;
      }
      
      view.helpersVisible = options?.showHelpers || false;
      
      console.log(`✅ Created custom view: ${id}`);
      
    } catch (e) {
      console.error('❌ Failed to create custom view:', e);
      throw e;
    }
  }

  /**
   * Open a specific storey view by name
   */
  async openStoreyView(storeyName: string): Promise<void> {
    try {
      console.log(`📝 Opening storey view: ${storeyName}`);
      
      // Ensure storey views are created
      if (!this.storeyViewsInitialized) {
        await this.createStoreyViews();
      }
      
      // Ensure all models are visible BEFORE opening view
      await this.ensureModelsVisible('2d');
      await this.saveCameraSnapshot();
      
      // Find matching view
      const viewId = this.findViewIdForStoreyName(storeyName);
      
      if (viewId) {
        console.log(`🔍 Found view ID: ${viewId}`);
        
        // Verify camera controls before opening view
        this.ensureCameraControls();
        
        // Set plan mode active
        this.planModeActive = true;
        
        // Safely open the view with error handling
        // OBC.Views will handle camera positioning automatically
        try {
          this.views.open(viewId);
          console.log(`✅ Opened storey view: ${viewId}`);
        } catch (viewError) {
          console.error('❌ Failed to open view with That Open Engine:', viewError);
          // Fallback: try to manually set camera position for 2D view
          await this.fallbackTo2DView(storeyName);
        }
        
        // Ensure models stay visible after view opening
        setTimeout(async () => {
          await this.ensureModelsVisible('2d');
        }, 100);
        
      } else {
        console.warn(`⚠️ No storey view found for: ${storeyName}`);
        console.log('Available views:', Array.from(this.views.list?.keys?.() || []));
        
        // Fallback: create a simple top view
        await this.openTopView();
      }
      
    } catch (e) {
      console.error('❌ Failed to open storey view:', e);
      try {
        await this.fallbackTo2DView(storeyName);
      } catch {}
    }
  }

  /**
   * Fallback method to manually create 2D view when That Open Engine fails
   */
  private async fallbackTo2DView(storeyName: string): Promise<void> {
    try {
      console.log(`🔄 Fallback: Creating manual 2D view for ${storeyName}`);
      
      // Get camera and set orthographic projection for 2D view
      const camera = this.world.camera;
      if (camera && camera.three) {
        const cam = camera.three;
        
        // Force orthographic projection for true 2D view
        if (typeof (camera as any).setProjection === 'function') {
          (camera as any).setProjection('Orthographic');
          console.log('📷 Switched to orthographic projection');
        }
        
        // Position camera for proper top-down 2D floor plan
        const union = await this.computeUnionBox();
        let floorElevation = 0; // Declare outside the if block
        
        if (union) {
          const center = new THREE.Vector3();
          union.getCenter(center);
          const size = new THREE.Vector3();
          union.getSize(size);
          
          // Find the elevation for this specific floor
          floorElevation = center.y; // Default to model center
          
          console.log(`🔍 Searching for storey: "${storeyName}" in list:`, this.storeyList.map(s => `"${s.name}" (${s.elevation.toFixed(2)}m)`));
          
          const storey = this.storeyList.find(s => s.name === storeyName);
          if (storey) {
            floorElevation = storey.elevation;
            console.log(`📜 Floor elevation: ${floorElevation.toFixed(2)}m for ${storeyName}`);
          } else {
            console.warn(`⚠️ Storey not found: "${storeyName}", using model center: ${floorElevation.toFixed(2)}m`);
            // If no storey found, use a reasonable elevation based on floor name
            if (storeyName.includes('1ST')) {
              floorElevation = union.min.y + (union.max.y - union.min.y) * 0.2;
            } else if (storeyName.includes('2ND')) {
              floorElevation = union.min.y + (union.max.y - union.min.y) * 0.5;
            } else if (storeyName.includes('3RD')) {
              floorElevation = union.min.y + (union.max.y - union.min.y) * 0.8;
            }
            console.log(`📜 Using estimated floor elevation: ${floorElevation.toFixed(2)}m for ${storeyName}`);
          }
          
          // Position camera directly above the floor for true top-down view
          const cameraHeight = Math.max(size.y, 20); // Ensure camera is high enough
          cam.position.set(center.x, floorElevation + cameraHeight, center.z);
          cam.lookAt(center.x, floorElevation, center.z);
          
          // Keep standard Y-up to avoid breaking control orientation
          cam.up.set(0, 1, 0);
          
          // Configure orthographic camera for 2D view
          if ('isOrthographicCamera' in cam && cam.isOrthographicCamera) {
            const orthoSize = Math.max(size.x, size.z) * 0.6;
            (cam as any).left = -orthoSize;
            (cam as any).right = orthoSize;
            (cam as any).top = orthoSize;
            (cam as any).bottom = -orthoSize;
            (cam as any).near = 0.1;
            (cam as any).far = cameraHeight * 2;
            console.log(`📷 Orthographic bounds: ${orthoSize.toFixed(2)}m`);
          }
          
          // Update camera
          if ('updateProjectionMatrix' in cam && typeof cam.updateProjectionMatrix === 'function') {
            cam.updateProjectionMatrix();
          }
          if (camera.controls && typeof camera.controls.update === 'function') {
            // camera-controls update(delta) expects a delta in seconds
            camera.controls.update(0);
          }
          // Recenter and apply framing padding consistently
          try { await this.center2DOnModelCenter(floorElevation); } catch {}
          
          console.log(`📷 Camera positioned at (${cam.position.x.toFixed(2)}, ${cam.position.y.toFixed(2)}, ${cam.position.z.toFixed(2)}) looking at floor ${floorElevation.toFixed(2)}m`);
          
          // Let That Open Engine handle the 2D sectioning natively
          // The Views component should handle clipping automatically
          console.log('✅ Using That Open Engine native 2D sectioning');
        }
      }
      
      this.planModeActive = true;
      console.log(`✅ Fallback 2D view created for ${storeyName}`);
      
    } catch (e) {
      console.error('❌ Fallback 2D view failed:', e);
    }
  }

  /**
   * Apply clipping planes to show only the floor level geometry
   */
  private async applyFloorClipping(floorElevation: number): Promise<void> {
    try {
      console.log(`✂️ Applying floor clipping at elevation ${floorElevation.toFixed(2)}m`);
      
      // Create clipping planes to slice the model at floor level with intelligent range
      const clippingRange = 4.0; // Show 4.0m range around floor level (captures full floor height)
      const lowerClip = floorElevation - 0.5; // 0.5m below floor level
      const upperClip = floorElevation + clippingRange - 0.5; // 3.5m above floor level
      
      console.log(`✂️ Clipping range: ${lowerClip.toFixed(2)}m to ${upperClip.toFixed(2)}m`);
      
      const lowerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -lowerClip);
      const upperPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), upperClip);
      
      const clippingPlanes = [lowerPlane, upperPlane];
      
      // Apply clipping to all models
      for (const [, model] of this.models.entries()) {
        try {
          if (model?.object) {
            model.object.traverse((child: any) => {
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat: any) => {
                    mat.clippingPlanes = clippingPlanes;
                    mat.clipShadows = true;
                    mat.needsUpdate = true;
                  });
                } else {
                  child.material.clippingPlanes = clippingPlanes;
                  child.material.clipShadows = true;
                  child.material.needsUpdate = true;
                }
              }
            });
          }
        } catch (e) {
          console.warn('⚠️ Failed to apply clipping to model:', e);
        }
      }
      
      // Apply clipping to OBC models
      try {
        const list = (this.obcFragments as any)?.list;
        if (list && typeof list[Symbol.iterator] === 'function') {
          for (const [, model] of list) {
            try {
              if (model?.object) {
                model.object.traverse((child: any) => {
                  if (child.material) {
                    if (Array.isArray(child.material)) {
                      child.material.forEach((mat: any) => {
                        mat.clippingPlanes = clippingPlanes;
                        mat.clipShadows = true;
                        mat.needsUpdate = true;
                      });
                    } else {
                      child.material.clippingPlanes = clippingPlanes;
                      child.material.clipShadows = true;
                      child.material.needsUpdate = true;
                    }
                  }
                });
              }
            } catch (e) {
              console.warn('⚠️ Failed to apply clipping to OBC model:', e);
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to access OBC models for clipping:', e);
      }
      
      // Enable clipping planes in the renderer
      if (this.world.renderer && this.world.renderer.three) {
        this.world.renderer.three.localClippingEnabled = true;
        console.log('✂️ Enabled local clipping in renderer');
      }
      
      console.log(`✅ Floor clipping applied with ${clippingRange}m range`);
      
    } catch (e) {
      console.error('❌ Failed to apply floor clipping:', e);
    }
  }

  /**
   * Open the top-down view
   */
  async openTopView(): Promise<void> {
    try {
      console.log('📝 Opening top view...');
      
      // Use the same orientation view as the 2D toggle for consistency
      await this.openOrientationView('top');
      
      console.log('✅ Opened top view');
      
    } catch (e) {
      console.error('❌ Failed to open top view:', e);
      throw e;
    }
  }

  /**
   * Open a specific view by ID
   */
  openView(viewId: string): void {
    try {
      if (!(this.views.list as any)?.has?.(viewId)) {
        console.warn(`⚠️ View not found: ${viewId}`);
        return;
      }
      
      this.views.open(viewId);
      console.log(`✅ Opened view: ${viewId}`);
      
    } catch (e) {
      console.error('❌ Failed to open view:', e);
      throw e;
    }
  }

  /**
   * Toggle between 2D plan mode and 3D mode
   */
  async togglePlanMode(): Promise<void> {
    try {
      const newMode = !this.planModeActive;
      console.log(`🔄 Toggling plan mode: ${this.planModeActive ? 'ON' : 'OFF'} -> ${newMode ? 'ON' : 'OFF'}`);
      
      if (newMode) {
        // Switching to 2D: open full model 2D view
        await this.openFullModel2DView();
      } else {
        // Switching to 3D: close 2D view and return to perspective
        await this.close3DMode();
      }
      
      console.log(`✅ Plan mode toggled: ${newMode ? 'ON' : 'OFF'}`);
      
    } catch (e) {
      console.error('❌ Failed to toggle plan mode:', e);
      throw e;
    }
  }

  /**
   * Delete a specific view
   */
  deleteView(viewId: string): void {
    try {
      // Close the view if it's currently open
      this.views.close();
      
      // Remove from list
      if ((this.views.list as any)?.delete) {
        (this.views.list as any).delete(viewId);
      }
      
      console.log(`✅ Deleted view: ${viewId}`);
      
    } catch (e) {
      console.error('❌ Failed to delete view:', e);
      throw e;
    }
  }

  /**
   * Open a full model 2D view (orthographic top-down view of entire model)
   */
  async openFullModel2DView(): Promise<void> {
    try {
      console.log('🔄 Opening full model 2D view...');
      
      await this.ensureModelsVisible('2d');
      this.ensureCameraControls();
      await this.saveCameraSnapshot();
      
      // Use the Top orientation view (which creates a proper OBC View)
      await this.openOrientationView('top');
      
      console.log('✅ Full model 2D view opened');
      
    } catch (e) {
      console.error('❌ Failed to open full model 2D view:', e);
      throw e;
    }
  }

  /**
   * Close 2D mode and return to 3D - COMPLETELY turn off all 2D
   */
  async close3DMode(): Promise<void> {
    try {
      console.log('🔄 COMPLETELY turning off 2D mode...');
      
      // STEP 1: Close the active 2D view (do NOT delete definitions)
      try {
        this.views.close();
      } catch (e) {
        console.warn('⚠️ No active 2D view to close:', e);
      }
      
      // STEP 2: Clear ALL clipping and renderer state
      this.clearClipping();
      try {
        const renderer: any = this.world.renderer?.three;
        if (renderer) {
          renderer.localClippingEnabled = false;
          renderer.clippingPlanes = [];
        }
      } catch {}
      
      // STEP 3: Remove body CSS class and disable interactions
      try { 
        document.body?.classList?.remove?.('mode-2d'); 
      } catch {}
      this.disableInteractiveSections();
      
      // STEP 4: Switch projection back to Perspective on the existing OBC camera
      this.planModeActive = false;
      try {
        if (typeof (this.world.camera as any).setProjection === 'function') {
          (this.world.camera as any).setProjection('Perspective');
        }
      } catch {}
      // Ensure up-vector and projection matrix are sane
      try {
        const threeCam: any = this.world.camera.three as any;
        threeCam.up.set(0, 1, 0);
        if (typeof threeCam.updateProjectionMatrix === 'function') threeCam.updateProjectionMatrix();
      } catch {}
      
      // STEP 5: Force enable camera controls
      if (this.world.camera.controls) {
        const controls: any = this.world.camera.controls as any;
        controls.enabled = true;
        // Restore rotation ability in 3D
        this.lock2DRotate(false);
        controls.enableZoom = true;
        controls.enablePan = true;
        try {
          const dom: any = (this.world.renderer as any)?.three?.domElement;
          if (controls.connect && dom) controls.connect(dom);
        } catch {}
        try { controls.update(0); } catch {}
        console.log('✅ Camera controls re-enabled');
      }
      
      // STEP 6: Restore camera pose: prefer saved snapshot, else fit to box like main.ts
      let restored = false;
      try {
        restored = await this.restoreCameraSnapshot();
      } catch {}
      if (!restored) {
        try {
          const union = await this.computeUnionBox();
          if (union) {
            const center = new THREE.Vector3();
            union.getCenter(center);
            const controls: any = this.world.camera.controls as any;
            if (controls?.fitToBox) {
              await controls.fitToBox(union, true, {
                paddingLeft: this.fitPadding2D,
                paddingRight: this.fitPadding2D,
                paddingTop: this.fitPadding2D,
                paddingBottom: this.fitPadding2D,
              });
              const cam = this.world.camera.three as THREE.PerspectiveCamera;
              const currentPos = cam.position.clone();
              const curDist = currentPos.distanceTo(center);
              const diagDir = new THREE.Vector3(0.7, 0.45, 0.7).normalize();
              const newPos = center.clone().add(diagDir.multiplyScalar(Math.max(curDist * 0.9, 2)));
              controls.setLookAt(newPos.x, newPos.y, newPos.z, center.x, center.y, center.z, true);
            } else if (controls?.setLookAt) {
              const size = new THREE.Vector3();
              union.getSize(size);
              const distance = Math.max(size.x, size.y, size.z) * 1.5;
              const newPos = center.clone().add(new THREE.Vector3(0.7, 0.45, 0.7).normalize().multiplyScalar(distance));
              controls.setLookAt(newPos.x, newPos.y, newPos.z, center.x, center.y, center.z, true);
            }
          }
        } catch (e) {
          console.warn('⚠️ Fallback fitToBox failed:', e);
        }
      }
      try { (this.world.camera.controls as any)?.update?.(0); } catch {}

      // STEP 7: Show 3D models, hide 2D helpers, and refresh fragments
      await this.ensureModelsVisible('3d');
      try { await this.fragments.update(true); } catch {}
      
      console.log('✅ COMPLETELY returned to 3D mode - camera working');
      
    } catch (e) {
      console.error('❌ Failed to return to 3D mode:', e);
      // Emergency: at least try to enable camera controls
      try {
        if (this.world.camera.controls) {
          const controls: any = this.world.camera.controls as any;
          controls.enabled = true;
          controls.update(0);
        }
      } catch {}
      throw e;
    }
  }

  /**
   * Open orientation view (Top, Front, Back, Left, Right)
   */
  async openOrientationView(orientation: string): Promise<void> {
    try {
      const raw = (orientation || '').toLowerCase();
      const view = raw === 'roof' ? 'top' : raw;
      if (!['top', 'front', 'back', 'left', 'right'].includes(view)) {
        console.warn(`⚠️ Unknown orientation "${orientation}", defaulting to Top`);
        orientation = 'top';
      } else {
        orientation = view;
      }
      console.log(`🔄 Opening ${orientation} view...`);
      
      // Close any active floor view first
      try {
        this.views.close();
      } catch (e) {
        console.warn('⚠️ No active view to close:', e);
      }
      
      await this.ensureModelsVisible('2d');
      this.ensureCameraControls();
      await this.saveCameraSnapshot();
      
      // Ensure the orientation view exists (create if needed)
      const viewId = await this.ensureOrientationView(orientation as 'top' | 'front' | 'back' | 'left' | 'right');
      if (!viewId) {
        throw new Error(`Failed to create ${orientation} view`);
      }
      
      // Open the OBC View (this handles orthographic projection, clipping, and camera automatically)
      this.views.open(viewId);
      console.log(`✅ Opened ${orientation} view via OBC.Views`);
      
      // OBC.Views positions the camera correctly for the orientation
      // Do NOT call center2DOnModelCenter here as it would override the elevation view camera
      
      this.planModeActive = true;

    } catch (e) {
      console.error(`❌ Failed to open ${orientation} view:`, e);
      throw e;
    }
  }

  /**
   * Ensure an orientation view (Top/Front/Back/Left/Right) exists, creating it if needed
   * Returns the view ID
   */
  private async ensureOrientationView(orientation: 'top' | 'front' | 'back' | 'left' | 'right'): Promise<string | null> {
    try {
      const viewId = `${orientation.charAt(0).toUpperCase() + orientation.slice(1)} View`;
      
      // Check if view already exists
      if ((this.views.list as any)?.has?.(viewId)) {
        return viewId;
      }
      
      // Get model bounds
      const union = await this.computeUnionBox();
      if (!union) {
        console.warn('⚠️ No model geometry found for orientation view');
        return null;
      }
      
      const center = new THREE.Vector3();
      union.getCenter(center);
      const size = new THREE.Vector3();
      union.getSize(size);
      
      // Define normal and position for each orientation following That Open Engine pattern
      let normal: THREE.Vector3;
      let position: THREE.Vector3;
      let range: number;
      
      switch (orientation) {
        case 'top':
          // Top view: normal pointing up (Y+), cutting plane at optimal height
          normal = new THREE.Vector3(0, 1, 0);
          // Use a more conservative approach - cut at a height that typically shows interior details
          let optimalHeight: number;
          
          // For most architectural models, cutting at 1.5-2m above ground level shows good floor plans
          const groundLevel = union.min.y;
          const buildingHeight = size.y;
          
          if (buildingHeight < 3) {
            // Very low building - cut near middle
            optimalHeight = groundLevel + (buildingHeight * 0.5);
          } else if (buildingHeight < 8) {
            // Single story - cut at typical door/window height (2m above ground)
            optimalHeight = groundLevel + Math.min(2, buildingHeight * 0.6);
          } else {
            // Multi-story - cut at first floor level (2.5m above ground)
            optimalHeight = groundLevel + Math.min(2.5, buildingHeight * 0.3);
          }
          
          position = new THREE.Vector3(center.x, optimalHeight, center.z);
          range = Math.max(buildingHeight, 20); // Range should capture the full building
          break;
        case 'front':
          // Front view: normal pointing south (Z-), cutting plane at optimal depth
          normal = new THREE.Vector3(0, 0, -1);
          // Cut slightly forward from center to show interior details
          const frontCutDepth = center.z + (size.z * 0.1); // 10% forward from center
          position = new THREE.Vector3(center.x, center.y, frontCutDepth);
          range = Math.max(size.z, 20); // Adequate range to capture building depth
          break;
        case 'back':
          // Back view: normal pointing north (Z+), cutting plane at optimal depth
          normal = new THREE.Vector3(0, 0, 1);
          // Cut slightly backward from center to show interior details
          const backCutDepth = center.z - (size.z * 0.1); // 10% backward from center
          position = new THREE.Vector3(center.x, center.y, backCutDepth);
          range = Math.max(size.z, 20); // Adequate range to capture building depth
          break;
        case 'left':
          // Left view: normal pointing west (X-), cutting plane at optimal width
          normal = new THREE.Vector3(-1, 0, 0);
          // Cut slightly left from center to show interior details
          const leftCutWidth = center.x + (size.x * 0.1); // 10% left from center
          position = new THREE.Vector3(leftCutWidth, center.y, center.z);
          range = Math.max(size.x, 20); // Adequate range to capture building width
          break;
        case 'right':
          // Right view: normal pointing east (X+), cutting plane at optimal width
          normal = new THREE.Vector3(1, 0, 0);
          // Cut slightly right from center to show interior details
          const rightCutWidth = center.x - (size.x * 0.1); // 10% right from center
          position = new THREE.Vector3(rightCutWidth, center.y, center.z);
          range = Math.max(size.x, 20); // Adequate range to capture building width
          break;
      }
      
      // Create the OBC View (this is what makes it truly 2D with clipping)
      const view = this.views.create(normal, position, {
        id: viewId,
        world: this.world
      });
      
      // Set appropriate range for the view (larger range = more geometry visible)
      view.range = range;
      view.helpersVisible = false;
      
      console.log(`✅ Created ${orientation} OBC View at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
      
      return viewId;
      
    } catch (e) {
      console.error(`❌ Failed to create ${orientation} view:`, e);
      return null;
    }
  }

  /**
   * Get list of all available views
   */
  getAvailableViews(): string[] {
    return Array.from(this.views.list?.keys?.() || []);
  }

  /**
   * Get list of all storey views
   */
  getStoreyList(): StoreyInfo[] {
    return [...this.storeyList];
  }

  /**
   * Check if currently in plan mode
   */
  isPlanModeActive(): boolean {
    return this.planModeActive;
  }

  /**
   * Find view ID by storey name (case-insensitive partial match)
   */
  private findViewIdForStoreyName(name: string): string | null {
    const needle = (name || '').toLowerCase();
    
    // First try exact match
    const keys = Array.from(this.views.list?.keys?.() || []);
    for (const key of keys) {
      if (key.toLowerCase() === needle) {
        return key;
      }
    }
    
    // Then try partial match
    for (const key of keys) {
      if (key.toLowerCase().includes(needle)) {
        return key;
      }
    }
    
    console.warn(`⚠️ No view found for storey: "${name}". Available views:`, keys);
    return null;
  }

  /**
   * Setup double-click to create section views
   */
  enableInteractiveSections(): void {
    if (this._dblclickHandler) return; // already enabled
    const casters = this.components.get(OBC.Raycasters);
    const caster = casters.get(this.world);
    this._dblclickHandler = async (_e: MouseEvent) => {
      try {
        const result = await caster.castRay();
        if (!result) return;
        const { normal, point } = result;
        if (!(normal && point)) return;
        const invertedNormal = normal.clone().negate();
        this.createCustomView(
          invertedNormal,
          point.addScaledVector(normal, 1),
          {
            id: `Section - ${this.views.list.size + 1}`,
            range: 10,
            showHelpers: true
          }
        );
        console.log('✅ Created section view at clicked position');
      } catch (e) {
        console.error('❌ Failed to create interactive section:', e);
      }
    };
    window.addEventListener('dblclick', this._dblclickHandler);
    console.log('✅ Interactive sections enabled (double-click to create)');
  }

  /** Disable interactive section creation listener */
  disableInteractiveSections(): void {
    if (this._dblclickHandler) {
      window.removeEventListener('dblclick', this._dblclickHandler);
      this._dblclickHandler = undefined;
      console.log('✅ Interactive sections disabled');
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    try {
      // Close current view
      this.views.close();
      
      // Clear all views
      const keys = Array.from(this.views.list?.keys?.() || []);
      for (const key of keys) {
        if ((this.views.list as any)?.delete) {
          (this.views.list as any).delete(key);
        }
      }
      
      this.storeyViewsInitialized = false;
      this.planModeActive = false;
      this.storeyList = [];
      
      console.log('✅ Views2DManager disposed');
      
    } catch (e) {
      console.error('❌ Failed to dispose Views2DManager:', e);
    }
  }
}
