import React, { useState } from 'react';
import { Room, WallSegment, TopologyProject } from '../types/topology.ts';
import { Ruler, Check, X, Target, Crosshair } from 'lucide-react';

interface LaserMeterModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TopologyProject;
  onUpdateProject: (updated: TopologyProject) => void;
}

export const LaserMeterModal: React.FC<LaserMeterModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
}) => {
  const [mode, setMode] = useState<'new_room' | 'calibrate_wall'>('new_room');
  const [roomName, setRoomName] = useState<string>('Nová místnost');
  const [widthMeters, setWidthMeters] = useState<number>(4.25);
  const [lengthMeters, setLengthMeters] = useState<number>(3.6);
  const [ceilingMeters, setCeilingMeters] = useState<number>(2.7);
  const [wallThicknessCm, setWallThicknessCm] = useState<number>(15);
  const [wallMaterial, setWallMaterial] = useState<WallSegment['material']>('brick_15cm');
  const [floorMaterial, setFloorMaterial] = useState<Room['floorMaterial']>('wood_parquet');

  // Calibration mode
  const [selectedWallId, setSelectedWallId] = useState<string>(project.walls[0]?.id || '');
  const [measuredLaserDistance, setMeasuredLaserDistance] = useState<number>(3.5);

  if (!isOpen) return null;

  const handleCreateRoom = () => {
    // Determine placement offset so it doesn't overlap perfectly
    const existingCount = project.rooms.length;
    const offsetX = (existingCount % 2) * 5.0;
    const offsetY = Math.floor(existingCount / 2) * 5.0;

    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: roomName,
      floor: 1,
      x: offsetX,
      y: offsetY,
      width: widthMeters,
      length: lengthMeters,
      ceilingHeight: ceilingMeters,
      floorMaterial,
      notes: `Výměra laserovým dálkoměrem: ${widthMeters}m × ${lengthMeters}m = ${(widthMeters * lengthMeters).toFixed(2)} m²`,
    };

    // Auto-generate 4 perimeter walls
    const p1 = { x: offsetX, y: offsetY };
    const p2 = { x: offsetX + widthMeters, y: offsetY };
    const p3 = { x: offsetX + widthMeters, y: offsetY + lengthMeters };
    const p4 = { x: offsetX, y: offsetY + lengthMeters };

    const newWalls: WallSegment[] = [
      { id: `wall-${Date.now()}-1`, p1, p2, thicknessCm: wallThicknessCm, heightM: ceilingMeters, material: wallMaterial },
      { id: `wall-${Date.now()}-2`, p1: p2, p2: p3, thicknessCm: wallThicknessCm, heightM: ceilingMeters, material: wallMaterial },
      { id: `wall-${Date.now()}-3`, p1: p3, p2: p4, thicknessCm: wallThicknessCm, heightM: ceilingMeters, material: wallMaterial },
      { id: `wall-${Date.now()}-4`, p1: p4, p2: p1, thicknessCm: wallThicknessCm, heightM: ceilingMeters, material: wallMaterial },
    ];

    onUpdateProject({
      ...project,
      rooms: [...project.rooms, newRoom],
      walls: [...project.walls, ...newWalls],
    });

    onClose();
  };

  const handleCalibrateWall = () => {
    const wall = project.walls.find((w) => w.id === selectedWallId);
    if (!wall) return;

    // Recalculate p2 based on p1 and measured laser distance along existing angle
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const currentLen = Math.sqrt(dx * dx + dy * dy);
    if (currentLen === 0) return;

    const scale = measuredLaserDistance / currentLen;
    const updatedWall: WallSegment = {
      ...wall,
      p2: {
        x: Math.round((wall.p1.x + dx * scale) * 100) / 100,
        y: Math.round((wall.p1.y + dy * scale) * 100) / 100,
      },
    };

    onUpdateProject({
      ...project,
      walls: project.walls.map((w) => (w.id === wall.id ? updatedWall : w)),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <Crosshair className="w-5 h-5 text-red-500 animate-pulse" />
            <span>PŘESNÝ LASEROVÝ DÁLKOMĚR / KALIBRACE</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setMode('new_room')}
            className={`px-3 py-1.5 rounded text-xs transition ${
              mode === 'new_room'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Nová místnost z laserových rozměrů
          </button>
          <button
            onClick={() => setMode('calibrate_wall')}
            className={`px-3 py-1.5 rounded text-xs transition ${
              mode === 'calibrate_wall'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Kalibrace stávající zdi
          </button>
        </div>

        {mode === 'new_room' ? (
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Název místnosti / sekce:</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Šířka (laserový odečet v metrech):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={widthMeters}
                    onChange={(e) => setWidthMeters(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-bold text-sm"
                  />
                  <span className="absolute right-3 top-2 text-slate-500">m</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Délka (laserový odečet v metrech):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={lengthMeters}
                    onChange={(e) => setLengthMeters(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-bold text-sm"
                  />
                  <span className="absolute right-3 top-2 text-slate-500">m</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Výška stropu:</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    value={ceilingMeters}
                    onChange={(e) => setCeilingMeters(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  />
                  <span className="absolute right-3 top-2 text-slate-500">m</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tloušťka obvodové zdi:</label>
                <div className="relative">
                  <input
                    type="number"
                    value={wallThicknessCm}
                    onChange={(e) => setWallThicknessCm(parseInt(e.target.value) || 15)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  />
                  <span className="absolute right-3 top-2 text-slate-500">cm</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Materiál zdí:</label>
                <select
                  value={wallMaterial}
                  onChange={(e) => setWallMaterial(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                >
                  <option value="stone">Kamenná zeď / Lomové zdivo (-28 dB)</option>
                  <option value="reinforced_concrete">Železobeton (-25 dB)</option>
                  <option value="brick_30cm">Cihla 30cm (-12 dB)</option>
                  <option value="brick_15cm">Cihla 15cm (-7 dB)</option>
                  <option value="plasterboard">Sádrokarton (-3 dB)</option>
                  <option value="metal_shield">Kovové stínění (-35 dB)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Podlahová krytina:</label>
                <select
                  value={floorMaterial}
                  onChange={(e) => setFloorMaterial(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                >
                  <option value="tiles">Dlažba (keramická)</option>
                  <option value="wood_parquet">Dřevěné parkety</option>
                  <option value="concrete_screed">Betonový potěr</option>
                  <option value="vinyl">Vinyl / PVC</option>
                </select>
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700 flex items-center justify-between">
              <span className="text-slate-400">Propočtená podlahová plocha:</span>
              <span className="text-cyan-400 font-bold text-sm">
                {(widthMeters * lengthMeters).toFixed(2)} m²
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Zrušit
              </button>
              <button
                onClick={handleCreateRoom}
                className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
              >
                <Check className="w-4 h-4" /> Vytvořit místnost a zdi
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Vyberte zeď pro přeměření:</label>
              <select
                value={selectedWallId}
                onChange={(e) => setSelectedWallId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
              >
                {project.walls.map((w) => (
                  <option key={w.id} value={w.id}>
                    Zeď {w.id} ({w.material}) [P1: {w.p1.x}, {w.p1.y} → P2: {w.p2.x}, {w.p2.y}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Skutečná naměřená délka (z laserového dálkoměru):</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.005"
                  value={measuredLaserDistance}
                  onChange={(e) => setMeasuredLaserDistance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-bold text-base"
                />
                <span className="absolute right-3 top-2.5 text-slate-500">m</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Zrušit
              </button>
              <button
                onClick={handleCalibrateWall}
                className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
              >
                <Check className="w-4 h-4" /> Kalibrovat rozměr
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
