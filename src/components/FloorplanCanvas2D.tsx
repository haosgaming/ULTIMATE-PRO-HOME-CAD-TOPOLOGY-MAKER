import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  TopologyProject,
  ConduitLayer,
  SignalSimParams,
  InWallConduit,
} from '../types/topology.ts';
import { RFDevice, WallSegment, calculateSignalAtPoint } from '../utils/rf-engine.ts';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  PenTool,
  Radio,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface FloorplanCanvas2DProps {
  project: TopologyProject;
  simParams: SignalSimParams;
  onUpdateProject: (updated: TopologyProject) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string | null, type?: 'device' | 'wall' | 'furniture' | 'conduit') => void;
  activeLayers: Record<ConduitLayer | 'rf' | 'walls' | 'furniture' | 'devices', boolean>;
  onToggleLayer: (layer: ConduitLayer | 'rf' | 'walls' | 'furniture' | 'devices') => void;
  onCaptureImageUri?: (dataUri: string) => void;
  theme?: 'dark' | 'light';
}

export const FloorplanCanvas2D: React.FC<FloorplanCanvas2DProps> = ({
  project,
  simParams,
  onUpdateProject,
  selectedItemId,
  onSelectItem,
  activeLayers,
  onToggleLayer,
  onCaptureImageUri,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom
  const [scale, setScale] = useState<number>(65); // pixels per meter
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tools
  const [activeTool, setActiveTool] = useState<'select' | 'draw_wall' | 'draw_conduit' | 'measure'>('select');
  const [wallStartPoint, setWallStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [mousePosMeters, setMousePosMeters] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedDeviceId, setDraggedDeviceId] = useState<string | null>(null);

  // New wall settings
  const [newWallMaterial, setNewWallMaterial] = useState<WallSegment['material']>('brick_15cm');
  const [newWallThickness, setNewWallThickness] = useState<number>(15);

  // Snap to 10cm grid
  const snapToGrid = (val: number, step = 0.1): number => {
    return Math.round(val / step) * step;
  };

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

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;

    // Clear background
    ctx.fillStyle = theme === 'light' ? '#f8fafc' : '#07090e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Grid (1m major, 0.2m minor)
    const startWorld = screenToWorld(0, 0);
    const endWorld = screenToWorld(canvas.width, canvas.height);

    ctx.strokeStyle = theme === 'light' ? '#e2e8f0' : '#141c2c';
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

    // Major 1m grid lines with numbers
    ctx.strokeStyle = theme === 'light' ? '#cbd5e1' : '#1e293b';
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

    // 2. RF Heatmap Overlay (if active)
    if (activeLayers.rf) {
      const activeTx = project.devices.find((d) => d.id === simParams.activeTxDeviceId) || project.devices[0];
      if (activeTx) {
        const stepMeters = simParams.resolutionCm / 100; // 0.2m or 0.5m
        const minX = Math.max(0, Math.floor(startWorld.x));
        const maxX = Math.min(10, Math.ceil(endWorld.x));
        const minY = Math.max(0, Math.floor(startWorld.y));
        const maxY = Math.min(8.5, Math.ceil(endWorld.y));

        for (let gx = minX; gx <= maxX; gx += stepMeters) {
          for (let gy = minY; gy <= maxY; gy += stepMeters) {
            const signal = calculateSignalAtPoint(
              activeTx,
              { x: gx, y: gy, z: 1.0 },
              project.walls
            );

            let effectiveRssi = signal.rssiDbm;
            if (simParams.interferenceType !== 'none') {
              effectiveRssi -= simParams.interferenceIntensityDb;
            }

            // Normalise (-95 dBm to -40 dBm)
            const norm = Math.max(0, Math.min(1, (effectiveRssi + 95) / 55));
            const p = worldToScreen(gx, gy);
            const w = stepMeters * scale;
            const h = stepMeters * scale;

            let alpha = 0.28;
            if (norm > 0.7) {
              ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`; // Electric Cyan
            } else if (norm > 0.45) {
              ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`; // Emerald Green
            } else if (norm > 0.25) {
              ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`; // Solar Amber
            } else {
              ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`; // Crimson
            }
            ctx.fillRect(p.x, p.y, w, h);
          }
        }

        // Concentric range circles around TX
        const txPos = worldToScreen(activeTx.position.x, activeTx.position.y);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Range rings at 1m, 3m, 5m
        [1, 3, 5].forEach((distM) => {
          ctx.beginPath();
          ctx.arc(txPos.x, txPos.y, distM * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#00f0ff';
          ctx.font = '9px monospace';
          ctx.fillText(`${distM}m`, txPos.x + distM * scale + 2, txPos.y - 2);
        });
        ctx.setLineDash([]);
      }
    }

    // 3. Rooms
    project.rooms.forEach((room) => {
      const tl = worldToScreen(room.x, room.y);
      const w = room.width * scale;
      const h = room.length * scale;

      let roomFill = 'rgba(20, 26, 38, 0.65)';
      let roomBorder = '#334155';

      if (room.id.includes('terrace')) {
        roomFill = 'rgba(45, 30, 20, 0.65)';
        roomBorder = '#78350f';
      } else if (room.id.includes('courtyard')) {
        roomFill = 'rgba(20, 45, 30, 0.65)';
        roomBorder = '#065f46';
      } else if (room.id.includes('driveway')) {
        roomFill = 'rgba(25, 28, 36, 0.7)';
        roomBorder = '#1e293b';
      } else if (room.id.includes('workshop')) {
        roomFill = 'rgba(24, 34, 48, 0.65)';
        roomBorder = '#0369a1';
      }

      ctx.fillStyle = roomFill;
      ctx.strokeStyle = roomBorder;
      ctx.lineWidth = 1;

      if (room.polygon && room.polygon.length > 2) {
        ctx.beginPath();
        const startPt = worldToScreen(room.polygon[0].x, room.polygon[0].y);
        ctx.moveTo(startPt.x, startPt.y);
        for (let i = 1; i < room.polygon.length; i++) {
          const pt = worldToScreen(room.polygon[i].x, room.polygon[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(tl.x, tl.y, w, h);
        ctx.strokeRect(tl.x, tl.y, w, h);
      }

      // Room name & dimensions label
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(room.name, tl.x + 8, tl.y + 20);

      ctx.font = '10px monospace';
      ctx.fillStyle = '#64748b';
      const area = (room.width * room.length).toFixed(1);
      const shapeLabel = room.shape ? ` [${room.shape.toUpperCase()}]` : '';
      ctx.fillText(`${room.width}m × ${room.length}m (${area} m²)${shapeLabel}`, tl.x + 8, tl.y + 34);
    });

    // 4. In-Wall Conduits by Layer
    const conduitColors: Record<ConduitLayer, string> = {
      ethernet: '#00f0ff',
      power: '#f59e0b',
      water: '#38bdf8',
      drainage: '#64748b',
      rf_bus: '#a855f7',
    };

    project.conduits.forEach((conduit) => {
      if (!activeLayers[conduit.layer]) return;
      if (conduit.points.length < 2) return;

      const isSelected = selectedItemId === conduit.id;
      ctx.strokeStyle = conduitColors[conduit.layer] || '#00f0ff';
      ctx.lineWidth = isSelected ? 4 : Math.max(2, (conduit.diameterMm / 1000) * scale * 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      conduit.points.forEach((pt, idx) => {
        const s = worldToScreen(pt.x, pt.y);
        if (idx === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();

      // Nodes on conduit
      conduit.points.forEach((pt) => {
        const s = worldToScreen(pt.x, pt.y);
        ctx.fillStyle = conduitColors[conduit.layer];
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // 5. Walls
    if (activeLayers.walls) {
      project.walls.forEach((wall) => {
        const p1 = worldToScreen(wall.p1.x, wall.p1.y);
        const p2 = worldToScreen(wall.p2.x, wall.p2.y);
        const thicknessPx = Math.max(3, (wall.thicknessCm / 100) * scale);
        const isSelected = selectedItemId === wall.id;

        ctx.strokeStyle = isSelected
          ? '#00f0ff'
          : wall.material === 'reinforced_concrete'
          ? '#475569'
          : wall.material.includes('brick')
          ? '#854d0e'
          : '#94a3b8';

        ctx.lineWidth = thicknessPx;
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Wall core centerline
        ctx.strokeStyle = isSelected ? '#ffffff' : '#0f172a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });
    }

    // 6. Furniture
    if (activeLayers.furniture) {
      project.furniture.forEach((furn) => {
        const pos = worldToScreen(furn.position.x, furn.position.y);
        const w = furn.width * scale;
        const l = furn.length * scale;
        const isSelected = selectedItemId === furn.id;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate((furn.rotationY * Math.PI) / 180);

        ctx.fillStyle = isSelected ? 'rgba(0, 240, 255, 0.4)' : '#1e293b';
        ctx.strokeStyle = isSelected ? '#00f0ff' : '#475569';
        ctx.lineWidth = 1.5;

        ctx.fillRect(-w / 2, -l / 2, w, l);
        ctx.strokeRect(-w / 2, -l / 2, w, l);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(furn.name.substring(0, 15), 0, 3);
        ctx.restore();
      });
    }

    // 7. Network connections (links)
    project.connections.forEach((conn) => {
      const src = project.devices.find((d) => d.id === conn.sourceDeviceId);
      const tgt = project.devices.find((d) => d.id === conn.targetDeviceId);
      if (!src || !tgt) return;

      const p1 = worldToScreen(src.position.x, src.position.y);
      const p2 = worldToScreen(tgt.position.x, tgt.position.y);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);

      if (conn.medium === 'CAT6A') {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      } else if (conn.medium === 'WIFI_2_4' || conn.medium === 'WIFI_5') {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
      } else {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 8. Devices
    if (activeLayers.devices) {
      project.devices.forEach((dev) => {
        const pos = worldToScreen(dev.position.x, dev.position.y);
        const isSelected = selectedItemId === dev.id;
        const isTx = dev.id === simParams.activeTxDeviceId;

        let dotColor = '#00f0ff';
        if (dev.protocol === 'RF433_EV1527') dotColor = '#a855f7';
        if (dev.protocol === 'ZIGBEE_2_4') dotColor = '#10b981';

        // Outer glow if TX
        if (isTx) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
          ctx.fill();
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isSelected ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : '#0a0d14';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Balun warning indicator
        if (dev.hardwareAttenuationOffsetDb <= -25) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dev.name, pos.x, pos.y - 12);

        ctx.font = '9px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${dev.ip}`, pos.x, pos.y + 16);
      });
    }

    // 9. Drawing guide for new wall
    if (activeTool === 'draw_wall' && wallStartPoint) {
      const p1 = worldToScreen(wallStartPoint.x, wallStartPoint.y);
      const p2 = worldToScreen(mousePosMeters.x, mousePosMeters.y);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const dx = mousePosMeters.x - wallStartPoint.x;
      const dy = mousePosMeters.y - wallStartPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy).toFixed(2);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${dist} m`, (p1.x + p2.x) / 2 + 10, (p1.y + p2.y) / 2 - 10);
    }
  }, [
    project,
    simParams,
    scale,
    offset,
    activeLayers,
    selectedItemId,
    activeTool,
    wallStartPoint,
    mousePosMeters,
    screenToWorld,
    worldToScreen,
  ]);

  // Handle Mouse Events for CAD interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldPos = screenToWorld(clientX, clientY);
    const snappedWorld = {
      x: snapToGrid(worldPos.x, 0.1),
      y: snapToGrid(worldPos.y, 0.1),
    };

    if (e.button === 1 || e.buttons === 4 || activeTool === 'select' && e.altKey) {
      // Pan with middle click or Alt+Drag
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (activeTool === 'select') {
      // Check if clicked near a device
      const clickedDevice = project.devices.find((dev) => {
        const dx = dev.position.x - worldPos.x;
        const dy = dev.position.y - worldPos.y;
        return Math.sqrt(dx * dx + dy * dy) < 0.4;
      });

      if (clickedDevice) {
        onSelectItem(clickedDevice.id, 'device');
        setDraggedDeviceId(clickedDevice.id);
        return;
      }

      // Check if clicked near a wall
      const clickedWall = project.walls.find((w) => {
        const l2 = (w.p2.x - w.p1.x) ** 2 + (w.p2.y - w.p1.y) ** 2;
        if (l2 === 0) return false;
        const t = Math.max(0, Math.min(1, ((worldPos.x - w.p1.x) * (w.p2.x - w.p1.x) + (worldPos.y - w.p1.y) * (w.p2.y - w.p1.y)) / l2));
        const projX = w.p1.x + t * (w.p2.x - w.p1.x);
        const projY = w.p1.y + t * (w.p2.y - w.p1.y);
        const dist = Math.sqrt((worldPos.x - projX) ** 2 + (worldPos.y - projY) ** 2);
        return dist < 0.35;
      });

      if (clickedWall) {
        onSelectItem(clickedWall.id, 'wall');
        return;
      }

      // Check furniture
      const clickedFurn = project.furniture.find((f) => {
        const dx = Math.abs(f.position.x - worldPos.x);
        const dy = Math.abs(f.position.y - worldPos.y);
        return dx <= f.width / 2 && dy <= f.length / 2;
      });

      if (clickedFurn) {
        onSelectItem(clickedFurn.id, 'furniture');
        return;
      }

      // Start panning canvas
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeTool === 'draw_wall') {
      if (!wallStartPoint) {
        setWallStartPoint(snappedWorld);
      } else {
        // Create wall
        const newWall: WallSegment = {
          id: `wall-${Date.now()}`,
          p1: wallStartPoint,
          p2: snappedWorld,
          thicknessCm: newWallThickness,
          heightM: 2.7,
          material: newWallMaterial,
        };
        onUpdateProject({
          ...project,
          walls: [...project.walls, newWall],
        });
        setWallStartPoint(null);
        onSelectItem(newWall.id, 'wall');
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const worldPos = screenToWorld(clientX, clientY);
    setMousePosMeters({
      x: snapToGrid(worldPos.x, 0.05),
      y: snapToGrid(worldPos.y, 0.05),
    });

    if (isPanning) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (draggedDeviceId) {
      // Drag device in world
      const snapped = {
        x: snapToGrid(worldPos.x, 0.1),
        y: snapToGrid(worldPos.y, 0.1),
      };
      onUpdateProject({
        ...project,
        devices: project.devices.map((d) =>
          d.id === draggedDeviceId ? { ...d, position: { ...d.position, x: snapped.x, y: snapped.y } } : d
        ),
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedDeviceId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.max(20, Math.min(200, scale * zoomFactor));

    // Zoom towards mouse
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

  const capture2dSnapshot = () => {
    if (canvasRef.current && onCaptureImageUri) {
      const dataUri = canvasRef.current.toDataURL('image/png');
      onCaptureImageUri(dataUri);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* 2D CAD Top Action Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl backdrop-blur-md bg-slate-900/80 border border-slate-700/60 shadow-xl">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-800/60 flex items-center gap-1">
            <PenTool className="w-3.5 h-3.5" /> 2D CAD FLOORPLAN
          </span>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Mode Selector */}
          <button
            onClick={() => {
              setActiveTool('select');
              setWallStartPoint(null);
            }}
            className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1 ${
              activeTool === 'select'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Move className="w-3 h-3" /> Výběr / Posun
          </button>

          <button
            onClick={() => setActiveTool('draw_wall')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition flex items-center gap-1 ${
              activeTool === 'draw_wall'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <PenTool className="w-3 h-3" /> Kreslit Zeď
          </button>

          {activeTool === 'draw_wall' && (
            <div className="flex items-center gap-1.5 ml-1 bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
              <span className="text-[11px] text-slate-400">Materiál:</span>
              <select
                value={newWallMaterial}
                onChange={(e) => setNewWallMaterial(e.target.value as any)}
                className="text-xs bg-slate-900 text-slate-200 rounded px-1.5 py-0.5 border border-slate-700"
              >
                <option value="reinforced_concrete">Železobeton (-25 dB)</option>
                <option value="brick_30cm">Cihla 30cm (-12 dB)</option>
                <option value="brick_15cm">Cihla 15cm (-7 dB)</option>
                <option value="plasterboard">Sádrokarton (-3 dB)</option>
                <option value="metal_shield">Kovové stínění (-35 dB)</option>
              </select>

              <span className="text-[11px] text-slate-400 ml-1">Tl. (cm):</span>
              <input
                type="number"
                value={newWallThickness}
                onChange={(e) => setNewWallThickness(parseInt(e.target.value) || 15)}
                className="w-12 text-xs bg-slate-900 text-cyan-300 rounded px-1 py-0.5 border border-slate-700 text-center"
              />
            </div>
          )}
        </div>

        {/* Layer Checkboxes */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleLayer('ethernet')}
            className={`px-2 py-1 text-xs rounded font-mono border transition ${
              activeLayers.ethernet
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                : 'text-slate-500 border-transparent hover:bg-slate-800'
            }`}
          >
            Ethernet
          </button>
          <button
            onClick={() => onToggleLayer('power')}
            className={`px-2 py-1 text-xs rounded font-mono border transition ${
              activeLayers.power
                ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                : 'text-slate-500 border-transparent hover:bg-slate-800'
            }`}
          >
            Elektro
          </button>
          <button
            onClick={() => onToggleLayer('water')}
            className={`px-2 py-1 text-xs rounded font-mono border transition ${
              activeLayers.water
                ? 'bg-sky-950 text-sky-300 border-sky-500/50'
                : 'text-slate-500 border-transparent hover:bg-slate-800'
            }`}
          >
            Voda
          </button>
          <button
            onClick={() => onToggleLayer('drainage')}
            className={`px-2 py-1 text-xs rounded font-mono border transition ${
              activeLayers.drainage
                ? 'bg-slate-800 text-slate-300 border-slate-600'
                : 'text-slate-500 border-transparent hover:bg-slate-800'
            }`}
          >
            Odpad
          </button>
          <button
            onClick={() => onToggleLayer('rf')}
            className={`px-2 py-1 text-xs rounded font-mono border transition ${
              activeLayers.rf
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                : 'text-slate-500 border-transparent hover:bg-slate-800'
            }`}
          >
            RF Heatmap
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Zoom buttons */}
          <button
            onClick={() => setScale((s) => Math.min(200, s * 1.2))}
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
              setScale(65);
              setOffset({ x: 80, y: 80 });
            }}
            className="p-1 text-slate-300 hover:bg-slate-800 rounded"
            title="Reset pohledu"
          >
            <Maximize className="w-4 h-4" />
          </button>

          <button
            onClick={capture2dSnapshot}
            className="px-2 py-1 text-xs text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 rounded border border-cyan-800/60 font-mono"
            title="Uložit snímek pro export do PDF"
          >
            Foto do PDF
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

        {/* Bottom coordinate HUD */}
        <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg backdrop-blur-md bg-slate-900/80 border border-slate-700/60 text-xs font-mono text-slate-300 flex items-center gap-3 shadow-lg pointer-events-none">
          <div>
            Pozice kurzoru: <span className="text-cyan-400">X: {mousePosMeters.x.toFixed(2)}m</span>,{' '}
            <span className="text-cyan-400">Y: {mousePosMeters.y.toFixed(2)}m</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div>Měřítko: <span className="text-slate-400">{scale.toFixed(0)} px/m</span></div>
          {activeTool === 'draw_wall' && (
            <div className="text-amber-400 font-bold">
              {wallStartPoint ? 'Klikněte pro koncový bod zdi' : 'Klikněte pro počáteční bod zdi'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
