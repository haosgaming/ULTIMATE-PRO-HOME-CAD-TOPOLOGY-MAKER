import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  TopologyProject,
  FurnitureItem,
  InWallConduit,
  SignalSimParams,
} from '../types/topology.ts';
import { RFDevice, WallSegment, calculateSignalAtPoint } from '../utils/rf-engine.ts';
import {
  Layers,
  Eye,
  Box,
  Radio,
  Plus,
  Move,
  Maximize2,
  Minimize2,
  Trash2,
  Sliders,
  RotateCw,
} from 'lucide-react';

interface Scene3DProps {
  project: TopologyProject;
  simParams: SignalSimParams;
  onUpdateProject: (updated: TopologyProject) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string | null, type?: 'device' | 'wall' | 'furniture' | 'conduit') => void;
  onCaptureImageUri?: (dataUri: string) => void;
  theme?: 'dark' | 'light';
}

export const Scene3D: React.FC<Scene3DProps> = ({
  project,
  simParams,
  onUpdateProject,
  selectedItemId,
  onSelectItem,
  onCaptureImageUri,
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsGroupRef = useRef<THREE.Group | null>(null);
  const heatmapMeshRef = useRef<THREE.Mesh | null>(null);

  // View state
  const [isXRayMode, setIsXRayMode] = useState<boolean>(false);
  const [showCeiling, setShowCeiling] = useState<boolean>(false);
  const [showSignalHeatmap, setShowSignalHeatmap] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<'select' | 'add_wall' | 'add_furniture' | 'add_device'>('select');
  const [selectedFurnitureType, setSelectedFurnitureType] = useState<FurnitureItem['type']>('rack_server');

  // Camera Orbit State
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraAngleRef = useRef<{ theta: number; phi: number; radius: number; target: THREE.Vector3 }>({
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 18,
    target: new THREE.Vector3(4.5, 1.2, 4.0),
  });

  // Dynamically update background when theme changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme === 'light' ? 0xe2e8f0 : 0x07090e);
    }
  }, [theme]);

  // Setup Three.js scene once
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'light' ? 0xe2e8f0 : 0x07090e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 0.7); // Electric cyan accent
    dirLight1.position.set(10, 20, 10);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf59e0b, 0.4); // Solar amber fill
    dirLight2.position.set(-10, 15, -10);
    scene.add(dirLight2);

    // Coordinate Grid Helper on ground
    const gridHelper = new THREE.GridHelper(24, 24, 0x00f0ff, 0x1e293b);
    gridHelper.position.set(4.5, -0.01, 4.0);
    scene.add(gridHelper);

    // Objects Group
    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);
    objectsGroupRef.current = objectsGroup;

    // Render loop
    let animationFrameId: number;
    const updateCameraPosition = () => {
      const { theta, phi, radius, target } = cameraAngleRef.current;
      const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.position.set(x, y, z);
      camera.lookAt(target);
    };

    updateCameraPosition();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Update Scene geometry whenever project, visual modes, or simParams change
  useEffect(() => {
    if (!sceneRef.current || !objectsGroupRef.current) return;
    const group = objectsGroupRef.current;

    // Clear previous dynamic objects
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        if (Array.isArray((child as any).material)) {
          (child as any).material.forEach((m: any) => m.dispose());
        } else {
          (child as any).material.dispose();
        }
      }
    }

    // 1. Render Rooms (Floors)
    project.rooms.forEach((room) => {
      let floorGeo: THREE.BufferGeometry;
      let posX = room.x + room.width / 2;
      let posZ = room.y + room.length / 2;
      let rotX = -Math.PI / 2;

      let floorColor = 0x182030;
      if (room.floorMaterial === 'tiles') floorColor = 0x1e293b;
      if (room.floorMaterial === 'concrete_screed') floorColor = 0x242d3d;
      if (room.floorMaterial === 'wood_parquet') floorColor = 0x2b221a;

      // Special tinting for exterior spaces
      if (room.id.includes('terrace')) floorColor = 0x3d2b1f; // Timber deck
      if (room.id.includes('courtyard')) floorColor = 0x1e3328; // Greenish courtyard/lawn
      if (room.id.includes('driveway')) floorColor = 0x171921; // Dark asphalt/paved
      if (room.id.includes('workshop')) floorColor = 0x27303f; // Industrial workshop

      const floorMat = new THREE.MeshStandardMaterial({
        color: floorColor,
        roughness: 0.8,
        metalness: 0.2,
      });

      if (room.polygon && room.polygon.length > 2) {
        const shape = new THREE.Shape();
        shape.moveTo(room.polygon[0].x, -room.polygon[0].y);
        for (let i = 1; i < room.polygon.length; i++) {
          shape.lineTo(room.polygon[i].x, -room.polygon[i].y);
        }
        shape.closePath();
        floorGeo = new THREE.ShapeGeometry(shape);
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set(0, 0.005, 0);
        floorMesh.receiveShadow = true;
        group.add(floorMesh);

        const edges = new THREE.EdgesGeometry(floorGeo);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.35 })
        );
        line.rotation.x = -Math.PI / 2;
        line.position.copy(floorMesh.position);
        group.add(line);
      } else {
        floorGeo = new THREE.PlaneGeometry(room.width, room.length);
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = rotX;
        floorMesh.position.set(posX, 0, posZ);
        floorMesh.receiveShadow = true;
        group.add(floorMesh);

        const edges = new THREE.EdgesGeometry(floorGeo);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.3 })
        );
        line.rotation.x = rotX;
        line.position.copy(floorMesh.position);
        group.add(line);
      }
    });

    // 2. Render Walls
    project.walls.forEach((wall) => {
      const dx = wall.p2.x - wall.p1.x;
      const dy = wall.p2.y - wall.p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.05) return;

      const angle = Math.atan2(dy, dx);
      const thickness = wall.thicknessCm / 100;
      const height = wall.heightM;

      const wallGeo = new THREE.BoxGeometry(length, height, thickness);

      let wallColor = 0x334155; // Slate default
      if (wall.material === 'reinforced_concrete') wallColor = 0x475569;
      if (wall.material === 'stone') wallColor = 0x52525b;
      if (wall.material.includes('brick')) wallColor = 0x854d0e;
      if (wall.material === 'plasterboard') wallColor = 0x94a3b8;
      if (wall.material === 'metal_shield') wallColor = 0x0284c7;

      const isSelected = selectedItemId === wall.id;
      const wallMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x00f0ff : wallColor,
        transparent: isXRayMode,
        opacity: isXRayMode ? 0.25 : 0.85,
        wireframe: false,
      });

      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(
        wall.p1.x + dx / 2,
        height / 2,
        wall.p1.y + dy / 2
      );
      wallMesh.rotation.y = -angle;
      wallMesh.castShadow = !isXRayMode;
      wallMesh.receiveShadow = true;
      (wallMesh as any).userData = { id: wall.id, type: 'wall' };
      group.add(wallMesh);
    });

    // 3. Render In-Wall Conduits (3D pipes / cables through walls)
    const conduitColors: Record<string, number> = {
      ethernet: 0x00f0ff, // Electric Cyan
      power: 0xf59e0b,    // Solar Amber
      water: 0x38bdf8,    // Sky Blue
      drainage: 0x64748b, // Grey
      rf_bus: 0xa855f7,   // Hyper Violet
    };

    project.conduits.forEach((conduit) => {
      if (conduit.points.length < 2) return;
      const curvePoints = conduit.points.map((p) => new THREE.Vector3(p.x, p.z, p.y));
      const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.1);
      const radius = Math.max(0.015, conduit.diameterMm / 1000);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, radius, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: conduitColors[conduit.layer] || 0x00f0ff,
        emissive: conduitColors[conduit.layer] || 0x00f0ff,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.5,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      (tubeMesh as any).userData = { id: conduit.id, type: 'conduit' };
      group.add(tubeMesh);
    });

    // 4. Render Furniture (Server Rack, Inverter, Battery, Desks)
    project.furniture.forEach((furn) => {
      const isSelected = selectedItemId === furn.id;
      const furnGeo = new THREE.BoxGeometry(furn.width, furn.height, furn.length);

      let furnColor = 0x1e293b;
      if (furn.type === 'rack_server') furnColor = 0x0f172a;
      if (furn.type === 'fve_inverter') furnColor = 0xf59e0b;
      if (furn.type === 'fve_battery_bank') furnColor = 0x10b981;
      if (furn.type === 'desk') furnColor = 0x334155;
      if (furn.type === 'terrace_pergola') furnColor = 0x3d2b1f;
      if (furn.type === 'car_parking') furnColor = 0x1e293b;
      if (furn.type === 'workshop_bench') furnColor = 0x475569;
      if (furn.type === 'courtyard_paving') furnColor = 0x334155;

      const furnMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x00f0ff : furnColor,
        metalness: furn.type === 'rack_server' || furn.type === 'workshop_bench' ? 0.8 : 0.2,
        roughness: 0.4,
      });

      // Special custom 3D geometries for outdoor structures
      if (furn.type === 'terrace_pergola') {
        const pergolaGroup = new THREE.Group();
        // 4 pillars
        const pillarGeo = new THREE.BoxGeometry(0.12, furn.height, 0.12);
        const pillarMat = new THREE.MeshStandardMaterial({ color: isSelected ? 0x00f0ff : 0x2b221a });
        const hw = furn.width / 2;
        const hl = furn.length / 2;
        const corners = [
          [-hw, -hl],
          [hw, -hl],
          [hw, hl],
          [-hw, hl],
        ];
        corners.forEach(([cx, cy]) => {
          const pillar = new THREE.Mesh(pillarGeo, pillarMat);
          pillar.position.set(cx, furn.height / 2, cy);
          pillar.castShadow = true;
          pergolaGroup.add(pillar);
        });

        // Top horizontal beams / slats
        const beamGeo = new THREE.BoxGeometry(furn.width, 0.08, 0.08);
        for (let i = -hl; i <= hl; i += 0.8) {
          const beam = new THREE.Mesh(beamGeo, pillarMat);
          beam.position.set(0, furn.height, i);
          pergolaGroup.add(beam);
        }

        pergolaGroup.position.set(furn.position.x, furn.position.z, furn.position.y);
        (pergolaGroup as any).userData = { id: furn.id, type: 'furniture' };
        group.add(pergolaGroup);
        return;
      }

      if (furn.type === 'car_parking') {
        const carportGroup = new THREE.Group();
        // Ground parking lines
        const padGeo = new THREE.BoxGeometry(furn.width, 0.04, furn.length);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(0, 0.02, 0);
        pad.receiveShadow = true;
        carportGroup.add(pad);

        // Canopy roof
        const roofGeo = new THREE.BoxGeometry(furn.width + 0.2, 0.08, furn.length + 0.2);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, furn.height, 0);
        roof.castShadow = true;
        carportGroup.add(roof);

        // Support posts
        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, furn.height, 8);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
        [
          [-furn.width / 2 + 0.1, -furn.length / 2 + 0.1],
          [furn.width / 2 - 0.1, -furn.length / 2 + 0.1],
          [-furn.width / 2 + 0.1, furn.length / 2 - 0.1],
          [furn.width / 2 - 0.1, furn.length / 2 - 0.1],
        ].forEach(([px, py]) => {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(px, furn.height / 2, py);
          carportGroup.add(post);
        });

        // Vehicle silhouette box on parking spot
        const carGeo = new THREE.BoxGeometry(1.8, 1.4, 4.2);
        const carMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 });
        const car = new THREE.Mesh(carGeo, carMat);
        car.position.set(-furn.width / 4, 0.7, 0);
        car.castShadow = true;
        carportGroup.add(car);

        carportGroup.position.set(furn.position.x, furn.position.z, furn.position.y);
        (carportGroup as any).userData = { id: furn.id, type: 'furniture' };
        group.add(carportGroup);
        return;
      }

      const furnMesh = new THREE.Mesh(furnGeo, furnMat);
      furnMesh.position.set(
        furn.position.x,
        furn.position.z + furn.height / 2,
        furn.position.y
      );
      furnMesh.rotation.y = (furn.rotationY * Math.PI) / 180;
      furnMesh.castShadow = true;
      (furnMesh as any).userData = { id: furn.id, type: 'furniture' };
      group.add(furnMesh);

      // Server rack detail (LED lights / status lines)
      if (furn.type === 'rack_server') {
        const ledGeo = new THREE.SphereGeometry(0.02, 8, 8);
        const ledMatGreen = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const ledMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

        for (let i = 0; i < 4; i++) {
          const led1 = new THREE.Mesh(ledGeo, ledMatGreen);
          led1.position.set(
            furn.position.x + furn.width / 2 + 0.01,
            furn.position.z + 0.4 + i * 0.3,
            furn.position.y - 0.2
          );
          group.add(led1);

          const led2 = new THREE.Mesh(ledGeo, ledMatCyan);
          led2.position.set(
            furn.position.x + furn.width / 2 + 0.01,
            furn.position.z + 0.4 + i * 0.3,
            furn.position.y - 0.1
          );
          group.add(led2);
        }
      }
    });

    // 5. Render IoT Devices
    project.devices.forEach((dev) => {
      const isSelected = selectedItemId === dev.id;
      const isTx = dev.id === simParams.activeTxDeviceId;

      // Base Device Box / Puck
      const devGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.1, 16);
      let devColor = 0x00f0ff; // Cyan
      if (dev.protocol === 'RF433_EV1527') devColor = 0xa855f7; // Hyper Violet
      if (dev.protocol === 'ZIGBEE_2_4') devColor = 0x10b981; // Emerald Green
      if (dev.protocol === 'ETHERNET') devColor = 0x0284c7; // Blue

      const devMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffffff : devColor,
        emissive: isTx ? 0x00f0ff : devColor,
        emissiveIntensity: isTx ? 0.8 : 0.2,
      });

      const devMesh = new THREE.Mesh(devGeo, devMat);
      devMesh.position.set(dev.position.x, dev.position.z, dev.position.y);
      (devMesh as any).userData = { id: dev.id, type: 'device' };
      group.add(devMesh);

      // Antenna rod
      const antGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.25, 8);
      const antMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const antMesh = new THREE.Mesh(antGeo, antMat);
      antMesh.position.set(dev.position.x, dev.position.z + 0.15, dev.position.y);
      group.add(antMesh);

      // Warning marker if CC1101 balun filter attenuation applies
      if (dev.hardwareAttenuationOffsetDb <= -25) {
        const warnGeo = new THREE.RingGeometry(0.18, 0.22, 16);
        const warnMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          side: THREE.DoubleSide,
        });
        const warnMesh = new THREE.Mesh(warnGeo, warnMat);
        warnMesh.rotation.x = -Math.PI / 2;
        warnMesh.position.set(dev.position.x, dev.position.z + 0.02, dev.position.y);
        group.add(warnMesh);
      }
    });

    // 6. Render 3D RF Signal Heatmap Ground Plane if enabled
    if (showSignalHeatmap) {
      const activeTx = project.devices.find((d) => d.id === simParams.activeTxDeviceId) || project.devices[0];
      if (activeTx) {
        const gridW = 10;
        const gridH = 8.5;
        const segsX = 40;
        const segsY = 34;
        const planeGeo = new THREE.PlaneGeometry(gridW, gridH, segsX, segsY);
        const colors: number[] = [];

        const posAttr = planeGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i) + gridW / 2;
          const vy = posAttr.getY(i) + gridH / 2;

          const signal = calculateSignalAtPoint(
            activeTx,
            { x: vx, y: vy, z: 1.0 },
            project.walls,
            0,
            project.customAttenuation
          );

          // Apply extra ambient noise floor or interference
          let effectiveRssi = signal.rssiDbm;
          if (simParams.interferenceType !== 'none') {
            effectiveRssi -= simParams.interferenceIntensityDb;
          }

          // Normalized color 0..1 (-100 dBm to -40 dBm)
          const norm = Math.max(0, Math.min(1, (effectiveRssi + 95) / 55));

          // Color gradient: Red (drop) -> Amber (marginal) -> Green/Cyan (strong)
          let c = new THREE.Color();
          if (norm < 0.3) {
            c.setRGB(0.9, 0.1, 0.1); // Crimson
          } else if (norm < 0.6) {
            c.setRGB(0.95, 0.6, 0.0); // Amber
          } else if (norm < 0.85) {
            c.setRGB(0.06, 0.72, 0.5); // Emerald Green
          } else {
            c.setRGB(0.0, 0.94, 1.0); // Electric Cyan
          }

          colors.push(c.r, c.g, c.b);
        }

        planeGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const heatMat = new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
        });

        const heatMesh = new THREE.Mesh(planeGeo, heatMat);
        heatMesh.rotation.x = -Math.PI / 2;
        heatMesh.position.set(gridW / 2, 0.05, gridH / 2);
        group.add(heatMesh);
        heatmapMeshRef.current = heatMesh;
      }
    }
  }, [project, simParams, isXRayMode, showCeiling, showSignalHeatmap, selectedItemId]);

  // Mouse Orbit & Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

    if (e.buttons === 1) {
      // Rotate camera
      cameraAngleRef.current.theta -= deltaX * 0.008;
      cameraAngleRef.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.05, cameraAngleRef.current.phi - deltaY * 0.008)
      );
    } else if (e.buttons === 2) {
      // Pan camera target
      const forward = new THREE.Vector3(
        -Math.sin(cameraAngleRef.current.theta),
        0,
        -Math.cos(cameraAngleRef.current.theta)
      );
      const right = new THREE.Vector3(
        Math.cos(cameraAngleRef.current.theta),
        0,
        -Math.sin(cameraAngleRef.current.theta)
      );
      cameraAngleRef.current.target.addScaledVector(right, -deltaX * 0.02);
      cameraAngleRef.current.target.addScaledVector(forward, deltaY * 0.02);
    }

    // Update camera
    if (cameraRef.current) {
      const { theta, phi, radius, target } = cameraAngleRef.current;
      const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.position.set(x, y, z);
      cameraRef.current.lookAt(target);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    cameraAngleRef.current.radius = Math.max(
      3,
      Math.min(40, cameraAngleRef.current.radius + e.deltaY * 0.015)
    );
    if (cameraRef.current) {
      const { theta, phi, radius, target } = cameraAngleRef.current;
      const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.position.set(x, y, z);
      cameraRef.current.lookAt(target);
    }
  };

  // Click on 3D objects with raycasting
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || !cameraRef.current || !objectsGroupRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(objectsGroupRef.current.children, true);
    if (intersects.length > 0) {
      // Find object with userData
      let hitObj: any = intersects[0].object;
      while (hitObj && !hitObj.userData?.id && hitObj.parent) {
        hitObj = hitObj.parent;
      }
      if (hitObj?.userData?.id) {
        onSelectItem(hitObj.userData.id, hitObj.userData.type);
        return;
      }
    }

    if (activeTool === 'add_furniture') {
      // Raycast to ground plane at y=0
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const targetPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(groundPlane, targetPoint);
      if (targetPoint) {
        const newFurn: FurnitureItem = {
          id: `furn-${Date.now()}`,
          name: `Nové ${selectedFurnitureType}`,
          type: selectedFurnitureType,
          position: {
            x: Math.round(targetPoint.x * 10) / 10,
            y: Math.round(targetPoint.z * 10) / 10,
            z: 0,
          },
          width: 0.8,
          length: 0.8,
          height: 1.0,
          rotationY: 0,
          rfAttenuationDb: 5,
        };
        onUpdateProject({
          ...project,
          furniture: [...project.furniture, newFurn],
        });
        onSelectItem(newFurn.id, 'furniture');
        setActiveTool('select');
      }
    } else if (activeTool === 'add_device') {
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const targetPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(groundPlane, targetPoint);
      if (targetPoint) {
        const newDev: RFDevice = {
          id: `dev-${Date.now()}`,
          name: 'Nové IoT Zařízení',
          ip: '192.168.1.200',
          mac: '78:2B:CB:AA:BB:CC',
          position: {
            x: Math.round(targetPoint.x * 10) / 10,
            y: Math.round(targetPoint.z * 10) / 10,
            z: 1.0,
          },
          frequencyMHz: 2400,
          txPowerDbm: 10,
          hardwareAttenuationOffsetDb: 0,
          antennaGainDbi: 2,
          protocol: 'ZIGBEE_2_4',
        };
        onUpdateProject({
          ...project,
          devices: [...project.devices, newDev],
        });
        onSelectItem(newDev.id, 'device');
        setActiveTool('select');
      }
    }
  };

  // Camera presets
  const setCameraPreset = (preset: 'isometric' | 'top' | 'server_room') => {
    if (!cameraRef.current) return;
    if (preset === 'isometric') {
      cameraAngleRef.current = {
        theta: Math.PI / 4,
        phi: Math.PI / 3,
        radius: 18,
        target: new THREE.Vector3(4.5, 1.0, 4.0),
      };
    } else if (preset === 'top') {
      cameraAngleRef.current = {
        theta: 0,
        phi: 0.05,
        radius: 20,
        target: new THREE.Vector3(4.5, 0, 4.0),
      };
    } else if (preset === 'server_room') {
      cameraAngleRef.current = {
        theta: Math.PI / 3,
        phi: Math.PI / 2.8,
        radius: 5,
        target: new THREE.Vector3(1.2, 1.2, 1.2),
      };
    }

    const { theta, phi, radius, target } = cameraAngleRef.current;
    const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(target);
  };

  // Export current 3D frame for PDF
  const capture3dSnapshot = () => {
    if (rendererRef.current && onCaptureImageUri) {
      const dataUri = rendererRef.current.domElement.toDataURL('image/png');
      onCaptureImageUri(dataUri);
    }
  };

  // Selected item inspector controls
  const selectedFurniture = project.furniture.find((f) => f.id === selectedItemId);
  const selectedDevice = project.devices.find((d) => d.id === selectedItemId);
  const selectedWall = project.walls.find((w) => w.id === selectedItemId);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* 3D Top Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl backdrop-blur-md bg-slate-900/80 border border-slate-700/60 shadow-xl">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-800/60 flex items-center gap-1">
            <Box className="w-3.5 h-3.5" /> 3D CAD MODELER
          </span>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Tools */}
          <button
            onClick={() => setActiveTool('select')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1 ${
              activeTool === 'select'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Move className="w-3 h-3" /> Výběr / Posun
          </button>

          <button
            onClick={() => setActiveTool('add_furniture')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1 ${
              activeTool === 'add_furniture'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3 h-3" /> Přidat Nábytek / Rack
          </button>

          <button
            onClick={() => setActiveTool('add_device')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1 ${
              activeTool === 'add_device'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3 h-3" /> Přidat Zařízení
          </button>

          {activeTool === 'add_furniture' && (
            <select
              value={selectedFurnitureType}
              onChange={(e) => setSelectedFurnitureType(e.target.value as any)}
              className="text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 ml-1"
            >
              <option value="rack_server">Server Rack 19" (R510/HAOS)</option>
              <option value="fve_inverter">CARSPA Střídač FVE</option>
              <option value="fve_battery_bank">Bateriové úložiště</option>
              <option value="desk">Pracovní stůl</option>
              <option value="cabinet">Kovová skříň</option>
              <option value="metal_door">Kovové dveře (stínění)</option>
            </select>
          )}
        </div>

        {/* View toggles & Camera Presets */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsXRayMode(!isXRayMode)}
            className={`px-2 py-1 text-xs rounded transition flex items-center gap-1 font-mono ${
              isXRayMode ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50' : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="Průhledné zdi pro kontrolu kabeláže uvnitř"
          >
            <Eye className="w-3 h-3" /> X-Ray Zdi
          </button>

          <button
            onClick={() => setShowSignalHeatmap(!showSignalHeatmap)}
            className={`px-2 py-1 text-xs rounded transition flex items-center gap-1 font-mono ${
              showSignalHeatmap ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="Přepnout 3D zobrazení RF tepelné mapy"
          >
            <Radio className="w-3 h-3" /> RF Heatmap
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Camera Presets */}
          <button
            onClick={() => setCameraPreset('isometric')}
            className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded font-mono"
          >
            Izometrie
          </button>
          <button
            onClick={() => setCameraPreset('top')}
            className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 rounded font-mono"
          >
            Půdorys
          </button>
          <button
            onClick={() => setCameraPreset('server_room')}
            className="px-2 py-1 text-xs text-amber-400 hover:bg-slate-800 rounded font-mono font-bold"
          >
            Serverovna R510
          </button>

          <button
            onClick={capture3dSnapshot}
            className="px-2 py-1 text-xs text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 rounded border border-cyan-800/60 font-mono"
            title="Uložit snímek pro export do PDF"
          >
            Foto do PDF
          </button>
        </div>
      </div>

      {/* Main 3D Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* 3D Legend and HUD */}
        <div className="absolute bottom-3 left-3 p-3 rounded-xl backdrop-blur-md bg-slate-900/85 border border-slate-700/60 text-xs font-mono text-slate-300 space-y-1.5 shadow-xl max-w-xs pointer-events-none">
          <div className="text-cyan-400 font-bold flex items-center justify-between">
            <span>LEGENDA VRSTEV VE ZDI</span>
            <span className="text-[10px] text-slate-400">3D Potrubí</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
              <span>Ethernet Cat6A</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500" />
              <span>Elektro / FVE</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span>Voda PEX 16mm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span>Odpad HT50</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            Otáčení: Levý stisk | Posun: Pravý stisk | Zoom: Kolečko
          </div>
        </div>

        {/* Selected Item Floating 3D Inspector */}
        {(selectedFurniture || selectedDevice || selectedWall) && (
          <div className="absolute bottom-3 right-3 p-3 rounded-xl backdrop-blur-md bg-slate-900/90 border border-cyan-500/50 text-xs text-slate-200 shadow-2xl w-80 space-y-2 pointer-events-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-cyan-400 font-mono truncate">
                {selectedFurniture?.name || selectedDevice?.name || `Zeď ${selectedWall?.id}`}
              </span>
              <button
                onClick={() => onSelectItem(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {selectedFurniture && (
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="text-slate-400">Typ: {selectedFurniture.type}</div>
                <div className="grid grid-cols-3 gap-1">
                  <div>
                    <span className="text-slate-500">X (m):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedFurniture.position.x}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateProject({
                          ...project,
                          furniture: project.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, position: { ...f.position, x: val } }
                              : f
                          ),
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-cyan-300"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500">Y (m):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedFurniture.position.y}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateProject({
                          ...project,
                          furniture: project.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, position: { ...f.position, y: val } }
                              : f
                          ),
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-cyan-300"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500">Z (výška):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedFurniture.position.z}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateProject({
                          ...project,
                          furniture: project.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, position: { ...f.position, z: val } }
                              : f
                          ),
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-cyan-300"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400">Rotace (stupně):</span>
                  <input
                    type="number"
                    step="15"
                    value={selectedFurniture.rotationY}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      onUpdateProject({
                        ...project,
                        furniture: project.furniture.map((f) =>
                          f.id === selectedFurniture.id ? { ...f, rotationY: val } : f
                        ),
                      });
                    }}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-200"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">RF Útlum (dB):</span>
                  <input
                    type="number"
                    value={selectedFurniture.rfAttenuationDb}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateProject({
                        ...project,
                        furniture: project.furniture.map((f) =>
                          f.id === selectedFurniture.id ? { ...f, rfAttenuationDb: val } : f
                        ),
                      });
                    }}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-right text-amber-400 font-bold"
                  />
                </div>

                <button
                  onClick={() => {
                    onUpdateProject({
                      ...project,
                      furniture: project.furniture.filter((f) => f.id !== selectedFurniture.id),
                    });
                    onSelectItem(null);
                  }}
                  className="w-full mt-2 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded flex items-center justify-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Odstranit prvek
                </button>
              </div>
            )}

            {selectedDevice && (
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="text-slate-400">IP: <span className="text-cyan-300">{selectedDevice.ip}</span></div>
                <div className="text-slate-400">MAC: <span className="text-slate-200">{selectedDevice.mac}</span></div>
                <div className="text-slate-400">Protokol: <span className="text-emerald-400 font-bold">{selectedDevice.protocol}</span></div>
                <div className="text-slate-400">Frekvence: {selectedDevice.frequencyMHz} MHz</div>

                {selectedDevice.hardwareAttenuationOffsetDb <= -25 && (
                  <div className="p-1.5 rounded bg-red-950/80 border border-red-700 text-red-300 text-[10px]">
                    POZOR: Hardwarový 868MHz LC filtr utlumuje 433.92MHz vysílání o 30 dB. Reálný TX dosah je pouze 15-50 cm!
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1 pt-1">
                  <div>
                    <span className="text-slate-500">X (m):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedDevice.position.x}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateProject({
                          ...project,
                          devices: project.devices.map((d) =>
                            d.id === selectedDevice.id
                              ? { ...d, position: { ...d.position, x: val } }
                              : d
                          ),
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-cyan-300"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500">Y (m):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedDevice.position.y}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateProject({
                          ...project,
                          devices: project.devices.map((d) =>
                            d.id === selectedDevice.id
                              ? { ...d, position: { ...d.position, y: val } }
                              : d
                          ),
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-cyan-300"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500">Z (výška):</span>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedDevice.position.z}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUpdateProject({
                          ...project,
                          devices: project.devices.map((d) =>
                            d.id === selectedDevice.id
                              ? { ...d, position: { ...d.position, z: val } }
                              : d
                          ),
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-cyan-300"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    onUpdateProject({
                      ...project,
                      devices: project.devices.filter((d) => d.id !== selectedDevice.id),
                    });
                    onSelectItem(null);
                  }}
                  className="w-full mt-2 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded flex items-center justify-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Odstranit zařízení
                </button>
              </div>
            )}

            {selectedWall && (
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="text-slate-400">Tloušťka: {selectedWall.thicknessCm} cm</div>
                <div className="text-slate-400">Výška: {selectedWall.heightM} m</div>
                <div className="text-slate-400">Materiál: <span className="text-amber-400">{selectedWall.material}</span></div>
                <div className="text-slate-500">
                  P1: [{selectedWall.p1.x}, {selectedWall.p1.y}] → P2: [{selectedWall.p2.x}, {selectedWall.p2.y}]
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
