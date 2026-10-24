import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  TopologyProject,
  Room,
  InWallConduit,
  ConduitLayer,
} from '../types/topology.ts';
import { WallSegment } from '../utils/rf-engine.ts';
import {
  Undo2,
  Redo2,
  Move,
  PenTool,
  Square,
  DoorOpen,
  Route,
  Ruler,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize,
  Check,
  X,
  Layers,
  Settings,
  Grid,
  Magnet,
} from 'lucide-react';

interface FloorplanEditorProps {
  project: TopologyProject;
  onUpdateProject: (updated: TopologyProject) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string | null, type?: 'device' | 'wall' | 'furniture' | 'conduit' | 'room') => void;
  theme?: 'dark' | 'light';
}

type EditorTool = 'select' | 'wall' | 'room' | 'door' | 'conduit' | 'ruler';

export const FloorplanEditor: React.FC<FloorplanEditorProps> = ({
  project,
  onUpdateProject,
  undo,
  redo,
  canUndo,
  canRedo,
  selectedItemId,
  onSelectItem,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tools & State
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [scale, setScale] = useState<number>(60); // px per meter
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Wall Drawing state
  const [wallStartPoint, setWallStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [mouseMeters, setMouseMeters] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedWallMaterial, setSelectedWallMaterial] = useState<WallSegment['material']>('brick_15cm');
  const [wallThicknessCm, setWallThicknessCm] = useState<number>(15);

  // Room Drawing state
  const [roomStartPoint, setRoomStartPoint] = useState<{ x: number; y: number } | null>(null);

  // Conduit Drawing state
  const [conduitPoints, setConduitPoints] = useState<{ x: number; y: number; z: number }[]>([]);
  const [activeConduitLayer, setActiveConduitLayer] = useState<ConduitLayer>('ethernet');

  // Vertex Dragging
  const [draggedVertex, setDraggedVertex] = useState<{
    wallId: string;
    endpoint: 'p1' | 'p2';
  } | null>(null);

  // Dragged Room
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null);
  const [roomDragOffset, setRoomDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Grid and Snapping options
  const [gridStepMeters, setGridStepMeters] = useState<number>(0.1); // 10cm default
  const [isSnapEnabled, setIsSnapEnabled] = useState<boolean>(true);

  // Sidebar tab
  const [sidebarTab, setSidebarTab] = useState<'rooms' | 'walls' | 'templates'>('rooms');

  // Coordinate transforms
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      return {
        x: (screenX - offset.x) / scale,
        y: (screenY - offset.y) / scale,
      };
    },
    [offset, scale]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number): { x: number; y: number } => {
      return {
        x: worldX * scale + offset.x,
        y: worldY * scale + offset.y,
      };
    },
    [offset, scale]
  );

  const snap = useCallback(
    (val: number, step = gridStepMeters): number => {
      if (!isSnapEnabled) return Math.round(val * 100) / 100;
      return Math.round(val / step) * step;
    },
    [isSnapEnabled, gridStepMeters]
  );

  // Key shortcuts for Delete and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target && ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Escape') {
        setWallStartPoint(null);
        setRoomStartPoint(null);
        setConduitPoints([]);
        setActiveTool('select');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId) {
          // Check if wall
          if (project.walls.some((w) => w.id === selectedItemId)) {
            onUpdateProject({
              ...project,
              walls: project.walls.filter((w) => w.id !== selectedItemId),
            });
            onSelectItem(null);
          } else if (project.rooms.some((r) => r.id === selectedItemId)) {
            onUpdateProject({
              ...project,
              rooms: project.rooms.filter((r) => r.id !== selectedItemId),
            });
            onSelectItem(null);
          } else if (project.conduits.some((c) => c.id === selectedItemId)) {
            onUpdateProject({
              ...project,
              conduits: project.conduits.filter((c) => c.id !== selectedItemId),
            });
            onSelectItem(null);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, project, onUpdateProject, onSelectItem]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;

    // Background
    ctx.fillStyle = theme === 'light' ? '#f8fafc' : '#07090e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startWorld = screenToWorld(0, 0);
    const endWorld = screenToWorld(canvas.width, canvas.height);

    // 1. Grid
    ctx.strokeStyle = theme === 'light' ? '#e2e8f0' : '#101726';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(startWorld.x); x <= Math.ceil(endWorld.x); x += 0.2) {
      const sx = worldToScreen(x, 0).x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
    }
    for (let y = Math.floor(startWorld.y); y <= Math.ceil(endWorld.y); y += 0.2) {
      const sy = worldToScreen(0, y).y;
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
    }
    ctx.stroke();

    // Major 1m Grid
    ctx.strokeStyle = theme === 'light' ? '#cbd5e1' : '#1b253b';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = theme === 'light' ? '#64748b' : '#475569';
    ctx.font = '10px monospace';
    ctx.beginPath();
    for (let x = Math.floor(startWorld.x); x <= Math.ceil(endWorld.x); x += 1.0) {
      const sx = worldToScreen(x, 0).x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
      ctx.fillText(`${x}m`, sx + 4, 14);
    }
    for (let y = Math.floor(startWorld.y); y <= Math.ceil(endWorld.y); y += 1.0) {
      const sy = worldToScreen(0, y).y;
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
      ctx.fillText(`${y}m`, 4, sy - 4);
    }
    ctx.stroke();

    // 2. Rooms
    project.rooms.forEach((room) => {
      const tl = worldToScreen(room.x, room.y);
      const w = room.width * scale;
      const h = room.length * scale;
      const isSelected = selectedItemId === room.id;

      ctx.fillStyle = isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(20, 26, 38, 0.7)';
      ctx.fillRect(tl.x, tl.y, w, h);

      ctx.strokeStyle = isSelected ? '#00f0ff' : '#334155';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(tl.x, tl.y, w, h);

      // Room Title
      ctx.fillStyle = isSelected ? '#00f0ff' : '#cbd5e1';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(room.name, tl.x + 10, tl.y + 22);

      // Room Dimensions
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      const area = (room.width * room.length).toFixed(1);
      ctx.fillText(`${room.width.toFixed(2)}m × ${room.length.toFixed(2)}m (${area} m²)`, tl.x + 10, tl.y + 38);
    });

    // 3. Conduits
    const conduitColors: Record<ConduitLayer, string> = {
      ethernet: '#00f0ff',
      power: '#f59e0b',
      water: '#38bdf8',
      drainage: '#64748b',
      rf_bus: '#a855f7',
    };

    project.conduits.forEach((conduit) => {
      if (conduit.points.length < 2) return;
      const isSelected = selectedItemId === conduit.id;

      ctx.strokeStyle = conduitColors[conduit.layer] || '#00f0ff';
      ctx.lineWidth = isSelected ? 4 : 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      conduit.points.forEach((pt, i) => {
        const s = worldToScreen(pt.x, pt.y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();

      // Waypoint handles
      conduit.points.forEach((pt) => {
        const s = worldToScreen(pt.x, pt.y);
        ctx.fillStyle = conduitColors[conduit.layer];
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // 4. Walls with Physical Thickness & Material Color
    project.walls.forEach((wall) => {
      const p1 = worldToScreen(wall.p1.x, wall.p1.y);
      const p2 = worldToScreen(wall.p2.x, wall.p2.y);
      const thicknessPx = Math.max(4, (wall.thicknessCm / 100) * scale);
      const isSelected = selectedItemId === wall.id;

      let strokeColor = '#475569';
      if (wall.material === 'reinforced_concrete') strokeColor = '#64748b';
      if (wall.material.includes('brick')) strokeColor = '#9a3412';
      if (wall.material === 'plasterboard') strokeColor = '#94a3b8';
      if (wall.material === 'metal_shield') strokeColor = '#0284c7';

      ctx.strokeStyle = isSelected ? '#00f0ff' : strokeColor;
      ctx.lineWidth = thicknessPx;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Wall Core Centerline
      ctx.strokeStyle = isSelected ? '#ffffff' : '#07090e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Dimension label on wall
      const dx = wall.p2.x - wall.p1.x;
      const dy = wall.p2.y - wall.p1.y;
      const lenMeters = Math.sqrt(dx * dx + dy * dy);
      if (lenMeters > 0.4) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        ctx.fillStyle = isSelected ? '#00f0ff' : '#94a3b8';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${lenMeters.toFixed(2)}m (${wall.thicknessCm}cm)`, midX, midY - thicknessPx / 2 - 6);
      }

      // Vertex Drag Handles in Select Tool Mode
      if (activeTool === 'select') {
        [
          { p: p1, endpoint: 'p1' as const },
          { p: p2, endpoint: 'p2' as const },
        ].forEach(({ p, endpoint }) => {
          const isDraggingThis =
            draggedVertex?.wallId === wall.id && draggedVertex?.endpoint === endpoint;
          ctx.fillStyle = isDraggingThis ? '#00f0ff' : isSelected ? '#38bdf8' : '#e2e8f0';
          ctx.strokeStyle = '#07090e';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, isDraggingThis ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    });

    // 5. Active Wall Drawing Guide
    if (activeTool === 'wall' && wallStartPoint) {
      const p1 = worldToScreen(wallStartPoint.x, wallStartPoint.y);
      const p2 = worldToScreen(mouseMeters.x, mouseMeters.y);

      // Angle Snapping guide (0°, 45°, 90°)
      const dx = mouseMeters.x - wallStartPoint.x;
      const dy = mouseMeters.y - wallStartPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(4, (wallThicknessCm / 100) * scale);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Length and angle badge
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist.toFixed(2)} m (${Math.round(dist * 100)} cm)`, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 14);
    }

    // 6. Active Room Drawing Guide
    if (activeTool === 'room' && roomStartPoint) {
      const rx = Math.min(roomStartPoint.x, mouseMeters.x);
      const ry = Math.min(roomStartPoint.y, mouseMeters.y);
      const rw = Math.abs(mouseMeters.x - roomStartPoint.x);
      const rh = Math.abs(mouseMeters.y - roomStartPoint.y);

      const p = worldToScreen(rx, ry);
      const w = rw * scale;
      const h = rh * scale;

      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fillRect(p.x, p.y, w, h);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(p.x, p.y, w, h);
      ctx.setLineDash([]);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${rw.toFixed(2)} m × ${rh.toFixed(2)} m (${(rw * rh).toFixed(2)} m²)`,
        p.x + w / 2,
        p.y + h / 2
      );
    }

    // 7. Active Conduit Drawing Guide
    if (activeTool === 'conduit' && conduitPoints.length > 0) {
      ctx.strokeStyle = conduitColors[activeConduitLayer];
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const lastPt = conduitPoints[conduitPoints.length - 1];
      const s1 = worldToScreen(lastPt.x, lastPt.y);
      const s2 = worldToScreen(mouseMeters.x, mouseMeters.y);
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    project,
    activeTool,
    scale,
    offset,
    wallStartPoint,
    roomStartPoint,
    conduitPoints,
    mouseMeters,
    wallThicknessCm,
    selectedWallMaterial,
    selectedItemId,
    draggedVertex,
    screenToWorld,
    worldToScreen,
    activeConduitLayer,
    theme,
  ]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldPos = screenToWorld(clientX, clientY);
    const snappedWorld = {
      x: snap(worldPos.x),
      y: snap(worldPos.y),
    };

    // Pan with middle click, right click, or Alt+click
    if (e.button === 1 || e.button === 2 || e.altKey) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (activeTool === 'select') {
      // 1. Check if clicked near a wall vertex handle (within 0.25m)
      for (const wall of project.walls) {
        const d1 = Math.sqrt((wall.p1.x - worldPos.x) ** 2 + (wall.p1.y - worldPos.y) ** 2);
        const d2 = Math.sqrt((wall.p2.x - worldPos.x) ** 2 + (wall.p2.y - worldPos.y) ** 2);
        if (d1 < 0.25) {
          setDraggedVertex({ wallId: wall.id, endpoint: 'p1' });
          onSelectItem(wall.id, 'wall');
          return;
        }
        if (d2 < 0.25) {
          setDraggedVertex({ wallId: wall.id, endpoint: 'p2' });
          onSelectItem(wall.id, 'wall');
          return;
        }
      }

      // 2. Check if clicked on a wall body
      const clickedWall = project.walls.find((w) => {
        const l2 = (w.p2.x - w.p1.x) ** 2 + (w.p2.y - w.p1.y) ** 2;
        if (l2 === 0) return false;
        const t = Math.max(0, Math.min(1, ((worldPos.x - w.p1.x) * (w.p2.x - w.p1.x) + (worldPos.y - w.p1.y) * (w.p2.y - w.p1.y)) / l2));
        const projX = w.p1.x + t * (w.p2.x - w.p1.x);
        const projY = w.p1.y + t * (w.p2.y - w.p1.y);
        const dist = Math.sqrt((worldPos.x - projX) ** 2 + (worldPos.y - projY) ** 2);
        return dist < (w.thicknessCm / 200 + 0.15);
      });

      if (clickedWall) {
        onSelectItem(clickedWall.id, 'wall');
        return;
      }

      // 3. Check if clicked inside a room
      const clickedRoom = project.rooms.find(
        (r) =>
          worldPos.x >= r.x &&
          worldPos.x <= r.x + r.width &&
          worldPos.y >= r.y &&
          worldPos.y <= r.y + r.length
      );

      if (clickedRoom) {
        onSelectItem(clickedRoom.id, 'room');
        setDraggedRoomId(clickedRoom.id);
        setRoomDragOffset({ x: worldPos.x - clickedRoom.x, y: worldPos.y - clickedRoom.y });
        return;
      }

      // Otherwise click on empty space: pan canvas
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeTool === 'wall') {
      if (!wallStartPoint) {
        setWallStartPoint(snappedWorld);
      } else {
        // Place wall
        const newWall: WallSegment = {
          id: `wall-${Date.now()}`,
          p1: wallStartPoint,
          p2: snappedWorld,
          thicknessCm: wallThicknessCm,
          heightM: 2.7,
          material: selectedWallMaterial,
        };

        onUpdateProject({
          ...project,
          walls: [...project.walls, newWall],
        });

        // Continuous drawing: set start point to this endpoint for fast chain drawing!
        setWallStartPoint(snappedWorld);
        onSelectItem(newWall.id, 'wall');
      }
    } else if (activeTool === 'room') {
      if (!roomStartPoint) {
        setRoomStartPoint(snappedWorld);
      } else {
        const rx = Math.min(roomStartPoint.x, snappedWorld.x);
        const ry = Math.min(roomStartPoint.y, snappedWorld.y);
        const rw = Math.abs(snappedWorld.x - roomStartPoint.x);
        const rh = Math.abs(snappedWorld.y - roomStartPoint.y);

        if (rw > 0.5 && rh > 0.5) {
          const newRoom: Room = {
            id: `room-${Date.now()}`,
            name: `Místnost ${project.rooms.length + 1}`,
            floor: 1,
            x: rx,
            y: ry,
            width: Math.round(rw * 100) / 100,
            length: Math.round(rh * 100) / 100,
            ceilingHeight: 2.7,
            floorMaterial: 'wood_parquet',
          };

          // Generate 4 perimeter walls
          const p1 = { x: rx, y: ry };
          const p2 = { x: rx + rw, y: ry };
          const p3 = { x: rx + rw, y: ry + rh };
          const p4 = { x: rx, y: ry + rh };

          const newWalls: WallSegment[] = [
            { id: `wall-${Date.now()}-1`, p1, p2, thicknessCm: wallThicknessCm, heightM: 2.7, material: selectedWallMaterial },
            { id: `wall-${Date.now()}-2`, p1: p2, p2: p3, thicknessCm: wallThicknessCm, heightM: 2.7, material: selectedWallMaterial },
            { id: `wall-${Date.now()}-3`, p1: p3, p2: p4, thicknessCm: wallThicknessCm, heightM: 2.7, material: selectedWallMaterial },
            { id: `wall-${Date.now()}-4`, p1: p4, p2: p1, thicknessCm: wallThicknessCm, heightM: 2.7, material: selectedWallMaterial },
          ];

          onUpdateProject({
            ...project,
            rooms: [...project.rooms, newRoom],
            walls: [...project.walls, ...newWalls],
          });

          onSelectItem(newRoom.id, 'room');
        }

        setRoomStartPoint(null);
        setActiveTool('select');
      }
    } else if (activeTool === 'conduit') {
      const newPt = { x: snappedWorld.x, y: snappedWorld.y, z: 1.0 };
      setConduitPoints((pts) => [...pts, newPt]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldPos = screenToWorld(clientX, clientY);
    const snappedWorld = {
      x: snap(worldPos.x),
      y: snap(worldPos.y),
    };
    setMouseMeters(snappedWorld);

    if (isPanning) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (draggedVertex) {
      // Move specific wall vertex
      onUpdateProject({
        ...project,
        walls: project.walls.map((w) => {
          if (w.id === draggedVertex.wallId) {
            return {
              ...w,
              [draggedVertex.endpoint]: snappedWorld,
            };
          }
          return w;
        }),
      });
    } else if (draggedRoomId) {
      // Move room
      const newX = snap(worldPos.x - roomDragOffset.x);
      const newY = snap(worldPos.y - roomDragOffset.y);
      onUpdateProject({
        ...project,
        rooms: project.rooms.map((r) =>
          r.id === draggedRoomId ? { ...r, x: newX, y: newY } : r
        ),
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedVertex(null);
    setDraggedRoomId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.max(20, Math.min(220, scale * zoomFactor));

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setOffset({
      x: mouseX - (mouseX - offset.x) * (newScale / scale),
      y: mouseY - (mouseY - offset.y) * (newScale / scale),
    });
    setScale(newScale);
  };

  const handleFinishConduit = () => {
    if (conduitPoints.length >= 2) {
      const newConduit: InWallConduit = {
        id: `conduit-${Date.now()}`,
        name: `Trasa ${activeConduitLayer.toUpperCase()}`,
        layer: activeConduitLayer,
        specification:
          activeConduitLayer === 'ethernet'
            ? 'Cat6A S/FTP'
            : activeConduitLayer === 'power'
            ? 'CYKY-J 3x2.5'
            : activeConduitLayer === 'water'
            ? 'PEX 16x2.0'
            : 'HT 50',
        diameterMm: activeConduitLayer === 'drainage' ? 50 : 20,
        points: conduitPoints,
        status: 'installed',
      };

      onUpdateProject({
        ...project,
        conduits: [...project.conduits, newConduit],
      });
    }
    setConduitPoints([]);
    setActiveTool('select');
  };

  const addRoomTemplate = (name: string, w: number, l: number, wallMat: WallSegment['material'], wallThick: number) => {
    const offsetX = (project.rooms.length % 2) * 6.0;
    const offsetY = Math.floor(project.rooms.length / 2) * 5.0;

    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name,
      floor: 1,
      x: offsetX,
      y: offsetY,
      width: w,
      length: l,
      ceilingHeight: 2.7,
      floorMaterial: 'tiles',
      notes: `Vytvořeno ze šablony: ${w}m × ${l}m`,
    };

    const p1 = { x: offsetX, y: offsetY };
    const p2 = { x: offsetX + w, y: offsetY };
    const p3 = { x: offsetX + w, y: offsetY + l };
    const p4 = { x: offsetX, y: offsetY + l };

    const newWalls: WallSegment[] = [
      { id: `wall-${Date.now()}-1`, p1, p2, thicknessCm: wallThick, heightM: 2.7, material: wallMat },
      { id: `wall-${Date.now()}-2`, p1: p2, p2: p3, thicknessCm: wallThick, heightM: 2.7, material: wallMat },
      { id: `wall-${Date.now()}-3`, p1: p3, p2: p4, thicknessCm: wallThick, heightM: 2.7, material: wallMat },
      { id: `wall-${Date.now()}-4`, p1: p4, p2: p1, thicknessCm: wallThick, heightM: 2.7, material: wallMat },
    ];

    onUpdateProject({
      ...project,
      rooms: [...project.rooms, newRoom],
      walls: [...project.walls, ...newWalls],
    });

    onSelectItem(newRoom.id, 'room');
  };

  const selectedRoom = project.rooms.find((r) => r.id === selectedItemId);
  const selectedWall = project.walls.find((w) => w.id === selectedItemId);

  return (
    <div className="relative w-full h-full flex bg-[#07090e] text-slate-200 font-mono text-xs overflow-hidden select-none">
      {/* Main Canvas Viewport */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* CAD Dedicated Top Action Bar */}
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl backdrop-blur-md bg-slate-900/90 border border-slate-700/70 shadow-2xl">
          {/* Left: Tools and Undo / Redo */}
          <div className="flex items-center gap-1.5">
            {/* UNDO / REDO BUTTONS */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 rounded text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center gap-1"
                title="Zpět (Undo) [Ctrl+Z]"
              >
                <Undo2 className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold">Zpět</span>
              </button>

              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-1.5 rounded text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition flex items-center gap-1"
                title="Vpřed (Redo) [Ctrl+Y]"
              >
                <Redo2 className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-bold">Vpřed</span>
              </button>
            </div>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Mode Selectors */}
            <button
              onClick={() => {
                setActiveTool('select');
                setWallStartPoint(null);
                setRoomStartPoint(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                activeTool === 'select'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Move className="w-3.5 h-3.5" /> Výběr & Vrcholy
            </button>

            <button
              onClick={() => {
                setActiveTool('wall');
                setWallStartPoint(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                activeTool === 'wall'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" /> Kreslit Zeď
            </button>

            <button
              onClick={() => {
                setActiveTool('room');
                setRoomStartPoint(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                activeTool === 'room'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Square className="w-3.5 h-3.5" /> Vytvořit Místnost
            </button>

            <button
              onClick={() => {
                setActiveTool('conduit');
                setConduitPoints([]);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                activeTool === 'conduit'
                  ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Route className="w-3.5 h-3.5" /> Vedení ve zdi
            </button>

            {/* Wall Tool Options */}
            {activeTool === 'wall' && (
              <div className="flex items-center gap-1.5 ml-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                <span className="text-slate-400">Materiál:</span>
                <select
                  value={selectedWallMaterial}
                  onChange={(e) => setSelectedWallMaterial(e.target.value as any)}
                  className="bg-slate-800 text-slate-200 rounded px-1.5 py-0.5 border border-slate-700"
                >
                  <option value="reinforced_concrete">Železobeton (-25 dB)</option>
                  <option value="brick_30cm">Cihla 30cm (-12 dB)</option>
                  <option value="brick_15cm">Cihla 15cm (-7 dB)</option>
                  <option value="plasterboard">Sádrokarton (-3 dB)</option>
                  <option value="metal_shield">Kovové stínění (-35 dB)</option>
                </select>

                <span className="text-slate-400 ml-1">Tl.:</span>
                <input
                  type="number"
                  value={wallThicknessCm}
                  onChange={(e) => setWallThicknessCm(parseInt(e.target.value) || 15)}
                  className="w-12 bg-slate-800 text-cyan-300 rounded px-1 py-0.5 border border-slate-700 text-center"
                />
                <span className="text-slate-500">cm</span>
              </div>
            )}

            {/* Conduit Tool Options */}
            {activeTool === 'conduit' && (
              <div className="flex items-center gap-1.5 ml-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                <span className="text-slate-400">Vrstva:</span>
                <select
                  value={activeConduitLayer}
                  onChange={(e) => setActiveConduitLayer(e.target.value as ConduitLayer)}
                  className="bg-slate-800 text-slate-200 rounded px-1.5 py-0.5 border border-slate-700 font-bold"
                >
                  <option value="ethernet">Ethernet (Cat6A)</option>
                  <option value="power">Elektro / FVE (230V)</option>
                  <option value="water">Voda (PEX 16mm)</option>
                  <option value="drainage">Odpad (HT 50)</option>
                  <option value="rf_bus">RF Sběrnice</option>
                </select>

                {conduitPoints.length >= 2 && (
                  <button
                    onClick={handleFinishConduit}
                    className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Dokončit trasu ({conduitPoints.length} bodů)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Snapping, Zoom, Delete */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSnapEnabled(!isSnapEnabled)}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition ${
                isSnapEnabled
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
              title="Magnetické přichytávání k mřížce (10 cm)"
            >
              <Magnet className="w-3.5 h-3.5" /> Magnet ({gridStepMeters * 100}cm)
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            <button
              onClick={() => setScale((s) => Math.min(220, s * 1.2))}
              className="p-1 text-slate-300 hover:bg-slate-800 rounded"
              title="Přiblížit"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale((s) => Math.max(20, s / 1.2))}
              className="p-1 text-slate-300 hover:bg-slate-800 rounded"
              title="Oddálit"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setScale(60);
                setOffset({ x: 80, y: 80 });
              }}
              className="p-1 text-slate-300 hover:bg-slate-800 rounded"
              title="Resetovat zobrazení"
            >
              <Maximize className="w-4 h-4" />
            </button>

            {selectedItemId && (
              <button
                onClick={() => {
                  if (project.walls.some((w) => w.id === selectedItemId)) {
                    onUpdateProject({
                      ...project,
                      walls: project.walls.filter((w) => w.id !== selectedItemId),
                    });
                    onSelectItem(null);
                  } else if (project.rooms.some((r) => r.id === selectedItemId)) {
                    onUpdateProject({
                      ...project,
                      rooms: project.rooms.filter((r) => r.id !== selectedItemId),
                    });
                    onSelectItem(null);
                  }
                }}
                className="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-bold flex items-center gap-1 transition ml-1"
                title="Smazat vybraný prvek (Delete)"
              >
                <Trash2 className="w-3.5 h-3.5" /> Smazat
              </button>
            )}
          </div>
        </div>

        {/* CAD Canvas */}
        <div
          ref={containerRef}
          className="w-full h-full relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => {
            e.preventDefault();
            // Cancel current drawing
            setWallStartPoint(null);
            setRoomStartPoint(null);
          }}
        >
          <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

          {/* Bottom helper HUD */}
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl backdrop-blur-md bg-slate-900/90 border border-slate-700/60 text-xs text-slate-300 flex items-center gap-4 shadow-xl pointer-events-none">
            <div>
              Kurzor: <span className="text-cyan-400">X: {mouseMeters.x.toFixed(2)}m</span>,{' '}
              <span className="text-cyan-400">Y: {mouseMeters.y.toFixed(2)}m</span>
            </div>
            <div className="h-3.5 w-px bg-slate-700" />
            <div>
              Měřítko: <span className="text-slate-400">{scale.toFixed(0)} px/m</span>
            </div>
            <div className="h-3.5 w-px bg-slate-700" />
            <div className="text-amber-400 font-bold">
              {activeTool === 'wall' && (wallStartPoint ? 'Klikněte pro koncový bod (nebo ESC pro zrušení)' : 'Klikněte pro počáteční bod zdi')}
              {activeTool === 'room' && (roomStartPoint ? 'Klikněte pro protější roh místnosti' : 'Klikněte pro první roh místnosti')}
              {activeTool === 'select' && 'Tažením bílých bodů lze přímo měnit délku a polohu zdí'}
            </div>
          </div>
        </div>
      </div>

      {/* Right Architectural Panel: Inspector & Lists */}
      <aside className="w-84 bg-slate-950/95 border-l border-slate-800/80 flex flex-col p-3 overflow-hidden shrink-0 space-y-3 z-10">
        {/* Tab switcher */}
        <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-1 text-[11px]">
          <button
            onClick={() => setSidebarTab('rooms')}
            className={`flex-1 py-1 rounded text-center font-bold transition ${
              sidebarTab === 'rooms' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Místnosti ({project.rooms.length})
          </button>
          <button
            onClick={() => setSidebarTab('walls')}
            className={`flex-1 py-1 rounded text-center font-bold transition ${
              sidebarTab === 'walls' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Zdi ({project.walls.length})
          </button>
          <button
            onClick={() => setSidebarTab('templates')}
            className={`flex-1 py-1 rounded text-center font-bold transition ${
              sidebarTab === 'templates' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Šablony
          </button>
        </div>

        {/* Selected element direct numerical editor */}
        {selectedRoom && (
          <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/50 space-y-2">
            <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-slate-800 pb-1">
              <span>EDITACE MÍSTNOSTI</span>
              <button onClick={() => onSelectItem(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div>
              <label className="text-slate-400 block text-[10px]">Název:</label>
              <input
                type="text"
                value={selectedRoom.name}
                onChange={(e) =>
                  onUpdateProject({
                    ...project,
                    rooms: project.rooms.map((r) =>
                      r.id === selectedRoom.id ? { ...r, name: e.target.value } : r
                    ),
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block text-[10px]">Šířka (m):</label>
                <input
                  type="number"
                  step="0.05"
                  value={selectedRoom.width}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      rooms: project.rooms.map((r) =>
                        r.id === selectedRoom.id ? { ...r, width: parseFloat(e.target.value) || 0 } : r
                      ),
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block text-[10px]">Délka (m):</label>
                <input
                  type="number"
                  step="0.05"
                  value={selectedRoom.length}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      rooms: project.rooms.map((r) =>
                        r.id === selectedRoom.id ? { ...r, length: parseFloat(e.target.value) || 0 } : r
                      ),
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-slate-400 pt-1">
              <span>Plocha:</span>
              <span className="text-cyan-400 font-bold">{(selectedRoom.width * selectedRoom.length).toFixed(2)} m²</span>
            </div>
          </div>
        )}

        {selectedWall && (
          <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/50 space-y-2">
            <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-1">
              <span>EDITACE ZDI</span>
              <button onClick={() => onSelectItem(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div>
              <label className="text-slate-400 block text-[10px]">Materiál a útlum:</label>
              <select
                value={selectedWall.material}
                onChange={(e) =>
                  onUpdateProject({
                    ...project,
                    walls: project.walls.map((w) =>
                      w.id === selectedWall.id ? { ...w, material: e.target.value as any } : w
                    ),
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
              >
                <option value="reinforced_concrete">Železobeton (-25 dB)</option>
                <option value="brick_30cm">Cihla 30cm (-12 dB)</option>
                <option value="brick_15cm">Cihla 15cm (-7 dB)</option>
                <option value="plasterboard">Sádrokarton (-3 dB)</option>
                <option value="metal_shield">Kovové stínění (-35 dB)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block text-[10px]">Tloušťka (cm):</label>
                <input
                  type="number"
                  value={selectedWall.thicknessCm}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      walls: project.walls.map((w) =>
                        w.id === selectedWall.id ? { ...w, thicknessCm: parseInt(e.target.value) || 15 } : w
                      ),
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block text-[10px]">Výška (m):</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedWall.heightM}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      walls: project.walls.map((w) =>
                        w.id === selectedWall.id ? { ...w, heightM: parseFloat(e.target.value) || 2.7 } : w
                      ),
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 pt-1">
              Délka zdi:{' '}
              <span className="text-amber-400 font-bold">
                {Math.sqrt(
                  (selectedWall.p2.x - selectedWall.p1.x) ** 2 + (selectedWall.p2.y - selectedWall.p1.y) ** 2
                ).toFixed(2)}{' '}
                m
              </span>
            </div>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {sidebarTab === 'rooms' && (
            <div className="space-y-1.5">
              {project.rooms.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onSelectItem(r.id, 'room')}
                  className={`p-2 rounded-lg cursor-pointer transition border ${
                    selectedItemId === r.id
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span>{r.name}</span>
                    <span className="text-cyan-400">{(r.width * r.length).toFixed(1)} m²</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between pt-0.5">
                    <span>{r.width}m × {r.length}m</span>
                    <span>Výška: {r.ceilingHeight}m</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sidebarTab === 'walls' && (
            <div className="space-y-1.5">
              {project.walls.map((w, i) => {
                const len = Math.sqrt((w.p2.x - w.p1.x) ** 2 + (w.p2.y - w.p1.y) ** 2);
                return (
                  <div
                    key={w.id}
                    onClick={() => onSelectItem(w.id, 'wall')}
                    className={`p-2 rounded-lg cursor-pointer transition border ${
                      selectedItemId === w.id
                        ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                        : 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span>Zeď #{i + 1} ({w.material})</span>
                      <span className="text-amber-400">{len.toFixed(2)} m</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex justify-between pt-0.5">
                      <span>Tloušťka: {w.thicknessCm} cm</span>
                      <span>P1:[{w.p1.x},{w.p1.y}]</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sidebarTab === 'templates' && (
            <div className="space-y-2">
              <div className="text-slate-400 text-[11px] pb-1">
                Rychlé vložení prefabrikované místnosti s obvodovými zdmi:
              </div>

              <button
                onClick={() => addRoomTemplate('Technická místnost (R510/FVE)', 3.5, 2.8, 'reinforced_concrete', 35)}
                className="w-full p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-left transition group"
              >
                <div className="font-bold text-cyan-300 group-hover:text-cyan-200">
                  + Technická místnost / Serverovna
                </div>
                <div className="text-[10px] text-slate-400">
                  3.5m × 2.8m | Železobeton 35cm (-25 dB)
                </div>
              </button>

              <button
                onClick={() => addRoomTemplate('Pracovna PC stanice', 4.5, 3.8, 'brick_30cm', 20)}
                className="w-full p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-left transition group"
              >
                <div className="font-bold text-amber-300 group-hover:text-amber-200">
                  + Pracovna (PC Multi-homed)
                </div>
                <div className="text-[10px] text-slate-400">
                  4.5m × 3.8m | Cihla 20cm (-12 dB)
                </div>
              </button>

              <button
                onClick={() => addRoomTemplate('Obývací pokoj & Smart zásuvky', 6.0, 4.2, 'brick_15cm', 15)}
                className="w-full p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-left transition group"
              >
                <div className="font-bold text-emerald-300 group-hover:text-emerald-200">
                  + Obývací pokoj (EMOS zásuvky)
                </div>
                <div className="text-[10px] text-slate-400">
                  6.0m × 4.2m | Cihla 15cm (-7 dB)
                </div>
              </button>

              <button
                onClick={() => addRoomTemplate('Centrální chodba & L2 páteř', 3.5, 5.2, 'brick_15cm', 15)}
                className="w-full p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-left transition group"
              >
                <div className="font-bold text-purple-300 group-hover:text-purple-200">
                  + Chodba & Šachta rozvodů
                </div>
                <div className="text-[10px] text-slate-400">
                  3.5m × 5.2m | Prostupová šachta
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
