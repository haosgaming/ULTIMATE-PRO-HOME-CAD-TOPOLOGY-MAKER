export interface Position3D {
  x: number; // meters
  y: number; // meters
  z: number; // meters (elevation)
}

export type WallMaterial =
  | 'reinforced_concrete'
  | 'stone'
  | 'brick_30cm'
  | 'brick_15cm'
  | 'plasterboard'
  | 'glass'
  | 'metal_shield'
  | 'wood';

export interface WallSegment {
  id: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  thicknessCm: number;
  heightM: number;
  material: WallMaterial;
}

export interface DevicePort {
  id: string;
  name: string; // e.g. "eth0 (2.5G PCIe)", "uart_rs232", "spi_cc1101", "sma_ant"
  type: 'RJ45_1G' | 'RJ45_2_5G' | 'SFP_PLUS' | 'RS232_RJ45' | 'SPI_BUS' | 'SMA_RF' | 'SCREW_TERMINAL' | 'USB_C';
  status: 'UP' | 'DOWN' | 'TESTING';
  mac?: string;
  ip?: string;
  subnet?: string;
  speedMbps?: number;
  duplex?: 'FULL' | 'HALF';
  poeWatts?: number;
  pinout?: { pin: number; label: string; wireColor?: string; signal: string }[];
  connectorImageUrl?: string; // Custom uploaded illustration image
  connectedToDeviceId?: string;
  connectedToPortId?: string;
}

export interface RFDevice {
  id: string;
  name: string;
  ip: string;
  mac: string;
  position: Position3D;
  frequencyMHz: number; // 433.92, 868.0, 2400.0, 5000.0
  txPowerDbm: number; // e.g. 10 dBm
  hardwareAttenuationOffsetDb: number; // e.g. -30 dB for CC1101 with 868MHz balun filter on 433MHz
  antennaGainDbi: number;
  protocol: 'RF433_EV1527' | 'RF868' | 'ZIGBEE_2_4' | 'BLE' | 'WIFI_2_4' | 'WIFI_5G' | 'ETHERNET';
  ports?: DevicePort[];
  firmwareVersion?: string;
  hardwareModel?: string;
  cpuArchitecture?: string;
  roomName?: string;
}

export const WALL_ATTENUATION_DB: Record<WallSegment['material'], Record<string, number>> = {
  reinforced_concrete: {
    '433': 18,
    '868': 22,
    '2400': 27,
    '5000': 35,
  },
  stone: {
    '433': 16,
    '868': 20,
    '2400': 28,
    '5000': 38,
  },
  brick_30cm: {
    '433': 8,
    '868': 10,
    '2400': 13,
    '5000': 18,
  },
  brick_15cm: {
    '433': 5,
    '868': 6,
    '2400': 8,
    '5000': 12,
  },
  plasterboard: {
    '433': 2,
    '868': 2.5,
    '2400': 3.5,
    '5000': 5,
  },
  glass: {
    '433': 1.5,
    '868': 2,
    '2400': 3,
    '5000': 4.5,
  },
  metal_shield: {
    '433': 30,
    '868': 35,
    '2400': 42,
    '5000': 48,
  },
  wood: {
    '433': 1.8,
    '868': 2.2,
    '2400': 3,
    '5000': 4.5,
  },
};

/**
 * Line segment intersection check between (p1->p2) and (p3->p4)
 */
export function checkLineIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(det) < 1e-9) return false;

  const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
  const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;

  return 0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1;
}

/**
 * Free-space Path Loss (FSPL) formula:
 * FSPL(dB) = 20*log10(d_m) + 20*log10(f_MHz) - 27.55
 * (d in meters, minimum 0.05m to prevent singularity)
 */
export function calculateFSPL(distanceMeters: number, frequencyMHz: number): number {
  const d = Math.max(distanceMeters, 0.05);
  return 20 * Math.log10(d) + 20 * Math.log10(frequencyMHz) - 27.55;
}

/**
 * Find frequency band key closest to device frequency
 */
export function getFrequencyBandKey(freqMHz: number): '433' | '868' | '2400' | '5000' {
  if (freqMHz <= 600) return '433';
  if (freqMHz <= 1500) return '868';
  if (freqMHz <= 3500) return '2400';
  return '5000';
}

/**
 * Calculate RF link budget & signal RSSI at target point
 */
export function calculateSignalAtPoint(
  txDevice: RFDevice,
  targetPos: Position3D,
  walls: WallSegment[],
  rxAntennaGainDbi = 0
): {
  distanceMeters: number;
  rssiDbm: number;
  freeSpaceLossDb: number;
  wallLossDb: number;
  intersectionsCount: number;
  linkStatus: 'NOMINAL' | 'MARGINAL' | 'DROPPED';
} {
  const dx = targetPos.x - txDevice.position.x;
  const dy = targetPos.y - txDevice.position.y;
  const dz = targetPos.z - txDevice.position.z;
  const distanceMeters = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const fspl = calculateFSPL(distanceMeters, txDevice.frequencyMHz);
  const freqBand = getFrequencyBandKey(txDevice.frequencyMHz);

  let wallLossDb = 0;
  let intersectionsCount = 0;

  const pTx = { x: txDevice.position.x, y: txDevice.position.y };
  const pRx = { x: targetPos.x, y: targetPos.y };

  for (const wall of walls) {
    if (checkLineIntersection(pTx, pRx, wall.p1, wall.p2)) {
      intersectionsCount++;
      const baseLoss = WALL_ATTENUATION_DB[wall.material]?.[freqBand] ?? 10;
      // Adjust slightly by thickness if non-standard (normalised to 15cm)
      const thicknessFactor = Math.max(0.5, wall.thicknessCm / 15);
      wallLossDb += baseLoss * thicknessFactor;
    }
  }

  // RSSI calculation:
  // TxPower + TxGain - HardwareMismatchOffset - FSPL - WallLoss + RxGain
  // Hardware mismatch offset is negative (e.g. -30 dB for 868MHz balun on 433MHz)
  const effectiveTxPower = txDevice.txPowerDbm + txDevice.hardwareAttenuationOffsetDb;
  const rssiDbm = effectiveTxPower + txDevice.antennaGainDbi - fspl - wallLossDb + rxAntennaGainDbi;

  let linkStatus: 'NOMINAL' | 'MARGINAL' | 'DROPPED' = 'NOMINAL';
  if (rssiDbm < -88) {
    linkStatus = 'DROPPED';
  } else if (rssiDbm < -75) {
    linkStatus = 'MARGINAL';
  }

  return {
    distanceMeters: Math.round(distanceMeters * 100) / 100,
    rssiDbm: Math.round(rssiDbm * 10) / 10,
    freeSpaceLossDb: Math.round(fspl * 10) / 10,
    wallLossDb: Math.round(wallLossDb * 10) / 10,
    intersectionsCount,
    linkStatus,
  };
}
