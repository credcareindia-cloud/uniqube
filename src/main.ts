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

const container = document.getElementById("container")!;
world.renderer = new OBC.SimpleRenderer(components, container);

world.camera = new OBC.SimpleCamera(components);
world.camera.controls.setLookAt(50, 30, 50, 0, 0, 0);

components.init();

const grids = components.get(OBC.Grids);
const grid = grids.create(world);
// Position grid at y = 0
grid.three.position.set(0, 0, 0);

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
world.camera.controls.addEventListener("rest", () => fragments.update(true));

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

// Load multiple models from outputFrag folder
const modelFiles = [
  { path: "../outputFrag/test.frag", name: "Test Model" },
  // { path: "../outputFrag/school_arq (1).frag", name: "School Architecture" },
  // Add more models here as needed
];

const models: Map<string, FRAGS.FragmentsModel> = new Map();
let allModelsLoaded = false;

const loadModels = async () => {
  console.log("=== LOADING MODELS ===");

  for (const modelFile of modelFiles) {
    try {
      const file = await fetch(modelFile.path);
      const buffer = await file.arrayBuffer();
      const model = await fragments.load(buffer, { modelId: modelFile.name });

      models.set(modelFile.name, model);
      console.log(`Loaded: ${modelFile.name}`);
    } catch (error) {
      console.warn(`Could not load ${modelFile.name}:`, error);
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

      // Position grid below all models
      const gridOffset = combinedBbox.min.y - 0.5;
      grid.three.position.y = gridOffset;
      console.log("Positioning grid at y:", gridOffset);

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

// Build tree structure from spatial data for a specific model - Show only floors and their direct children
const buildTreeStructureForModel = async (model: FRAGS.FragmentsModel, spatialData: any): Promise<TreeNodeData[]> => {
  const processNode = async (
    node: any,
    depth: number = 0,
    parentCategory: string | null = null
  ): Promise<TreeNodeData[]> => {
    try {
      const { localId, category, children } = node;

      // Check if this is a storey node
      const isStorey = category && category.toUpperCase().includes("STOREY");
      const isDirectStoreyChild = isStoreyChild(parentCategory);

      // If we're at depth 0 (searching for storeys) and this node contains storeys,
      // skip this node and process children
      if (depth === 0 && !isStorey && !isDirectStoreyChild && containsStoreys(node)) {
        const childResults: TreeNodeData[] = [];
        if (children && Array.isArray(children)) {
          for (const child of children) {
            const childNodes = await processNode(child, 0, category);
            childResults.push(...childNodes);
          }
        }
        return childResults;
      }

      // If no localId, just flatten and process children
      if (localId === null || localId === undefined) {
        const childResults: TreeNodeData[] = [];
        if (children && Array.isArray(children)) {
          // Determine next depth based on whether we're under a storey
          const nextDepth = isStorey ? 0 : (isDirectStoreyChild ? 1 : depth);

          // Don't go deeper than depth 1
          if (depth <= 1) {
            for (const child of children) {
              const childNodes = await processNode(child, nextDepth, category);
              childResults.push(...childNodes);
            }
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

      // Process children based on whether this is a direct storey child:
      // - If this is a direct child of IFCBUILDINGSTOREY (depth 0): process its children at depth 1
      // - At depth 1: DON'T process children (stop here)
      if (children && Array.isArray(children)) {
        if (isDirectStoreyChild && depth === 0) {
          // At storey child level - process direct children only (depth 1)
          for (const child of children) {
            const childNodes = await processNode(child, 1, category);
            treeNode.children.push(...childNodes);
          }
        }
        // At depth 1 - don't process children, stop here
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
      const processed = await processNode(rootNode, 0, null);
      rootNodes.push(...processed);
    }
  } else if (spatialData) {
    const processed = await processNode(spatialData, 0, null);
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
  node.dataset.localId = nodeData.localId.toString();
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
        ".tree-children-grid"
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

  // Click handler for parent node - triggers focus/highlight
  node.onclick = async (e) => {
    e.stopPropagation();

    try {
      // Update info panel
      updateInfoPanel(nodeData);

      // Get all IDs for this node and its children
      const targetIds = collectAllLocalIds(nodeData);
      console.log("Focusing on:", nodeData.name, "with", targetIds.length, "elements");

      // Reset highlights and visibility
      await model.resetHighlight(undefined);
      await model.setVisible(undefined, true);
      await fragments.update(true);

      // Highlight target elements in red
      if (targetIds.length > 0) {
        await model.highlight(targetIds, {
          color: new THREE.Color(0xff0000),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO,
        });
        await fragments.update(true);
      }

      // Focus camera
      const bbox = new THREE.Box3().setFromObject(model.object);
      if (!bbox.isEmpty()) {
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.5;

        const cameraPos = new THREE.Vector3(
          center.x + distance * 0.7,
          center.y + distance * 0.5,
          center.z + distance * 0.7
        );

        world.camera.controls.setLookAt(
          cameraPos.x, cameraPos.y, cameraPos.z,
          center.x, center.y, center.z,
          true
        );
      }

      await fragments.update(true);
    } catch (error) {
      console.error("Error in node click handler:", error);
    }
  };

  container.appendChild(node);
  treeNodeMap.set(nodeData.localId, node);

  // Render children in grid layout
  if (hasChildren) {
    const childrenGrid = document.createElement("div");
    childrenGrid.className = "tree-children-grid collapsed"; // Start collapsed

    for (const child of nodeData.children) {
      const childItem = document.createElement("div");
      childItem.className = "tree-child-item";
      childItem.textContent = child.name;
      childItem.dataset.localId = child.localId.toString();

      childItem.onclick = async (e) => {
        e.stopPropagation();

        // Update info panel
        updateInfoPanel(child);

        // Highlight single child element
        await model.resetHighlight(undefined);
        await model.setVisible(undefined, true);
        await model.highlight([child.localId], {
          color: new THREE.Color(0xff0000),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO,
        });
        await fragments.update(true);

        // Mark as selected
        document.querySelectorAll('.tree-child-item.selected').forEach(el => el.classList.remove('selected'));
        childItem.classList.add('selected');
      };

      childrenGrid.appendChild(childItem);
    }

    container.appendChild(childrenGrid);
  }

  parentElement.appendChild(container);
};

// Collect all local IDs from a node and its children
const collectAllLocalIds = (node: TreeNodeData): number[] => {
  const ids = [node.localId];
  for (const child of node.children) {
    ids.push(...collectAllLocalIds(child));
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

  treeContainer.innerHTML = '<div style="color: #aaa; padding: 20px; text-align: center;">Loading tree...</div>';

  try {
    treeContainer.innerHTML = "";

    // Process each model
    for (const [modelName, model] of models.entries()) {
      console.log(`Processing model: ${modelName}`);

      try {
        // Get spatial structure for this model
        const spatialData = await model.getSpatialStructure();
        console.log(`Spatial structure for ${modelName}:`, spatialData);

        if (!spatialData) {
          console.warn(`No spatial structure for ${modelName}`);
          continue;
        }

        // Build tree structure for this model
        const treeData = await buildTreeStructureForModel(model, spatialData);
        console.log(`Tree data for ${modelName}:`, treeData);

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

        // Render storeys for this model
        for (const storeyNode of treeData) {
          renderTreeNodeForModel(model, storeyNode, childrenContainer, 1);
        }

        modelContainer.appendChild(childrenContainer);
        treeContainer.appendChild(modelContainer);

      } catch (error) {
        console.error(`Error processing ${modelName}:`, error);
      }
    }

    console.log("=== TREE INITIALIZED FOR ALL MODELS ===");
  } catch (error) {
    console.error("Error initializing tree:", error);
    treeContainer.innerHTML = '<div style="color: #f55; padding: 20px; text-align: center;">Error loading tree. Check console for details.</div>';
  }
};

// Tree panel toggle functionality
const treePanel = document.getElementById("tree-panel");
const treeToggleBtn = document.getElementById("tree-toggle-btn");
const treeCloseBtn = document.getElementById("tree-close-btn");
const treeResetBtn = document.getElementById("tree-reset-btn");

if (treeToggleBtn && treePanel) {
  treeToggleBtn.addEventListener("click", () => {
    treePanel.classList.toggle("panel-hidden");
  });
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

// Initialize tree after model loads
await initializeObjectTree();

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
*/

const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());

console.log("=== Fragment Viewer Ready ===");
console.log("Model loaded successfully! Click elements to explore their data.");

/* MD
  ### 📊 Status Management System
  Manage custom statuses with icons and colors, stored in localStorage
*/

interface Status {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// Font Awesome icon list for the dropdown
const fontAwesomeIcons = [
  { name: "Angle Double Down", class: "fa-angles-down" },
  { name: "Angle Double Left", class: "fa-angles-left" },
  { name: "Angle Double Right", class: "fa-angles-right" },
  { name: "Angle Double Up", class: "fa-angles-up" },
  { name: "Angle Down", class: "fa-angle-down" },
  { name: "Angle Left", class: "fa-angle-left" },
  { name: "Angle Right", class: "fa-angle-right" },
  { name: "Angle Up", class: "fa-angle-up" },
  { name: "Check", class: "fa-check" },
  { name: "Check Circle", class: "fa-circle-check" },
  { name: "Times", class: "fa-times" },
  { name: "Times Circle", class: "fa-circle-xmark" },
  { name: "Exclamation", class: "fa-exclamation" },
  { name: "Exclamation Triangle", class: "fa-triangle-exclamation" },
  { name: "Info Circle", class: "fa-circle-info" },
  { name: "Question Circle", class: "fa-circle-question" },
  { name: "Star", class: "fa-star" },
  { name: "Heart", class: "fa-heart" },
  { name: "Flag", class: "fa-flag" },
  { name: "Bookmark", class: "fa-bookmark" },
  { name: "Tag", class: "fa-tag" },
  { name: "Tags", class: "fa-tags" },
  { name: "Thumbs Up", class: "fa-thumbs-up" },
  { name: "Thumbs Down", class: "fa-thumbs-down" },
  { name: "Play", class: "fa-play" },
  { name: "Pause", class: "fa-pause" },
  { name: "Stop", class: "fa-stop" },
  { name: "Clock", class: "fa-clock" },
  { name: "Calendar", class: "fa-calendar" },
  { name: "Wrench", class: "fa-wrench" },
  { name: "Cog", class: "fa-cog" },
  { name: "Hammer", class: "fa-hammer" },
  { name: "Screwdriver", class: "fa-screwdriver" },
  { name: "Hard Hat", class: "fa-hard-hat" },
  { name: "Truck", class: "fa-truck" },
  { name: "Box", class: "fa-box" },
  { name: "Archive", class: "fa-box-archive" },
];

// Status storage functions
const STORAGE_KEY = "bim-statuses";

const loadStatuses = (): Status[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading statuses:", error);
    return [];
  }
};

const saveStatuses = (statuses: Status[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  } catch (error) {
    console.error("Error saving statuses:", error);
  }
};

let statuses: Status[] = loadStatuses();
let selectedIcon: string = "";

// Render status list
const renderStatusList = () => {
  const statusListContent = document.getElementById("statusListContent");
  if (!statusListContent) return;

  if (statuses.length === 0) {
    statusListContent.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: rgba(255,255,255,0.4);">
        <i class="fas fa-tags" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
        <p>No statuses created yet</p>
        <p style="font-size: 13px; margin-top: 8px;">Click "Add New Status" to create one</p>
      </div>
    `;
    return;
  }

  statusListContent.innerHTML = "";
  statuses.forEach((status) => {
    const statusItem = document.createElement("div");
    statusItem.className = "status-item";
    statusItem.style.borderLeftColor = status.color;

    statusItem.innerHTML = `
      <i class="fas ${status.icon} status-item-icon" style="color: ${status.color};"></i>
      <span class="status-item-name">${status.name}</span>
      <button class="status-item-delete" data-id="${status.id}">
        <i class="fas fa-trash"></i>
      </button>
    `;

    statusListContent.appendChild(statusItem);
  });

  // Attach delete handlers
  statusListContent.querySelectorAll(".status-item-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      deleteStatus(id!);
    });
  });
};

// Render icon list
const renderIconList = (searchTerm: string = "") => {
  const iconList = document.getElementById("icon-list");
  if (!iconList) return;

  iconList.innerHTML = "";
  const filtered = fontAwesomeIcons.filter((icon) =>
    icon.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  filtered.forEach((icon) => {
    const option = document.createElement("div");
    option.className = "icon-option";
    option.innerHTML = `<i class="fas ${icon.class}"></i><span>${icon.name}</span>`;
    option.addEventListener("click", () => {
      selectedIcon = icon.class;
      const selectedIconDisplay = document.getElementById("selected-icon-display");
      if (selectedIconDisplay) {
        selectedIconDisplay.innerHTML = `<i class="fas ${icon.class}"></i> ${icon.name}`;
      }
      const iconDropdown = document.getElementById("icon-dropdown");
      if (iconDropdown) {
        iconDropdown.classList.remove("show");
      }
    });
    iconList.appendChild(option);
  });
};

// Delete status
const deleteStatus = (id: string) => {
  statuses = statuses.filter((s) => s.id !== id);
  saveStatuses(statuses);
  renderStatusList();
};

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

// Modal controls
const statusModal = document.getElementById("statusModal");
const addStatusBtn = document.getElementById("add-status-btn");
const modalCloseBtn = document.getElementById("modal-close-btn");
const cancelStatusBtn = document.getElementById("cancel-status-btn");
const createStatusBtn = document.getElementById("create-status-btn");
const iconSelectBtn = document.getElementById("icon-select-btn");
const iconDropdown = document.getElementById("icon-dropdown");
const iconSearchInput = document.getElementById("icon-search") as HTMLInputElement;
const statusNameInput = document.getElementById("status-name-input") as HTMLInputElement;
const statusColorInput = document.getElementById("status-color-input") as HTMLInputElement;
const statusColorText = document.getElementById("status-color-text") as HTMLInputElement;

// Open modal
if (addStatusBtn && statusModal) {
  addStatusBtn.addEventListener("click", () => {
    statusModal.classList.add("show");
    selectedIcon = "";
    if (statusNameInput) statusNameInput.value = "";
    if (statusColorInput) statusColorInput.value = "#3B82F6";
    if (statusColorText) statusColorText.value = "#3B82F6";
    const selectedIconDisplay = document.getElementById("selected-icon-display");
    if (selectedIconDisplay) selectedIconDisplay.textContent = "Select an icon";
    renderIconList();
  });
}

// Close modal
const closeModal = () => {
  if (statusModal) {
    statusModal.classList.remove("show");
  }
  if (iconDropdown) {
    iconDropdown.classList.remove("show");
  }
};

if (modalCloseBtn) {
  modalCloseBtn.addEventListener("click", closeModal);
}

if (cancelStatusBtn) {
  cancelStatusBtn.addEventListener("click", closeModal);
}

// Close modal on outside click
if (statusModal) {
  statusModal.addEventListener("click", (e) => {
    if (e.target === statusModal) {
      closeModal();
    }
  });
}

// Icon dropdown toggle
if (iconSelectBtn && iconDropdown) {
  iconSelectBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    iconDropdown.classList.toggle("show");
  });
}

// Icon search
if (iconSearchInput) {
  iconSearchInput.addEventListener("input", (e) => {
    const searchTerm = (e.target as HTMLInputElement).value;
    renderIconList(searchTerm);
  });
}

// Color picker sync
if (statusColorInput && statusColorText) {
  statusColorInput.addEventListener("input", (e) => {
    const color = (e.target as HTMLInputElement).value;
    statusColorText.value = color.toUpperCase();
  });
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (iconDropdown && !iconDropdown.contains(e.target as Node) && e.target !== iconSelectBtn) {
    iconDropdown.classList.remove("show");
  }
});

// Create status
if (createStatusBtn) {
  createStatusBtn.addEventListener("click", () => {
    const name = statusNameInput?.value.trim();
    const color = statusColorInput?.value;

    if (!name) {
      alert("Please enter a status name");
      return;
    }

    if (!selectedIcon) {
      alert("Please select an icon");
      return;
    }

    const newStatus: Status = {
      id: Date.now().toString(),
      name,
      icon: selectedIcon,
      color: color || "#3B82F6",
    };

    statuses.push(newStatus);
    saveStatuses(statuses);
    renderStatusList();
    closeModal();
  });
}

// Initialize status list
renderStatusList();

/* MD
  ### 👥 Groups Management System
  Manage groups with members from storey children, stored in localStorage
*/

interface GroupMember {
  localId: number;
  name: string;
  storeyName: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: GroupMember[];
}

// Groups storage functions
const GROUPS_STORAGE_KEY = "bim-groups";

const loadGroups = (): Group[] => {
  try {
    const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading groups:", error);
    return [];
  }
};

const saveGroups = (groups: Group[]): void => {
  try {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error("Error saving groups:", error);
  }
};

let groups: Group[] = loadGroups();
let currentGroup: Group | null = null;
let editingGroupId: string | null = null;
let selectedMembers: GroupMember[] = [];

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

// Render groups list
const renderGroupsList = () => {
  const groupsListContent = document.getElementById("groupsListContent");
  if (!groupsListContent) return;

  if (groups.length === 0) {
    groupsListContent.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: rgba(255,255,255,0.4);">
        <i class="fas fa-layer-group" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
        <p>No groups created yet</p>
        <p style="font-size: 13px; margin-top: 8px;">Click "Add New Group" to create one</p>
      </div>
    `;
    return;
  }

  groupsListContent.innerHTML = "";
  groups.forEach((group) => {
    const groupItem = document.createElement("div");
    groupItem.className = "group-item";

    groupItem.innerHTML = `
      <div class="group-item-header">
        <span class="group-item-name">${group.name}</span>
        <div class="group-item-actions">
          <button class="group-item-edit" data-id="${group.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="group-item-delete" data-id="${group.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="group-item-description">${group.description || "No description"}</div>
      <div class="group-item-members">
        <i class="fas fa-users"></i>
        <span>${group.members.length} member${group.members.length !== 1 ? "s" : ""}</span>
      </div>
    `;

    groupsListContent.appendChild(groupItem);
  });

  // Attach edit and delete handlers
  groupsListContent.querySelectorAll(".group-item-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      editGroup(id!);
    });
  });

  groupsListContent.querySelectorAll(".group-item-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      deleteGroup(id!);
    });
  });
};

// Delete group
const deleteGroup = (id: string) => {
  if (confirm("Are you sure you want to delete this group?")) {
    // Find the group to get its members
    const group = groups.find(g => g.id === id);

    // Remove element connections for all members of this group
    if (group) {
      group.members.forEach(member => {
        const conn = getElementConnections(member.localId);
        conn.groupIds = conn.groupIds.filter(gId => gId !== id);
      });
      saveConnections(elementConnections);
    }

    // Remove the group
    groups = groups.filter((g) => g.id !== id);
    saveGroups(groups);
    renderGroupsList();
  }
};

// Edit group
const editGroup = (id: string) => {
  const group = groups.find((g) => g.id === id);
  if (!group) return;

  editingGroupId = id;
  selectedMembers = [...group.members];

  const groupModal = document.getElementById("groupModal");
  const groupModalTitle = document.getElementById("groupModalTitle");
  const saveGroupText = document.getElementById("save-group-text");
  const groupNameInput = document.getElementById("group-name-input") as HTMLInputElement;
  const groupDescriptionInput = document.getElementById("group-description-input") as HTMLTextAreaElement;

  if (groupModalTitle) groupModalTitle.textContent = "Edit Group";
  if (saveGroupText) saveGroupText.textContent = "Update";
  if (groupNameInput) groupNameInput.value = group.name;
  if (groupDescriptionInput) groupDescriptionInput.value = group.description;

  updateSelectedMembersDisplay();
  if (groupModal) groupModal.classList.add("show");
};

// Render members list in Add Members modal
const renderMembersList = (searchTerm: string = "") => {
  const membersListContainer = document.getElementById("members-list-container");
  if (!membersListContainer) return;

  membersListContainer.innerHTML = "";
  const storeyChildren = collectAllStoreyChildren();

  if (storeyChildren.length === 0) {
    membersListContainer.innerHTML = `
      <div style="text-align: center; padding: 30px; color: rgba(255,255,255,0.5);">
        <p>No members available</p>
      </div>
    `;
    return;
  }

  storeyChildren.forEach(({ storeyName, children }) => {
    const storeySection = document.createElement("div");
    storeySection.className = "storey-section";

    const storeyHeader = document.createElement("div");
    storeyHeader.className = "storey-header";
    storeyHeader.innerHTML = `<i class="fas fa-building"></i><span>${storeyName}</span>`;
    storeySection.appendChild(storeyHeader);

    let visibleCount = 0;

    children.forEach((child) => {
      const isSelected = selectedMembers.some((m) => m.localId === child.localId);
      const matchesSearch = child.name.toLowerCase().includes(searchTerm.toLowerCase());

      if (matchesSearch) {
        visibleCount++;
        const memberItem = document.createElement("div");
        memberItem.className = "member-checkbox-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isSelected;
        checkbox.dataset.localId = child.localId.toString();
        checkbox.dataset.name = child.name;
        checkbox.dataset.storey = storeyName;

        const label = document.createElement("label");
        label.className = "member-checkbox-label";
        label.textContent = child.name;

        memberItem.appendChild(checkbox);
        memberItem.appendChild(label);

        // Toggle on click anywhere in the item
        memberItem.addEventListener("click", (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
          }
          handleMemberSelection(checkbox);
        });

        checkbox.addEventListener("change", () => {
          handleMemberSelection(checkbox);
        });

        storeySection.appendChild(memberItem);
      }
    });

    // Only add the storey section if it has visible members
    if (visibleCount > 0) {
      membersListContainer.appendChild(storeySection);
    }
  });

  updateSelectedCount();
};

// Handle member selection
const handleMemberSelection = (checkbox: HTMLInputElement) => {
  const localId = parseInt(checkbox.dataset.localId || "0");
  const name = checkbox.dataset.name || "";
  const storeyName = checkbox.dataset.storey || "";

  if (checkbox.checked) {
    // Add to selected members
    if (!selectedMembers.some((m) => m.localId === localId)) {
      selectedMembers.push({ localId, name, storeyName });
    }
  } else {
    // Remove from selected members
    selectedMembers = selectedMembers.filter((m) => m.localId !== localId);
  }

  updateSelectedCount();
};

// Update selected count display
const updateSelectedCount = () => {
  const selectedCount = document.getElementById("selected-count");
  if (selectedCount) {
    selectedCount.textContent = selectedMembers.length.toString();
  }
};

// Update selected members display in group modal
const updateSelectedMembersDisplay = () => {
  const selectedMembersDisplay = document.getElementById("selected-members-display");
  const memberCount = document.getElementById("member-count");

  if (memberCount) {
    memberCount.textContent = selectedMembers.length.toString();
  }

  if (!selectedMembersDisplay) return;

  if (selectedMembers.length === 0) {
    selectedMembersDisplay.innerHTML = `
      <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.4); font-size: 13px;">
        No members added yet
      </div>
    `;
    return;
  }

  selectedMembersDisplay.innerHTML = "";
  selectedMembers.forEach((member) => {
    const chip = document.createElement("div");
    chip.className = "selected-member-chip";
    chip.innerHTML = `
      <span>${member.name}</span>
      <button data-id="${member.localId}"><i class="fas fa-times"></i></button>
    `;

    const removeBtn = chip.querySelector("button");
    removeBtn?.addEventListener("click", () => {
      selectedMembers = selectedMembers.filter((m) => m.localId !== member.localId);
      updateSelectedMembersDisplay();
    });

    selectedMembersDisplay.appendChild(chip);
  });
};

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

// Group modal controls
const groupModal = document.getElementById("groupModal");
const addGroupBtn = document.getElementById("add-group-btn");
const groupModalCloseBtn = document.getElementById("group-modal-close-btn");
const cancelGroupBtn = document.getElementById("cancel-group-btn");
const saveGroupBtn = document.getElementById("save-group-btn");
const groupNameInput = document.getElementById("group-name-input") as HTMLInputElement;
const groupDescriptionInput = document.getElementById("group-description-input") as HTMLTextAreaElement;
const addMembersBtn = document.getElementById("add-members-btn");

// Members modal controls
const membersModal = document.getElementById("membersModal");
const membersModalCloseBtn = document.getElementById("members-modal-close-btn");
const cancelMembersBtn = document.getElementById("cancel-members-btn");
const doneMembersBtn = document.getElementById("done-members-btn");
const membersSearchInput = document.getElementById("members-search-input") as HTMLInputElement;

// Open group modal (Create new)
if (addGroupBtn && groupModal) {
  addGroupBtn.addEventListener("click", () => {
    editingGroupId = null;
    selectedMembers = [];

    const groupModalTitle = document.getElementById("groupModalTitle");
    const saveGroupText = document.getElementById("save-group-text");

    if (groupModalTitle) groupModalTitle.textContent = "Create New Group";
    if (saveGroupText) saveGroupText.textContent = "Create";
    if (groupNameInput) groupNameInput.value = "";
    if (groupDescriptionInput) groupDescriptionInput.value = "";

    updateSelectedMembersDisplay();
    groupModal.classList.add("show");
  });
}

// Close group modal
const closeGroupModal = () => {
  if (groupModal) {
    groupModal.classList.remove("show");
  }
};

if (groupModalCloseBtn) {
  groupModalCloseBtn.addEventListener("click", closeGroupModal);
}

if (cancelGroupBtn) {
  cancelGroupBtn.addEventListener("click", closeGroupModal);
}

if (groupModal) {
  groupModal.addEventListener("click", (e) => {
    if (e.target === groupModal) {
      closeGroupModal();
    }
  });
}

// Save group
if (saveGroupBtn) {
  saveGroupBtn.addEventListener("click", () => {
    const name = groupNameInput?.value.trim();
    const description = groupDescriptionInput?.value.trim();

    if (!name) {
      alert("Please enter a group name");
      return;
    }

    let groupId: string;

    if (editingGroupId) {
      // Update existing group
      groupId = editingGroupId;
      const groupIndex = groups.findIndex((g) => g.id === editingGroupId);
      if (groupIndex !== -1) {
        const oldMembers = groups[groupIndex].members;

        groups[groupIndex] = {
          ...groups[groupIndex],
          name,
          description,
          members: selectedMembers,
        };

        // Update element connections: remove old members, add new members
        // Remove connections for members no longer in the group
        oldMembers.forEach(oldMember => {
          if (!selectedMembers.some(m => m.localId === oldMember.localId)) {
            const conn = getElementConnections(oldMember.localId);
            conn.groupIds = conn.groupIds.filter(id => id !== groupId);
          }
        });

        // Add connections for new members
        selectedMembers.forEach(member => {
          if (!oldMembers.some(m => m.localId === member.localId)) {
            const conn = getElementConnections(member.localId);
            if (!conn.groupIds.includes(groupId)) {
              conn.groupIds.push(groupId);
            }
          }
        });
      }
    } else {
      // Create new group
      groupId = Date.now().toString();
      const newGroup: Group = {
        id: groupId,
        name,
        description,
        members: selectedMembers,
      };
      groups.push(newGroup);

      // Add element connections for all members
      selectedMembers.forEach(member => {
        const conn = getElementConnections(member.localId);
        if (!conn.groupIds.includes(groupId)) {
          conn.groupIds.push(groupId);
        }
      });
    }

    saveGroups(groups);
    saveConnections(elementConnections);
    renderGroupsList();
    closeGroupModal();
  });
}

// Open members modal
if (addMembersBtn && membersModal) {
  addMembersBtn.addEventListener("click", () => {
    renderMembersList();
    membersModal.classList.add("show");
  });
}

// Close members modal
const closeMembersModal = () => {
  if (membersModal) {
    membersModal.classList.remove("show");
  }
};

if (membersModalCloseBtn) {
  membersModalCloseBtn.addEventListener("click", closeMembersModal);
}

if (cancelMembersBtn) {
  cancelMembersBtn.addEventListener("click", closeMembersModal);
}

if (membersModal) {
  membersModal.addEventListener("click", (e) => {
    if (e.target === membersModal) {
      closeMembersModal();
    }
  });
}

// Done selecting members
if (doneMembersBtn) {
  doneMembersBtn.addEventListener("click", () => {
    updateSelectedMembersDisplay();
    closeMembersModal();
  });
}

// Members search
if (membersSearchInput) {
  membersSearchInput.addEventListener("input", (e) => {
    const searchTerm = (e.target as HTMLInputElement).value;
    renderMembersList(searchTerm);
  });
}

// Initialize groups list
renderGroupsList();

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

  const elementGroups = groups.filter(g => connections.groupIds.includes(g.id));

  if (elementGroups.length === 0) {
    const addBtn = document.createElement("button");
    addBtn.className = "add-element-btn";
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add to Group';
    addBtn.onclick = () => openSelectGroupsModal(connections.elementId);
    groupsList.appendChild(addBtn);
  } else {
    elementGroups.forEach(group => {
      const tag = document.createElement("div");
      tag.className = "element-group-tag";
      tag.innerHTML = `
        <div class="element-tag-content">
          <i class="fas fa-layer-group element-tag-icon"></i>
          <span>${group.name}</span>
        </div>
        <button class="element-tag-remove" data-group-id="${group.id}">
          <i class="fas fa-times"></i>
        </button>
      `;

      const removeBtn = tag.querySelector(".element-tag-remove");
      removeBtn?.addEventListener("click", () => {
        removeGroupFromElement(connections.elementId, group.id);
      });

      groupsList.appendChild(tag);
    });

    // Add button at the end
    const addBtn = document.createElement("button");
    addBtn.className = "add-element-btn";
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add to Another Group';
    addBtn.onclick = () => openSelectGroupsModal(connections.elementId);
    groupsList.appendChild(addBtn);
  }
};

// Render element status
const renderElementStatus = (connections: ElementConnections) => {
  const statusList = document.getElementById("element-status-list");
  if (!statusList) return;

  statusList.innerHTML = "";

  const elementStatuses = statuses.filter(s => connections.statusIds.includes(s.id));

  if (elementStatuses.length === 0) {
    const addBtn = document.createElement("button");
    addBtn.className = "add-element-btn";
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Assign Status';
    addBtn.onclick = () => openSelectStatusModal(connections.elementId);
    statusList.appendChild(addBtn);
  } else {
    elementStatuses.forEach(status => {
      const tag = document.createElement("div");
      tag.className = "element-status-tag";
      tag.style.borderLeftColor = status.color;
      tag.innerHTML = `
        <div class="element-tag-content">
          <i class="fas ${status.icon} element-tag-icon" style="color: ${status.color};"></i>
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
const removeGroupFromElement = (elementId: number, groupId: string) => {
  const connections = getElementConnections(elementId);
  connections.groupIds = connections.groupIds.filter(id => id !== groupId);

  // Also remove the element from the group's members list
  const group = groups.find(g => g.id === groupId);
  if (group) {
    group.members = group.members.filter(m => m.localId !== elementId);
    saveGroups(groups);
    renderGroupsList(); // Update groups UI in real-time
  }

  saveConnections(elementConnections);
  updateElementInfoPanel({ localId: elementId } as TreeNodeData);
};

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

// Select Groups Modal
const selectGroupsModal = document.getElementById("selectGroupsModal");
const selectGroupsModalCloseBtn = document.getElementById("select-groups-modal-close-btn");
const cancelSelectGroupsBtn = document.getElementById("cancel-select-groups-btn");
const doneSelectGroupsBtn = document.getElementById("done-select-groups-btn");
const selectGroupsList = document.getElementById("select-groups-list");

let tempSelectedGroupIds: string[] = [];

const openSelectGroupsModal = (elementId: number) => {
  if (!selectGroupsModal || !selectGroupsList) return;

  const connections = getElementConnections(elementId);
  tempSelectedGroupIds = [...connections.groupIds];

  // Render groups list
  selectGroupsList.innerHTML = "";

  if (groups.length === 0) {
    selectGroupsList.innerHTML = `
      <div class="empty-state">
        <p>No groups available</p>
        <p style="margin-top: 8px;">Create groups first to assign elements to them.</p>
      </div>
    `;
  } else {
    groups.forEach(group => {
      const item = document.createElement("div");
      item.className = "select-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = tempSelectedGroupIds.includes(group.id);
      checkbox.dataset.groupId = group.id;

      const content = document.createElement("div");
      content.className = "select-item-content";
      content.innerHTML = `
        <div class="select-item-name">${group.name}</div>
        <div class="select-item-desc">${group.members.length} member${group.members.length !== 1 ? "s" : ""}</div>
      `;

      const icon = document.createElement("i");
      icon.className = "fas fa-layer-group select-item-icon";

      item.appendChild(checkbox);
      item.appendChild(content);
      item.appendChild(icon);

      // Toggle checkbox on click
      item.onclick = (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        const groupId = checkbox.dataset.groupId!;
        if (checkbox.checked) {
          if (!tempSelectedGroupIds.includes(groupId)) {
            tempSelectedGroupIds.push(groupId);
          }
        } else {
          tempSelectedGroupIds = tempSelectedGroupIds.filter(id => id !== groupId);
        }
      };

      selectGroupsList.appendChild(item);
    });
  }

  selectGroupsModal.classList.add("show");
};

const closeSelectGroupsModal = () => {
  if (selectGroupsModal) {
    selectGroupsModal.classList.remove("show");
  }
};

if (selectGroupsModalCloseBtn) {
  selectGroupsModalCloseBtn.addEventListener("click", closeSelectGroupsModal);
}

if (cancelSelectGroupsBtn) {
  cancelSelectGroupsBtn.addEventListener("click", closeSelectGroupsModal);
}

if (selectGroupsModal) {
  selectGroupsModal.addEventListener("click", (e) => {
    if (e.target === selectGroupsModal) {
      closeSelectGroupsModal();
    }
  });
}

if (doneSelectGroupsBtn) {
  doneSelectGroupsBtn.addEventListener("click", () => {
    if (currentElementId !== null) {
      const connections = getElementConnections(currentElementId);
      const oldGroupIds = [...connections.groupIds];
      connections.groupIds = tempSelectedGroupIds;

      // Get element details from the tree
      const treeContainer = document.getElementById("tree-container");
      let elementName = "Unknown Element";
      let storeyName = "Unknown Storey";

      if (treeContainer) {
        // Find the element in the tree to get its name and storey
        const childItem = treeContainer.querySelector(`[data-local-id="${currentElementId}"]`);
        if (childItem) {
          elementName = childItem.textContent?.trim() || elementName;

          // Find parent storey
          const parentStoreyNode = childItem.closest(".tree-node-container")?.previousElementSibling;
          if (parentStoreyNode) {
            const storeyLabel = parentStoreyNode.querySelector(".tree-label");
            storeyName = storeyLabel?.textContent?.trim() || storeyName;
          }
        }
      }

      // Update group members: add this element to newly selected groups
      tempSelectedGroupIds.forEach(groupId => {
        if (!oldGroupIds.includes(groupId)) {
          // Element was added to this group
          const group = groups.find(g => g.id === groupId);
          if (group) {
            // Check if element is not already in the group
            if (!group.members.some(m => m.localId === currentElementId)) {
              group.members.push({
                localId: currentElementId,
                name: elementName,
                storeyName: storeyName
              });
            }
          }
        }
      });

      // Remove this element from groups that were unselected
      oldGroupIds.forEach(groupId => {
        if (!tempSelectedGroupIds.includes(groupId)) {
          // Element was removed from this group
          const group = groups.find(g => g.id === groupId);
          if (group) {
            group.members = group.members.filter(m => m.localId !== currentElementId);
          }
        }
      });

      saveConnections(elementConnections);
      saveGroups(groups);
      renderGroupsList(); // Update groups UI in real-time
      updateElementInfoPanel({ localId: currentElementId } as TreeNodeData);
    }
    closeSelectGroupsModal();
  });
}

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

  if (statuses.length === 0) {
    selectStatusList.innerHTML = `
      <div class="empty-state">
        <p>No statuses available</p>
        <p style="margin-top: 8px;">Create statuses first to assign them to elements.</p>
      </div>
    `;
  } else {
    statuses.forEach(status => {
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

      const icon = document.createElement("i");
      icon.className = `fas ${status.icon} select-item-icon`;
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
  console.log("All statuses:", statuses);

  activeStatusSelect.innerHTML = '<option value="">No status assigned</option>';

  const elementStatuses = statuses.filter(s => connections.statusIds.includes(s.id));
  console.log("Filtered element statuses:", elementStatuses);

  elementStatuses.forEach(status => {
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
    const status = statuses.find(s => s.id === sub.statusId);
    const timestamp = new Date(sub.timestamp).toLocaleString();

    const subItem = document.createElement("div");
    subItem.className = "submission-item";

    subItem.innerHTML = `
      <div class="submission-header">
        <div class="submission-status">
          <i class="fas ${status?.icon || 'fa-circle'}" style="color: ${status?.color || '#00e5ff'};"></i>
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

