import { WallSegment } from './rf-engine.ts';
import { ConduitLayer, InWallConduit, Position3D } from '../types/topology.ts';

export interface AutoRouteOptions {
  start: { x: number; y: number; z?: number };
  end: { x: number; y: number; z?: number };
  walls: WallSegment[];
  conduitLayer?: ConduitLayer;
  specification?: string;
  diameterMm?: number;
  gridResolution?: number; // meters, default 0.25 (25cm)
  avoidStructuralPenalty?: number; // Multiplier for load bearing concrete/stone, default 80
}

export interface WallPenetration {
  wallId: string;
  material: WallSegment['material'];
  thicknessCm: number;
  point: { x: number; y: number };
  isStructural: boolean;
  notes?: string;
}

export interface AutoRouteResult {
  success: boolean;
  points: Position3D[];
  totalDistanceMeters: number;
  wallPenetrations: WallPenetration[];
  structuralPenetrationsCount: number;
  lightPenetrationsCount: number;
  conduitProposal: InWallConduit;
}

/**
 * Returns exact intersection coordinate between segment (p1->p2) and (p3->p4)
 */
export function getSegmentIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { x: number; y: number } | null {
  const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(det) < 1e-9) return null;

  const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
  const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

  if (lambda >= 0 && lambda <= 1 && gamma >= 0 && gamma <= 1) {
    return {
      x: Math.round((p1.x + lambda * (p2.x - p1.x)) * 1000) / 1000,
      y: Math.round((p1.y + lambda * (p2.y - p1.y)) * 1000) / 1000,
    };
  }
  return null;
}

/**
 * Material penetration penalty (in equivalent extra meters of traversal cost).
 * Nosné konstrukce (železobeton, masivní kamenné zdivo) mají obrovskou penalizaci,
 * aby A* přirozeně volil trasu přes nenosné příčky, podhledy nebo chodby.
 */
export function getMaterialPenetrationPenalty(
  material: WallSegment['material'],
  thicknessCm: number
): { penaltyMeters: number; isStructural: boolean } {
  const thicknessFactor = Math.max(0.5, thicknessCm / 15);

  switch (material) {
    case 'reinforced_concrete':
      // Nosný železobeton: kritické riziko poškození statiky a armatury -> vysoce nežádoucí
      return { penaltyMeters: 65 * thicknessFactor, isStructural: true };
    case 'stone':
      // Lomové / kamenné zdivo 50-80cm: extrémní tloušťka a pracnost průrazu
      return { penaltyMeters: 45 * thicknessFactor, isStructural: true };
    case 'metal_shield':
      // Stínění / ocelové konstrukce
      return { penaltyMeters: 40 * thicknessFactor, isStructural: true };
    case 'glass':
      // Okenní sklo: skrz sklo nelze drážkovat ani vrtat
      return { penaltyMeters: 9999, isStructural: false };
    case 'brick_30cm':
      // Nosná pálená cihla 30cm: možné, ale s vyšším úsilím
      return { penaltyMeters: 14 * thicknessFactor, isStructural: true };
    case 'brick_15cm':
      // Nenosná příčkovka: běžné drážkování pro chráničky
      return { penaltyMeters: 3.5 * thicknessFactor, isStructural: false };
    case 'wood':
      // Dřevěná příčka / trám
      return { penaltyMeters: 3.0 * thicknessFactor, isStructural: false };
    case 'plasterboard':
      // Sádrokarton: dutá příčka, minimální odpor pro protažení chráničky
      return { penaltyMeters: 1.0 * thicknessFactor, isStructural: false };
    default:
      return { penaltyMeters: 5 * thicknessFactor, isStructural: false };
  }
}

interface GridNode {
  gx: number;
  gy: number;
  x: number;
  y: number;
}

/**
 * Auto-Route Conduit using A* pathfinding across a 2D spatial grid,
 * prioritizing structural preservation of reinforced concrete and stone masonry.
 */
export function autoRouteConduit(options: AutoRouteOptions): AutoRouteResult {
  const {
    start,
    end,
    walls,
    conduitLayer = 'ethernet',
    specification,
    diameterMm = 20,
    gridResolution = 0.25, // 25 cm grid step
  } = options;

  const defaultSpec =
    specification ||
    (conduitLayer === 'ethernet'
      ? 'Cat6A S/FTP v chráničce FXP 20mm'
      : conduitLayer === 'power'
      ? 'CYKY-J 3x2.5mm v chráničce 20mm'
      : conduitLayer === 'water'
      ? 'PEX-AL-PEX 16x2mm v izolaci'
      : conduitLayer === 'drainage'
      ? 'HT 50 PP svod'
      : 'Koaxiální RF 50 Ohm chránička');

  // 1. Calculate bounding box with margin
  let minX = Math.min(start.x, end.x);
  let maxX = Math.max(start.x, end.x);
  let minY = Math.min(start.y, end.y);
  let maxY = Math.max(start.y, end.y);

  for (const w of walls) {
    minX = Math.min(minX, w.p1.x, w.p2.x);
    maxX = Math.max(maxX, w.p1.x, w.p2.x);
    minY = Math.min(minY, w.p1.y, w.p2.y);
    maxY = Math.max(maxY, w.p1.y, w.p2.y);
  }

  // Margin around floorplan (1 meter)
  minX = Math.floor(minX - 1.0);
  minY = Math.floor(minY - 1.0);
  maxX = Math.ceil(maxX + 1.0);
  maxY = Math.ceil(maxY + 1.0);

  const cols = Math.round((maxX - minX) / gridResolution) + 1;
  const rows = Math.round((maxY - minY) / gridResolution) + 1;

  const nodeToCoord = (gx: number, gy: number): { x: number; y: number } => ({
    x: Math.round((minX + gx * gridResolution) * 100) / 100,
    y: Math.round((minY + gy * gridResolution) * 100) / 100,
  });

  const coordToNode = (x: number, y: number): { gx: number; gy: number } => ({
    gx: Math.max(0, Math.min(cols - 1, Math.round((x - minX) / gridResolution))),
    gy: Math.max(0, Math.min(rows - 1, Math.round((y - minY) / gridResolution))),
  });

  const startNode = coordToNode(start.x, start.y);
  const endNode = coordToNode(end.x, end.y);

  const startKey = `${startNode.gx},${startNode.gy}`;
  const endKey = `${endNode.gx},${endNode.gy}`;

  // Evaluate wall crossing cost between two world positions
  const getStepCost = (
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): number => {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    let penalty = 0;

    for (const wall of walls) {
      if (getSegmentIntersection(from, to, wall.p1, wall.p2)) {
        const pInfo = getMaterialPenetrationPenalty(wall.material, wall.thicknessCm);
        penalty += pInfo.penaltyMeters;
      }
    }

    return dist + penalty;
  };

  // Euclidean heuristic
  const heuristic = (gx: number, gy: number): number => {
    const p = nodeToCoord(gx, gy);
    return Math.hypot(end.x - p.x, end.y - p.y);
  };

  // Min-priority open set
  const openSet = new Map<string, { gx: number; gy: number; fScore: number }>();
  openSet.set(startKey, {
    gx: startNode.gx,
    gy: startNode.gy,
    fScore: heuristic(startNode.gx, startNode.gy),
  });

  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  gScore.set(startKey, 0);

  // 8-directional neighbor offsets
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  let currentKey = startKey;
  let iterations = 0;
  const maxIterations = 25000;

  while (openSet.size > 0 && iterations < maxIterations) {
    iterations++;

    // Find node in openSet with lowest fScore
    let bestKey = '';
    let lowestF = Infinity;
    for (const [key, node] of openSet.entries()) {
      if (node.fScore < lowestF) {
        lowestF = node.fScore;
        bestKey = key;
      }
    }

    currentKey = bestKey;
    const current = openSet.get(currentKey)!;

    if (currentKey === endKey) {
      break;
    }

    openSet.delete(currentKey);
    const currentCoord = nodeToCoord(current.gx, current.gy);
    const currentG = gScore.get(currentKey) ?? Infinity;

    for (const dir of directions) {
      const ngx = current.gx + dir.dx;
      const ngy = current.gy + dir.dy;

      if (ngx < 0 || ngx >= cols || ngy < 0 || ngy >= rows) continue;

      const neighborKey = `${ngx},${ngy}`;
      const neighborCoord = nodeToCoord(ngx, ngy);

      const stepCost = getStepCost(currentCoord, neighborCoord);
      const tentativeG = currentG + stepCost;

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        const fScore = tentativeG + heuristic(ngx, ngy);
        openSet.set(neighborKey, { gx: ngx, gy: ngy, fScore });
      }
    }
  }

  // Reconstruct path
  const rawPath: { x: number; y: number }[] = [];
  let curr: string | undefined = endKey;

  if (cameFrom.has(endKey) || startKey === endKey) {
    while (curr) {
      const [gxStr, gyStr] = curr.split(',');
      const c = nodeToCoord(parseInt(gxStr), parseInt(gyStr));
      rawPath.unshift(c);
      curr = cameFrom.get(curr);
    }
  } else {
    // Fallback: direct line if disconnected
    rawPath.push({ x: start.x, y: start.y }, { x: end.x, y: end.y });
  }

  // Ensure exact start and end coordinates are preserved
  if (rawPath.length > 0) {
    rawPath[0] = { x: start.x, y: start.y };
    rawPath[rawPath.length - 1] = { x: end.x, y: end.y };
  }

  // Path simplification (smoothing collinear / redundant nodes and raycasting line-of-sight shortcuts)
  const smoothedPath = simplifyConduitPath(rawPath, walls);

  // Map to 3D waypoints with elevation z
  const elevationZ = start.z ?? end.z ?? 1.2;
  const points3D: Position3D[] = smoothedPath.map((p) => ({
    x: Math.round(p.x * 100) / 100,
    y: Math.round(p.y * 100) / 100,
    z: elevationZ,
  }));

  // Calculate total physical metric distance
  let totalDistanceMeters = 0;
  for (let i = 0; i < points3D.length - 1; i++) {
    totalDistanceMeters += Math.hypot(
      points3D[i + 1].x - points3D[i].x,
      points3D[i + 1].y - points3D[i].y
    );
  }
  totalDistanceMeters = Math.round(totalDistanceMeters * 100) / 100;

  // Identify all wall penetrations along the final smoothed path
  const wallPenetrations: WallPenetration[] = [];
  let structuralPenetrationsCount = 0;
  let lightPenetrationsCount = 0;

  for (let i = 0; i < points3D.length - 1; i++) {
    const pA = { x: points3D[i].x, y: points3D[i].y };
    const pB = { x: points3D[i + 1].x, y: points3D[i + 1].y };

    for (const wall of walls) {
      const pt = getSegmentIntersection(pA, pB, wall.p1, wall.p2);
      if (pt) {
        // Prevent duplicate logging if vertex is right on the wall
        const alreadyLogged = wallPenetrations.some(
          (wp) => wp.wallId === wall.id && Math.hypot(wp.point.x - pt.x, wp.point.y - pt.y) < 0.15
        );
        if (!alreadyLogged) {
          const penaltyInfo = getMaterialPenetrationPenalty(wall.material, wall.thicknessCm);
          if (penaltyInfo.isStructural) {
            structuralPenetrationsCount++;
          } else {
            lightPenetrationsCount++;
          }
          wallPenetrations.push({
            wallId: wall.id,
            material: wall.material,
            thicknessCm: wall.thicknessCm,
            point: pt,
            isStructural: penaltyInfo.isStructural,
            notes: penaltyInfo.isStructural
              ? `Nosná konstrukce (${wall.material}) - vyžaduje jádrový prostup`
              : `Příčka (${wall.material}) - standardní drážkování`,
          });
        }
      }
    }
  }

  const conduitProposal: InWallConduit = {
    id: `conduit-auto-${Date.now()}`,
    name: `Auto-Trasa ${conduitLayer.toUpperCase()} (${start.x.toFixed(1)},${start.y.toFixed(1)} -> ${end.x.toFixed(1)},${end.y.toFixed(1)})`,
    layer: conduitLayer,
    specification: defaultSpec,
    points: points3D,
    diameterMm,
    status: 'planned',
    notes: `Navrženo Auto-Route Conduit. Délka: ${totalDistanceMeters}m, nosných průrazů: ${structuralPenetrationsCount}, lehkých příček: ${lightPenetrationsCount}.`,
  };

  return {
    success: points3D.length >= 2,
    points: points3D,
    totalDistanceMeters,
    wallPenetrations,
    structuralPenetrationsCount,
    lightPenetrationsCount,
    conduitProposal,
  };
}

/**
 * Simplifies a dense grid path using Line-of-Sight shortcutting (string-pulling)
 * without introducing new structural wall crossings.
 */
function simplifyConduitPath(
  path: { x: number; y: number }[],
  walls: WallSegment[]
): { x: number; y: number }[] {
  if (path.length <= 2) return path;

  const result: { x: number; y: number }[] = [path[0]];
  let currentIdx = 0;

  while (currentIdx < path.length - 1) {
    let furthestVisible = currentIdx + 1;

    // Look ahead as far as possible
    for (let testIdx = path.length - 1; testIdx > currentIdx + 1; testIdx--) {
      if (canShortcutDirectly(path[currentIdx], path[testIdx], path.slice(currentIdx, testIdx + 1), walls)) {
        furthestVisible = testIdx;
        break;
      }
    }

    result.push(path[furthestVisible]);
    currentIdx = furthestVisible;
  }

  return result;
}

/**
 * Checks if direct line between pA and pB does not penetrate any additional
 * structural walls compared to following the subpath.
 */
function canShortcutDirectly(
  pA: { x: number; y: number },
  pB: { x: number; y: number },
  subpath: { x: number; y: number }[],
  walls: WallSegment[]
): boolean {
  // Count penetrations on original subpath
  let originalStructuralCount = 0;
  for (let i = 0; i < subpath.length - 1; i++) {
    for (const w of walls) {
      if (getSegmentIntersection(subpath[i], subpath[i + 1], w.p1, w.p2)) {
        const pInfo = getMaterialPenetrationPenalty(w.material, w.thicknessCm);
        if (pInfo.isStructural) originalStructuralCount++;
      }
    }
  }

  // Count penetrations on proposed direct shortcut
  let directStructuralCount = 0;
  for (const w of walls) {
    if (getSegmentIntersection(pA, pB, w.p1, w.p2)) {
      const pInfo = getMaterialPenetrationPenalty(w.material, w.thicknessCm);
      if (pInfo.penaltyMeters > 500) {
        // e.g. glass or impassable obstacle
        return false;
      }
      if (pInfo.isStructural) directStructuralCount++;
    }
  }

  // Only permit shortcut if it does not introduce new structural penetrations
  return directStructuralCount <= originalStructuralCount;
}
