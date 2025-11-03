import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import Stats from "stats.js";
import * as FRAGS from "@thatopen/fragments";
import QRCode from 'qrcode';

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
    OBC.SimpleCamera,
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
  renderer.powerPreference = 'high-performance';
  renderer.precision = 'mediump'; // Use medium precision for better performance

world.camera = new OBC.SimpleCamera(components);
world.camera.controls.setLookAt(50, 30, 50, 0, 0, 0);

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

// Fetch project models from backend API
const fetchProjectModels = async (projectId: string) => {
  try {
    console.log(`📡 Fetching models for project ${projectId} from backend...`);
    
    // Get authentication token
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`http://localhost:4000/api/projects/${projectId}`, {
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
        status: projectData.currentModel.status
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
            status: model.status
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

      // Fetch model file from backend storage with authentication
      const fileUrl = `http://localhost:4000/api/models/${modelInfo.id}/download`;
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const file = await fetch(fileUrl, { headers });

      if (!file.ok) {
        throw new Error(`Failed to download model: ${file.statusText}`);
      }

      const buffer = await file.arrayBuffer();
      const model = await fragments.load(buffer, { modelId: modelInfo.id });

      models.set(modelInfo.name, model);
      console.log(`✅ Loaded: ${modelInfo.name}`);

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

// Build tree structure from spatial data (FULL TREE - no lazy loading)
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

      // Focus camera on the selected elements - calculate bounding box from selected IDs
      const selectedBbox = new THREE.Box3();

      // Calculate bounding box specifically for the selected elements (optimized)
      if (targetIds.length > 0) {
        model.object.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
            const bbox = new THREE.Box3().setFromObject(child);
            if (!bbox.isEmpty()) {
              selectedBbox.union(bbox);
            }
          }
        });
      }

      if (!selectedBbox.isEmpty()) {
        const center = new THREE.Vector3();
        selectedBbox.getCenter(center);
        const size = new THREE.Vector3();
        selectedBbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // Closer distance for tighter framing
        const distance = Math.max(maxDim * 1.2, 5);

        // Position camera at a 45-degree angle for better perspective
        const cameraPos = new THREE.Vector3(
          center.x + distance * 0.6,
          center.y + distance * 0.4,
          center.z + distance * 0.6
        );

        // Smooth animated transition
        world.camera.controls.setLookAt(
          cameraPos.x, cameraPos.y, cameraPos.z,
          center.x, center.y, center.z,
          true
        );
      }

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
        <div class="info-value">${nodeData.name}</div>
      </div>
      <div class="info-row">
        <div class="info-label">ID</div>
        <div class="info-value">${nodeData.localId}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Active Status</div>
        <div class="info-value">
          <select id="element-active-status" class="status-select">
            <option value="">No status assigned</option>
          </select>
        </div>
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
      <div>Loading tree structure...</div>
      <div style="font-size: 12px; margin-top: 10px; opacity: 0.7;">
        This may take 10-30 seconds for large models
      </div>
    </div>
  `;

  try {
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    // Process each model with timeout
    for (const [modelName, model] of models.entries()) {
      console.log(`📦 Processing model: ${modelName}`);
      
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

        // Model icon
        const icon = document.createElement("span");
        icon.className = "tree-icon";
        icon.textContent = "🏗️";
        modelNode.appendChild(icon);

        // Model name label
        const label = document.createElement("span");
        label.className = "tree-label";
        label.textContent = modelName;
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

// Map icon names to FontAwesome classes
const getIconClass = (iconName: string): string => {
  const iconMap: Record<string, string> = {
    'angle-double-down': 'fa-angles-down',
    'angle-double-left': 'fa-angles-left',
    'angle-double-right': 'fa-angles-right',
    'angle-double-up': 'fa-angles-up',
    'angle-down': 'fa-angle-down',
    'angle-left': 'fa-angle-left',
    'angle-right': 'fa-angle-right',
    'angle-up': 'fa-angle-up',
    'bell': 'fa-bell',
    'bookmark': 'fa-bookmark',
    'box': 'fa-box',
    'check': 'fa-check',
    'circle': 'fa-circle',
    'clock': 'fa-clock',
    'exclamation': 'fa-exclamation',
    'flag': 'fa-flag',
    'heart': 'fa-heart',
    'info': 'fa-info',
    'pause': 'fa-pause',
    'play': 'fa-play',
    'star': 'fa-star',
    'tag': 'fa-tag',
    'thumbs-down': 'fa-thumbs-down',
    'thumbs-up': 'fa-thumbs-up',
    'wrench': 'fa-wrench',
    'package': 'fa-box',
  };

  return iconMap[iconName.toLowerCase()] || 'fa-tag';
};

// Render status list (read-only)
const renderStatusList = () => {
  const statusListContent = document.getElementById("statusListContent");
  if (!statusListContent) return;

  if (elementStatuses.length === 0) {
    statusListContent.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-tags" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
        <p>No statuses found</p>
        <p style="font-size: 13px; margin-top: 8px;">Statuses are managed from the Project Dashboard</p>
      </div>
    `;
    return;
  }

  statusListContent.innerHTML = "";
  elementStatuses.forEach((status) => {
    const statusItem = document.createElement("div");
    statusItem.className = "status-item";
    statusItem.style.borderLeftColor = status.color;

    const iconClass = getIconClass(status.icon);
    const panelCount = status.panelCount || 0;

    statusItem.innerHTML = `
      <i class="fas ${iconClass} status-item-icon" style="color: ${status.color};"></i>
      <span class="status-item-name">${status.name}</span>
      <span class="status-item-count" style="font-size: 11px; color: var(--slate-500); margin-left: auto;">${panelCount} panel${panelCount !== 1 ? 's' : ''}</span>
    `;

    statusListContent.appendChild(statusItem);
  });
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

// API Configuration
const API_BASE_URL = 'http://localhost:4000/api';

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
  groups.forEach((group) => {
    const groupItem = document.createElement("div");
    groupItem.className = "group-item";

    const panelCount = group._count?.panelGroups || group._count?.panels || group.metadata?.panelCount || 0;
    const statusConfig = getGroupStatusDisplay(group.status);

    groupItem.innerHTML = `
      <div class="group-item-header">
        <span class="group-item-name">${group.name}</span>
        <span class="status-badge" style="background: ${statusConfig.bgColor}; color: ${statusConfig.color}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
          ${statusConfig.label}
        </span>
      </div>
      <div class="group-item-description">${group.description || "No description"}</div>
      <div class="group-item-members">
        <i class="fas fa-cube"></i>
        <span>${panelCount} panel${panelCount !== 1 ? "s" : ""}</span>
      </div>
    `;

    // Add click handler to highlight group panels
    groupItem.addEventListener("click", () => highlightGroupPanels(group));

    groupsListContent.appendChild(groupItem);
  });
};

// Highlight panels in a group and make others transparent
const highlightGroupPanels = async (group: DatabaseGroup) => {
  try {
    console.log(`Highlighting panels for group: ${group.name}`);

    // Get panel tags from the group (using tag as the identifier)
    const panelTags: string[] = [];

    // First try panelGroups (new structure)
    if (group.panelGroups && group.panelGroups.length > 0) {
      group.panelGroups.forEach(pg => {
        if (pg.panel && pg.panel.tag) {
          panelTags.push(pg.panel.tag.trim());
        }
      });
    }
    // Fallback to panels (old structure)
    else if (group.panels && group.panels.length > 0) {
      group.panels.forEach(panel => {
        if (panel.tag) {
          panelTags.push(panel.tag.trim());
        }
      });
    }

    if (panelTags.length === 0) {
      console.log("No panels found in this group");
      return;
    }

    console.log(`Found ${panelTags.length} panels in group:`, panelTags);

    // Find all tree nodes that match the panel tags
    const localIds: number[] = [];
    const treeContainer = document.getElementById("tree-container");

    if (treeContainer) {
      // Search through all tree nodes to find matching tags
      const allTreeNodes = treeContainer.querySelectorAll(".tree-node");
      allTreeNodes.forEach((node) => {
        const label = node.querySelector(".tree-label");
        if (label) {
          const nodeName = label.textContent?.trim() || "";
          // Check if this node's name matches any of the panel tags
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
      console.log("Could not find any matching elements in the tree");
      return;
    }

    console.log(`Found ${localIds.length} matching elements with IDs:`, localIds);

    // Reset all highlights first
    const highlightPromises = [];
    for (const [_, m] of models.entries()) {
      highlightPromises.push(m.resetHighlight(undefined));
    }
    await Promise.all(highlightPromises);
    highlightPromises.length = 0;

    // Make all elements semi-transparent (ghost mode)
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

    // Highlight the group's panels in all models
    for (const [_, model] of models.entries()) {
      try {
        await model.highlight(localIds, {
          color: new THREE.Color('gold'),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO,
        });
        console.log(`Highlighted ${localIds.length} panels in model`);
      } catch (error) {
        console.warn("Could not highlight panels in this model:", error);
      }
    }

    console.log("Group panels highlighted successfully");
  } catch (error) {
    console.error("Error highlighting group panels:", error);
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

  // Render groups
  renderElementGroups(connections);

  // Render status
  renderElementStatus(connections);

  // Update active status dropdown and submission count
  updateActiveStatusDropdown(connections);
  updateSubmissionCount(nodeData.localId);
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

  // Generate URL for the report page
  const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
  const reportUrl = `${baseUrl}element-report.html?id=${elementId}`;

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
  return { components, world, fragments };
}
