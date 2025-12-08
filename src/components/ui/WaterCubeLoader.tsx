import * as THREE from 'three';

export class WaterCubeLoader {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private cube: THREE.Group;
    private liquidMesh: THREE.Mesh | null = null;
    private animationId: number | null = null;
    private startTime: number = Date.now();
    private progress: number = 0;

    // Water properties
    private fillLevel: number = 0;
    private targetFillLevel: number = 0;
    private fillSpeed: number = 0.05;

    // Bubbles
    private bubbles: THREE.Mesh[] = [];

    // Drops
    private drops: THREE.Mesh[] = [];

    // Caustics plane
    private causticsPlane: THREE.Mesh | null = null;

    constructor(container: HTMLElement) {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = null;

        // Create camera - adjusted for larger appearance
        this.camera = new THREE.PerspectiveCamera(
            28, // Reduced FOV to make cube appear larger
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(2.4, 2.0, 2.4); // Closer to cube
        this.camera.lookAt(0, 0, 0);

        // Create renderer with better settings
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        container.appendChild(this.renderer.domElement);

        // Create cube group
        this.cube = new THREE.Group();
        this.scene.add(this.cube);

        // Add enhanced lighting
        this.setupLighting();

        // Create the cube components
        this.createGlassCube();
        this.createLiquid();
        this.createBubbles();
        this.createDrops();
        this.createCaustics();

        // Start animation
        this.animate();

        // Handle resize
        window.addEventListener('resize', this.handleResize);
    }

    private setupLighting() {
        // Ambient light for base illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Main directional light (sun-like)
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(5, 8, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024;
        mainLight.shadow.mapSize.height = 1024;
        this.scene.add(mainLight);

        // Rim light for depth
        const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
        rimLight.position.set(-3, 2, -3);
        this.scene.add(rimLight);

        // Fill light from below (water reflection simulation)
        const fillLight = new THREE.PointLight(0x38bdf8, 0.8, 10);
        fillLight.position.set(0, -2, 0);
        this.scene.add(fillLight);

        // Hemisphere light for natural sky/ground lighting
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x64748b, 0.5);
        this.scene.add(hemiLight);
    }

    private createGlassCube() {
        const size = 1;
        const geometry = new THREE.BoxGeometry(size, size, size);

        // Create edges for wireframe effect with glow
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        this.cube.add(wireframe);

        // Enhanced glass material with better refraction
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.08,
            roughness: 0.05,
            metalness: 0,
            transmission: 0.95,
            thickness: 0.2,
            ior: 1.5, // Glass index of refraction
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            envMapIntensity: 1.5,
            side: THREE.DoubleSide,
        });
        const glassMesh = new THREE.Mesh(geometry, glassMaterial);
        glassMesh.castShadow = true;
        glassMesh.receiveShadow = true;
        this.cube.add(glassMesh);
    }

    private createLiquid() {
        const size = 0.96; // Slightly smaller than cube

        // Create liquid geometry with higher resolution for better waves
        const geometry = new THREE.BoxGeometry(size, size, size, 64, 64, 64);

        // Store original positions for wave animation
        const positions = geometry.attributes.position;
        const originalPositions = new Float32Array(positions.array);
        (geometry as any).userData.originalPositions = originalPositions;

        // Enhanced water material with realistic properties
        const waterMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x5b7a9e, // Deeper blue-grey water
            transparent: true,
            opacity: 0.75,
            roughness: 0.05,
            metalness: 0.05,
            transmission: 0.6,
            thickness: 0.8,
            ior: 1.333, // Water index of refraction
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            envMapIntensity: 2.0,
            side: THREE.DoubleSide,
            reflectivity: 1.0,
        });

        this.liquidMesh = new THREE.Mesh(geometry, waterMaterial);
        this.liquidMesh.position.y = -size / 2;
        this.liquidMesh.castShadow = true;
        this.liquidMesh.receiveShadow = true;
        this.cube.add(this.liquidMesh);
    }

    private createBubbles() {
        const bubbleGeometry = new THREE.SphereGeometry(0.02, 16, 16);

        for (let i = 0; i < 20; i++) {
            // Varied bubble sizes
            const scale = 0.5 + Math.random() * 1.5;
            const bubbleMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.4,
                roughness: 0,
                metalness: 0,
                transmission: 0.95,
                thickness: 0.1,
                ior: 1.0, // Air bubble in water
                clearcoat: 1.0,
                clearcoatRoughness: 0,
                envMapIntensity: 2.0,
            });

            const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
            bubble.scale.setScalar(scale);
            bubble.position.set(
                (Math.random() - 0.5) * 0.7,
                -0.5 + Math.random() * 0.1,
                (Math.random() - 0.5) * 0.7
            );
            (bubble as any).userData = {
                speed: 0.15 + Math.random() * 0.25,
                wobbleX: Math.random() * Math.PI * 2,
                wobbleZ: Math.random() * Math.PI * 2,
                wobbleSpeedX: 0.8 + Math.random() * 1.5,
                wobbleSpeedZ: 0.8 + Math.random() * 1.5,
                wobbleAmplitude: 0.003 + Math.random() * 0.005,
                baseScale: scale,
            };
            this.bubbles.push(bubble);
            this.cube.add(bubble);
        }
    }

    private createDrops() {
        const dropGeometry = new THREE.CylinderGeometry(0.012, 0.008, 0.1, 12);

        for (let i = 0; i < 5; i++) {
            const dropMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x94a3b8,
                transparent: true,
                opacity: 0.85,
                roughness: 0.1,
                metalness: 0,
                transmission: 0.7,
                thickness: 0.3,
                ior: 1.333,
                clearcoat: 1.0,
                clearcoatRoughness: 0.1,
            });

            const drop = new THREE.Mesh(dropGeometry, dropMaterial);
            drop.position.set(
                (Math.random() - 0.5) * 0.4,
                1.5 + Math.random() * 0.8,
                (Math.random() - 0.5) * 0.4
            );
            (drop as any).userData = {
                speed: 1.2 + Math.random() * 0.6,
                delay: i * 0.4,
                startY: drop.position.y,
                startX: drop.position.x,
                startZ: drop.position.z,
            };
            this.drops.push(drop);
            this.cube.add(drop);
        }
    }

    private createCaustics() {
        // Create a plane to show caustics effect
        const planeGeometry = new THREE.PlaneGeometry(1, 1);
        const causticsMaterial = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
        });

        this.causticsPlane = new THREE.Mesh(planeGeometry, causticsMaterial);
        this.causticsPlane.rotation.x = -Math.PI / 2;
        this.causticsPlane.position.y = -0.5;
        this.cube.add(this.causticsPlane);
    }

    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);

        const elapsed = (Date.now() - this.startTime) / 1000;

        // Smooth cube rotation with slight wobble
        this.cube.rotation.y = elapsed * 0.25;
        this.cube.rotation.x = -0.25 + Math.sin(elapsed * 0.4) * 0.08;
        this.cube.rotation.z = Math.sin(elapsed * 0.3) * 0.05;

        // Animate fill level smoothly towards target
        const diff = this.targetFillLevel - this.fillLevel;
        if (Math.abs(diff) > 0.001) {
            // Smooth easing towards target
            this.fillLevel += diff * this.fillSpeed;
        } else {
            // Snap to target when very close
            this.fillLevel = this.targetFillLevel;
        }

        // Update liquid mesh with advanced wave simulation
        if (this.liquidMesh) {
            const geometry = this.liquidMesh.geometry as THREE.BufferGeometry;
            const positions = geometry.attributes.position;
            const originalPositions = (geometry as any).userData.originalPositions;

            // Multi-layered wave simulation
            for (let i = 0; i < positions.count; i++) {
                const x = originalPositions[i * 3];
                const y = originalPositions[i * 3 + 1];
                const z = originalPositions[i * 3 + 2];

                // Only affect top surface vertices
                if (y > 0.35) {
                    // Primary wave (large, slow)
                    const wave1 = Math.sin(x * 6 + elapsed * 1.5) * 0.025;
                    const wave2 = Math.sin(z * 6 + elapsed * 1.2) * 0.025;

                    // Secondary wave (medium, faster)
                    const wave3 = Math.sin(x * 12 + z * 8 + elapsed * 2.5) * 0.015;

                    // Tertiary ripples (small, fast)
                    const wave4 = Math.sin(x * 20 + elapsed * 4) * 0.008;
                    const wave5 = Math.sin(z * 20 + elapsed * 3.5) * 0.008;

                    // Circular ripples from center
                    const dist = Math.sqrt(x * x + z * z);
                    const radialWave = Math.sin(dist * 15 - elapsed * 3) * 0.01;

                    const totalWave = wave1 + wave2 + wave3 + wave4 + wave5 + radialWave;
                    positions.setY(i, y + totalWave);
                } else {
                    positions.setY(i, y);
                }
            }
            positions.needsUpdate = true;
            geometry.computeVertexNormals(); // Update normals for proper lighting

            // Scale and position liquid
            this.liquidMesh.scale.y = this.fillLevel;
            this.liquidMesh.position.y = -0.5 + (this.fillLevel * 0.5);
        }

        // Animate bubbles with realistic physics
        this.bubbles.forEach((bubble) => {
            const userData = (bubble as any).userData;

            // Rise with acceleration (buoyancy)
            const acceleration = 1.0 + (bubble.position.y + 0.5) * 0.5;
            bubble.position.y += userData.speed * 0.016 * acceleration;

            // 3D wobble motion
            userData.wobbleX += userData.wobbleSpeedX * 0.016;
            userData.wobbleZ += userData.wobbleSpeedZ * 0.016;
            bubble.position.x += Math.sin(userData.wobbleX) * userData.wobbleAmplitude;
            bubble.position.z += Math.cos(userData.wobbleZ) * userData.wobbleAmplitude;

            // Reset when reaching top
            const waterLevel = -0.5 + (this.fillLevel * 0.5);
            if (bubble.position.y > waterLevel - 0.05) {
                bubble.position.y = -0.5 + Math.random() * 0.1;
                bubble.position.x = (Math.random() - 0.5) * 0.7;
                bubble.position.z = (Math.random() - 0.5) * 0.7;
                userData.wobbleX = Math.random() * Math.PI * 2;
                userData.wobbleZ = Math.random() * Math.PI * 2;
            }

            // Dynamic scale (compress as rising)
            const heightFactor = (bubble.position.y + 0.5) / 1.0;
            const scaleVariation = 1.0 + Math.sin(elapsed * 3 + bubble.position.y * 10) * 0.1;
            bubble.scale.setScalar(userData.baseScale * (0.7 + heightFactor * 0.3) * scaleVariation);
        });

        // Animate drops with realistic physics
        this.drops.forEach((drop) => {
            const userData = (drop as any).userData;

            if (elapsed > userData.delay) {
                // Gravity acceleration
                const fallTime = elapsed - userData.delay;
                drop.position.y -= userData.speed * 0.016 * (1 + fallTime * 0.5);

                // Slight horizontal drift
                drop.position.x += Math.sin(fallTime * 2) * 0.002;

                // Splash effect when hitting water
                const waterLevel = -0.5 + (this.fillLevel * 0.5);
                const distToWater = drop.position.y - waterLevel;

                if (distToWater < 0.15 && distToWater > -0.05) {
                    // Approaching water - stretch
                    const stretchFactor = Math.max(0.3, 1 - (0.15 - distToWater) * 5);
                    drop.scale.y = stretchFactor;
                    drop.scale.x = 1.2 - stretchFactor * 0.2;
                    drop.scale.z = 1.2 - stretchFactor * 0.2;
                } else if (distToWater <= -0.05) {
                    // Hit water - splash
                    drop.scale.y = 0.2;
                    drop.scale.x = 2.0;
                    drop.scale.z = 2.0;
                } else {
                    drop.scale.set(1, 1, 1);
                }

                // Reset when fully submerged
                if (drop.position.y < waterLevel - 0.2) {
                    drop.position.y = userData.startY;
                    drop.position.x = userData.startX + (Math.random() - 0.5) * 0.2;
                    drop.position.z = userData.startZ + (Math.random() - 0.5) * 0.2;
                    userData.delay = elapsed + Math.random() * 1.5;
                }
            }
        });

        // Animate caustics
        if (this.causticsPlane) {
            const causticsMaterial = this.causticsPlane.material as THREE.MeshBasicMaterial;
            causticsMaterial.opacity = 0.1 + Math.sin(elapsed * 2) * 0.05;
        }

        this.renderer.render(this.scene, this.camera);
    };

    private handleResize = () => {
        const container = this.renderer.domElement.parentElement;
        if (!container) return;

        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    };

    public setProgress(progress: number) {
        // Convert progress (0-100) to fill level (0-0.9)
        // Cap at 90% to leave room for wave animation
        this.targetFillLevel = Math.min(progress / 100, 0.9);
    }

    public dispose() {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
        }

        window.removeEventListener('resize', this.handleResize);

        // Dispose geometries and materials
        this.cube.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
