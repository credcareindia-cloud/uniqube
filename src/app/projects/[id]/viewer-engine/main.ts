import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js";
import * as FRAGS from "@thatopen/fragments";
import QRCode from 'qrcode';
import { Views2DManager } from './views2d';
import { localId } from "three/src/nodes/TSL.js";

// API Configuration - must be defined before any functions that use it
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL;

// Custom Error Types for better error handling
export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ModelLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelLoadError';
  }
}

export class WebGLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebGLError';
  }
}

/* MD
  ### 🌎 Setting up a Simple Scene
  To get started, let's set up a basic ThreeJS scene. This will serve as the foundation for our application and allow us to visualize the 3D models effectively:
*/

export async function initializeViewer(containerId: string = "container") {
  console.log('🚀 Starting That Open Engine viewer initialization...');

  // Verify container exists
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container element with ID "${containerId}" not found`);
  }

  console.log('✅ Container found:', container);

  const components = new OBC.Components();

  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBC.SimpleRenderer
  >();

  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = null;

  // Memory optimization: Reduce matrix calculations
  world.scene.three.matrixAutoUpdate = false;

  world.renderer = new OBC.SimpleRenderer(components, container);

  // Memory optimization: Configure renderer for lower memory usage
  const renderer = world.renderer.three;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit pixel ratio

  world.camera = new OBC.OrthoPerspectiveCamera(components);
  await world.camera.controls.setLookAt(50, 30, 50, 0, 0, 0);

  components.init();

  // const grids = components.get(OBC.Grids);
  // const grid = grids.create(world);

  /* MD
    ### 🛠️ Setting Up Fragments
    Now, let's configure the Fragments library core. This will allow us to load models effortlessly and start manipulating them with ease:
  */

  const githubUrl =
    "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
  const fetchedUrl = await fetch(githubUrl);
  const workerBlob = await fetchedUrl.blob();
  const workerFile = new File([workerBlob], "worker.mjs", {
    type: "text/javascript",
  });
  const workerUrl = URL.createObjectURL(workerFile);
  const fragments = new FRAGS.FragmentsModels(workerUrl);

  // Initialize OBC FragmentsManager for 2D Views (IFC storey detection)
  const obcFragments = components.get(OBC.FragmentsManager);
  try {
    // Use the same-origin blob worker for OBC manager to avoid cross-origin Worker errors
    obcFragments.init(workerUrl);

    // Keep OBC fragments core updated with camera changes
    world.camera.controls.addEventListener("rest", () => {
      try { obcFragments.core.update(true); } catch { }
    });

    world.onCameraChanged.add((camera: any) => {
      try {
        for (const [, model] of (obcFragments as any).list || []) {
          try { model.useCamera(camera.three); } catch { }
        }
        obcFragments.core.update(true);
      } catch { }
    });

    // Ensure newly registered OBC models use the active camera and are present in the scene (hidden by default)
    obcFragments.list.onItemSet.add(({ value: model }: any) => {
      try {
        model.useCamera(world.camera.three);
        if (model.object && !world.scene.three.children.includes(model.object)) {
          model.object.visible = false; // hidden until plan mode is active
          world.scene.three.add(model.object);
        }
        obcFragments.core.update(true);
      } catch { }
    });

    console.log('✅ OBC.FragmentsManager initialized for 2D views');
  } catch (e) {
    console.warn('⚠️ Could not initialize OBC.FragmentsManager. 2D Views from storeys may be unavailable.', e);
  }

  // Memory optimization: Throttle fragment updates
  let updateTimeout: NodeJS.Timeout | null = null;
  world.camera.controls.addEventListener("rest", () => {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      fragments.update(true);
      updateTimeout = null;
    }, 100); // Debounce updates
  });

  // Once a model is available in the list, we can tell what camera to use
  // in order to perform the culling and LOD operations.
  // Also, we add the model to the 3D scene.
  fragments.models.list.onItemSet.add(({ value: model }) => {
    model.useCamera(world.camera.three);

    // Performance optimization: Simplify materials for large models
    model.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Enable frustum culling
        child.frustumCulled = true;

        // Simplify materials to MeshStandardMaterial for better performance
        if (child.material && !(child.material instanceof THREE.MeshStandardMaterial)) {
          const oldMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
          const simplifiedMaterial = new THREE.MeshStandardMaterial({
            color: oldMaterial.color || 0xcccccc,
            metalness: 0.1,
            roughness: 0.8,
            side: THREE.DoubleSide,
          });

          // Dispose old material
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }

          child.material = simplifiedMaterial;
        }

        // Optimize geometry
        if (child.geometry) {
          child.geometry.computeBoundingSphere();
          child.geometry.computeBoundingBox();
        }
      }
    });

    world.scene.three.add(model.object);
    // At the end, you tell fragments to update so the model can be seen given
    // the initial camera position
    fragments.update(true);
  });

  /* MD
    ### 📂 Loading a Fragments Model
    With the core setup complete, it's time to load a Fragments model into our scene. Fragments are optimized for fast loading and rendering, making them ideal for large-scale 3D models.
  */

  // Get project ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const projectIdFromUrl = window.location.pathname.split('/')[2]; // /projects/[id]/viewer
  const modelIdFromUrl = urlParams.get('model');

  console.log('📍 Project ID from URL:', projectIdFromUrl);
  console.log('📍 Model ID from URL:', modelIdFromUrl);

  const models: Map<string, FRAGS.FragmentsModel> = new Map();
  let allModelsLoaded = false;

  /** Keeps ghost + solid highlight in sync when 2D mode calls `resetHighlight` on all models */
  let lastFragmentSelection: { modelId: string; ids: number[] } | null = null;

  const getModelMapId = (m: FRAGS.FragmentsModel): string | null => {
    for (const [id, ref] of models.entries()) {
      if (ref === m) return id;
    }
    return null;
  };

  const setLastFragmentSelection = (modelId: string | null | undefined, ids: number[]) => {
    if (!modelId || !ids.length) {
      lastFragmentSelection = null;
      return;
    }
    lastFragmentSelection = { modelId, ids: [...ids] };
  };

  const reapplyLastFragmentGhostSelection = async () => {
    if (!lastFragmentSelection) return;
    const { modelId, ids } = lastFragmentSelection;
    const targetModel = models.get(modelId);
    if (!targetModel || !ids.length) return;
    try {
      const tasks: Promise<any>[] = [];
      for (const [, m] of models.entries()) tasks.push(m.resetHighlight(undefined));
      await Promise.all(tasks);
      tasks.length = 0;
      for (const [, m] of models.entries()) {
        tasks.push(
          m.highlight(undefined, {
            color: new THREE.Color(0xcccccc),
            opacity: 0.2,
            transparent: true,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          })
        );
      }
      await Promise.all(tasks);
      await targetModel.highlight(ids, {
        color: new THREE.Color('#0047AB'),
        opacity: 1,
        transparent: false,
        renderedFaces: FRAGS.RenderedFaces.TWO,
      });
      await fragments.update(true);
    } catch (e) {
      console.warn('reapplyLastFragmentGhostSelection:', e);
    }
  };

  // Initialize 2D Views Manager
  let views2d: Views2DManager | null = null;
  try {
    views2d = new Views2DManager({
      components,
      world,
      fragments,
      obcFragments,
      models,
      onAfterEnsureModelsVisible: async () => {
        await reapplyLastFragmentGhostSelection();
      },
    });
    console.log('✅ 2D Views Manager initialized');
  } catch (e) {
    console.warn('⚠️ Could not initialize 2D Views Manager:', e);
  }

  // Fetch project models from backend API
  const fetchProjectModels = async (projectId: string) => {
    try {
      console.log(`📡 Fetching models for project ${projectId} from backend...`);

      // Get authentication token
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // [local] duplicate helper (unused)
      const __findPathToLocalId_LOCAL_1 = (spatialData: any, targetId: number): any[] | null => {
        const path: any[] = [];
        const visit = (node: any): boolean => {
          if (!node) return false;
          const nodeId = node.localId || node.expressID;
          path.push(node);
          if (nodeId === targetId) return true;
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (visit(child)) return true;
            }
          }
          path.pop();
          return false;
        };
        if (Array.isArray(spatialData)) {
          for (const root of spatialData) {
            if (visit(root)) return [...path];
          }
          return null;
        } else {
          return visit(spatialData) ? [...path] : null;
        }
      };

      // [local] duplicate helper (unused)
      const __resolvePanelByHierarchy_LOCAL_1 = async (model: FRAGS.FragmentsModel, localId: number): Promise<{ panelData: any, mappedLocalId: number } | null> => {
        try {
          const cacheKey = (model as any).modelId || (model as any).threads?.modelId || 'default';
          let spatialStructure = spatialStructureCache.get(cacheKey);
          if (!spatialStructure) {
            spatialStructure = await model.getSpatialStructure();
            spatialStructureCache.set(cacheKey, spatialStructure);
          }
          const path = findPathToLocalId(spatialStructure, localId);
          if (path && path.length) {
            // Try ancestors first (closest upwards)
            for (let i = path.length - 1; i >= 0; i--) {
              const pid = path[i].localId || path[i].expressID;
              if (pid !== null && pid !== undefined && localIdPanelMap.has(pid)) {
                return { panelData: localIdPanelMap.get(pid), mappedLocalId: pid };
              }
            }
            // Limited descendant scan
            const targetNode = path[path.length - 1];
            const q: any[] = [...(targetNode.children || [])];
            let visited = 0;
            while (q.length && visited < 1000) {
              const n = q.shift();
              visited++;
              const nid = n.localId || n.expressID;
              if (nid !== null && nid !== undefined && localIdPanelMap.has(nid)) {
                return { panelData: localIdPanelMap.get(nid), mappedLocalId: nid };
              }
              if (n.children && Array.isArray(n.children)) q.push(...n.children);
            }
          }
        } catch (e) {
          console.warn('resolvePanelByHierarchy failed', e);
        }
        return null;
      };

      // [local] duplicate helper (unused)
      const __buildLocationText_LOCAL_1 = (panelData: any, infoLocalId: number): string => {
        if (panelData) {
          const modelName = (panelData.modelName || 'Model').replace(/\.frag$/i, '');
          const storey = panelData.metadata?.storeyName || 'Storey';
          const name = panelData.name || panelData.tag || `Element ${infoLocalId}`;
          return `${modelName} > ${storey} > ${name}`;
        }
        return `Element ${infoLocalId}`;
      };

      // [local] duplicate helper (unused)
      const __findPathToLocalId_LOCAL_2 = (spatialData: any, targetId: number): any[] | null => {
        const path: any[] = [];
        const visit = (node: any): boolean => {
          if (!node) return false;
          const nodeId = node.localId || node.expressID;
          path.push(node);
          if (nodeId === targetId) return true;
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (visit(child)) return true;
            }
          }
          path.pop();
          return false;
        };
        if (Array.isArray(spatialData)) {
          for (const root of spatialData) {
            if (visit(root)) return [...path];
          }
          return null;
        } else {
          return visit(spatialData) ? [...path] : null;
        }
      };

      // [local] duplicate helper (unused)
      const __resolvePanelByHierarchy_LOCAL_2 = async (model: FRAGS.FragmentsModel, localId: number): Promise<{ panelData: any, mappedLocalId: number } | null> => {
        try {
          const cacheKey = (model as any).modelId || (model as any).threads?.modelId || 'default';
          let spatialStructure = spatialStructureCache.get(cacheKey);
          if (!spatialStructure) {
            spatialStructure = await model.getSpatialStructure();
            spatialStructureCache.set(cacheKey, spatialStructure);
          }
          const path = findPathToLocalId(spatialStructure, localId);
          if (path && path.length) {
            // 1) Try ancestors (closest first)
            for (let i = path.length - 1; i >= 0; i--) {
              const pid = path[i].localId || path[i].expressID;
              if (pid !== null && pid !== undefined && localIdPanelMap.has(pid)) {
                return { panelData: localIdPanelMap.get(pid), mappedLocalId: pid };
              }
            }
            // 2) Try limited search among descendants (up to 1000)
            const targetNode = path[path.length - 1];
            const q: any[] = [...(targetNode.children || [])];
            let visited = 0;
            while (q.length && visited < 1000) {
              const n = q.shift();
              visited++;
              const nid = n.localId || n.expressID;
              if (nid !== null && nid !== undefined && localIdPanelMap.has(nid)) {
                return { panelData: localIdPanelMap.get(nid), mappedLocalId: nid };
              }
              if (n.children && Array.isArray(n.children)) q.push(...n.children);
            }
          }
        } catch (e) {
          console.warn('resolvePanelByHierarchy failed', e);
        }
        return null;
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new ProjectNotFoundError(`Project with ID ${projectId} not found. Please check the project ID or return to the dashboard.`);
        } else if (response.status === 403) {
          throw new ProjectNotFoundError(`Access denied to project ${projectId}. You may not have permission to view this project.`);
        } else if (response.status >= 500) {
          throw new NetworkError(`Server error (${response.status}). The server may be experiencing issues. Please try again later.`);
        } else {
          throw new NetworkError(`Failed to fetch project: ${response.statusText}`);
        }
      }

      const projectData = await response.json();
      console.log('✅ Project data received:', projectData);

      // Extract models from project data
      const modelsList = [];

      // Check both modelHistory and currentModel
      if (projectData.currentModel) {
        modelsList.push({
          id: projectData.currentModel.id,
          name: projectData.currentModel.originalFilename,
          status: projectData.currentModel.status,
          category: projectData.currentModel.category || 'OTHER'
        });
      }

      // Also add from modelHistory if available
      if (projectData.modelHistory && projectData.modelHistory.length > 0) {
        for (const model of projectData.modelHistory) {
          // Avoid duplicates
          if (!modelsList.find(m => m.id === model.id)) {
            modelsList.push({
              id: model.id,
              name: model.originalFilename,
              status: model.status,
              category: model.category || 'OTHER'
            });
          }
        }
      }

      console.log(`📦 Found ${modelsList.length} models for project`);
      return modelsList;

    } catch (error) {
      console.error('❌ Failed to fetch project models:', error);

      // Re-throw custom errors
      if (error instanceof ProjectNotFoundError || error instanceof NetworkError) {
        throw error;
      }

      // Handle network/fetch errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Cannot connect to server. Please check your internet connection');
      }

      // Unknown error
      throw new NetworkError(`Unexpected error while fetching project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const emitProgress = (progress: number, status: string) => {
    window.dispatchEvent(new CustomEvent('viewer-progress', {
      detail: { progress, status }
    }));
  };

  const loadModels = async () => {
    console.log("=== LOADING MODELS ===");
    emitProgress(10, 'Fetching model list...');

    // Fetch models from database
    let projectModels = await fetchProjectModels(projectIdFromUrl);

    // Check if models exist in database
    if (projectModels.length === 0) {
      console.warn('⚠️  No models found in database for this project');
      console.log('📝 Please upload models via the Project Dashboard');
      allModelsLoaded = true;
      emitProgress(100, 'Ready');

      // Show message in UI
      const treeContainer = document.getElementById("treeContainer");
      if (treeContainer) {
        treeContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #64748b;">
          <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
          <div style="font-weight: 600; margin-bottom: 8px;">No Models Available</div>
          <div style="font-size: 14px;">Please upload models via the Project Dashboard</div>
        </div>
      `;
      }

      return;
    }

    // Calculate progress increments
    const progressPerModel = 70 / projectModels.length;
    let currentProgress = 10;

    // Load models from database
    for (let i = 0; i < projectModels.length; i++) {
      const modelInfo = projectModels[i];
      try {
        const cleanName = modelInfo.name.replace(/\.frag$/i, '');
        const progressStatus = projectModels.length > 1
          ? `Loading model ${i + 1}/${projectModels.length}: ${cleanName}`
          : `Loading model: ${cleanName}`;
        emitProgress(currentProgress, progressStatus);

        console.log(`📥 Loading model: ${modelInfo.name} (${modelInfo.id})`);

        // Request a pre-signed URL from the backend (auth required)
        const token = localStorage.getItem('auth_token');
        const presignHeaders: Record<string, string> = {};
        if (token) {
          presignHeaders['Authorization'] = `Bearer ${token}`;
        }

        const presignRes = await fetch(`${API_BASE_URL}/models/${modelInfo.id}/download-url`, {
          headers: presignHeaders
        });

        if (!presignRes.ok) {
          throw new Error(`Failed to get download URL: ${presignRes.status} ${presignRes.statusText}`);
        }

        const { url: signedUrl } = await presignRes.json();

        // Download the model file directly from S3/CloudFront (no auth header needed)
        const file = await fetch(signedUrl);
        if (!file.ok) {
          throw new Error(`Failed to download model from storage: ${file.status} ${file.statusText}`);
        }

        const buffer = await file.arrayBuffer();

        currentProgress += progressPerModel * 0.5;
        emitProgress(currentProgress, `Processing: ${cleanName}`);

        // Also register model in OBC FragmentsManager so 2D Views can read IFC storeys
        try {
          const obcBuffer = buffer.slice(0); // clone to avoid transfer issues
          await (obcFragments as any).core?.load?.(obcBuffer, { modelId: modelInfo.id });
        } catch (e) {
          console.warn('⚠️ OBC.FragmentsManager load failed (2D Views may be limited):', e);
        }
        const model = await fragments.load(buffer, { modelId: modelInfo.id });

        models.set(modelInfo.id, model);
        console.log(`✅ Loaded: ${modelInfo.name} (ID: ${modelInfo.id})`);

        currentProgress += progressPerModel * 0.5;
        emitProgress(currentProgress, `Ready`);

      } catch (error) {
        console.warn(`❌ Could not load ${modelInfo.name}:`, error);
        currentProgress += progressPerModel;
        emitProgress(currentProgress, `Ready`);
      }
    }

    allModelsLoaded = true;
    console.log(`=== ALL MODELS LOADED: ${models.size} ===`);
    emitProgress(80, 'Setting up camera...');

    // Auto-fit camera and position grid after all models loaded
    setTimeout(async () => {
      const combinedBbox = new THREE.Box3();

      models.forEach(model => {
        const bbox = new THREE.Box3().setFromObject(model.object);
        if (!bbox.isEmpty()) {
          combinedBbox.union(bbox);
        }
      });

      if (!combinedBbox.isEmpty()) {
        console.log("Combined bounding box min:", combinedBbox.min);
        console.log("Combined bounding box max:", combinedBbox.max);


        // Calculate camera position for all models
        const center = new THREE.Vector3();
        combinedBbox.getCenter(center);
        const size = new THREE.Vector3();
        combinedBbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.8;

        console.log("Combined center:", center);
        console.log("Combined size:", size);

        world.camera.controls.setLookAt(
          center.x + distance * 0.7,
          center.y + distance * 0.5,
          center.z + distance * 0.7,
          center.x, center.y, center.z,
          true
        );
      }

    }, 200);
  };

  try {
    await loadModels();
  } catch (error) {
    console.error('❌ Failed to load models:', error);
    throw error; // Re-throw to trigger ViewerPage error state
  }

  // Warm up 2D storey views in the background (non-blocking)
  try {
    if (views2d) {
      // Don't await to keep initialization snappy
      views2d.createStoreyViews().catch((e: any) => {
        console.warn('⚠️ 2D storey warmup failed:', e);
      });
    }
  } catch { }

  /* MD
    ### 🌳 Object Tree Implementation
    Now let's create an interactive object tree viewer similar to IFC viewers.
  */

  interface TreeNodeData {
    localId: number;
    name: string;
    category: string;
    children: TreeNodeData[];
    expressID?: number;
    modelName?: string;
    model?: FRAGS.FragmentsModel;
  }

  interface ModelTreeData {
    modelName: string;
    model: FRAGS.FragmentsModel;
    children: TreeNodeData[];
  }

  let spatialTreeData: any = null;
  let treeNodeMap = new Map<number, HTMLElement>();
  let selectedTreeNode: number | null = null;
  let currentModel: FRAGS.FragmentsModel | null = null;

  // Global cache for panel data (keyed by panel ID)
  const panelDataCache = new Map<string, any>();
  // Map localId -> panel data (for quick lookup from selection)
  const localIdPanelMap = new Map<number, any>();
  // Toggle: synchronize tree selection when selecting in canvas
  let SYNC_TREE_ON_SELECT = true;

  // Auto-focus on element from URL (fetch from database)
  const elementIdFromUrl = urlParams.get('element');
  if (elementIdFromUrl) {
    console.log(`🎯 Auto-focusing on element from URL: ${elementIdFromUrl}`);

    // Fetch panel directly from database API
    setTimeout(async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/panels/${projectIdFromUrl}/${elementIdFromUrl}`, {
          headers
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`⚠️ Failed to fetch panel ${elementIdFromUrl}: ${response.status}`);
          console.warn('Error response:', errorText);
          console.warn('Requested URL:', `${API_BASE_URL}/panels/${projectIdFromUrl}/${elementIdFromUrl}`);
          return;
        }

        const panel = await response.json();

        if (panel && panel.metadata?.ifcElementId) {
          const foundLocalId = parseInt(panel.metadata.ifcElementId);
          console.log(`✅ Found localId ${foundLocalId} for database element ${elementIdFromUrl}`);
          console.log(`📦 Panel belongs to model: ${panel.modelId}`);

          // Check if the panel's model is loaded
          const panelModel = models.get(panel.modelId);
          if (!panelModel) {
            console.error(`❌ Panel's model ${panel.modelId} is not loaded. Loaded models:`, Array.from(models.keys()));
            console.error(`💡 The URL specifies model=${modelIdFromUrl} but panel belongs to model=${panel.modelId}`);
            return;
          }

          // Force tree to open for this selection
          openTreeNextSelection = true;
          selectElementByLocalId(foundLocalId, panel.modelId);
        } else {
          console.warn(`⚠️ Panel ${elementIdFromUrl} missing metadata.ifcElementId`);
          console.log('Panel data:', panel);
        }
      } catch (error) {
        console.error('❌ Error fetching panel for auto-focus:', error);
      }
    }, 1500); // Wait for viewer to be fully initialized
  }

  // Get icon based on IFC type
  const getIconForType = (type: string): string => {
    const typeUpper = type.toUpperCase();
    if (typeUpper.includes("PROJECT")) return "🏗️";
    if (typeUpper.includes("SITE")) return "🌍";
    if (typeUpper.includes("BUILDING")) return "🏢";
    if (typeUpper.includes("STOREY")) return "📐";
    if (typeUpper.includes("SPACE")) return "📦";
    if (typeUpper.includes("WALL")) return "🧱";
    if (typeUpper.includes("DOOR")) return "🚪";
    if (typeUpper.includes("WINDOW")) return "🪟";
    if (typeUpper.includes("SLAB")) return "⬜";
    if (typeUpper.includes("BEAM")) return "━";
    if (typeUpper.includes("COLUMN")) return "┃";
    if (typeUpper.includes("STAIR")) return "🪜";
    if (typeUpper.includes("ROOF")) return "🏠";
    if (typeUpper.includes("RAILING")) return "🛤️";
    if (typeUpper.includes("ASSEMBLY")) return "⚙️";
    return "📄";
  };

  // Helper function to check if a node or its descendants contain storeys
  const containsStoreys = (node: any): boolean => {
    if (node.category && node.category.toUpperCase().includes("STOREY")) {
      return true;
    }
    if (node.children && Array.isArray(node.children)) {
      return node.children.some((child: any) => containsStoreys(child));
    }
    return false;
  };

  // Helper function to check if a node is a direct child of IFCBUILDINGSTOREY
  const isStoreyChild = (parentCategory: string | null): boolean => {
    return !!(parentCategory && parentCategory.toUpperCase().includes("STOREY"));
  };

  // Cache for spatial structures to avoid re-parsing
  const spatialStructureCache = new Map<string, any>();
  const lazyLoadedNodes = new Map<string, TreeNodeData>();

  // Hoisted helpers (function declarations avoid TDZ issues)
  function findPathToLocalId(spatialData: any, targetId: number): any[] | null {
    const path: any[] = [];
    const visit = (node: any): boolean => {
      if (!node) return false;
      const nodeId = node.localId || node.expressID;
      path.push(node);
      if (nodeId === targetId) return true;
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (visit(child)) return true;
        }
      }
      path.pop();
      return false;
    };
    if (Array.isArray(spatialData)) {
      for (const root of spatialData) {
        if (visit(root)) return [...path];
      }
      return null;
    } else {
      return visit(spatialData) ? [...path] : null;
    }
  }

  async function resolvePanelByHierarchy(model: FRAGS.FragmentsModel, localId: number): Promise<{ panelData: any, mappedLocalId: number } | null> {
    try {
      const cacheKey = (model as any).modelId || (model as any).threads?.modelId || 'default';
      let spatialStructure = spatialStructureCache.get(cacheKey);
      if (!spatialStructure) {
        spatialStructure = await model.getSpatialStructure();
        spatialStructureCache.set(cacheKey, spatialStructure);
      }
      const path = findPathToLocalId(spatialStructure, localId);
      if (path && path.length) {
        // Try ancestors first (closest upwards)
        for (let i = path.length - 1; i >= 0; i--) {
          const pid = path[i].localId || path[i].expressID;
          if (pid !== null && pid !== undefined && localIdPanelMap.has(pid)) {
            return { panelData: localIdPanelMap.get(pid), mappedLocalId: pid };
          }
        }
        // Limited descendant scan
        const targetNode = path[path.length - 1];
        const q: any[] = [...(targetNode.children || [])];
        let visited = 0;
        while (q.length && visited < 1000) {
          const n = q.shift();
          visited++;
          const nid = n.localId || n.expressID;
          if (nid !== null && nid !== undefined && localIdPanelMap.has(nid)) {
            return { panelData: localIdPanelMap.get(nid), mappedLocalId: nid };
          }
          if (n.children && Array.isArray(n.children)) q.push(...n.children);
        }
      }
    } catch (e) {
      console.warn('resolvePanelByHierarchy failed', e);
    }
    return null;
  }

  function buildLocationText(panelData: any, infoLocalId: number): string {
    if (panelData) {
      const modelName = (panelData.modelName || 'Model').replace(/\.frag$/i, '');
      const storey = panelData.metadata?.storeyName || 'Storey';
      const name = panelData.name || panelData.tag || `Element ${infoLocalId}`;
      return `${modelName} > ${storey} > ${name}`;
    }
    return `Element ${infoLocalId}`;
  }
  // Helper: find model that contains a given localId
  const findModelForLocalId = async (localId: number): Promise<FRAGS.FragmentsModel | null> => {
    console.log(`🔍 Searching for localId ${localId} in ${models.size} loaded models`);
    for (const [modelId, m] of models.entries()) {
      try {
        console.log(`  Checking model: ${modelId}`);
        const boxes = await m.getBoxes([localId]);
        if (boxes && boxes.length > 0 && !boxes[0].isEmpty()) {
          console.log(`  ✅ Found localId ${localId} in model ${modelId}`);
          return m;
        }
        console.log(`  ❌ LocalId ${localId} not in model ${modelId}`);
      } catch (e) {
        console.log(`  ❌ Error checking model ${modelId}:`, e);
      }
    }
    console.warn(`⚠️ LocalId ${localId} not found in any of the ${models.size} loaded models`);
    return null;
  };

  // Helper: select corresponding tree node and ensure it is visible
  // List of IFC types that are considered "Panels" and tracked in the database
  const PANEL_TYPES = [
    // Structural
    'IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCSLAB', 'IFCBEAM', 'IFCCOLUMN',
    'IFCMEMBER', 'IFCPLATE', 'IFCCURTAINWALL', 'IFCFOOTING', 'IFCPILE',

    // Doors and Windows
    'IFCDOOR', 'IFCWINDOW', 'IFCDOORSTANDARDCASE', 'IFCWINDOWSTANDARDCASE',

    // Building Elements & Assemblies
    'IFCROOF', 'IFCSTAIR', 'IFCRAILING', 'IFCRAMP', 'IFCSPACE',
    'IFCFURNISHINGELEMENT', 'IFCELEMENTASSEMBLY', 'IFCBUILDINGELEMENTPART',
    'IFCELEMENTCOMPONENT', 'IFCDISCRETEACCESSORY', 'IFCMECHANICALFASTENER',

    // Reinforcement & Structural Components
    'IFCREINFORCINGBAR', 'IFCREINFORCINGMESH', 'IFCTENDON', 'IFCTENDONANCHOR',

    // MEP - Distribution
    'IFCDUCTFITTING', 'IFCDUCTSEGMENT', 'IFCPIPEFITTING', 'IFCPIPESEGMENT',
    'IFCFLOWSEGMENT',

    // MEP - Control & Terminals
    'IFCFLOWCONTROLLER', 'IFCFLOWTERMINAL', 'IFCVALVE', 'IFCDAMPER',
    'IFCAIRTERMINAL',

    // MEP - Electrical
    'IFCCABLECARRIERFITTING', 'IFCCABLECARRIERSEGMENT', 'IFCCABLESEGMENT',
    'IFCELECTRICALELEMENT', 'IFCELECTRICDISTRIBUTIONBOARD', 'IFCLIGHTFIXTURE',

    // MEP - HVAC Equipment
    'IFCFAN', 'IFCPUMP', 'IFCBOILER', 'IFCCHILLER', 'IFCCOIL', 'IFCHEATEXCHANGER'
  ];

  // Helper: Find the ID of the nearest ancestor that is a "Panel" type
  // This uses the IFC spatial structure which is always fully loaded
  async function findParentPanelId(model: FRAGS.FragmentsModel, localId: number): Promise<number | null> {
    try {
      const cacheKey = (model as any).modelId || (model as any).threads?.modelId || 'default';
      let spatialStructure = spatialStructureCache.get(cacheKey);
      if (!spatialStructure) {
        spatialStructure = await model.getSpatialStructure();
        spatialStructureCache.set(cacheKey, spatialStructure);
      }

      const path = findPathToLocalId(spatialStructure, localId);
      if (path && path.length) {
        // Debug log to see values
        console.log(`🔍 Hierarchy path for ${localId}:`, path.map(n => `${n.type || n.category} (${n.localId || n.expressID})`));

        const nodeName = (n: any) => String(n?.name ?? n?.Name ?? '');

        // Prefer Structural Framing Assembly over Connections Assembly when both appear in the path
        const assemblyCandidates: { id: number; typeRaw: string; name: string }[] = [];
        for (let i = path.length - 1; i >= 0; i--) {
          const node = path[i];
          const parent = i > 0 ? path[i - 1] : null;
          let typeRaw = node.type || node.category;
          if (!typeRaw && parent) typeRaw = parent.type || parent.category;
          typeRaw = typeRaw || 'Unknown';
          const id = node.localId || node.expressID;
          const typeUpper = typeRaw.toUpperCase();
          const typeNormalized = typeUpper.replace(/^IFC/, '');
          const isPanel = PANEL_TYPES.some(t => {
            const tNormalized = t.replace(/^IFC/, '');
            return typeNormalized.includes(tNormalized);
          });
          if (isPanel && id !== null && id !== undefined && typeNormalized.includes('ELEMENTASSEMBLY')) {
            assemblyCandidates.push({ id, typeRaw, name: nodeName(node) });
          }
        }
        if (assemblyCandidates.length) {
          const framing = assemblyCandidates.find((c) => /framing/i.test(c.name));
          if (framing) {
            console.log(`✅ Parent assembly (Framing preferred): ${framing.typeRaw} (${framing.id})`);
            return framing.id;
          }
          const notConnection = assemblyCandidates.find(
            (c) => !/connection/i.test(c.name) && !/connections/i.test(c.name)
          );
          if (notConnection) {
            console.log(`✅ Parent assembly (non-connection): ${notConnection.typeRaw} (${notConnection.id})`);
            return notConnection.id;
          }
          const fallback = assemblyCandidates[assemblyCandidates.length - 1];
          console.log(`✅ Parent assembly (fallback): ${fallback.typeRaw} (${fallback.id})`);
          return fallback.id;
        }

        // Find ALL panel types in the path, then return the TOPMOST one
        let topmostPanelId: number | null = null;
        let topmostPanelType: string | null = null;

        // Walk up the path to find all "Panel" types
        for (let i = path.length - 1; i >= 0; i--) {
          const node = path[i];
          const parent = i > 0 ? path[i - 1] : null;

          // Use type OR category (fallback)
          let typeRaw = node.type || node.category;
          if (!typeRaw && parent) {
            typeRaw = parent.type || parent.category;
          }
          typeRaw = typeRaw || 'Unknown';

          const id = node.localId || node.expressID;

          // Robust check: Normalize both to remove "IFC" prefix
          const typeUpper = typeRaw.toUpperCase();
          const typeNormalized = typeUpper.replace(/^IFC/, '');

          // Check against our list (also normalized)
          const isPanel = PANEL_TYPES.some(t => {
            const tNormalized = t.replace(/^IFC/, '');
            return typeNormalized.includes(tNormalized);
          });

          if (isPanel && id !== null && id !== undefined) {
            // Keep updating to find the topmost panel
            topmostPanelId = id;
            topmostPanelType = typeRaw;
          }
        }

        if (topmostPanelId !== null) {
          console.log(`✅ Found topmost parent panel: ${topmostPanelType} (${topmostPanelId})`);
          return topmostPanelId;
        }

        console.log(`❌ No parent panel found in path for ${localId}`);
      }
    } catch (e) {
      console.warn('findParentPanelId failed', e);
    }
    return null;
  }

  // Helper: select corresponding tree node and ensure it is visible
  const selectTreeNodeByLocalId = async (localId: number): Promise<boolean> => {
    const treeContainer = document.getElementById("tree-container");
    if (!treeContainer) return false;

    const expandAndSelect = (target: HTMLElement) => {
      // Clear previous selection
      treeContainer.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
      target.classList.add('selected');

      // Expand its parent storey if collapsed
      const storeyChildren = target.closest('.storey-children') as HTMLElement | null;
      if (storeyChildren && storeyChildren.classList.contains('collapsed')) {
        storeyChildren.classList.remove('collapsed');
        const storeyNode = storeyChildren.previousElementSibling as HTMLElement | null;
        const toggle = storeyNode?.querySelector('.tree-toggle-icon');
        toggle?.classList.add('expanded');
      }

      // Ensure model root is expanded
      const modelRoot = target.closest('.model-root') as HTMLElement | null;
      if (modelRoot) {
        const modelChildren = modelRoot.querySelector('.model-children') as HTMLElement | null;
        const modelToggle = modelRoot.querySelector('.tree-toggle-icon') as HTMLElement | null;
        if (modelChildren && modelChildren.classList.contains('collapsed')) {
          modelChildren.classList.remove('collapsed');
          modelToggle?.classList.add('expanded');
        }
      }

      // Scroll into view with centering and a small delay to ensure layout is stable
      setTimeout(() => {
        (target as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
        // Trigger the node's click handler to show element info panel
        target.click();
      }, 100);

      // Ensure tree panel is open
      const treePanel = document.getElementById('tree-panel');
      treePanel?.classList.remove('panel-hidden');
    };

    // Helper to wait for DOM update
    const waitForNode = async (id: number, retries = 5): Promise<HTMLElement | null> => {
      for (let i = 0; i < retries; i++) {
        const node = treeContainer.querySelector(`.tree-node.panel-node[data-local-id="${id}"]`) as HTMLElement | null;
        if (node) return node;
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 100)));
      }
      return null;
    };

    // 1. Try to find existing node in DOM (Fast path)
    let target = await waitForNode(localId, 1); // Quick check

    if (target) {
      expandAndSelect(target);
      return true;
    }

    // 2. Node not found - Resolve Parent ID using IFC Structure
    console.log(`🔍 Node for localId ${localId} not found in tree. Resolving hierarchy...`);

    let targetId = localId;
    const model = await findModelForLocalId(localId);

    if (model) {
      const parentId = await findParentPanelId(model, localId);
      if (parentId && parentId !== localId) {
        console.log(`✅ Resolved child element ${localId} to parent panel ${parentId}`);
        targetId = parentId;

        // Check DOM again for parent
        target = await waitForNode(targetId, 1);
        if (target) {
          expandAndSelect(target);
          return true;
        }
      }
    }

    // 3. Still not found - Fetch Location from Backend (Deep Linking)
    // Get project ID from URL
    const pathParts = window.location.pathname.split('/');
    const projectsIndex = pathParts.indexOf('projects');
    const projectId = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : null;

    if (!projectId) return false;

    // Fetch location using the targetId (resolved parent or original)
    const location = await fetchPanelLocation(projectId, targetId);

    if (!location) {
      // Element (and its parent) not in database
      console.log(`ℹ️ Element ${targetId} is not tracked in the database`);
      return false; // Graceful exit
    }

    console.log(`📍 Found panel location:`, location);

    // 4. Load Page & Select
    // Find the correct storey node in the tree
    const modelRoots = treeContainer.querySelectorAll('.model-root');
    for (const modelRoot of Array.from(modelRoots)) {
      const storeyNodes = modelRoot.querySelectorAll('.storey-node');
      for (const sNode of Array.from(storeyNodes)) {
        const label = sNode.querySelector('.tree-label')?.textContent;
        if (label === location.storey) {
          // Found the storey!
          const storeyContainer = sNode.parentElement as HTMLElement;
          const childrenContainer = storeyContainer.querySelector('.storey-children') as HTMLElement;
          const storeyData = (sNode as any)._storeyData;

          if (storeyData) {
            // Check if we need to load the page
            // Load if: not loaded at all, OR requested page is beyond what we have
            const currentMaxPage = storeyData._page || 1;
            const needsLoading = !storeyData._loaded || location.page > currentMaxPage;

            if (needsLoading) {
              console.log(`Loading page ${location.page} for storey ${location.storey}...`);

              // Show loading overlay on tree
              const treeContainer = document.getElementById('tree-container');
              if (treeContainer && location.page > 10) {
                const loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'tree-loading-overlay';
                loadingOverlay.style.cssText = `
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: rgba(255, 255, 255, 0.95);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  z-index: 1000;
                  backdrop-filter: blur(4px);
                `;

                // Create 3D cube loader (matching CubeLoader component)
                loadingOverlay.innerHTML = `
                  <div style="position: relative; width: 40px; height: 40px; perspective: 1000px;">
                    <div class="cube-3d" style="position: absolute; width: 100%; height: 100%; transform-style: preserve-3d; animation: spin-3d 3s infinite linear;">
                      <!-- Front -->
                      <div class="cube-face" style="position: absolute; width: 40px; height: 40px; background: rgba(148,163,184,0.2); border: 2px solid rgba(148,163,184,0.8); backdrop-filter: blur(2px); transform: translateZ(20px); box-shadow: 0 0 10px rgba(148,163,184,0.5);"></div>
                      <!-- Back -->
                      <div class="cube-face" style="position: absolute; width: 40px; height: 40px; background: rgba(148,163,184,0.2); border: 2px solid rgba(148,163,184,0.8); backdrop-filter: blur(2px); transform: rotateY(180deg) translateZ(20px); box-shadow: 0 0 10px rgba(148,163,184,0.5);"></div>
                      <!-- Right -->
                      <div class="cube-face" style="position: absolute; width: 40px; height: 40px; background: rgba(148,163,184,0.2); border: 2px solid rgba(148,163,184,0.8); backdrop-filter: blur(2px); transform: rotateY(90deg) translateZ(20px); box-shadow: 0 0 10px rgba(148,163,184,0.5);"></div>
                      <!-- Left -->
                      <div class="cube-face" style="position: absolute; width: 40px; height: 40px; background: rgba(148,163,184,0.2); border: 2px solid rgba(148,163,184,0.8); backdrop-filter: blur(2px); transform: rotateY(-90deg) translateZ(20px); box-shadow: 0 0 10px rgba(148,163,184,0.5);"></div>
                      <!-- Top -->
                      <div class="cube-face" style="position: absolute; width: 40px; height: 40px; background: rgba(148,163,184,0.2); border: 2px solid rgba(148,163,184,0.8); backdrop-filter: blur(2px); transform: rotateX(90deg) translateZ(20px); box-shadow: 0 0 10px rgba(148,163,184,0.5);"></div>
                      <!-- Bottom -->
                      <div class="cube-face" style="position: absolute; width: 40px; height: 40px; background: rgba(148,163,184,0.2); border: 2px solid rgba(148,163,184,0.8); backdrop-filter: blur(2px); transform: rotateX(-90deg) translateZ(20px); box-shadow: 0 0 10px rgba(148,163,184,0.5);"></div>
                      <!-- Core -->
                      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; background: rgba(148,163,184,0.8); box-shadow: 0 0 15px rgba(148,163,184,0.5); animation: pulse 2s infinite;"></div>
                    </div>
                  </div>
                  
                  <div style="margin-top: 24px; text-align: center;">
                    <h3 style="font-size: 13px; font-weight: 600; color: var(--slate-700); letter-spacing: 0.05em;">Loading page ${location.page}</h3>
                    <div style="display: flex; gap: 3px; justify-content: center; margin-top: 8px;">
                      <div style="width: 6px; height: 6px; background: var(--slate-500); border-radius: 50%; animation: bounce 1s infinite; animation-delay: 0ms;"></div>
                      <div style="width: 6px; height: 6px; background: var(--slate-500); border-radius: 50%; animation: bounce 1s infinite; animation-delay: 100ms;"></div>
                      <div style="width: 6px; height: 6px; background: var(--slate-500); border-radius: 50%; animation: bounce 1s infinite; animation-delay: 200ms;"></div>
                    </div>
                  </div>
                  
                  <style>
                    @keyframes spin-3d {
                      0% { transform: rotateX(0deg) rotateY(0deg); }
                      100% { transform: rotateX(360deg) rotateY(360deg); }
                    }
                    @keyframes pulse {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.5; }
                    }
                    @keyframes bounce {
                      0%, 100% { transform: translateY(0); }
                      50% { transform: translateY(-6px); }
                    }
                  </style>
                `;
                treeContainer.style.position = 'relative';
                treeContainer.appendChild(loadingOverlay);
              }

              // Show loading state
              const toggle = sNode.querySelector('.tree-toggle-icon');
              if (toggle) {
                toggle.classList.add("loading");
                toggle.textContent = "⏳";
              }

              try {
                // Fetch with timeout for deep pages
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                const result = await fetchPanelsForStorey(
                  projectId, // Keep projectId as first argument
                  modelRoot.dataset.modelId || location.modelId,
                  location.storey,
                  location.page,
                  50, // Keep limit as 50
                  controller.signal
                );

                clearTimeout(timeoutId);

                if (result && result.panels) {
                  // Update cache
                  result.panels.forEach((panel: any) => {
                    panelDataCache.set(panel.id, panel);
                    // Use expressId (robust) or fallback to metadata
                    const localId = panel.element?.expressId || (panel.metadata?.ifcElementId ? parseInt(panel.metadata.ifcElementId) : null);
                    if (localId) {
                      localIdPanelMap.set(localId, panel);
                    }
                  });

                  // Merge new panels with existing
                  const existingIds = new Set(storeyData.children.map((p: any) => p.id));
                  const newPanels = result.panels.filter((p: any) => !existingIds.has(p.id));
                  storeyData.children.push(...newPanels);

                  // Update pagination state
                  if (!storeyData._page || location.page > storeyData._page) {
                    storeyData._page = location.page;
                  }
                  // Initialize start page for deep linking
                  if (!storeyData._startPage || location.page < storeyData._startPage) {
                    storeyData._startPage = location.page;
                  }
                  storeyData._hasMore = result.panels.length < result.total;

                  // Render children
                  const isContainerEmpty = childrenContainer.children.length === 0 || childrenContainer.textContent === 'Failed to load';

                  if (isContainerEmpty) {
                    childrenContainer.innerHTML = "";

                    // Add Load Previous button if we're not on page 1
                    if (storeyData._startPage > 1) {
                      renderStoreyLoadPreviousButton(storeyData, childrenContainer, location.modelId);
                    }

                    // If container was empty, we must render ALL children, not just new ones
                    // because they might be in data but not in DOM
                    console.log(`Rendering all ${storeyData.children.length} panels for storey`);
                    storeyData.children.forEach((panel: any) => {
                      renderDatabasePanelNode(panel, childrenContainer);
                    });
                  } else {
                    // Just append new ones
                    console.log(`Appending ${newPanels.length} new panels`);
                    newPanels.forEach((panel: any) => {
                      renderDatabasePanelNode(panel, childrenContainer);
                    });
                  }

                  // Update load more button
                  const existingBtn = childrenContainer.querySelector('.load-more-btn');
                  if (existingBtn) existingBtn.remove();

                  if (storeyData._hasMore) {
                    renderStoreyLoadMoreButton(storeyData, childrenContainer, location.modelId);
                  }

                  // Select the target node (Retry a few times for DOM update)
                  const newTarget = await waitForNode(targetId, 5);
                  if (newTarget) {
                    expandAndSelect(newTarget);
                    return true;
                  } else {
                    console.warn("Node still not found after loading page");
                  }
                } else {
                  throw new Error("No data returned from server");
                }
              } catch (e: any) {
                console.error("Failed to deep load page", e);

                // Show error message to user
                const loadingOverlay = document.getElementById('tree-loading-overlay');
                if (loadingOverlay) {
                  loadingOverlay.innerHTML = `
                    <div style="text-align: center;">
                      <div style="font-size: 32px; margin-bottom: 12px; color: var(--red-500);">⚠️</div>
                      <div style="font-size: 14px; font-weight: 600; color: var(--slate-700); margin-bottom: 8px;">
                        ${e.name === 'AbortError' ? 'Request timed out' : 'Failed to load page'}
                      </div>
                      <div style="font-size: 12px; color: var(--slate-500); margin-bottom: 16px;">
                        Page ${location.page} is too deep to load quickly
                      </div>
                      <button onclick="this.closest('#tree-loading-overlay').remove()" 
                        style="padding: 8px 16px; background: var(--slate-600); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">
                        Close
                      </button>
                    </div>
                  `;

                  // Auto-remove after 5 seconds
                  setTimeout(() => {
                    const overlay = document.getElementById('tree-loading-overlay');
                    if (overlay) overlay.remove();
                  }, 5000);
                }
              } finally {
                // Remove loading overlay
                const loadingOverlay = document.getElementById('tree-loading-overlay');
                if (loadingOverlay) {
                  loadingOverlay.remove();
                }

                if (toggle) {
                  toggle.classList.remove("loading");
                  toggle.textContent = "▶";
                }
              }
            } else {
              // Already loaded, just expand
              const modelChildren = modelRoot.querySelector('.model-children') as HTMLElement;
              if (modelChildren) modelChildren.classList.remove('collapsed');

              if (childrenContainer.classList.contains('collapsed')) {
                childrenContainer.classList.remove('collapsed');
                const toggle = sNode.querySelector('.tree-toggle-icon');
                toggle?.classList.add('expanded');
              }

              (sNode as HTMLElement).scrollIntoView({ block: 'center' });

              // Try to select again
              const newTarget = await waitForNode(targetId, 3);
              if (newTarget) {
                expandAndSelect(newTarget);
                return true;
              }
            }
          } else {
            // Fallback
            (sNode as HTMLElement).scrollIntoView({ block: 'center' });
            (sNode as HTMLElement).style.backgroundColor = '#fff3cd';
            setTimeout(() => (sNode as HTMLElement).style.backgroundColor = '', 2000);
          }
          return false;
        }
      }
    }
    return false;
  };



  // Helper: select element by localId (highlight + camera + info panel)
  const selectElementByLocalId = async (localId: number, modelId?: string) => {
    try {
      // Determine which model contains this localId
      let model: FRAGS.FragmentsModel | null = null;

      if (modelId) {
        model = models.get(modelId) || null;
        if (!model) {
          console.warn(`Specified model ${modelId} not found in loaded models`);
          // Fallback to search if specific model not found
          model = await findModelForLocalId(localId);
        }
      } else {
        model = await findModelForLocalId(localId);
      }

      if (!model) {
        console.warn('No model found for localId', localId);
        return;
      }

      // 1. Resolve Parent ID FIRST
      // We want to select the main parent object (e.g. Wall) even if a child (e.g. Screw) was clicked.
      let targetId = localId;
      const parentId = await findParentPanelId(model, localId);
      if (parentId) {
        targetId = parentId;
        console.log(`ℹ️ Selection: Resolved child ${localId} to parent ${targetId}`);
      }

      // Reset highlights and ghost all models
      const tasks: Promise<any>[] = [];
      for (const [_, m] of models.entries()) {
        tasks.push(m.resetHighlight(undefined));
      }
      await Promise.all(tasks);
      tasks.length = 0;
      for (const [_, m] of models.entries()) {
        tasks.push(m.highlight(undefined, {
          color: new THREE.Color(0xcccccc),
          opacity: 0.2,
          transparent: true,
          renderedFaces: FRAGS.RenderedFaces.TWO,
        }));
      }
      await Promise.all(tasks);

      // Parent + children IDs (using the resolved targetId)
      let idsToHighlight: number[] = [targetId];

      // Use spatial structure to collect parent + children (most reliable method)
      try {
        const cacheKey = (model as any).modelId || (model as any).threads?.modelId || 'default';
        let spatialStructure = spatialStructureCache.get(cacheKey);
        if (!spatialStructure) {
          spatialStructure = await model.getSpatialStructure();
          spatialStructureCache.set(cacheKey, spatialStructure);
        }
        if (spatialStructure) {
          // Collect children of the TARGET (Parent) ID
          const related = collectParentAndChildIds(spatialStructure, targetId);
          if (related.length > 0) {
            idsToHighlight = related;
            console.log(`📦 Found ${related.length} related elements (parent + children) from spatial structure`);
          }
        }
      } catch (e) {
        console.warn('Could not compute parent/children for localId', targetId, e);
      }

      // Highlight selected ids in cobalt blue in owning model
      await model.highlight(idsToHighlight, {
        color: new THREE.Color('#0047AB'),
        opacity: 1,
        transparent: false,
        renderedFaces: FRAGS.RenderedFaces.TWO,
      });

      const resolvedMapId = modelId || getModelMapId(model);
      setLastFragmentSelection(resolvedMapId, idsToHighlight);

      // Focus camera close to selection
      await focusCameraOnLocalIds(idsToHighlight, { closer: 0.9 });
      await fragments.update(true);

      // 2. Tree navigation (which will trigger the tree node click handler to show element info)
      if (SYNC_TREE_ON_SELECT || openTreeNextSelection) {
        await selectTreeNodeByLocalId(targetId);
      }
      openTreeNextSelection = false;

    } catch (e) {
      console.error('Error selecting element by localId:', e);
    }
  };

  // Build tree structure from spatial data (FULL TREE - no lazy loading)
  // Helper function to collect parent + all child IDs from spatial structure
  const collectParentAndChildIds = (spatialData: any, targetId: number): number[] => {
    const collected: number[] = [];

    const traverse = (node: any, foundTarget: boolean = false): boolean => {
      if (!node) return false;

      const nodeId = node.localId || node.expressID;

      // Check if this is the target node
      if (nodeId === targetId) {
        // Found the target! Collect this ID
        collected.push(nodeId);
        // console.log(`🎯 collectParentAndChildIds: Found target ${targetId}`);

        // Collect ALL children recursively
        if (node.children && Array.isArray(node.children)) {
          const collectAllChildren = (childNode: any) => {
            const childId = childNode.localId || childNode.expressID;
            if (childId !== null && childId !== undefined) {
              collected.push(childId);
            }
            if (childNode.children && Array.isArray(childNode.children)) {
              childNode.children.forEach(collectAllChildren);
            }
          };
          node.children.forEach(collectAllChildren);
        }

        // console.log(`📦 collectParentAndChildIds: Collected ${collected.length} IDs for target ${targetId}`);
        return true;
      }

      // Continue searching in children
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (traverse(child, foundTarget)) {
            return true;
          }
        }
      }

      return false;
    };

    // Handle both array and single object spatial data
    if (Array.isArray(spatialData)) {
      for (const root of spatialData) {
        if (traverse(root)) break;
      }
    } else {
      traverse(spatialData);
    }

    if (collected.length === 0) {
      // console.warn(`⚠️ collectParentAndChildIds: Target ${targetId} NOT FOUND in spatial structure`);
    }

    return collected;
  };

  // Duplicate helper block removed; hoisted function declarations above are used

  // Focus the camera on a set of localIds (across all loaded models)
  const focusCameraOnLocalIds = async (
    localIds: number[],
    opts?: { padding?: number; closer?: number; minDistance?: number }
  ) => {
    if (!localIds || localIds.length === 0) return;

    const padding = opts?.padding ?? 1.15; // 15% padding
    const closer = opts?.closer ?? 0.9;    // move a bit closer than perfect fit
    const minDistance = opts?.minDistance ?? 2;

    // 1) Union the boxes of only the selected IDs across all models
    let hasAny = false;
    const union = new THREE.Box3();
    for (const [_, m] of models.entries()) {
      try {
        const boxes = await m.getBoxes(localIds);
        if (boxes && boxes.length) {
          for (const b of boxes) {
            if (!b.isEmpty()) {
              union.union(b);
              hasAny = true;
            }
          }
        }
      } catch (e) {
        // Some ids may not belong to this model; ignore
      }
    }

    if (!hasAny) return;

    const center = new THREE.Vector3();
    union.getCenter(center);
    const size = new THREE.Vector3();
    union.getSize(size);

    const controls: any = world.camera.controls as any;

    // 2) Prefer fitToBox if available (camera-controls provides this)
    if (controls && typeof controls.fitToBox === "function") {
      await controls.fitToBox(union, true, {
        paddingLeft: 0.06,
        paddingRight: 0.06,
        paddingTop: 0.06,
        paddingBottom: 0.06,
      });

      // Move slightly closer along view direction
      const cam = world.camera.three as THREE.PerspectiveCamera;
      const currentPos = cam.position.clone();
      const curDist = currentPos.distanceTo(center);
      // Always switch to a pleasant diagonal angle to better see distributed panels
      const diagDir = new THREE.Vector3(0.7, 0.45, 0.7).normalize();
      const newPos = center.clone().add(diagDir.multiplyScalar(Math.max(curDist * closer, minDistance)));
      controls.setLookAt(newPos.x, newPos.y, newPos.z, center.x, center.y, center.z, true);
    } else {
      // 3) Fallback: compute distance from FOV and setLookAt
      const cam = world.camera.three as THREE.PerspectiveCamera;
      const vfov = THREE.MathUtils.degToRad(cam.fov);
      const aspect = cam.aspect || (window.innerWidth / window.innerHeight);
      const distanceForHeight = (size.y * 0.5) / Math.tan(vfov / 2);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      const distanceForWidth = (size.x * 0.5) / Math.tan(hfov / 2);
      const fitDistance = Math.max(distanceForHeight, distanceForWidth, size.z) * padding;

      // Move slightly closer than the exact fit distance
      const camPos = cam.position.clone();
      const dir = camPos.sub(center).normalize();
      const newPos = center.clone().add(dir.multiplyScalar(Math.max(fitDistance * closer, minDistance)));
      world.camera.controls.setLookAt(newPos.x, newPos.y, newPos.z, center.x, center.y, center.z, true);
    }

    await fragments.update(true);
  };

  // Keep the whole model in view but center the framing toward the selected items.
  // Useful when selected panels are spread out: we use the model's distance but aim near the selection.
  const focusCameraForDistributedSelection = async (
    localIds: number[],
    opts?: { padding?: number; farther?: number; aimBias?: number; minDistance?: number }
  ) => {
    if (!localIds || localIds.length === 0) return;

    const padding = opts?.padding ?? 1.1;     // small padding for full model fit
    const farther = opts?.farther ?? 1.2;     // back off more than perfect fit
    const aimBias = opts?.aimBias ?? 0.25;    // how much to bias target toward model center (0..1)
    const minDistance = opts?.minDistance ?? 5;

    // Build union box of entire model(s)
    const modelBox = new THREE.Box3();
    for (const [_, m] of models.entries()) {
      const bbox = new THREE.Box3().setFromObject(m.object);
      if (!bbox.isEmpty()) modelBox.union(bbox);
    }
    if (modelBox.isEmpty()) return;

    // Build union box of selected items
    let selectedBox = new THREE.Box3();
    let hasSelected = false;
    for (const [_, m] of models.entries()) {
      try {
        const boxes = await m.getBoxes(localIds);
        for (const b of boxes) {
          if (!b.isEmpty()) { selectedBox.union(b); hasSelected = true; }
        }
      } catch (e) { /* ignore ids not in this model */ }
    }
    if (!hasSelected) selectedBox = modelBox.clone();

    const modelCenter = new THREE.Vector3();
    modelBox.getCenter(modelCenter);
    const size = new THREE.Vector3();
    modelBox.getSize(size);

    const selectedCenter = new THREE.Vector3();
    selectedBox.getCenter(selectedCenter);

    // Aim a bit toward selection but keep bias to model center so the whole stays visible
    const aim = selectedCenter.clone().lerp(modelCenter, aimBias);

    const controls: any = world.camera.controls as any;
    if (controls && typeof controls.fitToBox === 'function') {
      // Fit to whole model to compute a safe distance first
      await controls.fitToBox(modelBox, true, {
        paddingLeft: 0.08, paddingRight: 0.08, paddingTop: 0.08, paddingBottom: 0.08,
      });
      const cam = world.camera.three as THREE.PerspectiveCamera;
      const curDist = cam.position.distanceTo(modelCenter);
      const distance = Math.max(curDist * farther, minDistance);
      const diag = new THREE.Vector3(0.7, 0.45, 0.7).normalize();
      const newPos = aim.clone().add(diag.multiplyScalar(distance));
      controls.setLookAt(newPos.x, newPos.y, newPos.z, aim.x, aim.y, aim.z, true);
    } else {
      // Fallback: compute a safe distance from full model size
      const cam = world.camera.three as THREE.PerspectiveCamera;
      const vfov = THREE.MathUtils.degToRad(cam.fov);
      const aspect = cam.aspect || (window.innerWidth / window.innerHeight);
      const distanceForHeight = (size.y * 0.5) / Math.tan(vfov / 2);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      const distanceForWidth = (size.x * 0.5) / Math.tan(hfov / 2);
      const fitDistance = Math.max(distanceForHeight, distanceForWidth, size.z) * padding;
      const distance = Math.max(fitDistance * farther, minDistance);
      const diag = new THREE.Vector3(0.7, 0.45, 0.7).normalize();
      const newPos = aim.clone().add(diag.multiplyScalar(distance));
      world.camera.controls.setLookAt(newPos.x, newPos.y, newPos.z, aim.x, aim.y, aim.z, true);
    }

    await fragments.update(true);
  };

  // Focus the camera on the entire model(s) at a good isometric angle
  const focusCameraOnWholeModel = async (
    opts?: { padding?: number; closer?: number; minDistance?: number }
  ) => {
    const padding = opts?.padding ?? 1.1;   // small frame padding
    const closer = opts?.closer ?? 1.2;     // slightly farther than perfect fit
    const minDistance = opts?.minDistance ?? 5;

    const combinedBbox = new THREE.Box3();
    for (const [_, m] of models.entries()) {
      const bbox = new THREE.Box3().setFromObject(m.object);
      if (!bbox.isEmpty()) combinedBbox.union(bbox);
    }
    if (combinedBbox.isEmpty()) return;

    const center = new THREE.Vector3();
    combinedBbox.getCenter(center);
    const size = new THREE.Vector3();
    combinedBbox.getSize(size);

    const controls: any = world.camera.controls as any;
    if (controls && typeof controls.fitToBox === "function") {
      await controls.fitToBox(combinedBbox, true, {
        paddingLeft: 0.08,
        paddingRight: 0.08,
        paddingTop: 0.08,
        paddingBottom: 0.08,
      });

      const cam = world.camera.three as THREE.PerspectiveCamera;
      const currentPos = cam.position.clone();
      const dir = currentPos.clone().sub(center).normalize();
      const curDist = currentPos.distanceTo(center);
      const newPos = center.clone().add(dir.multiplyScalar(Math.max(curDist * closer, minDistance)));
      controls.setLookAt(newPos.x, newPos.y, newPos.z, center.x, center.y, center.z, true);
    } else {
      // Fallback: compute distance from FOV and use a diagonal angle
      const cam = world.camera.three as THREE.PerspectiveCamera;
      const vfov = THREE.MathUtils.degToRad(cam.fov);
      const aspect = cam.aspect || (window.innerWidth / window.innerHeight);
      const distanceForHeight = (size.y * 0.5) / Math.tan(vfov / 2);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      const distanceForWidth = (size.x * 0.5) / Math.tan(hfov / 2);
      const fitDistance = Math.max(distanceForHeight, distanceForWidth, size.z) * padding;

      const distance = Math.max(fitDistance * closer, minDistance);
      const cameraPos = new THREE.Vector3(
        center.x + distance * 0.7,
        center.y + distance * 0.45,
        center.z + distance * 0.7
      );
      world.camera.controls.setLookAt(
        cameraPos.x, cameraPos.y, cameraPos.z,
        center.x, center.y, center.z,
        true
      );
    }

    await fragments.update(true);
  };

  const buildTreeStructureForModel = async (
    model: FRAGS.FragmentsModel,
    spatialData: any,
    lazyLoad: boolean = false
  ): Promise<TreeNodeData[]> => {
    const processNode = async (node: any, depth: number = 0): Promise<TreeNodeData[]> => {
      try {
        const { localId, category, children } = node;

        // If no localId, just flatten and process children
        if (localId === null || localId === undefined) {
          const childResults: TreeNodeData[] = [];
          if (children && Array.isArray(children)) {
            for (const child of children) {
              const childNodes = await processNode(child, depth);
              childResults.push(...childNodes);
            }
          }
          return childResults;
        }

        // This node has a localId - include it
        // Get item data to fetch the name and other attributes
        const [itemData] = await model.getItemsData([localId], {
          attributesDefault: false,
          attributes: ["Name", "Tag", "ObjectType"],
        });

        // Try to get the best name available
        let name = category || "Unnamed";
        if (itemData) {
          if (itemData.Name && "value" in itemData.Name && itemData.Name.value) {
            name = itemData.Name.value as string;
          } else if (itemData.Tag && "value" in itemData.Tag && itemData.Tag.value) {
            name = itemData.Tag.value as string;
          } else if (itemData.ObjectType && "value" in itemData.ObjectType && itemData.ObjectType.value) {
            name = itemData.ObjectType.value as string;
          }
        }

        const treeNode: TreeNodeData = {
          localId,
          name,
          category: category || "Unknown",
          children: [],
          model: model,
        };

        // LAZY LOADING: Only process children if depth < 2 (storeys only)
        if (children && Array.isArray(children)) {
          if (lazyLoad && depth >= 1) {
            // Don't load children yet - just show count
            // This prevents the "..." from showing
            treeNode.children = [];
            // Store metadata for potential future lazy loading
            (treeNode as any)._childCount = children.length;
            (treeNode as any)._lazyChildren = children;
          } else {
            // Load children normally
            for (const child of children) {
              const childNodes = await processNode(child, depth + 1);
              treeNode.children.push(...childNodes);
            }
          }
        }

        return [treeNode];
      } catch (error) {
        console.warn("Error processing node:", error, node);
        return [];
      }
    };

    const rootNodes: TreeNodeData[] = [];
    if (Array.isArray(spatialData)) {
      for (const rootNode of spatialData) {
        const processed = await processNode(rootNode, 0);
        rootNodes.push(...processed);
      }
    } else if (spatialData) {
      const processed = await processNode(spatialData);
      rootNodes.push(...processed);
    }

    return rootNodes;
  };

  // Render tree node for a specific model
  const renderTreeNodeForModel = (
    model: FRAGS.FragmentsModel,
    nodeData: TreeNodeData,
    parentElement: HTMLElement,
    level: number = 0
  ) => {
    const container = document.createElement("div");
    container.className = "tree-node-container";

    const node = document.createElement("div");
    node.className = "tree-node";
    // Fix: Handle null localId from lazy loading
    if (nodeData.localId !== null && nodeData.localId !== undefined) {
      node.dataset.localId = nodeData.localId.toString();
    }
    node.style.paddingLeft = `${level * 20 + 10}px`;

    // Toggle icon for expandable nodes
    const hasChildren = nodeData.children.length > 0;
    if (hasChildren) {
      const toggleIcon = document.createElement("span");
      toggleIcon.className = "tree-toggle-icon"; // Start collapsed (no 'expanded' class)
      toggleIcon.textContent = "▶";
      toggleIcon.onclick = (e) => {
        e.stopPropagation();
        const childrenContainer = container.querySelector(
          ".tree-children"
        ) as HTMLElement;
        if (childrenContainer) {
          const isCollapsed = childrenContainer.classList.contains("collapsed");
          childrenContainer.classList.toggle("collapsed", !isCollapsed);
          toggleIcon.classList.toggle("expanded", isCollapsed);
        }
      };
      node.appendChild(toggleIcon);
    } else {
      const spacer = document.createElement("span");
      spacer.style.width = "16px";
      spacer.style.display = "inline-block";
      node.appendChild(spacer);
    }

    // Icon
    const icon = document.createElement("span");
    icon.className = "tree-icon";
    icon.textContent = getIconForType(nodeData.category);
    node.appendChild(icon);

    // Label
    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = nodeData.name;
    label.title = `${nodeData.category} - ${nodeData.name}`;
    node.appendChild(label);

    // Count badge for children
    if (hasChildren) {
      const count = document.createElement("span");
      count.className = "tree-count";
      count.textContent = nodeData.children.length.toString();
      node.appendChild(count);
    }

    // Click handler for parent node - triggers focus/highlight (optimized)
    node.onclick = async (e) => {
      e.stopPropagation();

      try {
        // Update info panel
        updateInfoPanel(nodeData);

        // Get all IDs for this node and its children
        const targetIds = collectAllLocalIds(nodeData);
        console.log("Focusing on:", nodeData.name, "with", targetIds.length, "elements");

        // Batch all highlight operations for better performance
        const highlightPromises = [];

        // Reset all highlights first (batched)
        for (const [_, m] of models.entries()) {
          highlightPromises.push(m.resetHighlight(undefined));
        }
        await Promise.all(highlightPromises);
        highlightPromises.length = 0; // Clear array

        // Make all elements semi-transparent (ghost mode) - batched
        for (const [_, m] of models.entries()) {
          highlightPromises.push(
            m.highlight(undefined, {
              color: new THREE.Color(0xcccccc),
              opacity: 0.2,
              transparent: true,
              renderedFaces: FRAGS.RenderedFaces.TWO,
            })
          );
        }
        await Promise.all(highlightPromises);

        // Highlight selected elements with full opacity and color
        if (targetIds.length > 0) {
          try {
            await model.highlight(targetIds, {
              color: new THREE.Color('#0047AB'),
              opacity: 1,
              transparent: false,
              renderedFaces: FRAGS.RenderedFaces.TWO,
            });
            console.log("Highlight applied to", targetIds.length, "elements");
            const mapId = getModelMapId(model);
            if (mapId) setLastFragmentSelection(mapId, targetIds);
          } catch (error) {
            console.error("Failed to highlight elements:", error);
          }
        } else {
          setLastFragmentSelection(null, []);
        }

        // Focus camera precisely on the selected items (a bit closer than perfect fit)
        await focusCameraOnLocalIds(targetIds, { closer: 0.9 });

        // Single update call at the end for better performance
        await fragments.update(true);
      } catch (error) {
        console.error("Error in node click handler:", error);
      }
    };

    container.appendChild(node);
    treeNodeMap.set(nodeData.localId, node);

    // Render children as nested tree (recursive)
    if (hasChildren) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "tree-children collapsed"; // Start collapsed
      childrenContainer.style.marginLeft = "0";

      for (const child of nodeData.children) {
        // Recursively render each child as a full tree node
        renderTreeNodeForModel(model, child, childrenContainer, level + 1);
      }

      container.appendChild(childrenContainer);
    }

    parentElement.appendChild(container);
  };

  // Recursive function to collect all local IDs from a node and its children (optimized with limit)
  const collectAllLocalIds = (node: TreeNodeData, maxIds: number = 10000): number[] => {
    const ids: number[] = [];
    const stack: TreeNodeData[] = [node];

    while (stack.length > 0 && ids.length < maxIds) {
      const current = stack.pop()!;

      if (current.localId !== null && current.localId !== undefined) {
        ids.push(current.localId);
      }

      if (current.children && current.children.length > 0) {
        // Limit children to prevent memory overflow
        const childrenToAdd = current.children.slice(0, Math.min(current.children.length, 1000));
        stack.push(...childrenToAdd);
      }
    }

    return ids;
  };

  // Update info panel with node data
  const updateInfoPanel = (nodeData: TreeNodeData) => {
    const infoPanel = document.getElementById("infoPanel");
    const statusPanel = document.getElementById("statusPanel");
    const groupsPanel = document.getElementById("groupsPanel");

    if (!infoPanel) return;

    // Hide other panels when showing info panel
    if (statusPanel) {
      statusPanel.classList.add("panel-hidden");
    }
    if (groupsPanel) {
      groupsPanel.classList.add("panel-hidden");
    }

    // Show the info panel
    infoPanel.classList.remove("panel-hidden");

    // Update basic info in the info section
    const infoSection = infoPanel.querySelector(".info-section");
    if (infoSection) {
      infoSection.innerHTML = `
      <div class="info-row">
        <div class="info-label">Name</div>
        <div class="info-value">${nodeData.name ?? '-'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">ID</div>
        <div class="info-value">${nodeData.localId ?? '-'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Type</div>
        <div class="info-value">${(nodeData as any).type ?? '-'}</div>
      </div>
      <div class="info-actions">
        <button id="show-qr-btn" class="info-action-btn" title="Show QR Code">
          <i class="fas fa-qrcode"></i>
        </button>
        <button id="show-submissions-btn" class="info-action-btn" title="View Submissions">
          <i class="fas fa-bell"></i>
          <span id="submission-count" class="notification-badge">0</span>
        </button>
      </div>
    `;

      // Re-attach event listeners for QR and Submissions buttons
      const showQrBtnInPanel = infoSection.querySelector("#show-qr-btn");
      const showSubmissionsBtnInPanel = infoSection.querySelector("#show-submissions-btn");

      if (showQrBtnInPanel) {
        showQrBtnInPanel.addEventListener("click", () => {
          if (nodeData.localId) {
            showQRCode(nodeData.localId);
          }
        });
      }

      if (showSubmissionsBtnInPanel) {
        showSubmissionsBtnInPanel.addEventListener("click", () => {
          if (nodeData.localId) {
            showSubmissionsModal(nodeData.localId);
          }
        });

        // Fetch and show badge for unread submissions
        if (nodeData.localId) {
          const panelData = localIdPanelMap.get(nodeData.localId);
          if (panelData && panelData.id) {
            fetchAndDisplaySubmissionBadge(nodeData.localId, panelData.id);
          }
        }
      }
    }

    // Update groups and status sections
    updateElementInfoPanel(nodeData);
  };

  // NEW: Fetch tree structure from database (optimized)
  // Fetch panels for a specific storey (Lazy Loading)
  const fetchPanelsForStorey = async (projectId: string, modelId: string, storeyName: string, page: number = 1, limit: number = 50, signal?: AbortSignal) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        modelId: modelId,
        storey: storeyName
      });

      const response = await fetch(`${API_BASE_URL}/panels/${projectId}?${queryParams.toString()}`, {
        method: 'GET',
        headers: headers,
        signal: signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Map backend data to frontend model
      if (data.panels) {
        data.panels = data.panels.map((p: any) => ({
          ...p,
          type: p.element?.ifcType || p.objectType || p.type || 'Unknown',
          localId: p.element?.expressId || (p.metadata?.ifcElementId ? parseInt(p.metadata.ifcElementId) : (p.element?.id || null))
        }));
      }

      return {
        panels: data.panels,
        total: data.pagination?.total || data.total || 0,
        page: data.pagination?.page || 1,
        totalPages: data.pagination?.totalPages || 1
      };
    } catch (error) {
      console.error('Error fetching panels for storey:', error);
      return null;
    }
  };

  // Helper to fetch panel location (deep linking)
  const fetchPanelLocation = async (projectId: string, localId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/panels/${projectId}/panel-location?localId=${localId}`, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json(); // { panelId, modelId, storey, page }
    } catch (error) {
      console.error('Error fetching panel location:', error);
      return null;
    }
  };

  // Cache for tree structure
  let treeStructureCache: any = null;

  const fetchTreeStructureFromDatabase = async (projectId: string) => {
    try {
      // Return cached structure if available
      if (treeStructureCache) {
        console.log('📦 Using cached tree structure');
        return treeStructureCache;
      }

      console.log(`🗄️ Fetching tree hierarchy from database for project ${projectId}...`);

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.time('⏱️ Fetch hierarchy from API');
      // Fetch hierarchy (Models -> Storeys) only
      const response = await fetch(`${API_BASE_URL}/panels/${projectId}/hierarchy`, {
        method: 'GET',
        headers: headers,
      });

      console.timeEnd('⏱️ Fetch hierarchy from API');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const hierarchy = data.hierarchy || [];

      console.log(`✅ Loaded hierarchy for ${hierarchy.length} models`);

      // Convert to tree structure
      const treeStructure = hierarchy.map((model: any) => ({
        modelId: model.modelId,
        modelName: model.modelName || 'Unknown Model',
        storeys: model.storeys.map((storey: any) => ({
          name: storey.name,
          type: 'IfcBuildingStorey',
          elementCount: storey.elementCount,
          children: [], // Empty initially
          // Lazy loading metadata
          _isLazy: true,
          _childCount: storey.elementCount,
          _loaded: false,
          _modelId: model.modelId,
          _storeyName: storey.name
        })),
        totalPanels: model.storeys.reduce((sum: any, s: any) => sum + s.elementCount, 0)
      }));

      // Cache the result
      treeStructureCache = treeStructure;

      return treeStructure;

    } catch (error) {
      console.error('Error fetching tree structure from database:', error);
      return null;
    }
  };

  // Initialize tree for multiple models
  const initializeObjectTree = async () => {
    console.log("=== INITIALIZING OBJECT TREE FOR MULTIPLE MODELS ===");
    const treeContainer = document.getElementById("tree-container");
    if (!treeContainer) {
      console.error("Tree container not found");
      return;
    }

    // Show loading with progress
    treeContainer.innerHTML = `
    <div style="color: #aaa; padding: 20px; text-align: center;">
      <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
      <div>Loading tree structure from database...</div>
      <div style="font-size: 12px; margin-top: 10px; opacity: 0.7;">
        Fast loading - optimized from database
      </div>
    </div>
  `;

    try {
      // NEW: Fetch from database first (much faster!)
      // URL format: /projects/5/viewer-engine -> get the project ID (5)
      const pathParts = window.location.pathname.split('/');
      const projectsIndex = pathParts.indexOf('projects');
      const projectIdFromUrl = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : null;
      console.log(`🔍 Project ID from URL: ${projectIdFromUrl}`);

      if (projectIdFromUrl) {
        const dbTreeStructure = await fetchTreeStructureFromDatabase(projectIdFromUrl);
        console.log(`📊 Database tree structure result:`, dbTreeStructure);

        if (dbTreeStructure && dbTreeStructure.length > 0) {
          console.log(`✅ Using database tree structure (optimized) - ${dbTreeStructure.length} models`);

          // Render database tree structure with separate model folders
          const fragment = document.createDocumentFragment();

          // Create separate model containers
          for (const modelData of dbTreeStructure) {
            // Create model root node
            const modelContainer = document.createElement("div");
            modelContainer.className = "tree-node-container model-root";

            const modelNode = document.createElement("div");
            modelNode.className = "tree-node model-node";
            modelNode.style.paddingLeft = "10px";
            modelNode.style.fontWeight = "600";
            modelNode.style.cursor = "pointer";

            // Toggle icon
            const toggleIcon = document.createElement("span");
            toggleIcon.className = "tree-toggle-icon";
            toggleIcon.textContent = "▶";
            modelNode.onclick = (e) => {
              e.stopPropagation();
              const childrenContainer = modelContainer.querySelector(".model-children") as HTMLElement;
              if (childrenContainer) {
                const isCollapsed = childrenContainer.classList.contains("collapsed");
                childrenContainer.classList.toggle("collapsed", !isCollapsed);
                toggleIcon.classList.toggle("expanded", isCollapsed);
              }
            };
            modelNode.appendChild(toggleIcon);

            // Model icon
            const icon = document.createElement("i");
            icon.className = "tree-icon";
            icon.setAttribute("data-lucide", "building-2");
            modelNode.appendChild(icon);

            // Model name label
            const label = document.createElement("span");
            label.className = "tree-label";
            // Remove .frag extension if present
            const displayName = modelData.modelName.replace(/\.frag$/i, '');
            label.textContent = displayName;
            modelNode.appendChild(label);

            // Count badge - show total panels
            const count = document.createElement("span");
            count.className = "tree-count";
            count.textContent = modelData.totalPanels.toString();
            modelNode.appendChild(count);

            // Eye icon for show/hide model
            const eyeIcon = document.createElement("i");
            eyeIcon.className = "fas fa-eye tree-eye-icon";
            eyeIcon.title = "Show/Hide Model";
            eyeIcon.style.cssText = "margin-left: 8px; cursor: pointer; font-size: 12px; opacity: 0.7; transition: opacity 0.2s;";

            // Track visibility state
            let isModelVisible = true;

            eyeIcon.onclick = async (e) => {
              e.stopPropagation();

              // Get the target model
              const targetModel = models.get(modelData.modelId);
              if (targetModel) {
                isModelVisible = !isModelVisible;

                // Update eye icon
                eyeIcon.className = isModelVisible ? "fas fa-eye tree-eye-icon" : "fas fa-eye-slash tree-eye-icon";
                eyeIcon.style.opacity = isModelVisible ? "0.7" : "0.4";

                // Show/hide the model in 3D viewer
                if (targetModel.object) {
                  targetModel.object.visible = isModelVisible;
                  console.log(`${isModelVisible ? '👁️ Showing' : '🙈 Hiding'} model: ${modelData.modelName}`);

                  // Update the fragments
                  await fragments.update(true);
                }
              }
            };

            // Hover effects
            eyeIcon.onmouseenter = () => {
              eyeIcon.style.opacity = "1";
            };
            eyeIcon.onmouseleave = () => {
              eyeIcon.style.opacity = isModelVisible ? "0.7" : "0.4";
            };

            modelNode.appendChild(eyeIcon);
            modelContainer.appendChild(modelNode);

            // Children container for storeys
            const childrenContainer = document.createElement("div");
            childrenContainer.className = "model-children collapsed";

            // Render storeys for this model
            modelData.storeys.forEach((storey: any) => {
              renderDatabaseStoreyNode(storey, childrenContainer, modelData.modelId);
            });

            modelContainer.appendChild(childrenContainer);
            fragment.appendChild(modelContainer);
          }

          treeContainer.innerHTML = "";
          treeContainer.appendChild(fragment);

          // Initialize Lucide icons
          if ((window as any).lucide) {
            (window as any).lucide.createIcons();
          }

          console.log("✅ Database tree structure rendered successfully");
          return;
        }
      }

      // FALLBACK: Use old IFC model extraction if database fails (COMMENTED OUT - using database only now)
      console.log("⚠️ Database tree not available, falling back to IFC model extraction...");
      // await initializeObjectTreeFromModel();  // OLD METHOD - Commented out, using database tree only
      treeContainer.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br/>Database tree not available<br/><small>Please ensure panels are loaded in the database</small></div>';

    } catch (error) {
      console.error("Error initializing tree:", error);
      treeContainer.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br/>Error loading tree structure</div>';
    }
  };

  // Helper function to render database storey nodes
  const renderDatabaseStoreyNode = (storey: any, container: HTMLElement, modelId: string) => {
    const storeyContainer = document.createElement("div");
    storeyContainer.className = "tree-node-container";

    const storeyNode = document.createElement("div");
    storeyNode.className = "tree-node storey-node";
    storeyNode.style.paddingLeft = "30px";
    storeyNode.style.cursor = "pointer";
    // Attach data for deep linking
    (storeyNode as any)._storeyData = storey;
    storeyNode.dataset.storeyName = storey.name;

    // Toggle icon
    const toggleIcon = document.createElement("span");
    toggleIcon.className = "tree-toggle-icon";
    toggleIcon.textContent = "▶";

    storeyNode.onclick = async (e) => {
      e.stopPropagation();
      const childrenContainer = storeyContainer.querySelector(".storey-children") as HTMLElement;

      if (childrenContainer) {
        const isCollapsed = childrenContainer.classList.contains("collapsed");

        // LAZY LOADING LOGIC
        if (isCollapsed && storey._isLazy && !storey._loaded && !storey._loading) {
          storey._loading = true;
          toggleIcon.classList.add("loading");
          toggleIcon.textContent = "⏳";

          try {
            // Fetch first page of panels
            const result = await fetchPanelsForStorey(
              projectIdFromUrl!,
              modelId,
              storey.name,
              1,
              50
            );

            if (result && result.panels) {
              // Update cache
              result.panels.forEach((panel: any) => {
                panelDataCache.set(panel.id, panel);
                // Use expressId (robust) or fallback to metadata
                const localId = panel.element?.expressId || (panel.metadata?.ifcElementId ? parseInt(panel.metadata.ifcElementId) : null);
                if (localId) {
                  localIdPanelMap.set(localId, panel);
                }
              });

              storey.children = result.panels;
              storey._loaded = true;
              storey._page = 1;
              storey._hasMore = result.panels.length < result.total;

              // Render the newly fetched children
              childrenContainer.innerHTML = ""; // Clear loading placeholder
              storey.children.forEach((panel: any) => {
                renderDatabasePanelNode(panel, childrenContainer);
              });

              // Initialize Lucide icons for newly rendered panels
              if ((window as any).lucide) {
                (window as any).lucide.createIcons();
              }

              // Add "Load More" button if needed
              if (storey._hasMore) {
                renderStoreyLoadMoreButton(storey, childrenContainer, modelId);
              }
            }
          } catch (err) {
            console.error("Failed to load storey children", err);
            childrenContainer.innerHTML = "<div style='padding-left: 50px; color: red;'>Failed to load</div>";
          } finally {
            storey._loading = false;
            toggleIcon.classList.remove("loading");
            toggleIcon.textContent = "▶";
          }
        }

        childrenContainer.classList.toggle("collapsed", !isCollapsed);
        toggleIcon.classList.toggle("expanded", isCollapsed);
      }
    };
    storeyNode.appendChild(toggleIcon);

    // Icon
    const icon = document.createElement("i");
    icon.className = "tree-icon";
    icon.setAttribute("data-lucide", "layers");
    storeyNode.appendChild(icon);

    // Label
    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = storey.name;
    storeyNode.appendChild(label);

    // Count badge
    const count = document.createElement("span");
    count.className = "tree-count";
    // Show total count if lazy, otherwise loaded count
    count.textContent = storey._isLazy
      ? (storey._childCount || 0).toString()
      : (storey.children?.length || 0).toString();
    storeyNode.appendChild(count);

    storeyContainer.appendChild(storeyNode);

    // Children container
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "storey-children collapsed";

    // Render panels if already loaded (or not lazy)
    if (!storey._isLazy || storey._loaded) {
      if (storey.children && Array.isArray(storey.children)) {
        storey.children.forEach((panel: any) => {
          renderDatabasePanelNode(panel, childrenContainer);
        });
      }
    }

    storeyContainer.appendChild(childrenContainer);
    container.appendChild(storeyContainer);
  };

  // Helper to render "Load Previous" button for storeys
  const renderStoreyLoadPreviousButton = (storey: any, container: HTMLElement, modelId: string) => {
    const loadPrevBtn = document.createElement("div");
    loadPrevBtn.className = "tree-node load-prev-btn";
    loadPrevBtn.style.paddingLeft = "50px";
    loadPrevBtn.style.cursor = "pointer";
    loadPrevBtn.style.color = "var(--primary)";
    loadPrevBtn.textContent = "Load previous...";

    loadPrevBtn.onclick = async (e) => {
      e.stopPropagation();
      loadPrevBtn.textContent = "Loading...";

      try {
        const prevPage = (storey._startPage || 1) - 1;
        if (prevPage < 1) return;

        const result = await fetchPanelsForStorey(
          projectIdFromUrl!,
          modelId,
          storey.name,
          prevPage,
          50
        );

        if (result && result.panels) {
          loadPrevBtn.remove();

          // Update cache
          result.panels.forEach((panel: any) => {
            panelDataCache.set(panel.id, panel);
            // Use expressId (robust) or fallback to metadata
            const localId = panel.element?.expressId || (panel.metadata?.ifcElementId ? parseInt(panel.metadata.ifcElementId) : null);
            if (localId) {
              localIdPanelMap.set(localId, panel);
            }
          });

          // Prepend to existing children
          storey.children.unshift(...result.panels);
          storey._startPage = prevPage;

          // Render new children at the top (after where the button was)
          // We need to insert them before the first panel node
          const firstPanelNode = container.querySelector('.panel-node');

          // Create a temporary container to render nodes
          const tempContainer = document.createElement('div');
          result.panels.forEach((panel: any) => {
            renderDatabasePanelNode(panel, tempContainer);
          });

          // Move nodes from temp container to real container
          while (tempContainer.firstChild) {
            container.insertBefore(tempContainer.firstChild, firstPanelNode);
          }

          // Re-add button if there are more previous pages
          if (prevPage > 1) {
            renderStoreyLoadPreviousButton(storey, container, modelId);
          }
        }
      } catch (error) {
        console.error("Failed to load previous panels:", error);
        loadPrevBtn.textContent = "Retry load previous";
      }
    };

    container.prepend(loadPrevBtn);
  };

  // Helper to render "Load More" button for storeys
  const renderStoreyLoadMoreButton = (storey: any, container: HTMLElement, modelId: string) => {
    const loadMoreBtn = document.createElement("div");
    loadMoreBtn.className = "tree-node load-more-btn";
    loadMoreBtn.style.paddingLeft = "50px";
    loadMoreBtn.style.cursor = "pointer";
    loadMoreBtn.style.color = "var(--primary)";
    loadMoreBtn.textContent = "Load more...";

    loadMoreBtn.onclick = async (e) => {
      e.stopPropagation();
      loadMoreBtn.textContent = "Loading...";

      try {
        const nextPage = (storey._page || 1) + 1;
        const result = await fetchPanelsForStorey(
          projectIdFromUrl!,
          modelId,
          storey.name,
          nextPage,
          50
        );

        if (result && result.panels) {
          loadMoreBtn.remove();

          // Update cache
          result.panels.forEach((panel: any) => {
            panelDataCache.set(panel.id, panel);
            // Use expressId (robust) or fallback to metadata
            const localId = panel.element?.expressId || (panel.metadata?.ifcElementId ? parseInt(panel.metadata.ifcElementId) : null);
            if (localId) {
              localIdPanelMap.set(localId, panel);
            }
          });

          // Append to existing children
          storey.children.push(...result.panels);
          storey._page = nextPage;
          storey._hasMore = (result.total > (nextPage * 50));

          // Render new children
          result.panels.forEach((panel: any) => {
            renderDatabasePanelNode(panel, container);
          });

          // Initialize Lucide icons for newly added panels
          if ((window as any).lucide) {
            (window as any).lucide.createIcons();
          }

          // Add button again if more
          if (storey._hasMore) {
            renderStoreyLoadMoreButton(storey, container, modelId);
          }
        }
      } catch (err) {
        console.error("Failed to load more panels", err);
        loadMoreBtn.textContent = "Failed to load (retry)";
      }
    };

    container.appendChild(loadMoreBtn);
  };

  // Helper function to render database panel nodes
  const renderDatabasePanelNode = (panel: any, container: HTMLElement) => {
    const panelNode = document.createElement("div");
    panelNode.className = "tree-node panel-node";
    panelNode.style.paddingLeft = "50px";

    if (panel.localId) {
      panelNode.dataset.localId = panel.localId.toString();
      // Debug log to verify rendering
      // console.log(`Rendering panel node: ${panel.localId}`);
    } else {
      console.warn("Panel missing localId:", panel);
    }

    // Panel icon
    const icon = document.createElement("i");
    icon.className = "tree-icon";
    icon.setAttribute("data-lucide", "box");
    panelNode.appendChild(icon);

    // Panel name
    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = panel.name || panel.tag || "Unnamed Panel";
    panelNode.appendChild(label);

    // Type badge
    const typeBadge = document.createElement("span");
    typeBadge.className = "tree-type-badge";
    if (panel.type) {
      typeBadge.textContent = panel.type.replace('Ifc', '');
    } else {
      typeBadge.textContent = "Unknown";
    }
    typeBadge.style.cssText = "font-size: 10px; color: #64748b; margin-left: 8px;";
    panelNode.appendChild(typeBadge);

    // Add to tree node map for filtering
    if (panel.localId) {
      treeNodeMap.set(panel.localId, panelNode);
    }

    // Click handler for highlighting and showing element info
    panelNode.onclick = async () => {
      if (panel.localId) {
        // Visual select in tree
        const treeContainer = document.getElementById("tree-container");
        if (treeContainer) treeContainer.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
        panelNode.classList.add('selected');
        console.log(`Clicked panel: ${panel.name}, localId: ${panel.localId}, modelId: ${panel.modelId}`);

        // Highlight in viewer
        const highlightPromises = [];
        for (const [_, m] of models.entries()) {
          highlightPromises.push(m.resetHighlight(undefined));
        }
        await Promise.all(highlightPromises);
        highlightPromises.length = 0;

        // Ghost mode
        for (const [_, m] of models.entries()) {
          highlightPromises.push(
            m.highlight(undefined, {
              color: new THREE.Color(0xcccccc),
              opacity: 0.2,
              transparent: true,
              renderedFaces: FRAGS.RenderedFaces.TWO,
            })
          );
        }
        await Promise.all(highlightPromises);

        // Highlight selected panel with parent-child relationships
        // Find the correct model for this panel
        const targetModel = models.get(panel.modelId);
        if (targetModel) {
          console.log(`✅ Found target model for panel: ${panel.modelId}`);

          // Resolve parent ID first (consistency with selection tool)
          let targetId = panel.localId;
          const parentId = await findParentPanelId(targetModel, panel.localId);
          if (parentId) {
            targetId = parentId;
            console.log(`ℹ️ Tree Click: Resolved child ${panel.localId} to parent ${targetId}`);
          }
          try {
            // Get all related IDs (parent + children) for highlighting
            let idsToHighlight: number[] = [targetId];

            // Use spatial structure to collect parent + children (most reliable method)
            try {
              // Get the spatial structure from the correct model
              const spatialStructure = await targetModel.getSpatialStructure();

              if (spatialStructure) {
                // Collect parent + all children IDs using the RESOLVED targetId (parent)
                const relatedIds = collectParentAndChildIds(spatialStructure, targetId);

                if (relatedIds.length > 0) {
                  idsToHighlight = relatedIds;
                  console.log(`📦 Found ${relatedIds.length} related elements (parent + children) from spatial structure`);
                } else {
                  console.log(`⚠️ No related elements found, using targetId only`);
                }
              }
            } catch (structureError) {
              console.log(`⚠️ Could not get spatial structure, using localId only:`, structureError);
            }

            // Highlight ALL collected IDs (parent + children)
            await targetModel.highlight(idsToHighlight, {
              color: new THREE.Color('#0047AB'),
              opacity: 1,
              transparent: false,
              renderedFaces: FRAGS.RenderedFaces.TWO,
            });

            setLastFragmentSelection(panel.modelId, idsToHighlight);

            // Focus camera on this panel (and keep it a little closer)
            await focusCameraOnLocalIds(idsToHighlight, { closer: 0.9 });

            await fragments.update(true);

            // Show element information panel (same as old tree structure)
            const nodeData = {
              localId: panel.localId,
              name: panel.name || panel.tag || 'Unnamed',
              type: panel.type,
              tag: panel.tag,
              id: panel.id,
              elementId: panel.elementId,
              metadata: panel.metadata,
              category: 'element',
              children: [],
              // Add panel data for groups and statuses
              panelData: panel,
            } as any;

            // Show info panel and update with element data
            const infoPanel = document.getElementById("infoPanel");
            const statusPanel = document.getElementById("statusPanel");
            const groupsPanel = document.getElementById("groupsPanel");

            if (statusPanel) statusPanel.classList.add("panel-hidden");
            if (groupsPanel) groupsPanel.classList.add("panel-hidden");
            if (infoPanel) {
              infoPanel.classList.remove("panel-hidden");

              // Update basic info
              const infoSection = infoPanel.querySelector(".info-section");
              if (infoSection) {
                infoSection.innerHTML = `
                <div class="info-row">
                  <div class="info-label">Name</div>
                  <div class="info-value">${nodeData.name}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">ID</div>
                  <div class="info-value">${nodeData.localId}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Type</div>
                  <div class="info-value">${nodeData.type}</div>
                </div>
                <!-- COMMENTED OUT: Active Status dropdown - replaced with multiple status assignment
                <div class="info-row">
                  <div class="info-label">Active Status</div>
                  <div class="info-value">
                    <select id="element-active-status" class="status-select">
                      <option value="">No status assigned</option>
                    </select>
                  </div>
                </div>
                -->
                <div class="info-actions">
                  <button id="show-qr-btn" class="info-action-btn" title="Show QR Code">
                    <i class="fas fa-qrcode"></i>
                  </button>
                  <button id="show-submissions-btn" class="info-action-btn" title="View Submissions">
                    <i class="fas fa-bell"></i>
                    <span id="submission-count" class="notification-badge">0</span>
                  </button>
                </div>
              `;
              }

              // Update groups and status sections
              updateElementInfoPanel(nodeData);

              // Attach QR code button event listener
              const showQrBtnInPanel = infoPanel.querySelector("#show-qr-btn");
              if (showQrBtnInPanel) {
                showQrBtnInPanel.addEventListener("click", () => {
                  if (nodeData.localId) {
                    console.log("🔲 Showing QR code for element:", nodeData.localId);
                    showQRCode(nodeData.localId);
                  }
                });
              }

              // Attach submissions button event listener
              const showSubmissionsBtnInPanel = infoPanel.querySelector("#show-submissions-btn");
              if (showSubmissionsBtnInPanel) {
                showSubmissionsBtnInPanel.addEventListener("click", () => {
                  if (nodeData.localId) {
                    console.log("📋 Showing submissions for element:", nodeData.localId);
                    showSubmissionsModal(nodeData.localId);
                  }
                });

                // Fetch and show badge for unread submissions
                if (nodeData.localId) {
                  const panelData = localIdPanelMap.get(nodeData.localId);
                  if (panelData && panelData.id) {
                    fetchAndDisplaySubmissionBadge(nodeData.localId, panelData.id);
                  }
                }
              }
            }

            console.log("✅ Element information panel updated");

          } catch (error) {
            console.error("Error highlighting panel:", error);
          }
        } else {
          console.error(`❌ Target model not found for panel: ${panel.modelId}. Available models:`, Array.from(models.keys()));
        }
      }
    };

    container.appendChild(panelNode);
  };

  // Setup search functionality
  const setupSearch = (projectId: string) => {
    const searchInput = document.getElementById('tree-search') as HTMLInputElement;
    if (!searchInput) return;

    // Remove existing listeners (by cloning)
    const newSearchInput = searchInput.cloneNode(true) as HTMLInputElement;
    searchInput.parentNode?.replaceChild(newSearchInput, searchInput);

    let debounceTimer: any;

    newSearchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.trim();

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const treeContainer = document.getElementById("tree-container");
        if (!treeContainer) return;

        if (query.length === 0) {
          // Reset to hierarchy view by re-fetching
          treeContainer.innerHTML = '<div style="padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Reloading tree...</div>';
          const dbTreeStructure = await fetchTreeStructureFromDatabase(projectId);

          if (dbTreeStructure && dbTreeStructure.length > 0) {
            treeContainer.innerHTML = "";
            const fragment = document.createDocumentFragment();

            // Re-render hierarchy (duplicated logic, but necessary for reset)
            for (const modelData of dbTreeStructure) {
              const modelContainer = document.createElement("div");
              modelContainer.className = "tree-node-container model-root";

              const modelNode = document.createElement("div");
              modelNode.className = "tree-node model-node";
              modelNode.style.paddingLeft = "10px";
              modelNode.style.fontWeight = "600";

              // Toggle icon
              const toggleIcon = document.createElement("span");
              toggleIcon.className = "tree-toggle-icon";
              toggleIcon.textContent = "▶";
              toggleIcon.onclick = (e) => {
                e.stopPropagation();
                const childrenContainer = modelContainer.querySelector(".model-children") as HTMLElement;
                if (childrenContainer) {
                  const isCollapsed = childrenContainer.classList.contains("collapsed");
                  childrenContainer.classList.toggle("collapsed", !isCollapsed);
                  toggleIcon.classList.toggle("expanded", isCollapsed);
                }
              };
              modelNode.appendChild(toggleIcon);

              const icon = document.createElement("i");
              icon.className = "tree-icon";
              icon.setAttribute("data-lucide", "building-2");
              modelNode.appendChild(icon);

              const label = document.createElement("span");
              label.className = "tree-label";
              label.textContent = modelData.modelName.replace(/\.frag$/i, '');
              modelNode.appendChild(label);

              const count = document.createElement("span");
              count.className = "tree-count";
              count.textContent = modelData.totalPanels.toString();
              modelNode.appendChild(count);

              modelContainer.appendChild(modelNode);

              const childrenContainer = document.createElement("div");
              childrenContainer.className = "model-children collapsed";

              modelData.storeys.forEach((storey: any) => {
                renderDatabaseStoreyNode(storey, childrenContainer, modelData.modelId);
              });

              modelContainer.appendChild(childrenContainer);
              fragment.appendChild(modelContainer);
            }
            treeContainer.appendChild(fragment);
          }
          return;
        }

        if (query.length < 2) return;

        // Show loading
        treeContainer.innerHTML = '<div style="padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

        try {
          const token = localStorage.getItem('auth_token');
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(`${API_BASE_URL}/panels/${projectId}?search=${encodeURIComponent(query)}&limit=100`, {
            method: 'GET',
            headers: headers
          });
          const data = await response.json();

          // Map backend data to frontend model
          if (data.panels) {
            data.panels = data.panels.map((p: any) => ({
              ...p,
              type: p.objectType || p.element?.ifcType || p.type || 'Unknown',
              localId: p.metadata?.ifcElementId ? parseInt(p.metadata.ifcElementId) : (p.element?.id || null)
            }));
          }

          treeContainer.innerHTML = '';
          if (data.panels && data.panels.length > 0) {
            const resultsHeader = document.createElement('div');
            resultsHeader.style.padding = '10px';
            resultsHeader.style.fontWeight = 'bold';
            resultsHeader.style.borderBottom = '1px solid var(--slate-200)';
            const totalCount = data.pagination ? data.pagination.total : (data.total || data.panels.length);
            resultsHeader.textContent = `Found ${totalCount} results for "${query}"`;
            treeContainer.appendChild(resultsHeader);

            const resultsContainer = document.createElement('div');
            resultsContainer.className = 'search-results';

            data.panels.forEach((panel: any) => {
              renderDatabasePanelNode(panel, resultsContainer);
            });
            treeContainer.appendChild(resultsContainer);
          } else {
            treeContainer.innerHTML = '<div style="padding: 20px; text-align: center;">No results found</div>';
          }
        } catch (error) {
          console.error('Search failed', error);
          treeContainer.innerHTML = '<div style="color: red; padding: 20px; text-align: center;">Search failed</div>';
        }
      }, 300);
    });
  };

  if (projectIdFromUrl) {
    setupSearch(projectIdFromUrl);
  }

  // OLD: Initialize tree from IFC model (commented out - kept as fallback)
  const initializeObjectTreeFromModel = async () => {
    console.log("=== INITIALIZING OBJECT TREE FROM IFC MODEL (FALLBACK) ===");
    const treeContainer = document.getElementById("tree-container");
    if (!treeContainer) {
      console.error("Tree container not found");
      return;
    }

    // Show loading with progress
    treeContainer.innerHTML = `
    <div style="color: #aaa; padding: 20px; text-align: center;">
      <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
      <div>Loading tree structure...</div>
      <div style="font-size: 12px; margin-top: 10px; opacity: 0.7;">
        This may take 10-30 seconds for large models
      </div>
    </div>
  `;

    try {
      // Use DocumentFragment for better performance
      const fragment = document.createDocumentFragment();

      // Fetch model info once for efficient lookup
      const modelInfo = await fetchProjectModels(projectIdFromUrl);
      const modelLookup = new Map(modelInfo.map(m => [m.id, m]));

      // Process each model with timeout
      for (const [modelId, model] of models.entries()) {
        // Get the original filename for display
        const modelData = modelLookup.get(modelId);
        const modelName = modelData ? modelData.name : modelId;

        console.log(`📦 Processing model: ${modelName} (ID: ${modelId})`);

        // Update progress
        treeContainer.innerHTML = `
        <div style="color: #aaa; padding: 20px; text-align: center;">
          <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
          <div>Extracting spatial structure...</div>
          <div style="font-size: 12px; margin-top: 10px; opacity: 0.7;">
            Processing: ${modelName}
          </div>
        </div>
      `;

        try {
          console.time(`getSpatialStructure-${modelName}`);

          // Get spatial structure with timeout (30 seconds max)
          const spatialDataPromise = model.getSpatialStructure();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: Model is too large or complex')), 30000)
          );

          const spatialData = await Promise.race([spatialDataPromise, timeoutPromise]);
          console.timeEnd(`getSpatialStructure-${modelName}`);
          console.log(`✅ Spatial structure for ${modelName}:`, spatialData);

          if (!spatialData) {
            console.warn(`⚠️ No spatial structure for ${modelName}`);
            treeContainer.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;">No spatial structure found in model</div>';
            continue;
          }

          // Check if spatialData is empty or invalid
          if (Array.isArray(spatialData) && spatialData.length === 0) {
            console.warn(`⚠️ Empty spatial structure array for ${modelName}`);
            treeContainer.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;">Model has no spatial hierarchy</div>';
            continue;
          }

          console.log(`🔨 Building tree structure for ${modelName}...`);
          console.time(`buildTree-${modelName}`);

          // Build tree structure for this model
          const treeData = await buildTreeStructureForModel(model, spatialData);

          console.timeEnd(`buildTree-${modelName}`);
          console.log(`✅ Tree data for ${modelName}:`, treeData);
          console.log(`📊 Tree has ${treeData.length} root nodes`);

          // Create model root node
          const modelContainer = document.createElement("div");
          modelContainer.className = "tree-node-container model-root";

          const modelNode = document.createElement("div");
          modelNode.className = "tree-node model-node";
          modelNode.style.paddingLeft = "10px";
          modelNode.style.fontWeight = "600";

          // Toggle icon
          const toggleIcon = document.createElement("span");
          toggleIcon.className = "tree-toggle-icon";
          toggleIcon.textContent = "▶";
          toggleIcon.onclick = (e) => {
            e.stopPropagation();
            const childrenContainer = modelContainer.querySelector(".model-children") as HTMLElement;
            if (childrenContainer) {
              const isCollapsed = childrenContainer.classList.contains("collapsed");
              childrenContainer.classList.toggle("collapsed", !isCollapsed);
              toggleIcon.classList.toggle("expanded", isCollapsed);
            }
          };
          modelNode.appendChild(toggleIcon);

          // Model icon based on category
          const icon = document.createElement("i");
          icon.className = "tree-icon";

          // Get category-specific icon
          const category = modelData?.category || 'OTHER';
          switch (category) {
            case 'STRUCTURE':
              icon.setAttribute("data-lucide", "building");
              break;
            case 'MEP':
              icon.setAttribute("data-lucide", "wrench");
              break;
            case 'ELECTRICAL':
              icon.setAttribute("data-lucide", "zap");
              break;
            default:
              icon.setAttribute("data-lucide", "building-2");
          }
          modelNode.appendChild(icon);

          // Model name label with category
          const label = document.createElement("span");
          label.className = "tree-label";

          // Create a more descriptive name
          const baseName = modelName.replace(/\.(ifc|frag)$/i, '');
          const categoryLabel = category !== 'OTHER' ? ` (${category})` : '';
          label.textContent = `${baseName}${categoryLabel}`;
          modelNode.appendChild(label);

          // Count badge
          const count = document.createElement("span");
          count.className = "tree-count";
          count.textContent = treeData.length.toString();
          modelNode.appendChild(count);

          modelContainer.appendChild(modelNode);

          // Children container
          const childrenContainer = document.createElement("div");
          childrenContainer.className = "model-children collapsed";

          // Render storeys for this model using fragment
          for (const storeyNode of treeData) {
            renderTreeNodeForModel(model, storeyNode, childrenContainer, 1);
          }

          modelContainer.appendChild(childrenContainer);
          fragment.appendChild(modelContainer);

        } catch (error) {
          console.error(`Error processing ${modelName}:`, error);
          // Show error in tree container
          const errorDiv = document.createElement('div');
          errorDiv.style.cssText = 'color: #ff6b6b; padding: 20px; text-align: center;';
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><br/>Error loading tree for ${modelName}<br/><small>${errorMessage}</small>`;
          fragment.appendChild(errorDiv);
        }
      }

      // Append all at once for better performance
      treeContainer.innerHTML = "";

      if (fragment.childNodes.length === 0) {
        treeContainer.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br/>No tree data available<br/><small>Model may not have spatial structure</small></div>';
      } else {
        treeContainer.appendChild(fragment);
        console.log("=== TREE INITIALIZED FOR ALL MODELS ===");
      }
    } catch (error) {
      console.error("Error initializing tree:", error);
      treeContainer.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;"><i class="fas fa-exclamation-triangle"></i><br/>Error loading tree<br/><small>Check console for details</small></div>';
    }
  };

  // Tree panel toggle functionality
  const treePanel = document.getElementById("tree-panel");
  const treeToggleBtn = document.getElementById("tree-toggle-btn");
  const treeCloseBtn = document.getElementById("tree-close-btn");
  const treeResetBtn = document.getElementById("tree-reset-btn");

  console.log("Tree panel elements:", { treePanel, treeToggleBtn, treeCloseBtn });

  if (treeToggleBtn && treePanel) {
    treeToggleBtn.addEventListener("click", () => {
      console.log("Tree toggle button clicked!");
      console.log("Panel classes before toggle:", treePanel.className);
      treePanel.classList.toggle("panel-hidden");
      console.log("Panel classes after toggle:", treePanel.className);
    });
    console.log("✅ Tree toggle button event listener attached");
  } else {
    console.error("❌ Tree toggle button or panel not found!", { treeToggleBtn, treePanel });
  }

  if (treeCloseBtn && treePanel) {
    treeCloseBtn.addEventListener("click", () => {
      treePanel.classList.add("panel-hidden");
    });
  }

  // Selection tool toggle and picking
  const selectionBtn = document.getElementById('selection-tool-btn');
  let selectionActive = false;
  let selectionHandler: any = null;
  let openTreeNextSelection = false;
  if (selectionBtn) {
    const casters = components.get(OBC.Raycasters);
    const caster = casters.get(world);
    selectionBtn.addEventListener('click', () => {
      selectionActive = !selectionActive;
      selectionBtn.classList.toggle('active', selectionActive);
      if (selectionActive) {
        console.log('🖱️ Selection tool enabled (double-click model to select)');
        selectionHandler = async (ev: MouseEvent) => {
          // Always compute based on renderer canvas
          const canvas = (world.renderer?.three as any)?.domElement as HTMLCanvasElement | undefined;
          if (!canvas) {
            console.warn('No renderer canvas found for picking');
            return;
          }
          if (ev.type !== 'dblclick') return;
          ev.preventDefault();
          ev.stopPropagation();
          console.log('🖱️ Double-click for selection at', ev.clientX, ev.clientY);
          // If user holds Shift, also open the tree for this selection
          openTreeNextSelection = !!ev.shiftKey;
          const rect = canvas.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((ev.clientX - rect.left) / rect.width) * 2 - 1,
            -((ev.clientY - rect.top) / rect.height) * 2 + 1,
          );
          const px = new THREE.Vector2(
            ev.clientX - rect.left,
            ev.clientY - rect.top,
          );
          console.log('📐 NDC:', ndc.x.toFixed(3), ndc.y.toFixed(3), ' PX:', Math.round(px.x), Math.round(px.y));

          // Try caster first (if it works, great)
          try {
            const result = await caster.castRay();
            if (result && typeof (result as any).localId === 'number') {
              console.log('Raycasters hit:', (result as any).localId);
              await selectElementByLocalId((result as any).localId);
              return;
            }
          } catch (e) {
            // ignore and fall back to manual model.raycast
          }

          // Manual raycast against each loaded model; pick closest
          let best: { localId: number; distance: number } | null = null;
          for (const [, m] of models.entries()) {
            try {
              let hit = await m.raycast({
                camera: world.camera.three,
                dom: canvas,
                mouse: ndc,
              } as any);
              if (!hit) {
                // Try pixel coordinates in case implementation expects them
                hit = await m.raycast({
                  camera: world.camera.three,
                  dom: canvas,
                  mouse: px,
                } as any);
              }
              if (hit && typeof (hit as any).localId === 'number') {
                const dist = (hit as any).distance ?? (hit as any).rayDistance ?? 0;
                if (!best || dist < best.distance) {
                  best = { localId: (hit as any).localId, distance: dist };
                }
              }
            } catch (e) {
              // ignore models without the id
            }
          }
          if (best) {
            console.log('Manual raycast hit:', best.localId, 'dist:', best.distance);
            await selectElementByLocalId(best.localId);
          } else {
            console.log('No element hit');
          }
        };
        const canvas = (world.renderer?.three as any)?.domElement as HTMLCanvasElement | undefined;
        if (canvas) canvas.addEventListener('dblclick', selectionHandler);
      } else {
        const canvas = (world.renderer?.three as any)?.domElement as HTMLCanvasElement | undefined;
        if (selectionHandler && canvas) canvas.removeEventListener('dblclick', selectionHandler);
        selectionHandler = null;
        console.log('🛑 Selection tool disabled');
      }
    });
  }

  // Reset button - clears all highlights and shows everything normally
  if (treeResetBtn) {
    treeResetBtn.addEventListener("click", async () => {
      try {
        lastFragmentSelection = null;
        // Reset all highlights and visibility for all models
        for (const [_, model] of models.entries()) {
          await model.resetHighlight(undefined);
          await model.setVisible(undefined, true);
        }

        // Calculate combined bounding box and fit camera
        const combinedBbox = new THREE.Box3();
        models.forEach(model => {
          const bbox = new THREE.Box3().setFromObject(model.object);
          if (!bbox.isEmpty()) {
            combinedBbox.union(bbox);
          }
        });

        if (!combinedBbox.isEmpty()) {
          const center = new THREE.Vector3();
          combinedBbox.getCenter(center);
          const size = new THREE.Vector3();
          combinedBbox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const distance = maxDim * 2;

          world.camera.controls.setLookAt(
            center.x + distance * 0.7,
            center.y + distance * 0.5,
            center.z + distance * 0.7,
            center.x, center.y, center.z,
            true
          );
        } else {
          // Fallback to default position
          world.camera.controls.setLookAt(50, 30, 50, 0, 0, 0, true);
        }

        await fragments.update(true);

        console.log("View reset successfully");
      } catch (error) {
        console.error("Error resetting view:", error);
      }
    });
  }

  // Info panel close button
  const infoCloseBtn = document.getElementById("info-close-btn");
  if (infoCloseBtn) {
    infoCloseBtn.addEventListener("click", () => {
      const infoPanel = document.getElementById("infoPanel");
      if (infoPanel) {
        infoPanel.classList.add("panel-hidden");
      }
    });
  }

  // Search functionality
  const treeSearchInput = document.getElementById("tree-search") as HTMLInputElement;
  if (treeSearchInput) {
    treeSearchInput.addEventListener("input", (e) => {
      const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
      const allNodes = document.querySelectorAll(".tree-node");

      allNodes.forEach((node) => {
        const label = node.querySelector(".tree-label");
        if (label) {
          const text = label.textContent?.toLowerCase() || "";
          const container = node.closest(".tree-node-container") as HTMLElement;
          if (container) {
            if (text.includes(searchTerm) || searchTerm === "") {
              container.style.display = "";
              node.classList.toggle("highlighted", searchTerm !== "" && text.includes(searchTerm));
            } else {
              container.style.display = "none";
              node.classList.remove("highlighted");
            }
          }
        }
      });
    });
  }

  // Initialize tree after model loads (non-blocking - runs in background)
  initializeObjectTree().catch(error => {
    console.error('Failed to initialize tree:', error);
  });

  // Update object count in status bar
  const updateObjectCount = () => {
    const objectCountEl = document.getElementById('objectCount');
    if (objectCountEl) {
      objectCountEl.textContent = `${models.size} models loaded`;
    }
  };
  updateObjectCount();

  /* MD
    Note: Old single-model UI components (raycasting, panels, etc.) have been removed
    as we now support multiple models through the tree interface.
  */

  /* MD
    ### ⏱️ Measuring the performance
    Performance monitoring disabled
  */

  console.log("=== Fragment Viewer Ready ===");
  console.log("Model loaded successfully! Click elements to explore their data.");

  /* MD
    ### 📊 Status Management System
    Display custom statuses from database (read-only)
  */

  interface DatabaseStatus {
    id: string;
    projectId: number;
    name: string;
    icon: string;
    color: string;
    description?: string;
    order: number;
    panelCount?: number;
    createdAt: string;
    updatedAt: string;
  }

  let elementStatuses: DatabaseStatus[] = [];

  // Fetch statuses from database
  const fetchStatusesFromDatabase = async (projectId: string): Promise<void> => {
    try {
      console.log(`Fetching statuses for project ${projectId}...`);

      // Get authentication token
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/status-management/${projectId}`, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      elementStatuses = data.statuses || [];
      console.log(`Loaded ${elementStatuses.length} statuses from database`);

      // Render the status list after fetching
      renderStatusList();
    } catch (error) {
      console.error("Error fetching statuses from database:", error);
      elementStatuses = [];
      renderStatusList();
    }
  };

  // Map icon names to Lucide icons (deprecated - use getIconComponent instead)
  // Kept for backward compatibility with renderStatusList
  const getIconClass = (iconName: string): string => {
    // Use the same Lucide icon mapping as getIconComponent
    return getIconComponent(iconName);
  };

  // Render status list (read-only)
  const renderStatusList = () => {
    const statusListContent = document.getElementById("statusListContent");
    if (!statusListContent) return;

    if (elementStatuses.length === 0) {
      statusListContent.innerHTML = `
      <div class="empty-state">
        <i data-lucide="tags" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3; width: 48px; height: 48px;"></i>
        <p>No statuses found</p>
        <p style="font-size: 13px; margin-top: 8px;">Statuses are managed from the Project Dashboard</p>
      </div>
    `;
      setTimeout(() => initializeLucideIcons(), 50);
      return;
    }

    statusListContent.innerHTML = "";
    elementStatuses.forEach((status, index) => {
      const statusItem = document.createElement("div");
      statusItem.className = "status-item";
      statusItem.style.borderLeftColor = status.color;
      statusItem.dataset.statusId = status.id;

      const iconClass = getIconClass(status.icon);
      const panelCount = status.panelCount || 0;

      // Get panels from the status
      const panels = status.panelStatuses?.map((ps: any) => ps.panel) || [];

      statusItem.innerHTML = `
      <div class="status-item-header">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; cursor: pointer;" class="status-header-main">
          <i class="fas fa-chevron-right status-chevron" style="font-size: 12px; transition: transform 0.2s; color: var(--slate-400);"></i>
          <i data-lucide="${iconClass}" class="status-item-icon" style="color: ${status.color}; width: 20px; height: 20px;"></i>
          <span class="status-item-name">${status.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="status-highlight-btn" title="Highlight all panels with this status" style="background: none; border: none; cursor: pointer; padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
            <i class="fas fa-eye" style="font-size: 14px; color: ${status.color};"></i>
          </button>
          <span class="status-item-count" style="font-size: 11px; color: var(--slate-500);">${panelCount} panel${panelCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="status-panels-container" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--slate-200);">
        <div class="status-panels-grid">
          ${panels.length > 0 ? panels.map(panel => `
            <div class="status-panel-item" data-panel-id="${panel.id}">
              <i class="fas fa-cube" style="font-size: 14px; color: ${status.color};"></i>
              <div class="panel-item-info">
                <div class="panel-item-name">${panel.name}</div>
                ${panel.tag ? `<div class="panel-item-tag">${panel.tag}</div>` : ''}
              </div>
            </div>
          `).join('') : '<div class="empty-state" style="grid-column: 1 / -1; padding: 20px;"><p style="font-size: 13px; color: var(--slate-500);">No panels with this status</p></div>'}
        </div>
      </div>
    `;

      // Add click handler to toggle expansion (only on the main header, not the highlight button)
      const headerMain = statusItem.querySelector(".status-header-main");
      const panelsContainer = statusItem.querySelector(".status-panels-container");
      const chevron = statusItem.querySelector(".status-chevron");

      if (headerMain && panelsContainer && chevron) {
        headerMain.addEventListener("click", (e) => {
          e.stopPropagation();
          const isExpanded = panelsContainer.style.display !== "none";

          if (isExpanded) {
            panelsContainer.style.display = "none";
            chevron.style.transform = "rotate(0deg)";
          } else {
            panelsContainer.style.display = "block";
            chevron.style.transform = "rotate(90deg)";
          }
        });
      }

      // Add click handler for highlight button to highlight all status panels (original behavior)
      const highlightBtn = statusItem.querySelector(".status-highlight-btn");
      if (highlightBtn) {
        highlightBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          highlightStatusPanels(status);
        });

        // Hover effect for highlight button
        highlightBtn.addEventListener("mouseenter", () => {
          (highlightBtn as HTMLElement).style.background = "var(--slate-100)";
        });
        highlightBtn.addEventListener("mouseleave", () => {
          (highlightBtn as HTMLElement).style.background = "none";
        });
      }

      statusListContent.appendChild(statusItem);
    });

    // Initialize Lucide icons after rendering
    setTimeout(() => initializeLucideIcons(), 100);
  };

  // Status management - Read only, editing done in dashboard

  // Status panel toggle
  const statusPanel = document.getElementById("statusPanel");
  const statusToggleBtn = document.getElementById("status-toggle-btn");
  const statusCloseBtn = document.getElementById("status-close-btn");
  const infoPanel = document.getElementById("infoPanel");

  if (statusToggleBtn && statusPanel) {
    statusToggleBtn.addEventListener("click", () => {
      const isHidden = statusPanel.classList.contains("panel-hidden");

      // Hide other panels when showing status panel
      if (isHidden) {
        if (infoPanel) {
          infoPanel.classList.add("panel-hidden");
        }
        const groupsPanel = document.getElementById("groupsPanel");
        if (groupsPanel) {
          groupsPanel.classList.add("panel-hidden");
        }
      }

      statusPanel.classList.toggle("panel-hidden");
    });
  }

  if (statusCloseBtn && statusPanel) {
    statusCloseBtn.addEventListener("click", () => {
      statusPanel.classList.add("panel-hidden");
    });
  }

  // Hide "Add New Status" button (statuses are managed in dashboard)
  const addStatusBtn = document.getElementById("add-status-btn");
  if (addStatusBtn) {
    addStatusBtn.style.display = "none";
  }

  /* MD
    ### 👥 Groups Management System
    Display groups from database (read-only)
  */

  // API Configuration moved to top of file (line 8)

  interface DatabaseGroup {
    id: string;
    projectId: number;
    name: string;
    description?: string;
    status: string;
    type: string;
    color?: string;
    elementIds?: string[];
    metadata?: {
      type?: string;
      panelCount?: number;
    };
    panels?: Array<{
      id: string;
      name: string;
      tag?: string;
      status: string;
    }>;
    panelGroups?: Array<{
      id: string;
      panelId: string;
      groupId: string;
      assignedAt: string;
      assignedBy?: string | null;
      panel: {
        id: string;
        name: string;
        tag?: string;
        objectType: string;
      };
    }>;
    _count?: {
      panels?: number;
      panelGroups?: number;
    };
    createdAt: string;
    updatedAt: string;
  }

  let groups: DatabaseGroup[] = [];

  // Fetch groups from database
  const fetchGroupsFromDatabase = async (projectId: string): Promise<void> => {
    try {
      console.log(`Fetching groups for project ${projectId}...`);

      // Get authentication token
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/groups/${projectId}`, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      groups = data.groups || [];
      console.log(`Loaded ${groups.length} groups from database`);

      // Render the groups list after fetching
      renderGroupsList();
    } catch (error) {
      console.error("Error fetching groups from database:", error);
      groups = [];
      renderGroupsList();
    }
  };

  // Collect all storey children from all models
  const collectAllStoreyChildren = (): { storeyName: string; children: TreeNodeData[] }[] => {
    const storeyChildren: { storeyName: string; children: TreeNodeData[] }[] = [];

    // Iterate through all models in the tree
    for (const [modelName, model] of models.entries()) {
      // Find all storey nodes in the tree
      const treeContainer = document.getElementById("tree-container");
      if (!treeContainer) continue;

      const modelNodes = treeContainer.querySelectorAll(".model-node");
      modelNodes.forEach((modelNode) => {
        const modelNameEl = modelNode.querySelector(".tree-label");
        if (modelNameEl?.textContent?.includes(modelName)) {
          const storeyContainers = modelNode.parentElement?.querySelectorAll(".tree-node-container");
          storeyContainers?.forEach((container) => {
            const storeyNode = container.querySelector(".tree-node");
            const storeyLabel = storeyNode?.querySelector(".tree-label");
            const storeyName = storeyLabel?.textContent?.trim() || "Unknown Storey";

            // Get children from this storey
            const childrenGrid = container.querySelector(".tree-children-grid");
            if (childrenGrid) {
              const childItems = childrenGrid.querySelectorAll(".tree-child-item");
              const children: TreeNodeData[] = [];

              childItems.forEach((item) => {
                const localId = parseInt(item.getAttribute("data-local-id") || "0");
                const name = item.textContent?.trim() || "";
                if (localId && name) {
                  children.push({
                    localId,
                    name,
                    category: "",
                    children: [],
                  });
                }
              });

              if (children.length > 0) {
                storeyChildren.push({ storeyName, children });
              }
            }
          });
        }
      });
    }

    return storeyChildren;
  };

  // Render groups list (read-only)
  const renderGroupsList = () => {
    const groupsListContent = document.getElementById("groupsListContent");
    if (!groupsListContent) return;

    if (groups.length === 0) {
      groupsListContent.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-layer-group" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
        <p>No groups found</p>
        <p style="font-size: 13px; margin-top: 8px;">Groups are managed from the Project Dashboard</p>
      </div>
    `;
      return;
    }

    groupsListContent.innerHTML = "";
    groups.forEach((group, index) => {
      const groupItem = document.createElement("div");
      groupItem.className = "group-item";
      groupItem.style.borderLeftColor = group.color || '#0047AB';
      groupItem.dataset.groupId = group.id;

      const panelCount = group._count?.panelGroups || group._count?.panels || group.metadata?.panelCount || 0;

      // Get panels from the group
      const panels = group.panelGroups?.map(pg => pg.panel) || group.panels || [];

      groupItem.innerHTML = `
      <div class="group-item-header">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; cursor: pointer;" class="group-header-main">
          <i class="fas fa-chevron-right group-chevron" style="font-size: 12px; transition: transform 0.2s; color: var(--slate-400);"></i>
          <i data-lucide="grid-3x3" class="group-item-icon" style="color: ${group.color || '#0047AB'}; width: 20px; height: 20px;"></i>
          <span class="group-item-name">${group.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="group-highlight-btn" title="Highlight all panels in group" style="background: none; border: none; cursor: pointer; padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
            <i class="fas fa-eye" style="font-size: 14px; color: ${group.color || '#0047AB'};"></i>
          </button>
          <span class="group-item-count" style="font-size: 11px; color: var(--slate-500);">${panelCount} panel${panelCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="group-panels-container" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--slate-200);">
        <div class="group-panels-grid">
          ${panels.length > 0 ? panels.map(panel => `
            <div class="group-panel-item" data-panel-id="${panel.id}">
              <i class="fas fa-cube" style="font-size: 14px; color: ${group.color || '#0047AB'};"></i>
              <div class="panel-item-info">
                <div class="panel-item-name">${panel.name}</div>
                ${panel.tag ? `<div class="panel-item-tag">${panel.tag}</div>` : ''}
              </div>
            </div>
          `).join('') : '<div class="empty-state" style="grid-column: 1 / -1; padding: 20px;"><p style="font-size: 13px; color: var(--slate-500);">No panels in this group</p></div>'}
        </div>
      </div>
    `;

      // Add click handler to toggle expansion (only on the main header, not the highlight button)
      const headerMain = groupItem.querySelector(".group-header-main");
      const panelsContainer = groupItem.querySelector(".group-panels-container");
      const chevron = groupItem.querySelector(".group-chevron");

      if (headerMain && panelsContainer && chevron) {
        headerMain.addEventListener("click", (e) => {
          e.stopPropagation();
          const isExpanded = panelsContainer.style.display !== "none";

          if (isExpanded) {
            panelsContainer.style.display = "none";
            chevron.style.transform = "rotate(0deg)";
          } else {
            panelsContainer.style.display = "block";
            chevron.style.transform = "rotate(90deg)";
          }
        });
      }

      // Add click handler for highlight button to highlight all group panels (original behavior)
      const highlightBtn = groupItem.querySelector(".group-highlight-btn");
      if (highlightBtn) {
        highlightBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          highlightGroupPanels(group);
        });

        // Hover effect for highlight button
        highlightBtn.addEventListener("mouseenter", () => {
          (highlightBtn as HTMLElement).style.background = "var(--slate-100)";
        });
        highlightBtn.addEventListener("mouseleave", () => {
          (highlightBtn as HTMLElement).style.background = "none";
        });
      }


      groupsListContent.appendChild(groupItem);
    });

    // Initialize Lucide icons after rendering
    setTimeout(() => initializeLucideIcons(), 100);
  };

  // Highlight panels in a group and make others transparent
  // Helper: Resolve GlobalIds to LocalIds
  const resolveGlobalIdsToLocalIds = async (model: FRAGS.FragmentsModel, globalIds: string[]): Promise<number[]> => {
    const resolvedIds: number[] = [];
    if (!globalIds || globalIds.length === 0) return resolvedIds;

    try {
      // Optimization: Check if we have a cached map
      const cacheKey = (model as any).modelId || 'default';
      if (!(model as any)._globalIdMap) {
        console.log(`⚙️ Building GlobalId map for model ${cacheKey}...`);
        (model as any)._globalIdMap = new Map<string, number>();

        if (model.properties) {
          for (const expressID in model.properties) {
            const props = model.properties[expressID];
            if (props.GlobalId && props.GlobalId.value) {
              (model as any)._globalIdMap.set(props.GlobalId.value, parseInt(expressID));
            }
          }
        }
        console.log(`✅ Built GlobalId map with ${(model as any)._globalIdMap.size} entries`);
      }

      const map = (model as any)._globalIdMap;
      if (map) {
        for (const gid of globalIds) {
          if (map.has(gid)) {
            resolvedIds.push(map.get(gid));
          }
        }
      }

    } catch (e) {
      console.warn("Error resolving GlobalIds:", e);
    }

    return resolvedIds;
  };

  // Highlight panels in a group and make others transparent
  const highlightGroupPanels = async (group: DatabaseGroup) => {
    try {
      console.log(`Highlighting panels for group: ${group.name}`);

      // Get panel element IDs from the group (using elementId as the unique identifier)
      const panelElementIds: string[] = []; // These are likely LocalIds (ifcElementId)
      const panelGlobalIds: string[] = [];  // These are GlobalIds
      const panelTags: string[] = [];       // Fallback tags

      // Helper to process a panel
      const processPanel = (panel: any) => {
        let foundId = false;

        // Priority 1: Use metadata.ifcElementId (LocalId)
        if (panel.metadata?.ifcElementId) {
          panelElementIds.push(panel.metadata.ifcElementId);
          foundId = true;
        }

        // Priority 2: Use element.globalId (GlobalId)
        if (panel.element && panel.element.globalId) {
          panelGlobalIds.push(panel.element.globalId);
          if (!foundId) foundId = true; // We have at least a GlobalId
        }

        // Priority 3: Use elementId field (Could be either, but usually LocalId if numeric)
        if (!foundId && panel.elementId) {
          // Check if it looks like a number
          if (/^\d+$/.test(panel.elementId)) {
            panelElementIds.push(panel.elementId);
          } else {
            // Assume GlobalId if not numeric
            panelGlobalIds.push(panel.elementId);
          }
          foundId = true;
        }

        // Fallback: Tag
        if (panel.tag) {
          panelTags.push(panel.tag.trim());
        }
      };

      // First try panelGroups (new structure)
      if (group.panelGroups && group.panelGroups.length > 0) {
        group.panelGroups.forEach(pg => {
          if (pg.panel) processPanel(pg.panel);
        });
      }
      // Fallback to panels (old structure)
      else if (group.panels && group.panels.length > 0) {
        group.panels.forEach(panel => processPanel(panel));
      }

      // Collect all resolved local IDs
      const localIds: number[] = [];

      // 1. Process explicit Local IDs
      panelElementIds.forEach(elementId => {
        const numericId = parseInt(elementId);
        if (!isNaN(numericId)) {
          localIds.push(numericId);
        }
      });

      // 2. Resolve Global IDs if we have any
      if (panelGlobalIds.length > 0) {
        console.log(`🔍 Attempting to resolve ${panelGlobalIds.length} GlobalIds...`);
        for (const [_, model] of models.entries()) {
          const resolved = await resolveGlobalIdsToLocalIds(model, panelGlobalIds);
          if (resolved.length > 0) {
            console.log(`✅ Resolved ${resolved.length} GlobalIds in model`);
            localIds.push(...resolved);
          }
        }
      }

      // 3. Fallback to Tags if no IDs found
      if (localIds.length === 0 && panelTags.length > 0) {
        console.log("No element IDs resolved, falling back to panel tags");
        return highlightGroupPanelsByTag(group);
      }

      if (localIds.length === 0) {
        console.warn("❌ No panels found to highlight (no valid IDs or tags)");
        return;
      }

      console.log(`Converted to ${localIds.length} local IDs for highlighting:`, localIds);

      // Reset all highlights first
      const highlightPromises = [];
      for (const [_, m] of models.entries()) {
        highlightPromises.push(m.resetHighlight(undefined));
      }
      await Promise.all(highlightPromises);
      highlightPromises.length = 0;

      // Make all elements semi-transparent (ghost mode) - same as tree structure
      for (const [_, m] of models.entries()) {
        highlightPromises.push(
          m.highlight(undefined, {
            color: new THREE.Color(0xcccccc),
            opacity: 0.2,
            transparent: true,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          })
        );
      }
      await Promise.all(highlightPromises);

      // Highlight the group's panels with parent-child relationships
      for (const [_, model] of models.entries()) {
        try {
          // Collect all IDs including parent-child relationships
          let allIdsToHighlight: number[] = [];

          try {
            const spatialStructure = await model.getSpatialStructure();

            if (spatialStructure) {
              // For each panel ID, collect parent + children
              for (const localId of localIds) {
                // Check if this localId belongs to this model
                // (Optimization: we could check model.ids, but getBoxes check inside highlight might be enough)
                // However, collectParentAndChildIds assumes the ID exists in the structure.

                const relatedIds = collectParentAndChildIds(spatialStructure, localId);
                if (relatedIds.length > 0) {
                  allIdsToHighlight.push(...relatedIds);
                } else {
                  // If not found in structure, it might not be in this model, or just isolated.
                  // We'll add it anyway, highlight will ignore if invalid.
                  allIdsToHighlight.push(localId);
                }
              }

              // Remove duplicates
              allIdsToHighlight = [...new Set(allIdsToHighlight)];
            } else {
              allIdsToHighlight = localIds;
            }
          } catch (structureError) {
            console.log(`⚠️ Could not get spatial structure, using original IDs`);
            allIdsToHighlight = localIds;
          }

          if (allIdsToHighlight.length > 0) {
            // Use group's color if available, otherwise default to blue
            const groupColor = new THREE.Color(group.color || '#0047AB');
            await model.highlight(allIdsToHighlight, {
              color: groupColor,
              opacity: 1,
              transparent: false,
              renderedFaces: FRAGS.RenderedFaces.TWO,
            });
            console.log(`Highlighted ${allIdsToHighlight.length} elements in model`);
          }
        } catch (error) {
          console.warn("Could not highlight panels in this model:", error);
        }
      }

      // frame entire model with fixed diagonal angle
      {
        const combinedBbox = new THREE.Box3();
        models.forEach((m) => {
          const bbox = new THREE.Box3().setFromObject(m.object);
          if (!bbox.isEmpty()) combinedBbox.union(bbox);
        });
        if (!combinedBbox.isEmpty()) {
          const center = new THREE.Vector3();
          combinedBbox.getCenter(center);
          const size = new THREE.Vector3();
          combinedBbox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const distance = maxDim * 1.2;
          world.camera.controls.setLookAt(
            center.x + distance * 0.7,
            center.y + distance * 0.5,
            center.z + distance * 0.7,
            center.x, center.y, center.z,
            true
          );
        }
      }

      // Update fragments (same as tree structure)
      await fragments.update(true);

      console.log("Group panels highlighted successfully");
    } catch (error) {
      console.error("Error highlighting group panels:", error);
    }
  };

  // Highlight panels in a status and make others transparent
  const highlightStatusPanels = async (status: any) => {
    try {
      console.log(`Highlighting panels for status: ${status.name}`);

      // Get panel element IDs from the status (using elementId as the unique identifier)
      const panelElementIds: string[] = []; // LocalIds
      const panelGlobalIds: string[] = [];  // GlobalIds
      const panelTags: string[] = [];       // Tags

      // Extract panel data from panelStatuses
      if (status.panelStatuses && status.panelStatuses.length > 0) {
        status.panelStatuses.forEach((ps: any) => {
          if (ps.panel) {
            let foundId = false;

            // Priority 1: Use metadata.ifcElementId (LocalId)
            if (ps.panel.metadata?.ifcElementId) {
              panelElementIds.push(ps.panel.metadata.ifcElementId);
              foundId = true;
            }
            // Priority 2: Use element.globalId (GlobalId)
            if (ps.panel.element && ps.panel.element.globalId) {
              panelGlobalIds.push(ps.panel.element.globalId);
              if (!foundId) foundId = true;
            }
            // Priority 3: Use elementId field
            if (!foundId && ps.panel.elementId) {
              if (/^\d+$/.test(ps.panel.elementId)) {
                panelElementIds.push(ps.panel.elementId);
              } else {
                panelGlobalIds.push(ps.panel.elementId);
              }
              foundId = true;
            }

            // Fallback: Tag
            if (ps.panel.tag) {
              panelTags.push(ps.panel.tag.trim());
            }
          }
        });
      }

      // Collect all resolved local IDs
      const localIds: number[] = [];

      // 1. Process explicit Local IDs
      panelElementIds.forEach(elementId => {
        const numericId = parseInt(elementId);
        if (!isNaN(numericId)) {
          localIds.push(numericId);
        }
      });

      // 2. Resolve Global IDs
      if (panelGlobalIds.length > 0) {
        console.log(`🔍 Attempting to resolve ${panelGlobalIds.length} GlobalIds...`);
        for (const [_, model] of models.entries()) {
          const resolved = await resolveGlobalIdsToLocalIds(model, panelGlobalIds);
          if (resolved.length > 0) {
            console.log(`✅ Resolved ${resolved.length} GlobalIds in model`);
            localIds.push(...resolved);
          }
        }
      }

      // 3. Fallback to Tags
      if (localIds.length === 0 && panelTags.length > 0) {
        console.log("No element IDs resolved, falling back to panel tags");
        return highlightStatusPanelsByTag(status);
      }

      if (localIds.length === 0) {
        console.warn("❌ No panels found to highlight (no valid IDs or tags)");
        return;
      }

      console.log(`Converted to ${localIds.length} local IDs for highlighting:`, localIds);

      // Reset all highlights first
      const highlightPromises = [];
      for (const [_, m] of models.entries()) {
        highlightPromises.push(m.resetHighlight(undefined));
      }
      await Promise.all(highlightPromises);
      highlightPromises.length = 0;

      // Make all elements semi-transparent (ghost mode) - same as tree structure
      for (const [_, m] of models.entries()) {
        highlightPromises.push(
          m.highlight(undefined, {
            color: new THREE.Color(0xcccccc),
            opacity: 0.2,
            transparent: true,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          })
        );
      }
      await Promise.all(highlightPromises);

      // Highlight the status's panels with parent-child relationships
      const statusColor = new THREE.Color(status.color || '#3b82f6');
      for (const [_, model] of models.entries()) {
        try {
          // Collect all IDs including parent-child relationships
          let allIdsToHighlight: number[] = [];

          try {
            const spatialStructure = await model.getSpatialStructure();

            if (spatialStructure) {
              // For each panel ID, collect parent + children
              for (const localId of localIds) {
                const relatedIds = collectParentAndChildIds(spatialStructure, localId);
                if (relatedIds.length > 0) {
                  allIdsToHighlight.push(...relatedIds);
                } else {
                  allIdsToHighlight.push(localId);
                }
              }

              // Remove duplicates
              allIdsToHighlight = [...new Set(allIdsToHighlight)];
            } else {
              allIdsToHighlight = localIds;
            }
          } catch (structureError) {
            console.log(`⚠️ Could not get spatial structure, using original IDs`);
            allIdsToHighlight = localIds;
          }

          if (allIdsToHighlight.length > 0) {
            await model.highlight(allIdsToHighlight, {
              color: statusColor,
              opacity: 1,
              transparent: false,
              renderedFaces: FRAGS.RenderedFaces.TWO,
            });
            console.log(`Highlighted ${allIdsToHighlight.length} elements in model`);
          }
        } catch (error) {
          console.warn("Could not highlight panels in this model:", error);
        }
      }

      // OLD FIXED-ANGLE METHOD (requested): frame entire model with fixed diagonal angle
      {
        const combinedBbox = new THREE.Box3();
        models.forEach((m) => {
          const bbox = new THREE.Box3().setFromObject(m.object);
          if (!bbox.isEmpty()) combinedBbox.union(bbox);
        });
        if (!combinedBbox.isEmpty()) {
          const center = new THREE.Vector3();
          combinedBbox.getCenter(center);
          const size = new THREE.Vector3();
          combinedBbox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const distance = maxDim * 1.2;
          world.camera.controls.setLookAt(
            center.x + distance * 0.7,
            center.y + distance * 0.5,
            center.z + distance * 0.7,
            center.x, center.y, center.z,
            true
          );
        }
      }

      // Update fragments (same as tree structure)
      await fragments.update(true);

      console.log("Status panels highlighted successfully");
    } catch (error) {
      console.error("Error highlighting status panels:", error);
    }
  };

  // Fallback function: Highlight status panels by tag name (legacy method)
  const highlightStatusPanelsByTag = async (status: any) => {
    try {
      console.log(`Highlighting panels by tag for status: ${status.name}`);

      const panelTags: string[] = [];

      if (status.panelStatuses && status.panelStatuses.length > 0) {
        status.panelStatuses.forEach((ps: any) => {
          if (ps.panel && ps.panel.tag) {
            panelTags.push(ps.panel.tag.trim());
          }
        });
      }

      if (panelTags.length === 0) {
        console.log("No panel tags found in this status");
        return;
      }

      console.log(`Found ${panelTags.length} panel tags:`, panelTags);

      const localIds: number[] = [];
      const treeContainer = document.getElementById("tree-container");

      if (treeContainer) {
        const allTreeNodes = treeContainer.querySelectorAll(".tree-node");
        allTreeNodes.forEach((node) => {
          const label = node.querySelector(".tree-label");
          if (label) {
            const nodeName = label.textContent?.trim() || "";
            if (panelTags.some(tag => nodeName === tag || nodeName.includes(tag))) {
              const localIdStr = (node as HTMLElement).dataset.localId;
              if (localIdStr) {
                const localId = parseInt(localIdStr);
                if (!isNaN(localId)) {
                  localIds.push(localId);
                }
              }
            }
          }
        });
      }

      if (localIds.length === 0) {
        console.log("Could not find any matching elements by tag");
        return;
      }

      console.log(`Found ${localIds.length} matching elements by tag`);

      // Reset and highlight
      const highlightPromises = [];
      for (const [_, m] of models.entries()) {
        highlightPromises.push(m.resetHighlight(undefined));
      }
      await Promise.all(highlightPromises);
      highlightPromises.length = 0;

      for (const [_, m] of models.entries()) {
        highlightPromises.push(
          m.highlight(undefined, {
            color: new THREE.Color(0xcccccc),
            opacity: 0.2,
            transparent: true,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          })
        );
      }
      await Promise.all(highlightPromises);

      const statusColor = new THREE.Color(status.color || '#3b82f6');
      for (const [_, model] of models.entries()) {
        try {
          await model.highlight(localIds, {
            color: statusColor,
            opacity: 1,
            transparent: false,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          });
        } catch (error) {
          console.warn("Could not highlight panels in this model:", error);
        }
      }

      console.log("Status panels highlighted by tag successfully");
    } catch (error) {
      console.error("Error highlighting status panels by tag:", error);
    }
  };

  // Fallback function: Highlight panels by tag name (legacy method)
  const highlightGroupPanelsByTag = async (group: DatabaseGroup) => {
    try {
      console.log(`Highlighting panels by tag for group: ${group.name}`);

      // Get panel tags from the group
      const panelTags: string[] = [];

      if (group.panelGroups && group.panelGroups.length > 0) {
        group.panelGroups.forEach(pg => {
          if (pg.panel && pg.panel.tag) {
            panelTags.push(pg.panel.tag.trim());
          }
        });
      }
      else if (group.panels && group.panels.length > 0) {
        group.panels.forEach(panel => {
          if (panel.tag) {
            panelTags.push(panel.tag.trim());
          }
        });
      }

      if (panelTags.length === 0) {
        console.log("No panel tags found in this group");
        return;
      }

      console.log(`Found ${panelTags.length} panel tags:`, panelTags);

      // Find all tree nodes that match the panel tags
      const localIds: number[] = [];
      const treeContainer = document.getElementById("tree-container");

      if (treeContainer) {
        const allTreeNodes = treeContainer.querySelectorAll(".tree-node");
        allTreeNodes.forEach((node) => {
          const label = node.querySelector(".tree-label");
          if (label) {
            const nodeName = label.textContent?.trim() || "";
            if (panelTags.some(tag => nodeName === tag || nodeName.includes(tag))) {
              const localIdStr = (node as HTMLElement).dataset.localId;
              if (localIdStr) {
                const localId = parseInt(localIdStr);
                if (!isNaN(localId)) {
                  localIds.push(localId);
                }
              }
            }
          }
        });
      }

      if (localIds.length === 0) {
        console.log("Could not find any matching elements by tag");
        return;
      }

      console.log(`Found ${localIds.length} matching elements by tag`);

      // Reset all highlights first
      const highlightPromises = [];
      for (const [_, m] of models.entries()) {
        highlightPromises.push(m.resetHighlight(undefined));
      }
      await Promise.all(highlightPromises);
      highlightPromises.length = 0;

      // Make all elements semi-transparent
      for (const [_, m] of models.entries()) {
        highlightPromises.push(
          m.highlight(undefined, {
            color: new THREE.Color(0xcccccc),
            opacity: 0.2,
            transparent: true,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          })
        );
      }
      await Promise.all(highlightPromises);

      // Highlight the group's panels with group color
      const groupColor = new THREE.Color(group.color || '#0047AB');
      for (const [_, model] of models.entries()) {
        try {
          await model.highlight(localIds, {
            color: groupColor,
            opacity: 1,
            transparent: false,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          });
        } catch (error) {
          console.warn("Could not highlight panels in this model:", error);
        }
      }

      console.log("Group panels highlighted by tag successfully");
    } catch (error) {
      console.error("Error highlighting group panels by tag:", error);
    }
  };

  // Get group status display config
  const getGroupStatusDisplay = (status: string) => {
    const configs: Record<string, { label: string; color: string; bgColor: string }> = {
      'PENDING': { label: 'Pending', color: '#6B7280', bgColor: '#F3F4F6' },
      'IN_PROGRESS': { label: 'In Progress', color: '#F59E0B', bgColor: '#FFFBEB' },
      'COMPLETED': { label: 'Completed', color: '#059669', bgColor: '#ECFDF5' },
      'ON_HOLD': { label: 'On Hold', color: '#DC2626', bgColor: '#FEF2F2' }
    };
    return configs[status] || configs['PENDING'];
  };

  // Groups panel management - Read only, editing done in dashboard

  // Groups panel toggle
  const groupsPanel = document.getElementById("groupsPanel");
  const groupsToggleBtn = document.getElementById("groups-toggle-btn");
  const groupsCloseBtn = document.getElementById("groups-close-btn");

  if (groupsToggleBtn && groupsPanel) {
    groupsToggleBtn.addEventListener("click", () => {
      const isHidden = groupsPanel.classList.contains("panel-hidden");

      // Hide other panels when showing groups panel
      if (isHidden) {
        if (infoPanel) infoPanel.classList.add("panel-hidden");
        if (statusPanel) statusPanel.classList.add("panel-hidden");
      }

      groupsPanel.classList.toggle("panel-hidden");
    });
  }

  if (groupsCloseBtn && groupsPanel) {
    groupsCloseBtn.addEventListener("click", () => {
      groupsPanel.classList.add("panel-hidden");
    });
  }

  // Hide "Add New Group" button (groups are managed in dashboard)
  const addGroupBtn = document.getElementById("add-group-btn");
  if (addGroupBtn) {
    addGroupBtn.style.display = "none";
  }

  /* MD
    ### 🔗 Element Connections System
    Connect elements to groups and statuses, stored in localStorage
  */

  interface ElementConnections {
    elementId: number;
    groupIds: string[];
    statusIds: string[];
    activeStatusId?: string;
  }

  interface ElementSubmission {
    id: string;
    elementId: number;
    statusId: string;
    note: string;
    reporter: string;
    timestamp: string;
  }

  // Element connections storage
  const CONNECTIONS_STORAGE_KEY = "bim-element-connections";

  const loadConnections = (): ElementConnections[] => {
    try {
      const stored = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading connections:", error);
      return [];
    }
  };

  const saveConnections = (connections: ElementConnections[]): void => {
    try {
      localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
    } catch (error) {
      console.error("Error saving connections:", error);
    }
  };

  let elementConnections: ElementConnections[] = loadConnections();
  let currentElementId: number | null = null;

  // Get connections for an element
  const getElementConnections = (elementId: number): ElementConnections => {
    let conn = elementConnections.find(c => c.elementId === elementId);
    if (!conn) {
      conn = { elementId, groupIds: [], statusIds: [] };
      elementConnections.push(conn);
    }
    return conn;
  };

  // Update element info panel with groups and status
  const updateElementInfoPanel = async (nodeData: TreeNodeData) => {
    currentElementId = nodeData.localId;
    const connections = getElementConnections(nodeData.localId);

    // Update basic info
    const infoPanel = document.getElementById("infoPanel");
    const groupsList = document.getElementById("element-groups-list");
    const statusList = document.getElementById("element-status-list");

    if (!groupsList || !statusList) return;

    // Open the info panel
    if (infoPanel) {
      infoPanel.classList.add('open');
    }

    // Check if we have panel data from database (new tree structure)
    if ((nodeData as any).panelData) {
      const panelData = (nodeData as any).panelData;
      console.log('📦 Panel data from database:', panelData);
      console.log('📦 Panel groups:', panelData.groups);
      console.log('📦 Panel statuses:', panelData.statuses);

      // Render groups from panel data
      renderElementGroupsFromPanel(panelData, groupsList);

      // Render statuses from panel data
      renderElementStatusFromPanel(panelData, statusList);

      // Active Status dropdown disabled per requirements
    } else {
      console.log('⚠️ No panel data from database, using fallback method');
      // Fallback to old method for IFC tree structure
      renderElementGroups(connections);
      renderElementStatus(connections);
      // Active Status dropdown disabled per requirements
    }

    updateSubmissionCount(nodeData.localId);
  };

  // Render groups from panel data (database tree)
  const renderElementGroupsFromPanel = (panelData: any, groupsList: HTMLElement) => {
    groupsList.innerHTML = "";

    // Add "Assign Group" button at the top
    const assignGroupBtn = document.createElement("button");
    assignGroupBtn.className = "assign-btn";
    assignGroupBtn.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 12px;
    transition: all 0.2s;
  `;
    assignGroupBtn.innerHTML = `<i class="fas fa-plus"></i> Assign Group`;
    assignGroupBtn.onmouseover = () => assignGroupBtn.style.background = "var(--primary-dark)";
    assignGroupBtn.onmouseout = () => assignGroupBtn.style.background = "var(--primary)";
    assignGroupBtn.onclick = async () => {
      console.log("Assign group clicked for panel:", panelData.id);
      await showGroupAssignmentModal(panelData);
    };
    groupsList.appendChild(assignGroupBtn);

    const panelGroups = panelData.groups || [];

    if (panelGroups.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.style.cssText = "padding: 20px; text-align: center;";
      emptyState.innerHTML = `
      <i class="fas fa-layer-group" style="font-size: 32px; opacity: 0.3; margin-bottom: 8px;"></i>
      <p style="font-size: 13px; color: var(--slate-500);">Not assigned to any groups</p>
    `;
      groupsList.appendChild(emptyState);
    } else {
      panelGroups.forEach((pg: any) => {
        const group = pg.group;
        const tag = document.createElement("div");
        tag.className = "element-group-tag";
        tag.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--slate-100);
        border: 1px solid var(--slate-200);
        border-radius: 6px;
        margin-bottom: 8px;
      `;
        tag.innerHTML = `
        <div class="element-tag-content" style="display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-layer-group element-tag-icon"></i>
          <span>${group.name}</span>
        </div>
        <button class="remove-btn" style="
          background: transparent;
          border: none;
          color: var(--red-500);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s;
        " title="Remove from group">
          <i class="fas fa-times"></i>
        </button>
      `;

        // Add remove button handler
        const removeBtn = tag.querySelector(".remove-btn");
        if (removeBtn) {
          removeBtn.addEventListener("mouseover", () => {
            (removeBtn as HTMLElement).style.background = "var(--red-100)";
          });
          removeBtn.addEventListener("mouseout", () => {
            (removeBtn as HTMLElement).style.background = "transparent";
          });
          removeBtn.addEventListener("click", async () => {
            console.log("Remove from group:", group.name, "panel:", panelData.id);
            showRemoveConfirmModal(
              'Remove Group from Selected Panels',
              `Remove group "${group.name}" from panel(s)?`,
              async () => await removePanelFromGroup(panelData.id, group.id)
            );
          });
        }

        groupsList.appendChild(tag);
      });
    }
  };

  // Map icon names to Lucide icons for vanilla JS
  // This matches the icon mapping in /utils/iconMapping.ts
  // Database stores icons in kebab-case format, we map them to Lucide PascalCase
  const getIconComponent = (iconName: string): string => {
    if (!iconName) return 'circle';

    // Icon mapping from kebab-case to Lucide names (matching /utils/iconMapping.ts)
    const iconMap: Record<string, string> = {
      'angle-double-down': 'chevrons-down',
      'angle-double-left': 'chevrons-left',
      'angle-double-right': 'chevrons-right',
      'angle-double-up': 'chevrons-up',
      'angle-down': 'chevron-down',
      'angle-left': 'chevron-left',
      'angle-right': 'chevron-right',
      'angle-up': 'chevron-up',
      'bell': 'bell',
      'bookmark': 'bookmark',
      'box': 'box',
      'check': 'check',
      'circle': 'circle',
      'clock': 'clock',
      'code': 'code',
      'exclamation': 'alert-triangle',
      'eye': 'eye',
      'file': 'file',
      'folder': 'folder',
      'forward': 'forward',
      'hashtag': 'hash',
      'info': 'info',
      'lightbulb': 'lightbulb',
      'lock': 'lock',
      'lock-open': 'lock-open',
      'map-marker': 'map-pin',
      'minus': 'minus',
      'pause': 'pause',
      'pen-to-square': 'edit',
      'phone': 'phone',
      'play': 'play',
      'plus': 'plus',
      'reply': 'reply',
      'save': 'save',
      'search': 'search',
      'send': 'send',
      'server': 'server',
      'share-alt': 'share-2',
      'shield': 'shield',
      'shop': 'shopping-bag',
      'sign-in': 'log-in',
      'sign-out': 'log-out',
      'sliders-h': 'sliders-horizontal',
      'sort': 'arrow-up-down',
      'spinner': 'loader',
      'star': 'star',
      'stop-circle': 'stop-circle',
      'stopwatch': 'timer',
      'tag': 'tag',
      'thumbs-down': 'thumbs-down',
      'thumbs-up': 'thumbs-up',
      'thumbtack': 'pin',
      'th-large': 'grid-3x3',
      'ticket': 'ticket',
      'times': 'x',
      'times-circle': 'x-circle',
      'trash': 'trash-2',
      'undo': 'undo',
      'unlock': 'unlock',
      'user': 'user',
      'users': 'users',
      'verified': 'badge-check',
      'warehouse': 'warehouse',
      'maximize': 'maximize',
      'minimize': 'minimize',
      'wrench': 'wrench',
      'package': 'package',
    };

    // Return Lucide icon name (kebab-case for data-lucide attribute)
    return iconMap[iconName.toLowerCase()] || iconName.toLowerCase();
  };

  // Helper to initialize Lucide icons after DOM updates
  const initializeLucideIcons = () => {
    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  };

  // Render statuses from panel data (database tree)
  const renderElementStatusFromPanel = (panelData: any, statusList: HTMLElement) => {
    statusList.innerHTML = "";

    // Add "Assign Status" button at the top
    const assignStatusBtn = document.createElement("button");
    assignStatusBtn.className = "assign-btn";
    assignStatusBtn.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 12px;
    transition: all 0.2s;
  `;
    assignStatusBtn.innerHTML = `<i class="fas fa-plus"></i> Assign Status`;
    assignStatusBtn.onmouseover = () => assignStatusBtn.style.background = "var(--primary-dark)";
    assignStatusBtn.onmouseout = () => assignStatusBtn.style.background = "var(--primary)";
    assignStatusBtn.onclick = async () => {
      console.log("Assign status clicked for panel:", panelData.id);
      await showStatusAssignmentModal(panelData);
    };
    statusList.appendChild(assignStatusBtn);

    const panelStatuses = panelData.statuses || [];

    if (panelStatuses.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.style.cssText = "padding: 20px; text-align: center;";
      emptyState.innerHTML = `
      <i class="fas fa-circle-notch" style="font-size: 32px; opacity: 0.3; margin-bottom: 8px;"></i>
      <p style="font-size: 13px; color: var(--slate-500);">No status assigned</p>
    `;
      statusList.appendChild(emptyState);
    } else {
      panelStatuses.forEach((ps: any) => {
        const status = ps.status;
        const tag = document.createElement("div");
        tag.className = "element-status-tag";
        tag.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 12px;
        background: ${status.color}15;
        border: 1px solid ${status.color}40;
        border-radius: 6px;
        margin-bottom: 8px;
      `;
        const iconClass = getIconComponent(status.icon);
        console.log(`📊 Status: ${status.name}, Icon: ${status.icon}, Lucide: ${iconClass}`);
        tag.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <i data-lucide="${iconClass}" style="color: ${status.color}; width: 16px; height: 16px;"></i>
          <span style="font-weight: 500;">${status.name}</span>
          ${status.description ? `<span style="font-size: 11px; color: var(--slate-500);">${status.description}</span>` : ''}
        </div>
        <button class="remove-btn" style="
          background: transparent;
          border: none;
          color: var(--red-500);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s;
        " title="Remove status">
          <i class="fas fa-times"></i>
        </button>
      `;

        // Add remove button handler
        const removeBtn = tag.querySelector(".remove-btn");
        if (removeBtn) {
          removeBtn.addEventListener("mouseover", () => {
            (removeBtn as HTMLElement).style.background = "var(--red-100)";
          });
          removeBtn.addEventListener("mouseout", () => {
            (removeBtn as HTMLElement).style.background = "transparent";
          });
          removeBtn.addEventListener("click", async () => {
            console.log("Remove status:", status.name, "from panel:", panelData.id);
            showRemoveConfirmModal(
              'Remove Status from Selected Panels',
              `Remove status "${status.name}" from panel(s)?`,
              async () => await removePanelStatus(panelData.id, status.id)
            );
          });
        }

        statusList.appendChild(tag);
      });
    }

    // Initialize Lucide icons after rendering
    setTimeout(() => initializeLucideIcons(), 100);
  };

  // Show remove confirmation modal
  const showRemoveConfirmModal = (title: string, message: string, onConfirm: () => Promise<void>) => {
    const modalContent = `
    <p style="color: var(--slate-500); margin-bottom: 24px; font-size: 15px;">${message}</p>
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button class="modal-cancel" style="
        padding: 10px 24px;
        border: 1px solid var(--slate-200);
        background: var(--panel-bg);
        color: var(--slate-600);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      ">✕ Cancel</button>
      <button class="modal-remove" style="
        padding: 10px 24px;
        border: none;
        background: var(--accent);
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      ">✓ Remove</button>
    </div>
  `;

    const modal = createModal(title, modalContent);
    document.body.appendChild(modal);

    const removeBtn = modal.querySelector('.modal-remove') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('.modal-cancel') as HTMLButtonElement;

    removeBtn.addEventListener('click', async () => {
      modal.remove();
      await onConfirm();
    });

    cancelBtn.addEventListener('click', () => modal.remove());
  };

  // Create modal HTML structure
  const createModal = (title: string, content: string): HTMLElement => {
    const modal = document.createElement('div');
    modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;

    modal.innerHTML = `
    <div style="
      background: var(--panel-bg);
      border-radius: 12px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3);
      position: relative;
      border: 1px solid var(--panel-border);
    ">
      <button class="modal-close" style="
        position: absolute;
        top: 16px;
        right: 16px;
        background: transparent;
        border: none;
        font-size: 24px;
        color: var(--slate-500);
        cursor: pointer;
        padding: 4px 8px;
        line-height: 1;
        transition: color 0.2s;
      ">×</button>
      <h2 style="
        font-size: 24px;
        font-weight: 600;
        color: var(--slate-800);
        margin: 0 0 24px 0;
      ">${title}</h2>
      ${content}
    </div>
  `;

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Close button hover effect
    const closeBtn = modal.querySelector('.modal-close') as HTMLElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', () => modal.remove());
      closeBtn.addEventListener('mouseover', () => {
        closeBtn.style.color = 'var(--slate-700)';
      });
      closeBtn.addEventListener('mouseout', () => {
        closeBtn.style.color = 'var(--slate-500)';
      });
    }

    return modal;
  };

  // Show group assignment modal
  const showGroupAssignmentModal = async (panelData: any) => {
    // Get project ID from URL
    const pathParts = window.location.pathname.split('/');
    const projectsIndex = pathParts.indexOf('projects');
    const projectId = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : null;

    if (!projectId) {
      alert('Project ID not found');
      return;
    }

    // Fetch all groups for this project
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/groups/${projectId}`, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.statusText}`);
      }

      const data = await response.json();
      const availableGroups = data.groups || [];

      // Get currently assigned group IDs
      const assignedGroupIds = (panelData.groups || []).map((pg: any) => pg.group.id);
      const unassignedGroups = availableGroups.filter((g: any) => !assignedGroupIds.includes(g.id));

      // Create modal content
      let modalContent = '';

      if (unassignedGroups.length === 0) {
        // Show message when all groups are assigned
        modalContent = `
        <div style="text-align: center; padding: 20px 0;">
          <i class="fas fa-check-circle" style="font-size: 48px; color: var(--success); margin-bottom: 16px;"></i>
          <p style="color: var(--slate-500); font-size: 15px; margin-bottom: 24px;">All groups are already assigned to this panel</p>
        </div>
        <div style="display: flex; justify-content: center;">
          <button class="modal-close-btn" style="
            padding: 10px 24px;
            border: 1px solid var(--slate-200);
            background: var(--panel-bg);
            color: var(--slate-600);
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          ">Close</button>
        </div>
      `;

        const modal = createModal('Add Group to Selected Panels', modalContent);
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.modal-close-btn') as HTMLButtonElement;
        closeBtn.addEventListener('click', () => modal.remove());
        return;
      }

      // Show dropdown when there are unassigned groups
      modalContent = `
      <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--slate-700);">Group to Add</label>
      <select id="group-select" style="
        width: 100%;
        padding: 12px;
        border: 2px solid var(--slate-200);
        border-radius: 8px;
        font-size: 14px;
        color: var(--slate-800);
        background: var(--panel-bg);
        cursor: pointer;
        margin-bottom: 24px;
      ">
        <option value="">Select group to add</option>
        ${unassignedGroups.map((g: any) => `<option value="${g.id}">${g.name}</option>`).join('')}
      </select>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="modal-cancel" style="
          padding: 10px 24px;
          border: 1px solid var(--slate-200);
          background: var(--panel-bg);
          color: var(--slate-600);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        ">✕ Cancel</button>
        <button class="modal-assign" style="
          padding: 10px 24px;
          border: none;
          background: var(--primary);
          color: white;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        ">✓ Assign</button>
      </div>
    `;

      const modal = createModal('Add Group to Selected Panels', modalContent);
      document.body.appendChild(modal);

      // Handle assign button
      const assignBtn = modal.querySelector('.modal-assign') as HTMLButtonElement;
      const cancelBtn = modal.querySelector('.modal-cancel') as HTMLButtonElement;
      const selectEl = modal.querySelector('#group-select') as HTMLSelectElement;

      assignBtn.addEventListener('click', async () => {
        const selectedGroupId = selectEl.value;
        if (selectedGroupId) {
          modal.remove();
          await assignPanelToGroup(panelData.id, selectedGroupId, projectId);
        } else {
          alert('Please select a group');
        }
      });

      cancelBtn.addEventListener('click', () => modal.remove());
    } catch (error) {
      console.error('Error fetching groups:', error);
      alert('Failed to fetch groups');
    }
  };

  // Assign panel to group
  const assignPanelToGroup = async (panelId: string, groupId: string, projectId: string) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/groups/${projectId}/${groupId}/panels`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ panelIds: [panelId] }),
      });

      if (!response.ok) {
        throw new Error(`Failed to assign panel to group: ${response.statusText}`);
      }

      console.log('✅ Panel assigned to group successfully');

      // Refresh the panel data and UI without full page reload
      await refreshPanelData(panelId);
    } catch (error) {
      console.error('Error assigning panel to group:', error);
      alert('Failed to assign panel to group');
    }
  };

  // Remove panel from group
  const removePanelFromGroup = async (panelId: string, groupId: string) => {
    const pathParts = window.location.pathname.split('/');
    const projectsIndex = pathParts.indexOf('projects');
    const projectId = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : null;

    if (!projectId) {
      alert('Project ID not found');
      return;
    }

    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/groups/${projectId}/${groupId}/panels`, {
        method: 'DELETE',
        headers: headers,
        body: JSON.stringify({ panelIds: [panelId] }),
      });

      if (!response.ok) {
        throw new Error(`Failed to remove panel from group: ${response.statusText}`);
      }

      console.log('✅ Panel removed from group successfully');

      // Refresh the panel data and UI without full page reload
      await refreshPanelData(panelId);
    } catch (error) {
      console.error('Error removing panel from group:', error);
      alert('Failed to remove panel from group');
    }
  };

  // Show status assignment modal
  const showStatusAssignmentModal = async (panelData: any) => {
    // Get project ID from URL
    const pathParts = window.location.pathname.split('/');
    const projectsIndex = pathParts.indexOf('projects');
    const projectId = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : null;

    if (!projectId) {
      alert('Project ID not found');
      return;
    }

    // Get currently assigned status IDs
    const assignedStatusIds = (panelData.statuses || []).map((ps: any) => ps.status.id);
    const unassignedStatuses = elementStatuses.filter((s: any) => !assignedStatusIds.includes(s.id));

    // Create modal content
    let modalContent = '';

    if (unassignedStatuses.length === 0) {
      // Show message when all statuses are assigned
      modalContent = `
        <div style="text-align: center; padding: 20px 0;">
          <i class="fas fa-check-circle" style="font-size: 48px; color: var(--success); margin-bottom: 16px;"></i>
          <p style="color: var(--slate-500); font-size: 15px; margin-bottom: 24px;">All statuses are already assigned to this panel</p>
        </div>
        <div style="display: flex; justify-content: center;">
          <button class="modal-close-btn" style="
            padding: 10px 24px;
            border: 1px solid var(--slate-200);
            background: var(--panel-bg);
            color: var(--slate-600);
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          ">Close</button>
        </div>
      `;

      const modal = createModal('Add Status to Selected Panels', modalContent);
      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('.modal-close-btn') as HTMLButtonElement;
      closeBtn.addEventListener('click', () => modal.remove());
      return;
    }

    // Show dropdown when there are unassigned statuses
    modalContent = `
    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--slate-700);">Status to Add</label>
    <select id="status-select" style="
      width: 100%;
      padding: 12px;
      border: 2px solid var(--slate-200);
      border-radius: 8px;
      font-size: 14px;
      color: var(--slate-800);
      background: var(--panel-bg);
      cursor: pointer;
      margin-bottom: 24px;
    ">
      <option value="">Select status to add</option>
      ${unassignedStatuses.map((s: any) => `<option value="${s.id}" style="color: ${s.color};">${s.name}</option>`).join('')}
    </select>
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button class="modal-cancel" style="
        padding: 10px 24px;
        border: 1px solid var(--slate-200);
        background: var(--panel-bg);
        color: var(--slate-600);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      ">✕ Cancel</button>
      <button class="modal-assign" style="
        padding: 10px 24px;
        border: none;
        background: var(--primary);
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      ">✓ Assign</button>
    </div>
  `;

    const modal = createModal('Add Status to Selected Panels', modalContent);
    document.body.appendChild(modal);

    // Handle assign button
    const assignBtn = modal.querySelector('.modal-assign') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('.modal-cancel') as HTMLButtonElement;
    const selectEl = modal.querySelector('#status-select') as HTMLSelectElement;

    assignBtn.addEventListener('click', async () => {
      const selectedStatusId = selectEl.value;
      if (selectedStatusId) {
        modal.remove();
        await assignPanelStatus(panelData.id, selectedStatusId, projectId);
      } else {
        alert('Please select a status');
      }
    });

    cancelBtn.addEventListener('click', () => modal.remove());
  };

  // Assign status to panel
  const assignPanelStatus = async (panelId: string, statusId: string, projectId: string) => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/status-management/assign-to-panels`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          panelIds: [panelId],
          statusId: statusId,
          projectId: parseInt(projectId)
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to assign status to panel: ${response.statusText}`);
      }

      console.log('✅ Status assigned to panel successfully');

      // Refresh the panel data and UI without full page reload
      await refreshPanelData(panelId);
    } catch (error) {
      console.error('Error assigning status to panel:', error);
      alert('Failed to assign status to panel');
    }
  };

  // Remove status from panel
  const removePanelStatus = async (panelId: string, statusId: string) => {
    const pathParts = window.location.pathname.split('/');
    const projectsIndex = pathParts.indexOf('projects');
    const projectId = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : null;

    if (!projectId) {
      alert('Project ID not found');
      return;
    }

    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // Use PanelStatus delete endpoint
      const response = await fetch(`${API_BASE_URL}/status-management/remove-from-panels`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          panelIds: [panelId],
          projectId: parseInt(projectId)
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to remove status from panel: ${response.statusText}`);
      }

      console.log('✅ Status removed from panel successfully');

      // Refresh the panel data and UI without full page reload
      await refreshPanelData(panelId);
    } catch (error) {
      console.error('Error removing status from panel:', error);
      alert('Failed to remove status from panel');
    }
  };

  // Refresh panel data after assignment/removal (no page reload)
  const refreshPanelData = async (panelId: string) => {
    const pathParts = window.location.pathname.split('/');
    const projectsIndex = pathParts.indexOf('projects');
    const projectId = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : null;

    if (!projectId) {
      console.error('Project ID not found');
      return;
    }

    try {
      // Fetch updated panel data from database
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/panels/${projectId}/all`, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch panel data: ${response.statusText}`);
      }

      const data = await response.json();
      const updatedPanel = data.panels?.find((p: any) => p.id === panelId);

      if (updatedPanel) {
        console.log('✅ Panel data refreshed:', updatedPanel);

        // Update the cache with fresh panel data
        const cachedPanel = panelDataCache.get(panelId);
        if (cachedPanel) {
          // Update the cached panel object with new groups and statuses
          cachedPanel.groups = updatedPanel.groups || [];
          cachedPanel.statuses = updatedPanel.statuses || [];
          console.log('✅ Panel cache updated for ID:', panelId);
        }

        // Update the Element Information panel with fresh data
        const nodeData = {
          localId: updatedPanel.metadata?.ifcElementId ? parseInt(updatedPanel.metadata.ifcElementId) : null,
          name: updatedPanel.name || updatedPanel.tag || 'Unnamed',
          type: updatedPanel.objectType || 'Unknown',
          tag: updatedPanel.tag,
          id: updatedPanel.id,
          elementId: updatedPanel.elementId,
          metadata: updatedPanel.metadata,
          category: 'element',
          children: [],
          panelData: updatedPanel,
        } as any;

        // Re-render the groups and status sections in Element Info Panel
        const groupsList = document.getElementById('element-groups-list');
        const statusList = document.getElementById('element-status-list');

        if (groupsList && statusList) {
          renderElementGroupsFromPanel(updatedPanel, groupsList);
          renderElementStatusFromPanel(updatedPanel, statusList);
          console.log('✅ Element Info Panel UI updated successfully');
        }

        // Also refresh the Groups Panel and Status Panel on the left sidebar
        await fetchGroupsFromDatabase(projectId);
        await fetchStatusesFromDatabase(projectId);
        console.log('✅ Groups and Status panels refreshed');

        // Refresh the submission badge to show updated unread count
        if (nodeData.localId) {
          await fetchAndDisplaySubmissionBadge(nodeData.localId, panelId);
          console.log('✅ Submission badge refreshed');
        }
      } else {
        console.error('Panel not found in response');
      }
    } catch (error) {
      console.error('Error refreshing panel data:', error);
      alert('Failed to refresh panel data. Please refresh the page.');
    }
  };

  // Update active status dropdown from panel data
  const updateActiveStatusDropdownFromPanel = (panelData: any) => {
    const activeStatusSelect = document.getElementById("element-active-status") as HTMLSelectElement;
    if (!activeStatusSelect) return;

    // Clear existing options
    activeStatusSelect.innerHTML = '<option value="">No status assigned</option>';

    // Get all available statuses from elementStatuses (fetched from database)
    if (elementStatuses && elementStatuses.length > 0) {
      elementStatuses.forEach((status: any) => {
        const option = document.createElement("option");
        option.value = status.id;
        option.textContent = status.name;
        option.style.color = status.color;

        // Check if this status is assigned to the panel
        const isAssigned = panelData.statuses?.some((ps: any) => ps.status.id === status.id);
        if (isAssigned) {
          option.selected = true;
        }

        activeStatusSelect.appendChild(option);
      });
    }
  };

  // Render element groups
  const renderElementGroups = (connections: ElementConnections) => {
    const groupsList = document.getElementById("element-groups-list");
    if (!groupsList) return;

    groupsList.innerHTML = "";

    // Find groups that contain this element (checking by panel IDs from database)
    const elementGroups = groups.filter(g => {
      // Check if element is in the group's panelGroups (new structure)
      if (g.panelGroups) {
        return g.panelGroups.some(pg => pg.panel.id === connections.elementId.toString());
      }
      // Check if element is in the group's panels (old structure)
      if (g.panels) {
        return g.panels.some(panel => panel.id === connections.elementId.toString());
      }
      // Fallback to elementIds if available
      if (g.elementIds) {
        return g.elementIds.includes(connections.elementId.toString());
      }
      return false;
    });

    if (elementGroups.length === 0) {
      groupsList.innerHTML = `
      <div class="empty-state" style="padding: 20px; text-align: center;">
        <i class="fas fa-layer-group" style="font-size: 32px; opacity: 0.3; margin-bottom: 8px;"></i>
        <p style="font-size: 13px; color: var(--slate-500);">Not assigned to any groups</p>
        <p style="font-size: 12px; color: var(--slate-400); margin-top: 4px;">Manage groups from the Project Dashboard</p>
      </div>
    `;
    } else {
      elementGroups.forEach(group => {
        const statusConfig = getGroupStatusDisplay(group.status);
        const tag = document.createElement("div");
        tag.className = "element-group-tag";
        tag.innerHTML = `
        <div class="element-tag-content">
          <i class="fas fa-layer-group element-tag-icon"></i>
          <span>${group.name}</span>
        </div>
        <span class="status-badge" style="background: ${statusConfig.bgColor}; color: ${statusConfig.color}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">
          ${statusConfig.label}
        </span>
      `;

        groupsList.appendChild(tag);
      });
    }
  };

  // Render element status
  const renderElementStatus = (connections: ElementConnections) => {
    const statusList = document.getElementById("element-status-list");
    if (!statusList) return;

    statusList.innerHTML = "";

    const assignedStatuses = elementStatuses.filter(s => connections.statusIds.includes(s.id));

    if (assignedStatuses.length === 0) {
      const addBtn = document.createElement("button");
      addBtn.className = "add-element-btn";
      addBtn.innerHTML = '<i class="fas fa-plus"></i> Assign Status';
      addBtn.onclick = () => openSelectStatusModal(connections.elementId);
      statusList.appendChild(addBtn);
    } else {
      assignedStatuses.forEach(status => {
        const tag = document.createElement("div");
        tag.className = "element-status-tag";
        tag.style.borderLeftColor = status.color;

        const iconClass = getIconClass(status.icon);
        tag.innerHTML = `
        <div class="element-tag-content">
          <i class="fas ${iconClass} element-tag-icon" style="color: ${status.color};"></i>
          <span>${status.name}</span>
        </div>
        <button class="element-tag-remove" data-status-id="${status.id}">
          <i class="fas fa-times"></i>
        </button>
      `;

        const removeBtn = tag.querySelector(".element-tag-remove");
        removeBtn?.addEventListener("click", () => {
          removeStatusFromElement(connections.elementId, status.id);
        });

        // Click to change status
        tag.onclick = (e) => {
          if (!(e.target as HTMLElement).closest(".element-tag-remove")) {
            openSelectStatusModal(connections.elementId);
          }
        };

        statusList.appendChild(tag);
      });
    }
  };

  // Remove group from element
  // Groups are now managed in dashboard (read-only in viewer)

  // Remove status from element
  const removeStatusFromElement = (elementId: number, statusId: string) => {
    const connections = getElementConnections(elementId);
    connections.statusIds = connections.statusIds.filter(id => id !== statusId);

    // If the removed status was the active status, clear it
    if (connections.activeStatusId === statusId) {
      connections.activeStatusId = undefined;
    }

    saveConnections(elementConnections);
    updateElementInfoPanel({ localId: elementId } as TreeNodeData);
  };

  // Group assignment removed - groups are managed in dashboard only

  // Select Status Modal
  const selectStatusModal = document.getElementById("selectStatusModal");
  const selectStatusModalCloseBtn = document.getElementById("select-status-modal-close-btn");
  const cancelSelectStatusBtn = document.getElementById("cancel-select-status-btn");
  const doneSelectStatusBtn = document.getElementById("done-select-status-btn");
  const selectStatusList = document.getElementById("select-status-list");

  let tempSelectedStatusIds: string[] = [];

  const openSelectStatusModal = (elementId: number) => {
    if (!selectStatusModal || !selectStatusList) return;

    const connections = getElementConnections(elementId);
    tempSelectedStatusIds = [...connections.statusIds];

    // Render status list
    selectStatusList.innerHTML = "";

    if (elementStatuses.length === 0) {
      selectStatusList.innerHTML = `
      <div class="empty-state">
        <p>No statuses available</p>
        <p style="margin-top: 8px;">Statuses are managed from the Project Dashboard</p>
      </div>
    `;
    } else {
      elementStatuses.forEach(status => {
        const item = document.createElement("div");
        item.className = "select-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = tempSelectedStatusIds.includes(status.id);
        checkbox.dataset.statusId = status.id;

        const content = document.createElement("div");
        content.className = "select-item-content";
        content.innerHTML = `
        <div class="select-item-name">${status.name}</div>
      `;

        const iconClass = getIconClass(status.icon);
        const icon = document.createElement("i");
        icon.className = `fas ${iconClass} select-item-icon`;
        icon.style.color = status.color;

        item.appendChild(checkbox);
        item.appendChild(content);
        item.appendChild(icon);

        // Toggle checkbox on click
        item.onclick = (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
          }
          const statusId = checkbox.dataset.statusId!;
          if (checkbox.checked) {
            if (!tempSelectedStatusIds.includes(statusId)) {
              tempSelectedStatusIds.push(statusId);
            }
          } else {
            tempSelectedStatusIds = tempSelectedStatusIds.filter(id => id !== statusId);
          }
        };

        selectStatusList.appendChild(item);
      });
    }

    selectStatusModal.classList.add("show");
  };

  const closeSelectStatusModal = () => {
    if (selectStatusModal) {
      selectStatusModal.classList.remove("show");
    }
  };

  if (selectStatusModalCloseBtn) {
    selectStatusModalCloseBtn.addEventListener("click", closeSelectStatusModal);
  }

  if (cancelSelectStatusBtn) {
    cancelSelectStatusBtn.addEventListener("click", closeSelectStatusModal);
  }

  if (selectStatusModal) {
    selectStatusModal.addEventListener("click", (e) => {
      if (e.target === selectStatusModal) {
        closeSelectStatusModal();
      }
    });
  }

  if (doneSelectStatusBtn) {
    doneSelectStatusBtn.addEventListener("click", () => {
      if (currentElementId !== null) {
        const connections = getElementConnections(currentElementId);
        connections.statusIds = tempSelectedStatusIds;
        saveConnections(elementConnections);
        updateElementInfoPanel({ localId: currentElementId } as TreeNodeData);
      }
      closeSelectStatusModal();
    });
  }

  /* MD
    ### 📱 QR Code & Submissions System
    Generate QR codes for elements and manage submissions
  */

  // Submissions storage
  const SUBMISSIONS_STORAGE_KEY = "bim-element-submissions";

  const loadSubmissions = (): ElementSubmission[] => {
    try {
      const stored = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading submissions:", error);
      return [];
    }
  };

  let elementSubmissions: ElementSubmission[] = loadSubmissions();

  // Update active status dropdown
  const updateActiveStatusDropdown = (connections: ElementConnections) => {
    const activeStatusSelect = document.getElementById("element-active-status") as HTMLSelectElement;
    if (!activeStatusSelect) {
      console.warn("Active status select element not found");
      return;
    }

    console.log("Updating active status dropdown for element:", connections.elementId);
    console.log("Assigned status IDs:", connections.statusIds);
    console.log("All statuses:", elementStatuses);

    activeStatusSelect.innerHTML = '<option value="">No status assigned</option>';

    const assignedStatuses = elementStatuses.filter(s => connections.statusIds.includes(s.id));
    console.log("Filtered element statuses:", assignedStatuses);

    assignedStatuses.forEach(status => {
      const option = document.createElement("option");
      option.value = status.id;
      option.textContent = status.name;
      if (status.id === connections.activeStatusId) {
        option.selected = true;
      }
      activeStatusSelect.appendChild(option);
    });

    // Handle status change
    activeStatusSelect.onchange = () => {
      const selectedStatusId = activeStatusSelect.value;
      connections.activeStatusId = selectedStatusId;
      saveConnections(elementConnections);
      console.log("Active status changed to:", selectedStatusId);
    };
  };

  // Helper to fetch and display submission badge (unread count)
  const fetchAndDisplaySubmissionBadge = async (elementId: number, panelId: string) => {
    const badge = document.getElementById('submission-count');
    if (!badge) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/status-management/history/${panelId}`, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) return;

      const data = await response.json();
      console.log('🔔 Badge data received:', data);
      // Backend now calculates unread count based on database records
      const unreadCount = data.unreadCount !== undefined ? data.unreadCount : 0;
      console.log('🔔 Calculated unread count:', unreadCount);

      badge.textContent = unreadCount.toString();

      // Show badge if there are unread items
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';

    } catch (e) {
      console.error('Failed to fetch submission count', e);
      badge.style.display = 'none';
    }
  };

  // Update submission count badge (Legacy - kept for compatibility but unused for badge)
  const updateSubmissionCount = (elementId: number) => {
    // This function is replaced by fetchAndDisplaySubmissionBadge which handles unread counts
  };

  // QR Code Modal
  const qrModal = document.getElementById("qrModal");
  const qrModalCloseBtn = document.getElementById("qr-modal-close-btn");
  const closeQrBtn = document.getElementById("close-qr-btn");
  const showQrBtn = document.getElementById("show-qr-btn");
  const qrCanvas = document.getElementById("qr-canvas") as HTMLCanvasElement;

  const showQRCode = async (elementId: number) => {
    if (!qrModal || !qrCanvas) return;

    // Extract project ID from current URL
    const pathParts = window.location.pathname.split('/').filter(part => part.length > 0);
    const projectsIndex = pathParts.indexOf('projects');
    const projectId = projectsIndex !== -1 && pathParts[projectsIndex + 1]
      ? pathParts[projectsIndex + 1]
      : '1';

    console.log('📍 Current URL:', window.location.pathname);
    console.log('📍 Path parts:', pathParts);
    console.log('📍 Extracted project ID:', projectId);

    // Show loading state
    const qrContainer = qrModal.querySelector('.qr-container') as HTMLElement;
    const qrInfo = qrModal.querySelector('.qr-info') as HTMLElement;

    if (qrContainer) {
      qrContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px;">
          <div style="width: 40px; height: 40px; border: 4px solid #334155; border-top: 4px solid #64748b; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin-top: 16px; color: #94a3b8;">Generating QR code...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }

    qrModal.classList.add("show");

    try {
      // Get auth token
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Call backend API to generate or retrieve QR code
      const response = await fetch(`${API_BASE_URL}/qr-codes/generate`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          panelId: elementId.toString(),
          projectId: parseInt(projectId)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to generate QR code: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ QR code data received:', data);

      // Generate dynamic QR code URL
      const baseUrl = window.location.origin;
      const qrUrl = `${baseUrl}/qr/${data.qrCode.id}`;

      console.log('🔲 Generating QR code for:', qrUrl);

      // Clear loading state and add canvas
      if (qrContainer) {
        qrContainer.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.id = 'qr-canvas';
        qrContainer.appendChild(canvas);

        // Generate QR code on the new canvas
        await QRCode.toCanvas(canvas, qrUrl, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      }

      // Update info section with panel name and print options
      if (qrInfo) {
        const panelName = data.panel?.name || data.panel?.tag || 'Unknown Panel';
        qrInfo.innerHTML = `
          <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #94a3b8;">
              ${panelName}
            </h4>
            <p style="margin: 0; font-size: 13px; color: #94a3b8;">
              Scan this QR code to view element details and submit reports
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <input type="checkbox" id="print-with-name" checked style="width: 16px; height: 16px; cursor: pointer; accent-color: #64748b;" />
            <label for="print-with-name" style="margin: 0; font-size: 13px; color: #94a3b8; cursor: pointer; user-select: none;">
              Include panel name on QR code
            </label>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <input type="checkbox" id="print-with-logo" checked style="width: 16px; height: 16px; cursor: pointer; accent-color: #64748b;" />
            <label for="print-with-logo" style="margin: 0; font-size: 13px; color: #94a3b8; cursor: pointer; user-select: none;">
              Include company logo on QR code
            </label>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="download-jpg-btn" style="
              flex: 1;
              padding: 12px 24px;
              background: #475569;
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            " onmouseover="this.style.background='#64748b'" onmouseout="this.style.background='#475569'">
              <i class="fas fa-download"></i>
              JPG
            </button>
            <button id="download-pdf-btn" style="
              flex: 1;
              padding: 12px 24px;
              background: #475569;
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            " onmouseover="this.style.background='#64748b'" onmouseout="this.style.background='#475569'">
              <i class="fas fa-file-pdf"></i>
              PDF
            </button>
          </div>
        `;

        // Add download button event listeners
        const downloadJpgBtn = qrInfo.querySelector('#download-jpg-btn') as HTMLButtonElement;
        const downloadPdfBtn = qrInfo.querySelector('#download-pdf-btn') as HTMLButtonElement;
        const printWithNameCheckbox = qrInfo.querySelector('#print-with-name') as HTMLInputElement;
        const printWithLogoCheckbox = qrInfo.querySelector('#print-with-logo') as HTMLInputElement;

        if (downloadJpgBtn) {
          downloadJpgBtn.addEventListener('click', () => {
            const includeName = printWithNameCheckbox?.checked ?? true;
            const includeLogo = printWithLogoCheckbox?.checked ?? true;
            downloadStickerJPG(qrUrl, panelName, includeName, includeLogo);
          });
        }

        if (downloadPdfBtn) {
          downloadPdfBtn.addEventListener('click', () => {
            const includeName = printWithNameCheckbox?.checked ?? true;
            const includeLogo = printWithLogoCheckbox?.checked ?? true;
            downloadStickerPDF(qrUrl, panelName, includeName, includeLogo);
          });
        }
      }

    } catch (error: any) {
      console.error("Error generating QR code:", error);

      // Show error state
      if (qrContainer) {
        qrContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; color: #e74c3c;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
            <p style="margin: 0; font-size: 16px; font-weight: 600;">Failed to generate QR code</p>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #666; text-align: center; max-width: 80%;">${error.message || 'Please try again later'}</p>
          </div>
        `;
      }
    }
  };

  // Download sticker as JPG function 
  const downloadStickerJPG = async (qrUrl: string, panelName: string, includeName: boolean, includeLogo: boolean = true) => {
    try {
      // Sticker dimensions: 3" x 1.5" LANDSCAPE at 300 DPI for print quality
      const DPI = 300;
      const stickerWidth = 3 * DPI;
      const stickerHeight = 1.5 * DPI;
      const qrSize = 1.2 * DPI;

      // Create main canvas for the sticker
      const stickerCanvas = document.createElement('canvas');
      stickerCanvas.width = stickerWidth;
      stickerCanvas.height = stickerHeight;
      const ctx = stickerCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Fill background with white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, stickerWidth, stickerHeight);

      // Generate QR code first
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, qrUrl, {
        width: qrSize,
        margin: 0,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Draw QR code
      const qrX = 60;
      const qrY = (stickerHeight - qrSize) / 2;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // ========================================
      // LOGO RENDERING
      // ========================================
      let logoY = 20;
      let logoHeight = 0;

      try {
        const logo = new Image();
        logo.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          logo.onload = () => resolve();
          logo.onerror = () => reject(new Error('Failed to load logo'));

          logo.src = '/Uniqube_QR_logo.jpg';
        });

        const rightAreaX = qrX + qrSize + 40;
        const rightAreaWidth = stickerWidth - rightAreaX - 30;
        const maxLogoHeight = 200;

        let logoWidth = logo.width;
        logoHeight = logo.height;

        const scaleWidth = rightAreaWidth / logoWidth;
        const scaleHeight = maxLogoHeight / logoHeight;
        const scale = Math.min(scaleWidth, scaleHeight, 1);

        logoWidth = logoWidth * scale;
        logoHeight = logoHeight * scale;

        const logoX = stickerWidth - logoWidth - 30;
        logoY = 20;

        if (includeLogo) {
          ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
        }
      } catch (err) {
        console.warn('Could not load logo for layout calculation', err);
      }


      if (includeName && panelName) {

        const minPaddingFromQR = 20;
        const preferredPaddingFromEdge = 100;
        const minPaddingFromEdge = 50;

        const textAreaStartX = qrX + qrSize + minPaddingFromQR;


        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';


        let fontSize = 72;
        ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;


        let textAreaEndX = stickerWidth - preferredPaddingFromEdge;
        let textAreaWidth = textAreaEndX - textAreaStartX;


        let textWidth = ctx.measureText(panelName).width;


        if (textWidth > textAreaWidth) {
          textAreaEndX = stickerWidth - minPaddingFromEdge;
          textAreaWidth = textAreaEndX - textAreaStartX;
        }



        let lines = [panelName];
        let isMultiLine = false;


        let tempFontSize = fontSize;
        while (ctx.measureText(panelName).width > textAreaWidth && tempFontSize > 40) {
          tempFontSize -= 2;
          ctx.font = `700 ${tempFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        }


        if (ctx.measureText(panelName).width > textAreaWidth) {
          isMultiLine = true;

          const mid = Math.floor(panelName.length / 2);
          const separators = ['_', '-', ' '];
          let splitIndex = -1;
          let minDistance = panelName.length;


          for (let i = 0; i < panelName.length; i++) {
            if (separators.includes(panelName[i])) {
              const distance = Math.abs(i - mid);
              if (distance < minDistance) {
                minDistance = distance;
                splitIndex = i;
              }
            }
          }


          if (splitIndex === -1) {
            splitIndex = mid;
          } else {

            splitIndex += 1;
          }

          lines = [
            panelName.substring(0, splitIndex),
            panelName.substring(splitIndex)
          ];


          fontSize = 72;
          ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        }

        // Adjust font size for the lines
        let maxLineWidth = 0;
        lines.forEach(line => {
          const width = ctx.measureText(line).width;
          if (width > maxLineWidth) maxLineWidth = width;
        });

        while (maxLineWidth > textAreaWidth && fontSize > 24) {
          fontSize -= 2;
          ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;


          maxLineWidth = 0;
          lines.forEach(line => {
            const width = ctx.measureText(line).width;
            if (width > maxLineWidth) maxLineWidth = width;
          });
        }


        const logoBottom = logoY + logoHeight + 10;
        const stickerBottom = stickerHeight - 10;
        const availableVerticalSpace = stickerBottom - logoBottom;
        const verticalCenter = logoBottom + (availableVerticalSpace / 2);

        const lineHeight = fontSize * 1.1;

        if (isMultiLine) {
          const line1Y = verticalCenter - (lineHeight / 2) + (fontSize * 0.1);
          const line2Y = verticalCenter + (lineHeight / 2) + (fontSize * 0.1);

          const textX = textAreaEndX;

          const width1 = ctx.measureText(lines[0]).width;
          const width2 = ctx.measureText(lines[1]).width;

          if (width1 < width2) {
            const bottomLineStart = textX - width2;
            const bottomLineCenter = bottomLineStart + (width2 / 2);

            const topLineStart = bottomLineCenter - (width1 / 2);

            ctx.textAlign = 'left';
            ctx.fillText(lines[0], topLineStart, line1Y);

            ctx.textAlign = 'right';
            ctx.fillText(lines[1], textX, line2Y);
          } else {
            ctx.fillText(lines[0], textX, line1Y, textAreaWidth);
            ctx.fillText(lines[1], textX, line2Y, textAreaWidth);
          }
        } else {
          const textY = verticalCenter + (fontSize * 0.1);
          const textX = textAreaEndX;
          ctx.fillText(panelName, textX, textY, textAreaWidth);
        }
      }

      // Convert canvas to JPG and download
      stickerCanvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to generate sticker image');
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${panelName.replace(/[^a-z0-9]/gi, '_')}_sticker.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // console.log('✅ Sticker downloaded successfully');
      }, 'image/jpeg', 0.95);

    } catch (error) {
      console.error('Error generating sticker:', error);
      alert('Failed to generate sticker. Please try again.');
    }
  };

  // Download sticker as PDF function
  const downloadStickerPDF = async (qrUrl: string, panelName: string, includeName: boolean, includeLogo: boolean = true) => {
    try {
      // Use same dimensions as JPG: 3" x 1.5" LANDSCAPE at 300 DPI
      const DPI = 300;
      const stickerWidth = 3 * DPI;
      const stickerHeight = 1.5 * DPI;
      const qrSize = 1.2 * DPI;

      // Create main canvas for the sticker (same as JPG)
      const stickerCanvas = document.createElement('canvas');
      stickerCanvas.width = stickerWidth;
      stickerCanvas.height = stickerHeight;
      const ctx = stickerCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, stickerWidth, stickerHeight);

      // Generate QR code
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, qrUrl, {
        width: qrSize,
        margin: 0,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const qrX = 60;
      const qrY = (stickerHeight - qrSize) / 2;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // ========================================
      // LOGO RENDERING (Optional)
      // ========================================
      // Set includeLogo to false to disable logo rendering
      // This can be controlled via the "Include company logo" checkbox in the UI

      // Declare logo position variables (used later for text positioning)
      // Always load logo to calculate dimensions and preserve text layout
      let logoY = 20;
      let logoHeight = 0;

      try {
        // Load and draw logo
        const logo = new Image();
        logo.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          logo.onload = () => resolve();
          logo.onerror = () => reject(new Error('Failed to load logo'));
          logo.src = '/Uniqube_QR_logo.jpg';
        });

        const rightAreaX = qrX + qrSize + 40;
        const rightAreaWidth = stickerWidth - rightAreaX - 30;
        const maxLogoHeight = 200;

        let logoWidth = logo.width;
        logoHeight = logo.height;

        const scaleWidth = rightAreaWidth / logoWidth;
        const scaleHeight = maxLogoHeight / logoHeight;
        const scale = Math.min(scaleWidth, scaleHeight, 1);

        logoWidth = logoWidth * scale;
        logoHeight = logoHeight * scale;

        const logoX = stickerWidth - logoWidth - 30;
        logoY = 20;

        if (includeLogo) {
          ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
        }
      } catch (err) {
        console.warn('Could not load logo for layout calculation', err);
      }

      // Draw panel name (same logic as JPG)
      if (includeName && panelName) {
        const minPaddingFromQR = 20;
        const preferredPaddingFromEdge = 100;
        const minPaddingFromEdge = 50;

        const textAreaStartX = qrX + qrSize + minPaddingFromQR;

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        let fontSize = 72;
        ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

        let textAreaEndX = stickerWidth - preferredPaddingFromEdge;
        let textAreaWidth = textAreaEndX - textAreaStartX;

        let textWidth = ctx.measureText(panelName).width;

        if (textWidth > textAreaWidth) {
          textAreaEndX = stickerWidth - minPaddingFromEdge;
          textAreaWidth = textAreaEndX - textAreaStartX;
        }

        let lines = [panelName];
        let isMultiLine = false;

        let tempFontSize = fontSize;
        while (ctx.measureText(panelName).width > textAreaWidth && tempFontSize > 40) {
          tempFontSize -= 2;
          ctx.font = `700 ${tempFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        }

        if (ctx.measureText(panelName).width > textAreaWidth) {
          isMultiLine = true;
          const mid = Math.floor(panelName.length / 2);
          const separators = ['_', '-', ' '];
          let splitIndex = -1;
          let minDistance = panelName.length;

          for (let i = 0; i < panelName.length; i++) {
            if (separators.includes(panelName[i])) {
              const distance = Math.abs(i - mid);
              if (distance < minDistance) {
                minDistance = distance;
                splitIndex = i;
              }
            }
          }

          if (splitIndex === -1) {
            splitIndex = mid;
          } else {
            splitIndex += 1;
          }

          lines = [
            panelName.substring(0, splitIndex),
            panelName.substring(splitIndex)
          ];

          fontSize = 72;
          ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        }

        let maxLineWidth = 0;
        lines.forEach(line => {
          const width = ctx.measureText(line).width;
          if (width > maxLineWidth) maxLineWidth = width;
        });

        while (maxLineWidth > textAreaWidth && fontSize > 24) {
          fontSize -= 2;
          ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

          maxLineWidth = 0;
          lines.forEach(line => {
            const width = ctx.measureText(line).width;
            if (width > maxLineWidth) maxLineWidth = width;
          });
        }

        const logoBottom = logoY + logoHeight + 10;
        const stickerBottom = stickerHeight - 10;
        const availableVerticalSpace = stickerBottom - logoBottom;
        const verticalCenter = logoBottom + (availableVerticalSpace / 2);

        const lineHeight = fontSize * 1.1;

        if (isMultiLine) {
          const line1Y = verticalCenter - (lineHeight / 2) + (fontSize * 0.1);
          const line2Y = verticalCenter + (lineHeight / 2) + (fontSize * 0.1);

          const textX = textAreaEndX;

          const width1 = ctx.measureText(lines[0]).width;
          const width2 = ctx.measureText(lines[1]).width;

          if (width1 < width2) {
            const bottomLineStart = textX - width2;
            const bottomLineCenter = bottomLineStart + (width2 / 2);
            const topLineStart = bottomLineCenter - (width1 / 2);

            ctx.textAlign = 'left';
            ctx.fillText(lines[0], topLineStart, line1Y);

            ctx.textAlign = 'right';
            ctx.fillText(lines[1], textX, line2Y);
          } else {
            ctx.fillText(lines[0], textX, line1Y, textAreaWidth);
            ctx.fillText(lines[1], textX, line2Y, textAreaWidth);
          }
        } else {
          const textY = verticalCenter + (fontSize * 0.1);
          const textX = textAreaEndX;
          ctx.fillText(panelName, textX, textY, textAreaWidth);
        }
      }

      // Convert canvas to image data URL
      const imageDataUrl = stickerCanvas.toDataURL('image/jpeg', 0.95);

      // Create a new window for PDF printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Failed to open print window. Please allow popups.');
      }

      // Write HTML with the sticker image and print styles
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code Sticker - ${panelName}</title>
            <style>
              @page {
                size: landscape;
                margin: 0;
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: white;
              }
              img {
                max-width: 90%;
                max-height: 90%;
                width: auto;
                height: auto;
                display: block;
                object-fit: contain;
              }
              @media print {
                html, body {
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                img {
                  max-width: 90%;
                  max-height: 90%;
                }
              }
            </style>
          </head>
          <body>
            <img src="${imageDataUrl}" alt="QR Code Sticker" />
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() { 
                    window.close(); 
                  }, 100);
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

    } catch (error) {
      console.error('Error generating PDF sticker:', error);
      alert('Failed to generate PDF sticker. Please try again.');
    }
  };


  const closeQRModal = () => {
    if (qrModal) {
      qrModal.classList.remove("show");
    }
  };

  if (showQrBtn) {
    showQrBtn.addEventListener("click", () => {
      if (currentElementId !== null) {
        showQRCode(currentElementId);
      }
    });
  }

  if (qrModalCloseBtn) {
    qrModalCloseBtn.addEventListener("click", closeQRModal);
  }

  if (closeQrBtn) {
    closeQrBtn.addEventListener("click", closeQRModal);
  }

  if (qrModal) {
    qrModal.addEventListener("click", (e) => {
      if (e.target === qrModal) {
        closeQRModal();
      }
    });
  }

  // Submissions Modal
  const submissionsModal = document.getElementById("submissionsModal");
  const submissionsModalCloseBtn = document.getElementById("submissions-modal-close-btn");
  const closeSubmissionsBtn = document.getElementById("close-submissions-btn");
  const showSubmissionsBtn = document.getElementById("show-submissions-btn");
  const submissionsList = document.getElementById("submissions-list");

  const renderSubmissions = (elementId: number) => {
    if (!submissionsList) return;

    const elementSubs = elementSubmissions.filter(s => s.elementId === elementId);

    if (elementSubs.length === 0) {
      submissionsList.innerHTML = `
      <div class="empty-submissions">
        <i class="fas fa-inbox"></i>
        <p>No submissions yet for this element</p>
      </div>
    `;
      return;
    }

    submissionsList.innerHTML = "";

    // Sort by timestamp (newest first)
    elementSubs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    elementSubs.forEach(sub => {
      const status = elementStatuses.find(s => s.id === sub.statusId);
      const timestamp = new Date(sub.timestamp).toLocaleString();
      const iconClass = status ? getIconClass(status.icon) : 'fa-circle';

      const subItem = document.createElement("div");
      subItem.className = "submission-item";

      subItem.innerHTML = `
      <div class="submission-header">
        <div class="submission-status">
          <i class="fas ${iconClass}" style="color: ${status?.color || '#00e5ff'};"></i>
          <span>${status?.name || 'Unknown Status'}</span>
        </div>
        <div class="submission-timestamp">${timestamp}</div>
      </div>
      <div class="submission-note">${sub.note}</div>
      <div class="submission-reporter">
        <i class="fas fa-user"></i>
        <span>${sub.reporter}</span>
      </div>
    `;

      submissionsList.appendChild(subItem);
    });
  };

  const showSubmissionsModal = async (elementId: number) => {
    if (!submissionsModal || !submissionsList) return;

    // Show loading state
    submissionsList.innerHTML = `
      <div class="empty-submissions">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading submissions...</p>
      </div>
    `;
    submissionsModal.classList.add("show");

    try {
      // Get the panel UUID from the element ID using localIdPanelMap
      const panelData = localIdPanelMap.get(elementId);

      if (!panelData || !panelData.id) {
        console.error('Panel data not found for element ID:', elementId);
        submissionsList.innerHTML = `
          <div class="empty-submissions">
            <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
            <p>Panel data not found</p>
            <p style="font-size: 12px; opacity: 0.7; margin-top: 8px;">Element ID: ${elementId}</p>
          </div>
        `;
        return;
      }

      const panelId = panelData.id; // This is the UUID string
      console.log(`📊 Fetching status history for panel: ${panelId} (element ID: ${elementId})`);

      // Fetch status history from database
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Sending token for history fetch:', token.substring(0, 10) + '...');
      } else {
        console.warn('⚠️ No token found in localStorage for history fetch');
      }

      const response = await fetch(`${API_BASE_URL}/status-management/history/${panelId}`, {
        method: 'GET',
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch status history: ${response.statusText}`);
      }

      const data = await response.json();
      const history = data.history || [];
      const allStatuses = data.allStatuses || [];

      // Create a map for quick status lookup
      const statusMap = new Map();
      allStatuses.forEach((s: any) => statusMap.set(s.id, s));

      console.log(`✅ Fetched ${history.length} history entries for panel ${panelId}`);

      // Mark submissions as viewed in the database
      try {
        await fetch(`${API_BASE_URL}/status-management/history/${panelId}/mark-viewed`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({})
        });
      } catch (e) {
        console.warn('Failed to mark submissions as viewed:', e);
      }

      // Update badge immediately to 0 (hidden) since we are viewing them
      const badge = document.getElementById('submission-count');
      if (badge) badge.style.display = 'none';

      // Render the history
      if (history.length === 0) {
        submissionsList.innerHTML = `
          <div class="empty-submissions">
            <i class="fas fa-inbox"></i>
            <p>No submissions yet for this element</p>
          </div>
        `;
        return;
      }

      submissionsList.innerHTML = "";

      history.forEach((entry: any) => {
        const status = entry.status;
        const timestamp = new Date(entry.createdAt).toLocaleString();
        const iconClass = status ? getIconClass(status.icon) : 'fa-circle';

        // Parse note and snapshot
        let note = entry.notes || '';
        let snapshotIds: string[] = [];

        if (note.includes('\n\n---\nSNAPSHOT:')) {
          const parts = note.split('\n\n---\nSNAPSHOT:');
          note = parts[0];
          try {
            snapshotIds = JSON.parse(parts[1]);
          } catch (e) {
            console.error('Error parsing snapshot:', e);
          }
        }

        // Extract reporter name from notes if it exists
        let reporterName = entry.user?.name || 'Unknown';

        // Check if notes contain "Reporter: " prefix
        if (note.startsWith('Reporter: ')) {
          const lines = note.split('\n');
          const reporterLine = lines[0].replace('Reporter: ', '');
          reporterName = reporterLine;
          note = lines.slice(1).join('\n').trim();
        }

        const subItem = document.createElement("div");
        subItem.className = "submission-item";

        // Add click handler to show detail modal
        subItem.onclick = () => showSubmissionDetail(entry, status, reporterName, note, snapshotIds, statusMap);

        // Action color class
        const actionClass = entry.action === 'ASSIGNED' ? 'assigned' : (entry.action === 'REMOVED' ? 'removed' : (entry.action === 'UPDATED' ? 'updated' : ''));

        // Generate snapshot HTML (limited/compact - just icons like the STATUS screenshot)
        const snapshotHtml = snapshotIds.length > 0 ? `
          <div class="submission-snapshot" style="display: flex; gap: 8px; align-items: center;">
            ${snapshotIds.slice(0, 4).map(id => {
          const s = statusMap.get(id);
          if (!s) return '';
          return `
                <div style="color: ${s.color}; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;" title="${s.name}">
                  <i data-lucide="${getIconClass(s.icon)}"></i>
                </div>
              `;
        }).join('')}
            ${snapshotIds.length > 4 ? `<div style="font-size: 12px; color: var(--slate-400); font-weight: 600;">+${snapshotIds.length - 4}</div>` : ''}
          </div>
        ` : '';

        subItem.innerHTML = `
          <div class="submission-header">
            <div class="submission-status">
              <i data-lucide="${iconClass}" style="color: ${status?.color || '#00e5ff'};"></i>
              <span>${status?.name || 'Unknown Status'}</span>
              <span class="submission-action ${actionClass}" style="margin-left: 8px; font-size: 11px; opacity: 0.9;">(${entry.action})</span>
            </div>
            <div class="submission-timestamp">${timestamp}</div>
          </div>
          ${note ? `<div class="submission-note">${note}</div>` : ''}
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--slate-100);">
            <div class="submission-reporter">
              <i class="fas fa-user"></i>
              <span>${reporterName}</span>
            </div>
            ${snapshotHtml}
          </div>
        `;

        submissionsList.appendChild(subItem);
      });

      // Initialize Lucide icons after rendering
      setTimeout(() => initializeLucideIcons(), 50);

    } catch (error) {
      console.error('Error loading status history:', error);
      submissionsList.innerHTML = `
        <div class="empty-submissions">
          <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
          <p>Failed to load submissions</p>
          <p style="font-size: 12px; opacity: 0.7; margin-top: 8px;">Please try again later</p>
        </div>
      `;
    }
  };

  // Show submission detail modal
  const showSubmissionDetail = (entry: any, status: any, reporterName: string, note: string, snapshotIds: string[], statusMap: Map<string, any>) => {
    const detailModal = document.getElementById("submissionDetailModal");
    const detailContent = document.getElementById("submission-detail-content");

    if (!detailModal || !detailContent) return;

    const timestamp = new Date(entry.createdAt).toLocaleString();
    const iconClass = status ? getIconClass(status.icon) : 'fa-circle';
    const actionColor = entry.action === 'ASSIGNED' ? '#10b981' : (entry.action === 'REMOVED' ? '#ef4444' : (entry.action === 'UPDATED' ? '#3b82f6' : 'var(--slate-500)'));

    // Generate full snapshot HTML (pill style like the Statuses screenshot)
    const fullSnapshotHtml = snapshotIds.length > 0 ? `
      <div>
        <div style="font-size: 14px; font-weight: 600; color: var(--slate-700); margin-bottom: 12px;">
          <i data-lucide="layers" style="margin-right: 6px;"></i>Panel Status Snapshot
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          ${snapshotIds.map(id => {
      const s = statusMap.get(id);
      if (!s) return '';
      // Create a light background color based on the status color (using opacity)
      // Since we can't easily manipulate hex to rgba here without a helper, we'll use a generic light background
      // and use the status color for the text/icon/border
      return `
              <div style="
                display: flex; 
                align-items: center; 
                gap: 8px; 
                padding: 8px 16px; 
                background: ${s.color}15; 
                border-radius: 8px; 
                border: 1px solid ${s.color}40; 
                color: ${s.color};
                font-weight: 500;
                font-size: 14px;
              ">
                <i data-lucide="${getIconClass(s.icon)}" style="font-size: 16px;"></i>
                <span>${s.name}</span>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    ` : '';

    detailContent.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div style="padding: 20px; background: var(--slate-50); border-radius: 12px; border-left: 4px solid ${status?.color || '#00e5ff'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="
              width: 48px; 
              height: 48px; 
              border-radius: 12px; 
              background: ${status?.color || '#00e5ff'}20; 
              display: flex; 
              align-items: center; 
              justify-content: center;
            ">
              <i data-lucide="${iconClass}" style="color: ${status?.color || '#00e5ff'}; font-size: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 20px; font-weight: 700; color: var(--slate-900);">${status?.name || 'Unknown Status'}</div>
              <div style="font-size: 14px; color: var(--slate-500); margin-top: 4px;">
                <span style="font-weight: 700; color: ${actionColor};">${entry.action}</span> on ${timestamp}
              </div>
            </div>
          </div>
        </div>

        ${note ? `
          <div>
            <div style="font-size: 14px; font-weight: 600; color: var(--slate-700); margin-bottom: 8px;">
              <i data-lucide="sticky-note" style="margin-right: 6px;"></i>Notes
            </div>
            <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid var(--slate-200); color: var(--slate-700); line-height: 1.6; white-space: pre-wrap;">
              ${note}
            </div>
          </div>
        ` : ''}

        ${fullSnapshotHtml}

        <div>
          <div style="font-size: 14px; font-weight: 600; color: var(--slate-700); margin-bottom: 8px;">
            <i data-lucide="user" style="margin-right: 6px;"></i>Reporter
          </div>
          <div style="padding: 12px 16px; background: var(--slate-50); border-radius: 8px; color: var(--slate-900); font-weight: 500; display: inline-block;">
            ${reporterName}
          </div>
        </div>
      </div>
    `;

    detailModal.classList.add("show");

    // Initialize Lucide icons after rendering
    setTimeout(() => initializeLucideIcons(), 50);
  };

  // Close submission detail modal
  const closeSubmissionDetailModal = () => {
    const detailModal = document.getElementById("submissionDetailModal");
    if (detailModal) {
      detailModal.classList.remove("show");
    }
  };

  const submissionDetailCloseBtn = document.getElementById("submission-detail-modal-close-btn");
  const closeSubmissionDetailBtn = document.getElementById("close-submission-detail-btn");
  const submissionDetailModal = document.getElementById("submissionDetailModal");

  if (submissionDetailCloseBtn) {
    submissionDetailCloseBtn.addEventListener("click", closeSubmissionDetailModal);
  }

  if (closeSubmissionDetailBtn) {
    closeSubmissionDetailBtn.addEventListener("click", closeSubmissionDetailModal);
  }

  if (submissionDetailModal) {
    submissionDetailModal.addEventListener("click", (e) => {
      if (e.target === submissionDetailModal) {
        closeSubmissionDetailModal();
      }
    });
  }

  const closeSubmissionsModalFn = () => {
    if (submissionsModal) {
      submissionsModal.classList.remove("show");
    }
  };

  if (showSubmissionsBtn) {
    showSubmissionsBtn.addEventListener("click", () => {
      if (currentElementId !== null) {
        showSubmissionsModal(currentElementId);
      }
    });
  }

  if (submissionsModalCloseBtn) {
    submissionsModalCloseBtn.addEventListener("click", closeSubmissionsModalFn);
  }

  if (closeSubmissionsBtn) {
    closeSubmissionsBtn.addEventListener("click", closeSubmissionsModalFn);
  }

  if (submissionsModal) {
    submissionsModal.addEventListener("click", (e) => {
      if (e.target === submissionsModal) {
        closeSubmissionsModalFn();
      }
    });
  }

  // Fetch groups and statuses from database
  if (projectIdFromUrl) {
    emitProgress(90, 'Loading groups and statuses...');
    fetchGroupsFromDatabase(projectIdFromUrl);
    fetchStatusesFromDatabase(projectIdFromUrl);
  }

  /* MD
    ### 🎨 Element Category Filtering
    Filter and highlight elements by category (MEP, Doors & Windows, Frames)
  */

  // Element category filtering state
  let activeElementFilters = new Set<string>();

  // IFC Element type categorization
  const IFC_ELEMENT_CATEGORIES: Record<string, string[]> = {
    MEP: [
      // Distribution Flow Elements
      'IFCDUCTFITTING', 'IFCDUCTSEGMENT', 'IFCPIPEFITTING', 'IFCPIPESEGMENT',
      'IFCFLOWSEGMENT', 'IFCFLOWFITTING', 'IFCCABLECARRIERFITTING', 'IFCCABLECARRIERSEGMENT',
      'IFCCABLESEGMENT',

      // Flow Control and Terminals
      'IFCFLOWCONTROLLER', 'IFCFLOWTERMINAL', 'IFCVALVE', 'IFCDAMPER',
      'IFCAIRTERMINAL', 'IFCAIRTOAIRHEATRECOVERY', 'IFCFIRESUPPRESSIONTERMINAL',
      'IFCSANITARYTERMINAL', 'IFCSTACKTERMINAL', 'IFCWASTETERMINAL',

      // Electrical
      'IFCELECTRICALELEMENT', 'IFCELECTRICDISTRIBUTIONBOARD', 'IFCELECTRICFLOWSTORAGEDEVICE',
      'IFCELECTRICGENERATOR', 'IFCELECTRICMOTOR', 'IFCJUNCTIONBOX', 'IFCLIGHTFIXTURE',
      'IFCOUTLET', 'IFCSWITCHINGDEVICE', 'IFCTRANSFORMER', 'IFCPROTECTIVEDEVICE',

      // HVAC Equipment
      'IFCFAN', 'IFCPUMP', 'IFCBOILER', 'IFCCHILLER', 'IFCCOIL', 'IFCHEATEXCHANGER',
      'IFCHUMIDIFIER', 'IFCUNITARYEQUIPMENT', 'IFCAIRCONDITIONER', 'IFCCOMPRESSOR',
      'IFCCONDENSER', 'IFCCOOLEDBEAM', 'IFCCOOLINGTOWER', 'IFCEVAPORATIVECOOLER',
      'IFCFILTER', 'IFCTANK'
    ],
    DOORS_WINDOWS: [
      'IFCDOOR', 'IFCWINDOW', 'IFCDOORSTANDARDCASE', 'IFCWINDOWSTANDARDCASE'
    ],
    FRAMES: [
      'IFCMEMBER',
      'IFCELEMENTASSEMBLY'
    ],
    STRUCTURAL: [
      'IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCSLAB', 'IFCSLABSTANDARDCASE',
      'IFCBEAM', 'IFCCOLUMN', 'IFCFOOTING', 'IFCPILE', 'IFCPLATE', 'IFCCURTAINWALL',
      'IFCROOF', 'IFCSTAIR', 'IFCSTAIRFLIGHT', 'IFCRAILING', 'IFCRAMP', 'IFCRAMPFLIGHT',
      'IFCCOVERING', 'IFCBUILDINGELEMENTPART'
    ]
  };

  // Check if an IFC type matches any active filters
  const matchesElementFilter = (ifcType: string): boolean => {
    if (activeElementFilters.size === 0) return true; // No filters = show all

    if (!ifcType) return false;

    const typeUpper = ifcType.toUpperCase();
    console.log(`🔍 matchesElementFilter checking: "${ifcType}" (uppercase: "${typeUpper}") against filters:`, Array.from(activeElementFilters));

    for (const filter of activeElementFilters) {
      const categoryTypes = IFC_ELEMENT_CATEGORIES[filter];
      if (categoryTypes) {
        // Check if any category type is contained in the IFC type
        const match = categoryTypes.some(t => {
          const isMatch = typeUpper.includes(t);
          if (isMatch) {
            console.log(`  ✓ Match found: "${typeUpper}" contains "${t}" (filter: ${filter})`);
          }
          return isMatch;
        });
        if (match) return true;
      }
    }

    console.log(`  ✗ No match for "${typeUpper}"`);
    return false;
  };

  // Get the category for a specific IFC type (returns the first matching category)
  const getCategoryForType = (ifcType: string): string | null => {
    if (!ifcType) return null;

    const typeUpper = ifcType.toUpperCase();

    for (const [category, types] of Object.entries(IFC_ELEMENT_CATEGORIES)) {
      if (types.some(t => typeUpper.includes(t))) {
        return category;
      }
    }

    return null;
  };

  // Get color for a specific category
  const getCategoryColor = (category: string): THREE.Color => {
    const colorMap: Record<string, string> = {
      'MEP': '#ec3b3b',              // Red
      'DOORS_WINDOWS': '#00cc66',    // Green(Teal)
      'FRAMES': '#ffb300',           // yellow/orange
      'STRUCTURAL': '#D773FF'        // purple(Heliotrope)
    };

    return new THREE.Color(colorMap[category] || '#0047AB'); // Default to cobalt blue if unknown
  };

  // Render filtered tree view (replaces tree content with filtered panels)
  const renderFilteredTree = async (filterTypes: Set<string>, page: number = 1) => {
    const treeContainer = document.getElementById('tree-container');
    if (!treeContainer) return;

    // Show loading on first page
    if (page === 1) {
      treeContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--slate-500);">
          <i class="fas fa-spinner fa-spin" style="font-size: 20px;"></i>
          <div style="margin-top: 10px;">Filtering elements...</div>
        </div>
      `;
    }

    try {
      // Convert filter types to IFC types
      const ifcTypes: string[] = [];
      filterTypes.forEach(filter => {
        const categoryTypes = IFC_ELEMENT_CATEGORIES[filter];
        if (categoryTypes) {
          ifcTypes.push(...categoryTypes);
        }
      });

      if (ifcTypes.length === 0) {
        treeContainer.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--slate-500);">
            No filter types configured
          </div>
        `;
        return;
      }

      // Fetch filtered panels from backend
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `/api/panels/${projectIdFromUrl}/filter-by-type?ifcTypes=${ifcTypes.join(',')}&page=${page}&limit=50`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch filtered panels: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📊 Fetched ${data.panels.length} of ${data.total} filtered panels (page ${page})`);

      // Map backend data to frontend model (same as search)
      if (data.panels) {
        data.panels = data.panels.map((p: any) => ({
          ...p,
          type: p.element?.ifcType || p.objectType || p.type || 'Unknown',
          localId: p.element?.expressId || (p.metadata?.ifcElementId ? parseInt(p.metadata.ifcElementId) : (p.element?.id || null))
        }));
      }

      // Clear tree on first page
      if (page === 1) {
        treeContainer.innerHTML = '';

        // Clear tree node map to remove stale references from previous view
        treeNodeMap.clear();
        console.log('🧹 Cleared tree node map for filtered view');

        // Add header with filter names and count
        const header = document.createElement('div');
        header.className = 'filtered-tree-header';
        const filterNames = Array.from(filterTypes).join(', ');
        header.innerHTML = `
          <div style="padding: 12px; background: var(--slate-100); border-bottom: 1px solid var(--slate-200); font-size: 14px;">
            <div style="font-weight: 600; color: var(--slate-900);">Filtered Results</div>
            <div id="filtered-results-count" style="color: var(--slate-600); margin-top: 4px; font-size: 12px;">
              ${data.panels.length} of ${data.total} ${filterNames} elements
            </div>
          </div>
        `;
        treeContainer.appendChild(header);
      }

      // Render panel nodes
      data.panels.forEach((panel: any) => {
        renderFilteredPanelNode(panel, treeContainer);
      });

      // Update count if not first page
      if (page > 1) {
        const countDisplay = document.getElementById('filtered-results-count');
        if (countDisplay) {
          const currentCount = treeContainer.querySelectorAll('.filtered-panel').length;
          const filterNames = Array.from(filterTypes).join(', ');
          countDisplay.textContent = `${currentCount} of ${data.total} ${filterNames} elements`;
        }
      }

      // Add or update "Load More" button
      const existingLoadMore = treeContainer.querySelector('.filtered-load-more');
      if (existingLoadMore) {
        existingLoadMore.remove();
      }

      const currentLoadedCount = treeContainer.querySelectorAll('.filtered-panel').length;
      if (currentLoadedCount < data.total) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'filtered-load-more';
        loadMoreBtn.textContent = `Load More (${data.total - currentLoadedCount} remaining)`;
        loadMoreBtn.style.cssText = `
          width: 100%;
          padding: 12px;
          background: var(--slate-100);
          border: none;
          border-top: 1px solid var(--slate-200);
          color: var(--primary);
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        `;
        loadMoreBtn.onmouseenter = () => {
          loadMoreBtn.style.background = 'var(--slate-200)';
        };
        loadMoreBtn.onmouseleave = () => {
          loadMoreBtn.style.background = 'var(--slate-100)';
        };
        loadMoreBtn.onclick = async () => {
          loadMoreBtn.textContent = 'Loading...';
          loadMoreBtn.disabled = true;
          await renderFilteredTree(filterTypes, page + 1);
        };
        treeContainer.appendChild(loadMoreBtn);
      }

      // Initialize Lucide icons for the new nodes
      if ((window as any).lucide) {
        (window as any).lucide.createIcons();
      }
    } catch (error) {
      console.error('Error rendering filtered tree:', error);
      treeContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--danger);">
          Failed to load filtered elements
        </div>
      `;
    }
  };

  // Render a single filtered panel node
  const renderFilteredPanelNode = (panel: any, container: HTMLElement) => {
    const node = document.createElement('div');
    node.className = 'tree-node panel-node filtered-panel';
    node.style.paddingLeft = '20px';
    node.style.cursor = 'pointer';
    node.style.transition = 'background 0.2s';

    // Extract localId from metadata
    const localId = panel.metadata?.ifcElementId;
    if (localId) {
      const numericId = typeof localId === 'number' ? localId : parseInt(localId);
      if (!isNaN(numericId)) {
        node.dataset.localId = numericId.toString();
        treeNodeMap.set(numericId, node);
      }
    }

    // Get category and color for this element
    const ifcType = panel.element?.ifcType || panel.type || panel.objectType || '';
    const category = getCategoryForType(ifcType);
    const categoryColor = category ? getCategoryColor(category) : null;

    // Color indicator dot
    if (categoryColor) {
      const colorDot = document.createElement('div');
      colorDot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${categoryColor.getStyle()};
        margin-right: 8px;
        flex-shrink: 0;
      `;
      node.appendChild(colorDot);
    }

    // Icon
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'box');
    icon.style.marginRight = '8px';
    icon.style.color = 'var(--primary)';
    node.appendChild(icon);

    // Name
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = panel.name || panel.tag || 'Unnamed Element';
    label.style.flex = '1';
    node.appendChild(label);

    // Type badge
    const badge = document.createElement('span');
    badge.className = 'tree-type-badge';
    badge.textContent = ifcType.replace('IFC', '').replace('Ifc', '');
    badge.style.cssText = `
      font-size: 10px;
      color: var(--slate-500);
      background: var(--slate-100);
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
    `;
    node.appendChild(badge);

    // Hover effect
    node.onmouseenter = () => {
      node.style.background = 'var(--slate-100)';
    };
    node.onmouseleave = () => {
      if (!node.classList.contains('selected')) {
        node.style.background = '';
      }
    };

    // Click handler - highlight and focus on element
    node.onclick = async () => {
      if (localId) {
        const numericId = typeof localId === 'number' ? localId : parseInt(localId);

        // Update selection in tree
        container.querySelectorAll('.selected').forEach(n => {
          n.classList.remove('selected');
          (n as HTMLElement).style.background = '';
        });
        node.classList.add('selected');
        node.style.background = 'var(--slate-200)';

        // Populate localIdPanelMap for other functions to use
        if (!localIdPanelMap.has(numericId)) {
          localIdPanelMap.set(numericId, panel);
        }

        // Highlight and focus in 3D viewer
        try {
          // Reset all highlights
          const resetPromises = [];
          for (const [_, m] of models.entries()) {
            resetPromises.push(m.resetHighlight(undefined));
          }
          await Promise.all(resetPromises);

          // Ghost mode for all elements
          const ghostPromises = [];
          for (const [_, m] of models.entries()) {
            ghostPromises.push(
              m.highlight(undefined, {
                color: new THREE.Color(0xcccccc),
                opacity: 0.2,
                transparent: true,
                renderedFaces: FRAGS.RenderedFaces.TWO,
              })
            );
          }
          await Promise.all(ghostPromises);

          // Collect parent and children for highlighting
          let idsToHighlight: number[] = [numericId];

          for (const [_, model] of models.entries()) {
            try {
              // Find parent panel
              const parentId = await findParentPanelId(model, numericId);
              const targetId = parentId || numericId;

              // Get spatial structure
              const cacheKey = (model as any).modelId || (model as any).threads?.modelId || 'default';
              let spatialStructure = spatialStructureCache.get(cacheKey);
              if (!spatialStructure) {
                spatialStructure = await model.getSpatialStructure();
                spatialStructureCache.set(cacheKey, spatialStructure);
              }

              if (spatialStructure) {
                // Collect parent and all children
                const relatedIds = collectParentAndChildIds(spatialStructure, targetId);
                if (relatedIds.length > 0) {
                  idsToHighlight = relatedIds;
                  console.log(`📦 Highlighting ${relatedIds.length} related elements for ${panel.name || panel.tag}`);
                  break; // Found in this model
                }
              }
            } catch (err) {
              console.warn('Could not resolve parent/children:', err);
            }
          }

          // Highlight all related elements with category color
          const highlightColor = categoryColor || new THREE.Color('#0047AB');
          for (const [_, model] of models.entries()) {
            try {
              await model.highlight(idsToHighlight, {
                color: highlightColor,
                opacity: 1,
                transparent: false,
                renderedFaces: FRAGS.RenderedFaces.TWO,
              });
            } catch (err) {
              console.warn('Could not highlight in this model:', err);
            }
          }

          // Focus camera on all related elements
          await focusCameraOnLocalIds(idsToHighlight, { closer: 0.9 });

          // Update fragments
          await fragments.update(true);

          console.log(`✅ Focused on element: ${panel.name || panel.tag} (localId: ${numericId}, total highlighted: ${idsToHighlight.length})`);

          // Show element information panel
          const nodeData = {
            localId: numericId,
            name: panel.name || panel.tag || 'Unnamed',
            type: panel.element?.ifcType || 'Unknown',
            tag: panel.tag,
            id: panel.id,
            elementId: panel.elementId,
            metadata: panel.metadata,
            category: 'element',
            children: [],
            panelData: panel,
          } as any;

          // Show info panel and update with element data
          const infoPanel = document.getElementById("infoPanel");
          const statusPanel = document.getElementById("statusPanel");
          const groupsPanel = document.getElementById("groupsPanel");

          if (statusPanel) statusPanel.classList.add("panel-hidden");
          if (groupsPanel) groupsPanel.classList.add("panel-hidden");
          if (infoPanel) {
            infoPanel.classList.remove("panel-hidden");

            // Update basic info
            const infoSection = infoPanel.querySelector(".info-section");
            if (infoSection) {
              infoSection.innerHTML = `
                <div class="info-row">
                  <div class="info-label">Name</div>
                  <div class="info-value">${nodeData.name}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">ID</div>
                  <div class="info-value">${nodeData.localId}</div>
                </div>
                <div class="info-row">
                  <div class="info-label">Type</div>
                  <div class="info-value">${nodeData.type}</div>
                </div>
                <div class="info-actions">
                  <button id="show-qr-btn" class="info-action-btn" title="Show QR Code">
                    <i class="fas fa-qrcode"></i>
                  </button>
                  <button id="show-submissions-btn" class="info-action-btn" title="View Submissions">
                    <i class="fas fa-bell"></i>
                    <span id="submission-count" class="notification-badge">0</span>
                  </button>
                </div>
              `;
            }

            // Update groups and status sections
            if (typeof updateElementInfoPanel === 'function') {
              updateElementInfoPanel(nodeData);
            }

            // Attach QR code button event listener
            const showQrBtnInPanel = infoPanel.querySelector("#show-qr-btn");
            if (showQrBtnInPanel) {
              showQrBtnInPanel.addEventListener("click", () => {
                if (nodeData.localId) {
                  showQRCode(nodeData.localId);
                }
              });
            }

            // Attach submissions button event listener
            const showSubmissionsBtnInPanel = infoPanel.querySelector("#show-submissions-btn");
            if (showSubmissionsBtnInPanel) {
              showSubmissionsBtnInPanel.addEventListener("click", () => {
                if (nodeData.localId) {
                  showSubmissionsModal(nodeData.localId);
                }
              });

              // Fetch and show badge for unread submissions
              if (panel.id) {
                fetchAndDisplaySubmissionBadge(nodeData.localId, panel.id);
              }
            }
          }

        } catch (error) {
          console.error('Error focusing on element:', error);
        }
      }
    };

    container.appendChild(node);
  };

  // Restore normal tree view (when filters are cleared)
  const restoreNormalTree = async () => {
    const treeContainer = document.getElementById('tree-container');
    if (!treeContainer) return;

    // Clear filtered tree
    treeContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--slate-500);">
        <i class="fas fa-spinner fa-spin" style="font-size: 20px;"></i>
        <div style="margin-top: 10px;">Restoring tree view...</div>
      </div>
    `;

    // Clear tree node map to remove stale references
    treeNodeMap.clear();
    console.log('🧹 Cleared tree node map');

    // Re-initialize the tree (uses cache if available)
    await initializeObjectTree();

    // Ensure tree panel is visible
    const treePanel = document.getElementById('tree-panel');
    if (treePanel && treePanel.classList.contains('panel-hidden')) {
      treePanel.classList.remove('panel-hidden');
    }
  };


  // Apply element category filter (highlight matching, dim others)
  const applyElementFilter = async (loadingTitle = 'Filtering Elements', loadingSubtitle = 'Applying filters to 3D model...') => {
    // Start loading
    window.dispatchEvent(new CustomEvent('viewer-loading', {
      detail: {
        isLoading: true,
        title: loadingTitle,
        subtitle: loadingSubtitle,
        status: 'Preparing...',
        progress: 0
      }
    }));

    // Disable all filter buttons during operation
    const filterButtons = document.querySelectorAll('.filter-btn');
    const clearFiltersBtn = document.getElementById('filter-clear-btn');

    filterButtons.forEach(btn => btn.setAttribute('disabled', 'true'));
    if (clearFiltersBtn) clearFiltersBtn.setAttribute('disabled', 'true');

    try {
      console.log(`🎨 Applying element filters:`, Array.from(activeElementFilters));

      // If no filters active, reset all highlights and restore normal tree
      if (activeElementFilters.size === 0) {
        console.log('✨ No filters active, resetting highlights');
        for (const [_, model] of models.entries()) {
          await model.resetHighlight(undefined);
        }

        // Restore normal tree view
        restoreNormalTree();

        await fragments.update(true);
        return;
      }

      // Render filtered tree view (replaces tree content with filtered panels)
      await renderFilteredTree(activeElementFilters);

      // Automatically open tree panel to show results
      const treePanel = document.getElementById('tree-panel');
      if (treePanel && treePanel.classList.contains('panel-hidden')) {
        treePanel.classList.remove('panel-hidden');
        console.log('📂 Automatically opened tree panel for filtered results');
      }

      // Fetch all panels from database with their IFC types
      const pathParts = window.location.pathname.split('/');
      const projectsIndex = pathParts.indexOf('projects');
      const projectId = projectsIndex >= 0 ? pathParts[projectsIndex + 1] : null;

      if (!projectId) {
        console.error('❌ Project ID not found');
        return;
      }

      console.log(`📡 Fetching panel filter data from database for project ${projectId}...`);

      // Fetch minimal panel data for filtering (only id, elementId, ifcType)
      // This is much lighter than fetching all panel data
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Use lightweight filter-data endpoint that only returns essential fields
      const response = await fetch(`/api/panels/${projectId}/filter-data`, {
        headers
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch panel filter data:', response.statusText);
        return;
      }

      // The /filter-data endpoint returns {panels, total}
      const data = await response.json();
      const allPanels = data.panels || [];
      console.log(`📊 Fetched ${allPanels.length} panels (lightweight filter data) from database`);

      // Debug: Log sample panel data to see structure
      if (allPanels.length > 0) {
        console.log('🔍 Sample panel data:', {
          panel: allPanels[0],
          ifcType: allPanels[0].element?.ifcType,
          type: allPanels[0].type,
          objectType: allPanels[0].objectType
        });

        // Log all unique IFC types in the dataset
        const uniqueTypes = new Set<string>();
        allPanels.forEach((p: any) => {
          const ifcType = p.element?.ifcType || p.type || p.objectType || '';
          if (ifcType) uniqueTypes.add(ifcType);
        });
        console.log('📋 All unique IFC types in database:', Array.from(uniqueTypes));
      }

      // Filter panels by IFC type matching active filters
      const matchingPanels = allPanels.filter((panel: any) => {
        const ifcType = panel.element?.ifcType || panel.type || panel.objectType || '';
        console.log(`🔎 Checking panel "${panel.name || panel.tag}" - IFC Type: "${ifcType}"`);
        const matches = matchesElementFilter(ifcType);
        if (matches) {
          console.log(`✓ Matched panel: ${panel.name || panel.tag} - Type: ${ifcType}`);
        }
        return matches;
      });

      console.log(`📊 Found ${matchingPanels.length} panels matching filters`);

      if (matchingPanels.length === 0) {
        console.warn('⚠️ No panels found matching the selected filters');
        // Still dim all elements to show filter is active
        for (const [_, model] of models.entries()) {
          await model.resetHighlight(undefined);
          await model.highlight(undefined, {
            color: new THREE.Color(0xcccccc),
            opacity: 0.2,
            transparent: true,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          });
        }
        await fragments.update(true);
        return;
      }

      // Extract localIds from matching panels
      // metadata.ifcElementId contains the numeric localId from the IFC model
      const localIds: number[] = [];
      matchingPanels.forEach((panel: any) => {
        // Only use metadata.ifcElementId - this is the numeric localId from the model
        if (panel.metadata?.ifcElementId) {
          const id = typeof panel.metadata.ifcElementId === 'number'
            ? panel.metadata.ifcElementId
            : parseInt(panel.metadata.ifcElementId);

          if (!isNaN(id)) {
            localIds.push(id);
          } else {
            console.warn(`⚠️ Invalid ifcElementId for panel ${panel.id}:`, panel.metadata.ifcElementId);
          }
        } else {
          console.warn(`⚠️ Panel ${panel.id} missing metadata.ifcElementId, skipping`);
        }
      });

      console.log(`🔑 Extracted ${localIds.length} localIds from ${matchingPanels.length} matching panels`);

      if (localIds.length === 0) {
        console.error('❌ Could not parse any element IDs as numbers');
        return;
      }

      console.log(`🎯 Converted to ${localIds.length} local IDs for highlighting`);

      // Reset all highlights first (batch operation)
      const resetPromises = [];
      for (const [_, m] of models.entries()) {
        resetPromises.push(m.resetHighlight(undefined));
      }
      await Promise.all(resetPromises);

      // Make all elements semi-transparent (ghost mode) - batch operation
      const ghostPromises = [];
      for (const [_, m] of models.entries()) {
        ghostPromises.push(
          m.highlight(undefined, {
            color: new THREE.Color(0xcccccc),
            opacity: 0.2,
            transparent: true,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          })
        );
      }
      await Promise.all(ghostPromises);

      // Highlight matching elements with parent-child relationships
      // Process in batches to avoid memory issues with very large datasets
      const BATCH_SIZE = 1000; // Process 1000 elements at a time

      for (const [_, model] of models.entries()) {
        try {
          // Use all localIds for each model (robust against model ID mismatches)
          // We'll just skip IDs that aren't found in the spatial structure
          const targetLocalIds = localIds;

          if (targetLocalIds.length === 0) continue;

          let allIdsToHighlight: number[] = [];
          // Map each ID to its category (so children inherit parent's category)
          const idToCategoryMap = new Map<number, string>();

          try {
            const cacheKey = (model as any).modelId || (model as any).threads?.modelId || 'default';
            let spatialStructure = spatialStructureCache.get(cacheKey);
            if (!spatialStructure) {
              spatialStructure = await model.getSpatialStructure();
              spatialStructureCache.set(cacheKey, spatialStructure);
            }

            if (spatialStructure) {
              // For each panel ID, collect parent + children (in batches)
              for (let i = 0; i < targetLocalIds.length; i += BATCH_SIZE) {
                const batch = targetLocalIds.slice(i, i + BATCH_SIZE);

                for (const localId of batch) {
                  // Find the panel in matchingPanels to get its category
                  const panel = matchingPanels.find((p: any) => {
                    const panelLocalId = p.metadata?.ifcElementId;
                    const id = typeof panelLocalId === 'number' ? panelLocalId : parseInt(panelLocalId);
                    return id === localId;
                  });

                  let category = 'OTHER';
                  if (panel) {
                    const ifcType = panel.element?.ifcType || panel.type || panel.objectType || '';
                    category = getCategoryForType(ifcType) || 'OTHER';
                  }

                  // 1. First find the topmost parent panel (to handle assemblies)
                  const parentId = await findParentPanelId(model, localId);
                  const targetId = parentId || localId;

                  // 2. Then collect all children of that parent
                  const relatedIds = collectParentAndChildIds(spatialStructure, targetId);

                  if (relatedIds.length > 0) {
                    allIdsToHighlight.push(...relatedIds);
                    // Assign the parent's category to all collected IDs
                    relatedIds.forEach(id => idToCategoryMap.set(id, category));
                  } else {
                    // Only add if we actually found something or if it's a direct match in this model
                    // We can check if the ID exists in the model using findPathToLocalId or similar
                    // But for now, let's just add it. If it's not in the model, highlight() will ignore it.
                    allIdsToHighlight.push(targetId);
                    idToCategoryMap.set(targetId, category);
                  }
                }

                // Log progress for large datasets
                if (targetLocalIds.length > BATCH_SIZE) {
                  const progress = Math.min(100, Math.round(((i + batch.length) / targetLocalIds.length) * 100));
                  console.log(`📦 Processing elements: ${progress}% (${i + batch.length}/${targetLocalIds.length})`);

                  // Update loading progress
                  window.dispatchEvent(new CustomEvent('viewer-loading', {
                    detail: {
                      isLoading: true,
                      status: `Processing elements... ${progress}%`,
                      progress: progress
                    }
                  }));
                }
              }

              // Remove duplicates
              allIdsToHighlight = [...new Set(allIdsToHighlight)];
              console.log(`📦 Expanded ${targetLocalIds.length} panels to ${allIdsToHighlight.length} elements (with parent-child relationships)`);
            } else {
              allIdsToHighlight = targetLocalIds;
            }
          } catch (structureError) {
            console.error(`⚠️ Could not get spatial structure for model, using original IDs:`, structureError);
            allIdsToHighlight = targetLocalIds;
          }

          // Group elements by category for color-coded highlighting
          const elementsByCategory: Record<string, number[]> = {};

          // Group all IDs by their category using our tracked map
          for (const localId of allIdsToHighlight) {
            const category = idToCategoryMap.get(localId) || 'OTHER';

            if (!elementsByCategory[category]) {
              elementsByCategory[category] = [];
            }
            elementsByCategory[category].push(localId);
          }

          console.log('📊 Elements grouped by category:', Object.keys(elementsByCategory).map(cat => `${cat}: ${elementsByCategory[cat].length}`));

          // Highlight each category with its specific color
          for (const [category, categoryIds] of Object.entries(elementsByCategory)) {
            const color = getCategoryColor(category);
            console.log(`🎨 Highlighting ${categoryIds.length} ${category} elements with color:`, color);

            // Highlight in batches for better performance
            if (categoryIds.length > BATCH_SIZE) {
              console.log(`🎨 Highlighting ${categoryIds.length} ${category} elements in batches...`);
              for (let i = 0; i < categoryIds.length; i += BATCH_SIZE) {
                const batch = categoryIds.slice(i, i + BATCH_SIZE);
                await model.highlight(batch, {
                  color: color,
                  opacity: 1,
                  transparent: false,
                  renderedFaces: FRAGS.RenderedFaces.TWO,
                });

                // Update fragments periodically for visual feedback
                if (i % (BATCH_SIZE * 5) === 0) {
                  await fragments.update(true);
                }
              }
            } else {
              await model.highlight(categoryIds, {
                color: color,
                opacity: 1,
                transparent: false,
                renderedFaces: FRAGS.RenderedFaces.TWO,
              });
            }
          }

          console.log(`✅ Highlighted ${allIdsToHighlight.length} elements in model with category-specific colors`);
        } catch (error) {
          console.warn('⚠️ Could not highlight elements in this model:', error);
        }
      }

      await fragments.update(true);
      console.log('✅ Element filter applied successfully');
    } catch (error) {
      console.error('❌ Error applying element filter:', error);
    } finally {
      // Stop loading
      window.dispatchEvent(new CustomEvent('viewer-loading', {
        detail: { isLoading: false }
      }));

      // Re-enable all filter buttons
      const filterButtons = document.querySelectorAll('.filter-btn');
      const clearFiltersBtn = document.getElementById('filter-clear-btn');

      filterButtons.forEach(btn => btn.removeAttribute('disabled'));
      if (clearFiltersBtn) clearFiltersBtn.removeAttribute('disabled');
    }
  };

  // Wire up filter buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  console.log(`🔘 Found ${filterButtons.length} filter buttons`);

  filterButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const filterType = btn.getAttribute('data-filter');
      console.log(`🖱️ Filter button clicked: ${filterType}`);

      if (!filterType) return;

      // Toggle filter
      let title = 'Filtering Elements';
      let subtitle = 'Applying filters to 3D model...';
      if (activeElementFilters.has(filterType)) {
        activeElementFilters.delete(filterType);
        btn.classList.remove('active');
        title = 'Removing Filter';
        subtitle = 'Restoring view...';
        console.log(`➖ Removed filter: ${filterType}`);
      } else {
        activeElementFilters.add(filterType);
        btn.classList.add('active');
        console.log(`➕ Added filter: ${filterType}`);
      }

      console.log(`📋 Active filters:`, Array.from(activeElementFilters));

      // Apply filter
      await applyElementFilter(title, subtitle);
    });
  });

  // Wire up clear filters button
  const clearFiltersBtn = document.getElementById('filter-clear-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', async () => {
      console.log('🧹 Clearing all filters');

      // Remove active class from all filter buttons
      filterButtons.forEach(btn => {
        btn.classList.remove('active');
      });

      // Clear the active filters set
      activeElementFilters.clear();
      console.log('📋 Active filters cleared');

      // Reset highlights
      await applyElementFilter('Clearing Filters', 'Restoring original view...');
    });
  }

  console.log('🎉 That Open Engine viewer initialized successfully!');
  emitProgress(100, 'Ready');

  // Return viewer instance with 2D views support
  return {
    components,
    world,
    fragments,
    views2d,
    obcFragments
  };
}