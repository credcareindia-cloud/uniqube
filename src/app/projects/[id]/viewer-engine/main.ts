import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js";
import * as FRAGS from "@thatopen/fragments";
import QRCode from 'qrcode';
import { Views2DManager } from './views2d';

// API Configuration - must be defined before any functions that use it
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

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
    try { obcFragments.core.update(true); } catch {}
  });
  
  world.onCameraChanged.add((camera: any) => {
    try {
      for (const [, model] of (obcFragments as any).list || []) {
        try { model.useCamera(camera.three); } catch {}
      }
      obcFragments.core.update(true);
    } catch {}
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
    } catch {}
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

// Initialize 2D Views Manager
let views2d: Views2DManager | null = null;
try {
  views2d = new Views2DManager({
    components,
    world,
    fragments,
    obcFragments,
    models
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
      throw new Error(`Failed to fetch project: ${response.statusText}`);
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
    return [];
  }
};

const loadModels = async () => {
  console.log("=== LOADING MODELS ===");

  // Fetch models from database
  let projectModels = await fetchProjectModels(projectIdFromUrl);

  // Check if models exist in database
  if (projectModels.length === 0) {
    console.warn('⚠️  No models found in database for this project');
    console.log('📝 Please upload models via the Project Dashboard');
    allModelsLoaded = true;

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

  // Load models from database
  for (const modelInfo of projectModels) {
    try {
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

    } catch (error) {
      console.warn(`❌ Could not load ${modelInfo.name}:`, error);
    }
  }

  allModelsLoaded = true;
  console.log(`=== ALL MODELS LOADED: ${models.size} ===`);

  // Auto-fit camera and position grid after all models loaded
  setTimeout(() => {
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

await loadModels();

// Warm up 2D storey views in the background (non-blocking)
try {
  if (views2d) {
    // Don't await to keep initialization snappy
    views2d.createStoreyViews().catch((e: any) => {
      console.warn('⚠️ 2D storey warmup failed:', e);
    });
  }
} catch {}

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
  for (const [_, m] of models.entries()) {
    try {
      const boxes = await m.getBoxes([localId]);
      if (boxes && boxes.length > 0 && !boxes[0].isEmpty()) return m;
    } catch {
      // not in this model
    }
  }
  return null;
};

// Helper: select corresponding tree node and ensure it is visible
const selectTreeNodeByLocalId = (localId: number) => {
  const treeContainer = document.getElementById("tree-container");
  if (!treeContainer) return;
  const target = treeContainer.querySelector(`.tree-node.panel-node[data-local-id="${localId}"]`) as HTMLElement | null;
  if (!target) return;
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
  (target as HTMLElement).scrollIntoView({ block: 'nearest' });
  // Ensure tree panel is open
  const treePanel = document.getElementById('tree-panel');
  treePanel?.classList.remove('panel-hidden');
};

// Helper: select element by localId (highlight + camera + info panel)
const selectElementByLocalId = async (localId: number) => {
  try {
    // Determine which model contains this localId
    const model = await findModelForLocalId(localId);
    if (!model) {
      console.warn('No model found for localId', localId);
      return;
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

    // Parent + children IDs
    let idsToHighlight: number[] = [localId];
    try {
      const cacheKey = (model as any).modelId || (model as any).threads?.modelId || 'default';
      let spatialStructure = spatialStructureCache.get(cacheKey);
      if (!spatialStructure) {
        spatialStructure = await model.getSpatialStructure();
        spatialStructureCache.set(cacheKey, spatialStructure);
      }
      if (spatialStructure) {
        const related = collectParentAndChildIds(spatialStructure, localId);
        if (related.length > 0) idsToHighlight = related;
      }
    } catch (e) {
      console.warn('Could not compute parent/children for localId', localId, e);
    }

    // Highlight selected ids in gold in owning model
    await model.highlight(idsToHighlight, {
      color: new THREE.Color('gold'),
      opacity: 1,
      transparent: false,
      renderedFaces: FRAGS.RenderedFaces.TWO,
    });

    // Focus camera close to selection
    await focusCameraOnLocalIds(idsToHighlight, { closer: 0.9 });
    await fragments.update(true);

    // Info panel data (from DB cache if available) with hierarchy resolution
    let infoLocalId = localId;
    let panelData = localIdPanelMap.get(localId);
    if (!panelData) {
      const resolved = await resolvePanelByHierarchy(model, localId);
      if (resolved) {
        panelData = resolved.panelData;
        infoLocalId = resolved.mappedLocalId;
      }
    }

    let nodeData: any = { localId: infoLocalId, name: `Element ${infoLocalId}`, category: 'element', children: [] };
    if (panelData) {
      nodeData = {
        localId: infoLocalId,
        name: panelData.name || panelData.tag || 'Unnamed',
        type: panelData.type,
        tag: panelData.tag,
        id: panelData.id,
        elementId: panelData.elementId,
        metadata: panelData.metadata,
        category: 'element',
        children: [],
        panelData,
      };
    } else {
      try {
        const [itemData] = await model.getItemsData([infoLocalId], { attributesDefault: false, attributes: ["Name", "Tag", "ObjectType"] });
        nodeData.name = (itemData?.Name as any)?.value || (itemData?.Tag as any)?.value || (itemData?.ObjectType as any)?.value || `Element ${infoLocalId}`;
        nodeData.type = (itemData?.ObjectType as any)?.value || 'Unknown';
      } catch {}
    }
    // Open Info Panel and fill (use same logic as tree click)
    updateInfoPanel(nodeData);

    // Optionally open/select model structure on canvas selection
    if (SYNC_TREE_ON_SELECT || openTreeNextSelection) {
      selectTreeNodeByLocalId(infoLocalId);
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
            color: new THREE.Color('gold'), 
            opacity: 1,
            transparent: false,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          });
          console.log("Highlight applied to", targetIds.length, "elements");
        } catch (error) {
          console.error("Failed to highlight elements:", error);
        }
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
    }
  }

  // Update groups and status sections
  updateElementInfoPanel(nodeData);
};

// NEW: Fetch tree structure from database (optimized)
const fetchTreeStructureFromDatabase = async (projectId: string) => {
  try {
    console.log(`🗄️ Fetching tree structure from database for project ${projectId}...`);
    
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.time('⏱️ Fetch panels from API');
    console.log(`📡 Fetching from: ${API_BASE_URL}/panels/${projectId}/all`);
    console.log(`🔑 Auth token present: ${!!token}`);
    
    // Fetch ALL panels without pagination
    const response = await fetch(`${API_BASE_URL}/panels/${projectId}/all`, {
      method: 'GET',
      headers: headers,
    });
    
    console.timeEnd('⏱️ Fetch panels from API');
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.time('⏱️ Parse JSON response');
    const data = await response.json();
    console.timeEnd('⏱️ Parse JSON response');
    
    const panelCount = data.panels?.length || 0;
    console.log(`✅ Loaded ${panelCount} panels from database`);
    
    // WARNING: Log only if panel count is reasonable
    if (panelCount > 1000) {
      console.warn(`⚠️ Large dataset detected: ${panelCount} panels. This may cause performance issues.`);
    } else if (panelCount > 0) {
      console.log(`📦 Sample panel:`, data.panels?.[0]);
    }
    
    console.time('⏱️ Organize panels by model and storey');
    
    // First organize panels by model, then by storey
    const modelMap = new Map<string, Map<string, any[]>>();
    
    if (data.panels && Array.isArray(data.panels)) {
      // Process in batches to avoid blocking the main thread
      const batchSize = 100;
      let processedCount = 0;
      
      for (let i = 0; i < data.panels.length; i += batchSize) {
        const batch = data.panels.slice(i, i + batchSize);
        
        batch.forEach((panel: any) => {
          const modelId = panel.modelId || 'unknown';
          const modelName = panel.model?.originalFilename || 'Unknown Model';
          const storeyName = panel.metadata?.storeyName || 'Unknown Storey';
          
          // Get or create model map
          if (!modelMap.has(modelId)) {
            modelMap.set(modelId, new Map<string, any[]>());
          }
          const storeyMap = modelMap.get(modelId)!;
          
          // Get or create storey array within model
          if (!storeyMap.has(storeyName)) {
            storeyMap.set(storeyName, []);
          }
          
          // Simplified panel object - only include essential data
          const panelObj = {
            id: panel.id,
            name: panel.name,
            tag: panel.tag,
            type: panel.objectType || panel.metadata?.elementType || 'Unknown',
            localId: panel.metadata?.ifcElementId ? parseInt(panel.metadata.ifcElementId) : null,
            elementId: panel.elementId,
            metadata: panel.metadata,
            modelId: modelId,
            modelName: modelName,
            // Include full groups and statuses data for element info panel
            groups: panel.groups || [],
            statuses: panel.statuses || [],
          };
          
          storeyMap.get(storeyName)!.push(panelObj);
          
          // Cache the panel data for quick lookup
          panelDataCache.set(panel.id, panelObj);
          if (panelObj.localId !== null && panelObj.localId !== undefined) {
            localIdPanelMap.set(panelObj.localId as number, panelObj);
          }
        });
        
        processedCount += batch.length;
        
        // Log progress for large datasets
        if (data.panels.length > 500 && processedCount % 500 === 0) {
          console.log(`📊 Processed ${processedCount}/${data.panels.length} panels...`);
        }
        
        // Allow UI to breathe between batches
        if (i + batchSize < data.panels.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
    
    console.timeEnd('⏱️ Organize panels by model and storey');
    
    console.time('⏱️ Convert to tree structure');
    // Convert to model-based tree structure
    const treeStructure = Array.from(modelMap.entries()).map(([modelId, storeyMap]) => {
      const storeys = Array.from(storeyMap.entries()).map(([storeyName, panels]) => ({
        name: storeyName,
        type: 'IfcBuildingStorey',
        elementCount: panels.length,
        children: panels,
      }));
      
      // Get model info from first panel
      const firstPanel = storeys[0]?.children[0];
      const modelName = firstPanel?.modelName || 'Unknown Model';
      
      return {
        modelId: modelId,
        modelName: modelName,
        storeys: storeys,
        totalPanels: storeys.reduce((sum, storey) => sum + storey.elementCount, 0)
      };
    });
    console.timeEnd('⏱️ Convert to tree structure');
    
    console.log(`✅ Organized into ${treeStructure.length} models`);
    console.log(`📊 Model breakdown:`, treeStructure.map(m => `${m.modelName}: ${m.totalPanels} panels in ${m.storeys.length} storeys`));
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

          // Model icon
          const icon = document.createElement("span");
          icon.className = "tree-icon";
          icon.textContent = "🏗️";
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
            renderDatabaseStoreyNode(storey, childrenContainer);
          });

          modelContainer.appendChild(childrenContainer);
          fragment.appendChild(modelContainer);
        }
        
        treeContainer.innerHTML = "";
        treeContainer.appendChild(fragment);
        
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
const renderDatabaseStoreyNode = (storey: any, container: HTMLElement) => {
  const storeyContainer = document.createElement("div");
  storeyContainer.className = "tree-node-container";

  const storeyNode = document.createElement("div");
  storeyNode.className = "tree-node storey-node";
  storeyNode.style.paddingLeft = "30px";

  // Toggle icon
  const toggleIcon = document.createElement("span");
  toggleIcon.className = "tree-toggle-icon";
  toggleIcon.textContent = "▶";
  toggleIcon.onclick = (e) => {
    e.stopPropagation();
    const childrenContainer = storeyContainer.querySelector(".storey-children") as HTMLElement;
    if (childrenContainer) {
      const isCollapsed = childrenContainer.classList.contains("collapsed");
      childrenContainer.classList.toggle("collapsed", !isCollapsed);
      toggleIcon.classList.toggle("expanded", isCollapsed);
    }
  };
  storeyNode.appendChild(toggleIcon);

  // Storey icon
  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.textContent = "🏢";
  storeyNode.appendChild(icon);

  // Storey name
  const label = document.createElement("span");
  label.className = "tree-label";
  label.textContent = storey.name;
  storeyNode.appendChild(label);

  // Count badge
  const count = document.createElement("span");
  count.className = "tree-count";
  count.textContent = storey.children?.length.toString() || "0";
  storeyNode.appendChild(count);

  // 2D pill button
  // const pill2D = document.createElement("button");
  // pill2D.textContent = "2D";
  // pill2D.title = "Open 2D plan";
  // pill2D.className = "pill-2d-btn";
  // // Minimal inline styles to make it visible if CSS isn't available
  // (pill2D as HTMLElement).style.marginLeft = "8px";
  // (pill2D as HTMLElement).style.padding = "2px 8px";
  // (pill2D as HTMLElement).style.fontSize = "12px";
  // (pill2D as HTMLElement).style.borderRadius = "12px";
  // (pill2D as HTMLElement).style.border = "1px solid var(--slate-200)";
  // (pill2D as HTMLElement).style.background = "var(--slate-50)";
  // (pill2D as HTMLElement).style.cursor = "pointer";
  // pill2D.onclick = async (e) => {
  //   e.stopPropagation();
  //   try {
  //     if (views2d) {
  //       await views2d.openStoreyView(storey.name);
  //     } else {
  //       console.warn('2D views manager not ready');
  //     }
  //   } catch (err) {
  //     console.warn('Failed to open 2D view for storey', storey.name, err);
  //   }
  // };
  // storeyNode.appendChild(pill2D);

  storeyContainer.appendChild(storeyNode);

  // Children container
  const childrenContainer = document.createElement("div");
  childrenContainer.className = "storey-children collapsed";

  // Render panels
  if (storey.children && Array.isArray(storey.children)) {
    storey.children.forEach((panel: any) => {
      renderDatabasePanelNode(panel, childrenContainer);
    });
  }

  storeyContainer.appendChild(childrenContainer);
  container.appendChild(storeyContainer);
};

// Helper function to render database panel nodes
const renderDatabasePanelNode = (panel: any, container: HTMLElement) => {
  const panelNode = document.createElement("div");
  panelNode.className = "tree-node panel-node";
  panelNode.style.paddingLeft = "50px";
  
  if (panel.localId) {
    panelNode.dataset.localId = panel.localId.toString();
  }

  // Panel icon
  const icon = document.createElement("span");
  icon.className = "tree-icon";
  icon.textContent = "📦";
  panelNode.appendChild(icon);

  // Panel name
  const label = document.createElement("span");
  label.className = "tree-label";
  label.textContent = panel.name || panel.tag || "Unnamed Panel";
  panelNode.appendChild(label);

  // Type badge
  const typeBadge = document.createElement("span");
  typeBadge.className = "tree-type-badge";
  typeBadge.textContent = panel.type.replace('Ifc', '');
  typeBadge.style.cssText = "font-size: 10px; color: #64748b; margin-left: 8px;";
  panelNode.appendChild(typeBadge);

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
        try {
          // Get all related IDs (parent + children) for highlighting
          let idsToHighlight: number[] = [panel.localId];
          
          try {
            // Get the spatial structure from the correct model
            const spatialStructure = await targetModel.getSpatialStructure();
            
            if (spatialStructure) {
              // Collect parent + all children IDs
              const relatedIds = collectParentAndChildIds(spatialStructure, panel.localId);
              
              if (relatedIds.length > 0) {
                idsToHighlight = relatedIds;
                console.log(`📦 Found ${relatedIds.length} related elements (parent + children) for highlighting`);
              } else {
                console.log(`⚠️ No related elements found, using localId only`);
              }
            }
          } catch (structureError) {
            console.log(`⚠️ Could not get spatial structure, using localId only:`, structureError);
          }
          
          // Highlight ALL collected IDs (parent + children)
          await targetModel.highlight(idsToHighlight, {
            color: new THREE.Color('gold'),
            opacity: 1,
            transparent: false,
            renderedFaces: FRAGS.RenderedFaces.TWO,
          });
          
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
        const icon = document.createElement("span");
        icon.className = "tree-icon";
        
        // Get category-specific icon
        const category = modelData?.category || 'OTHER';
        switch (category) {
          case 'STRUCTURE':
            icon.textContent = "🏢";
            break;
          case 'MEP':
            icon.textContent = "🔧";
            break;
          case 'ELECTRICAL':
            icon.textContent = "⚡";
            break;
          default:
            icon.textContent = "🏗️";
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
      console.log('🖱️ Selection tool enabled');
      selectionHandler = async (ev: MouseEvent) => {
        // Always compute based on renderer canvas
        const canvas = (world.renderer?.three as any)?.domElement as HTMLCanvasElement | undefined;
        if (!canvas) {
          console.warn('No renderer canvas found for picking');
          return;
        }
        if (ev.type !== 'click') return; // ensure click only
        console.log('🖱️ Click for selection at', ev.clientX, ev.clientY);
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
      if (canvas) canvas.addEventListener('click', selectionHandler);
    } else {
      const canvas = (world.renderer?.three as any)?.domElement as HTMLCanvasElement | undefined;
      if (selectionHandler && canvas) canvas.removeEventListener('click', selectionHandler);
      selectionHandler = null;
      console.log('🛑 Selection tool disabled');
    }
  });
}

// Reset button - clears all highlights and shows everything normally
if (treeResetBtn) {
  treeResetBtn.addEventListener("click", async () => {
    try {
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
    groupItem.dataset.groupId = group.id;

    const panelCount = group._count?.panelGroups || group._count?.panels || group.metadata?.panelCount || 0;
    const statusConfig = getGroupStatusDisplay(group.status);

    // Get panels from the group
    const panels = group.panelGroups?.map(pg => pg.panel) || group.panels || [];

    groupItem.innerHTML = `
      <div class="group-item-header">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; cursor: pointer;" class="group-header-main">
          <i class="fas fa-chevron-right group-chevron" style="font-size: 12px; transition: transform 0.2s; color: var(--slate-400);"></i>
          <span class="group-item-name">${group.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="group-highlight-btn" title="Highlight all panels in group" style="background: none; border: none; cursor: pointer; padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
            <i class="fas fa-eye" style="font-size: 14px; color: var(--primary);"></i>
          </button>
          <span class="status-badge" style="background: ${statusConfig.bgColor}; color: ${statusConfig.color}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
            ${statusConfig.label}
          </span>
        </div>
      </div>
      <div class="group-item-description">${group.description || "No description"}</div>
      <div class="group-item-members">
        <i class="fas fa-cube"></i>
        <span>${panelCount} panel${panelCount !== 1 ? "s" : ""}</span>
      </div>
      <div class="group-panels-container" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--slate-200);">
        <div class="group-panels-grid">
          ${panels.length > 0 ? panels.map(panel => `
            <div class="group-panel-item" data-panel-id="${panel.id}">
              <i class="fas fa-cube" style="font-size: 14px; color: var(--primary);"></i>
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
};

// Highlight panels in a group and make others transparent
const highlightGroupPanels = async (group: DatabaseGroup) => {
  try {
    console.log(`Highlighting panels for group: ${group.name}`);

    // Get panel element IDs from the group (using elementId as the unique identifier)
    const panelElementIds: string[] = [];
    const panelIds: string[] = [];

    // First try panelGroups (new structure)
    if (group.panelGroups && group.panelGroups.length > 0) {
      group.panelGroups.forEach(pg => {
        if (pg.panel) {
          panelIds.push(pg.panel.id);
          
          // Priority 1: Use metadata.ifcElementId (real IFC element ID from model)
          if ((pg.panel as any).metadata?.ifcElementId) {
            panelElementIds.push((pg.panel as any).metadata.ifcElementId);
          }
          // Priority 2: Use element.globalId from database relation
          else if (pg.panel.element && pg.panel.element.globalId) {
            panelElementIds.push(pg.panel.element.globalId);
          }
          // Priority 3: Use elementId field if available
          else if ((pg.panel as any).elementId) {
            panelElementIds.push((pg.panel as any).elementId);
          }
        }
      });
    }
    // Fallback to panels (old structure)
    else if (group.panels && group.panels.length > 0) {
      group.panels.forEach(panel => {
        panelIds.push(panel.id);
        
        // Priority 1: Use metadata.ifcElementId
        if ((panel as any).metadata?.ifcElementId) {
          panelElementIds.push((panel as any).metadata.ifcElementId);
        }
        // Priority 2: Use element.globalId
        else if (panel.element && panel.element.globalId) {
          panelElementIds.push(panel.element.globalId);
        }
        // Priority 3: Use elementId field
        else if ((panel as any).elementId) {
          panelElementIds.push((panel as any).elementId);
        }
      });
    }

    if (panelElementIds.length === 0) {
      console.log("No element IDs found in this group, falling back to panel tags");
      // Fallback to tag-based matching if no element IDs available
      return highlightGroupPanelsByTag(group);
    }

    console.log(`Found ${panelElementIds.length} element IDs in group:`, panelElementIds);

    // Convert IFC element IDs to numbers for matching with localId
    const localIds: number[] = [];
    
    panelElementIds.forEach(elementId => {
      // IFC element IDs are stored as strings but represent the localId (numeric)
      const numericId = parseInt(elementId);
      if (!isNaN(numericId)) {
        localIds.push(numericId);
      }
    });

    if (localIds.length === 0) {
      console.log("Could not parse element IDs as numbers, falling back to tag matching");
      return highlightGroupPanelsByTag(group);
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
              const relatedIds = collectParentAndChildIds(spatialStructure, localId);
              if (relatedIds.length > 0) {
                allIdsToHighlight.push(...relatedIds);
              } else {
                allIdsToHighlight.push(localId);
              }
            }
            
            // Remove duplicates
            allIdsToHighlight = [...new Set(allIdsToHighlight)];
            console.log(`📦 Expanded ${localIds.length} panels to ${allIdsToHighlight.length} elements (with parent-child relationships)`);
          } else {
            allIdsToHighlight = localIds;
          }
        } catch (structureError) {
          console.log(`⚠️ Could not get spatial structure, using original IDs`);
          allIdsToHighlight = localIds;
        }
        
        await model.highlight(allIdsToHighlight, {
          color: new THREE.Color('gold'),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO,
        });
        console.log(`Highlighted ${allIdsToHighlight.length} elements in model`);
      } catch (error) {
        console.warn("Could not highlight panels in this model:", error);
      }
    }
    
    // Show the whole model at a good angle (not too close)
    // await focusCameraOnWholeModel({ closer: 1.3 });
    
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
    const panelElementIds: string[] = [];
    const panelIds: string[] = [];

    // Extract panel data from panelStatuses
    if (status.panelStatuses && status.panelStatuses.length > 0) {
      status.panelStatuses.forEach((ps: any) => {
        if (ps.panel) {
          panelIds.push(ps.panel.id);
          
          // Priority 1: Use metadata.ifcElementId (real IFC element ID from model)
          if (ps.panel.metadata?.ifcElementId) {
            panelElementIds.push(ps.panel.metadata.ifcElementId);
          }
          // Priority 2: Use element.globalId from database relation
          else if (ps.panel.element && ps.panel.element.globalId) {
            panelElementIds.push(ps.panel.element.globalId);
          }
          // Priority 3: Use elementId field if available
          else if (ps.panel.elementId) {
            panelElementIds.push(ps.panel.elementId);
          }
        }
      });
    }

    if (panelElementIds.length === 0) {
      console.log("No element IDs found in this status, falling back to panel tags");
      return highlightStatusPanelsByTag(status);
    }

    console.log(`Found ${panelElementIds.length} element IDs in status:`, panelElementIds);

    // Convert IFC element IDs to numbers for matching with localId
    const localIds: number[] = [];
    
    panelElementIds.forEach(elementId => {
      const numericId = parseInt(elementId);
      if (!isNaN(numericId)) {
        localIds.push(numericId);
      }
    });

    if (localIds.length === 0) {
      console.log("Could not parse element IDs as numbers, falling back to tag matching");
      return highlightStatusPanelsByTag(status);
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
            console.log(`📦 Expanded ${localIds.length} panels to ${allIdsToHighlight.length} elements (with parent-child relationships)`);
          } else {
            allIdsToHighlight = localIds;
          }
        } catch (structureError) {
          console.log(`⚠️ Could not get spatial structure, using original IDs`);
          allIdsToHighlight = localIds;
        }
        
        await model.highlight(allIdsToHighlight, {
          color: statusColor,
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO,
        });
        console.log(`Highlighted ${allIdsToHighlight.length} elements in model`);
      } catch (error) {
        console.warn("Could not highlight panels in this model:", error);
      }
    }

    // Show the whole model at a good angle (not too close)
    // await focusCameraOnWholeModel({ closer: 1.3 });
    
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

    // Highlight the group's panels
    for (const [_, model] of models.entries()) {
      try {
        await model.highlight(localIds, {
          color: new THREE.Color('gold'),
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
const updateElementInfoPanel = (nodeData: TreeNodeData) => {
  currentElementId = nodeData.localId;
  const connections = getElementConnections(nodeData.localId);

  // Update basic info
  const infoPanel = document.getElementById("infoPanel");
  const groupsList = document.getElementById("element-groups-list");
  const statusList = document.getElementById("element-status-list");

  if (!groupsList || !statusList) return;

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

// Update submission count badge
const updateSubmissionCount = (elementId: number) => {
  const submissionCountEl = document.getElementById("submission-count");
  if (!submissionCountEl) return;

  const count = elementSubmissions.filter(s => s.elementId === elementId).length;
  submissionCountEl.textContent = count.toString();

  if (count > 0) {
    submissionCountEl.style.display = "block";
  } else {
    submissionCountEl.style.display = "none";
  }
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

  // Generate URL for the new React report page (inside projects route)
  const baseUrl = window.location.origin;
  const reportUrl = `${baseUrl}/projects/${projectId}/element-report/${elementId}`;
  
  console.log('🔲 Generating QR code for:', reportUrl);

  try {
    await QRCode.toCanvas(qrCanvas, reportUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    qrModal.classList.add("show");
  } catch (error) {
    console.error("Error generating QR code:", error);
    alert("Failed to generate QR code");
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

const showSubmissionsModal = (elementId: number) => {
  if (!submissionsModal) return;

  // Reload submissions from localStorage
  elementSubmissions = loadSubmissions();

  renderSubmissions(elementId);
  submissionsModal.classList.add("show");
};

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
    fetchGroupsFromDatabase(projectIdFromUrl);
    fetchStatusesFromDatabase(projectIdFromUrl);
  }

  console.log('🎉 That Open Engine viewer initialized successfully!');
  
  // Return viewer instance with 2D views support
  return { 
    components, 
    world, 
    fragments, 
    views2d,
    obcFragments
  };
}
