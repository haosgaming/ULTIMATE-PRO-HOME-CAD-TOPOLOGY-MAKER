import {
  Position3D,
  WallSegment,
  WallMaterial,
  RFDevice,
  DevicePort,
  MaterialAttenuationMap,
  MaterialMetadata,
  MATERIAL_METADATA,
  WALL_ATTENUATION_DB,
  RFInterferenceSource,
  InterferenceSourceType,
  SignalCalculationResult,
} from '../utils/rf-engine.ts';
export type {
  Position3D,
  WallSegment,
  WallMaterial,
  RFDevice,
  DevicePort,
  MaterialAttenuationMap,
  MaterialMetadata,
  RFInterferenceSource,
  InterferenceSourceType,
  SignalCalculationResult,
};
export { MATERIAL_METADATA, WALL_ATTENUATION_DB };

export type ConduitLayer = 'ethernet' | 'power' | 'water' | 'drainage' | 'rf_bus';

export interface InWallConduit {
  id: string;
  name: string;
  layer: ConduitLayer;
  specification: string; // e.g. "Cat6A S/FTP", "CYKY 3x2.5", "PEX-AL-PEX 16mm", "HT 50"
  wallId?: string; // If embedded inside a specific wall
  points: Position3D[]; // 3D waypoints
  diameterMm: number;
  status: 'installed' | 'planned' | 'testing';
  notes?: string;
}

export type RoomShape = 'rectangle' | 'square' | 'l_shape' | 't_shape' | 'angled';

export interface Room {
  id: string;
  name: string;
  floor: number;
  x: number; // top-left x in meters
  y: number; // top-left y in meters
  width: number; // meters
  length: number; // meters
  ceilingHeight: number; // meters (e.g. 2.7)
  floorMaterial: 'concrete_screed' | 'tiles' | 'wood_parquet' | 'vinyl';
  shape?: RoomShape;
  polygon?: { x: number; y: number }[]; // custom polygon vertices
  notes?: string;
}

export type FurnitureType =
  | 'rack_server'
  | 'fve_inverter'
  | 'fve_battery_bank'
  | 'desk'
  | 'cabinet'
  | 'metal_door'
  | 'water_boiler'
  | 'sofa'
  | 'terrace_pergola'
  | 'car_parking'
  | 'workshop_bench'
  | 'courtyard_paving';

export interface FurnitureItem {
  id: string;
  name: string;
  type: FurnitureType;
  position: Position3D;
  width: number; // meters
  length: number; // meters
  height: number; // meters
  rotationY: number; // degrees
  rfAttenuationDb: number;
  notes?: string;
}

export interface NetworkConnection {
  id: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  medium: 'CAT6A' | 'WIFI_2_4' | 'WIFI_5' | 'ZIGBEE' | 'RF433' | 'BLE' | 'RS232' | 'FIBER';
  speedMbps?: number;
  ipSubnet?: string;
  metric?: number;
  status: 'UP' | 'DEGRADED' | 'DOWN';
}

export type InterferenceType = 'none' | 'microwave_2_4ghz' | 'motor_emi' | 'channel_congestion' | 'ble_beacon_storm';

export interface SignalSimParams {
  activeTxDeviceId: string;
  frequencyBand: '433' | '868' | '2400' | '5000' | 'auto';
  txPowerDbm: number;
  antennaGainDbi: number;
  noiseFloorDbm: number; // -105 dBm typical thermal noise floor
  interferenceType: InterferenceType;
  interferenceIntensityDb: number;
  enableBalunFilterPenalty: boolean; // For CC1101 868MHz balun on 433MHz (-30 dB)
  showIsolines: boolean;
  resolutionCm: number; // Heatmap grid step: 20cm or 50cm
  heatmapMetric?: 'rssi' | 'snr'; // Visualization mode
}

export interface TopologyProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rooms: Room[];
  walls: WallSegment[];
  conduits: InWallConduit[];
  furniture: FurnitureItem[];
  devices: RFDevice[];
  connections: NetworkConnection[];
  interferenceSources?: RFInterferenceSource[];
  notes: string;
  customAttenuation?: MaterialAttenuationMap;
  nasConfig: {
    truenasIp: string;
    dataset: string;
    lastBackupTimestamp?: string;
  };
}
