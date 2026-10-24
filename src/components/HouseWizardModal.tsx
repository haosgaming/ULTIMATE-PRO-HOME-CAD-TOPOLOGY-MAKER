import React, { useState } from 'react';
import {
  TopologyProject,
  Room,
  RoomShape,
  FurnitureItem,
  InWallConduit,
} from '../types/topology.ts';
import { WallSegment, RFDevice } from '../utils/rf-engine.ts';
import {
  Home,
  Layers,
  Compass,
  Check,
  X,
  Plus,
  Trash2,
  Car,
  Wrench,
  Trees,
  Sun,
  Shield,
  Square,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Eye,
  Sliders,
  Maximize2,
  Box,
} from 'lucide-react';

export interface RoomConfig {
  id: string;
  name: string;
  floor: number;
  shape: RoomShape;
  width: number;
  length: number;
  ceilingHeight?: number;
  floorMaterial: Room['floorMaterial'];
  notes?: string;
  enabled: boolean;
}

interface HouseWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateProject: (newProject: TopologyProject) => void;
  theme?: 'dark' | 'light';
}

export const HouseWizardModal: React.FC<HouseWizardModalProps> = ({
  isOpen,
  onClose,
  onGenerateProject,
  theme = 'dark',
}) => {
  const [step, setStep] = useState<number>(1);

  // KROK 1: Parametry budovy, podlaží, stěny & půdní prostor
  const [floorsCount, setFloorsCount] = useState<number>(1);
  const [ceilingHeight, setCeilingHeight] = useState<number>(2.7);
  const [wallMaterial, setWallMaterial] = useState<WallSegment['material']>('brick_30cm');
  const [wallThicknessCm, setWallThicknessCm] = useState<number>(30);
  const [roofType, setRoofType] = useState<'attic_storage' | 'loft_living' | 'flat_fve' | 'gabled_mast'>('flat_fve');

  // KROK 2: Místnosti a jejich tvar & rozměry
  const [roomsList, setRoomsList] = useState<RoomConfig[]>([
    {
      id: 'room-tech',
      name: 'Serverovna / Technická místnost',
      floor: 1,
      shape: 'rectangle',
      width: 3.5,
      length: 2.8,
      floorMaterial: 'tiles',
      notes: 'Dell PowerEdge R510, HAOS MiniPC, TrueNAS SCALE, FVE Carspa MKS1000-12 a LiFePO4 baterie.',
      enabled: true,
    },
    {
      id: 'room-office',
      name: 'Pracovna (PC stanice)',
      floor: 1,
      shape: 'rectangle',
      width: 4.5,
      length: 3.8,
      floorMaterial: 'wood_parquet',
      notes: 'PC 2.5G PCIe (192.168.1.82) + 1G LAN (192.168.1.81), ESP32-S3 CC1101 Gateway.',
      enabled: true,
    },
    {
      id: 'room-corridor',
      name: 'Centrální chodba & L2 páteř',
      floor: 1,
      shape: 'l_shape',
      width: 3.5,
      length: 5.2,
      floorMaterial: 'tiles',
      notes: 'Páteřní kabelová trasa Cat6A v podhledu, rozvod vody PEX a odpadu HT50.',
      enabled: true,
    },
    {
      id: 'room-living',
      name: 'Obývací pokoj & Smart zásuvky',
      floor: 1,
      shape: 'l_shape',
      width: 6.0,
      length: 4.5,
      floorMaterial: 'wood_parquet',
      notes: 'Samoučící zásuvky EMOS P0065 (EV1527 protokol 3), Zigbee osvětlení a 4-tlačítkový dálkový ovladač.',
      enabled: true,
    },
    {
      id: 'room-kitchen',
      name: 'Kuchyň & Jídelna',
      floor: 1,
      shape: 'rectangle',
      width: 4.0,
      length: 3.8,
      floorMaterial: 'tiles',
      notes: 'Indukční varná deska, mikrovlnná trouba (simulace rušení 2.45 GHz).',
      enabled: true,
    },
    {
      id: 'room-bath',
      name: 'Koupelna & Technická šachta TUV',
      floor: 1,
      shape: 'square',
      width: 3.2,
      length: 3.2,
      floorMaterial: 'tiles',
      notes: 'Bojler TUV, stoupačka kanalizace HT50, IoT čidla vytopení.',
      enabled: true,
    },
    {
      id: 'room-bedroom',
      name: 'Ložnice',
      floor: 1,
      shape: 'rectangle',
      width: 4.5,
      length: 3.8,
      floorMaterial: 'wood_parquet',
      notes: 'Zigbee multisenzory teploty, přítomnosti a kvality vzduchu CO2.',
      enabled: true,
    },
  ]);

  // KROK 3: Exteriér a venkovní zóny
  // 1. Terasa
  const [includeTerrace, setIncludeTerrace] = useState<boolean>(true);
  const [terraceType, setTerraceType] = useState<'pergola' | 'deck' | 'patio'>('pergola');
  const [terraceShape, setTerraceShape] = useState<RoomShape>('rectangle');
  const [terraceWidth, setTerraceWidth] = useState<number>(4.5);
  const [terraceLength, setTerraceLength] = useState<number>(4.0);

  // 2. Vnitřní dvůr / zahrada
  const [includeCourtyard, setIncludeCourtyard] = useState<boolean>(true);
  const [courtyardType, setCourtyardType] = useState<'paved' | 'lawn' | 'gravel'>('paved');
  const [courtyardWidth, setCourtyardWidth] = useState<number>(7.0);
  const [courtyardLength, setCourtyardLength] = useState<number>(5.5);

  // 3. Samostatná dílna / garáž
  const [includeWorkshop, setIncludeWorkshop] = useState<boolean>(true);
  const [workshopType, setWorkshopType] = useState<'workshop' | 'garage_workshop' | 'outbuilding'>('workshop');
  const [workshopWidth, setWorkshopWidth] = useState<number>(5.5);
  const [workshopLength, setWorkshopLength] = useState<number>(6.0);
  const [workshopEmi, setWorkshopEmi] = useState<boolean>(true);

  // 4. Příjezdová cesta s parkovacím stáním
  const [includeDriveway, setIncludeDriveway] = useState<boolean>(true);
  const [drivewayType, setDrivewayType] = useState<'paved_drive' | 'asphalt' | 'carport'>('carport');
  const [parkingSpots, setParkingSpots] = useState<number>(2);
  const [drivewayWidth, setDrivewayWidth] = useState<number>(6.0);
  const [drivewayLength, setDrivewayLength] = useState<number>(7.0);

  // Helper pro manipulaci s místnostmi
  const handleAddRoom = () => {
    const newId = `room-${Date.now().toString(36)}`;
    const newRoom: RoomConfig = {
      id: newId,
      name: `Nová místnost #${roomsList.length + 1}`,
      floor: 1,
      shape: 'rectangle',
      width: 4.0,
      length: 3.5,
      floorMaterial: 'wood_parquet',
      notes: 'Přídavná místnost pro IoT topologii.',
      enabled: true,
    };
    setRoomsList([...roomsList, newRoom]);
  };

  const handleRemoveRoom = (id: string) => {
    setRoomsList(roomsList.filter((r) => r.id !== id));
  };

  const handleUpdateRoom = (id: string, updates: Partial<RoomConfig>) => {
    setRoomsList(roomsList.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Rychlé předvolby počtu místností
  const applyPresetRooms = (presetType: 'minimal' | 'family' | 'extended') => {
    if (presetType === 'minimal') {
      // 4 základní místnosti
      setRoomsList([
        {
          id: 'room-tech',
          name: 'Serverovna & FVE',
          floor: 1,
          shape: 'square',
          width: 3.0,
          length: 3.0,
          floorMaterial: 'tiles',
          notes: 'Rack Dell R510, HAOS, TrueNAS, FVE Carspa.',
          enabled: true,
        },
        {
          id: 'room-office',
          name: 'Pracovna (PC stanice)',
          floor: 1,
          shape: 'rectangle',
          width: 4.5,
          length: 3.5,
          floorMaterial: 'wood_parquet',
          notes: 'PC 2.5G & 1G, ESP32 Gateway.',
          enabled: true,
        },
        {
          id: 'room-living',
          name: 'Obývací pokoj',
          floor: 1,
          shape: 'rectangle',
          width: 5.5,
          length: 4.0,
          floorMaterial: 'wood_parquet',
          notes: 'RF zásuvky EMOS P0065.',
          enabled: true,
        },
        {
          id: 'room-corridor',
          name: 'Chodba & Rozvaděč',
          floor: 1,
          shape: 'rectangle',
          width: 2.5,
          length: 4.0,
          floorMaterial: 'tiles',
          notes: 'Hlavní kabelová trasa.',
          enabled: true,
        },
      ]);
    } else if (presetType === 'family') {
      // 7 místností
      setRoomsList([
        {
          id: 'room-tech',
          name: 'Serverovna / Technická místnost',
          floor: 1,
          shape: 'rectangle',
          width: 3.5,
          length: 2.8,
          floorMaterial: 'tiles',
          notes: 'Dell R510, HAOS MiniPC, TrueNAS, FVE Carspa.',
          enabled: true,
        },
        {
          id: 'room-office',
          name: 'Pracovna (PC stanice)',
          floor: 1,
          shape: 'rectangle',
          width: 4.5,
          length: 3.8,
          floorMaterial: 'wood_parquet',
          notes: 'PC 2.5G & 1G, ESP32-S3 CC1101 Gateway.',
          enabled: true,
        },
        {
          id: 'room-corridor',
          name: 'Centrální chodba',
          floor: 1,
          shape: 'l_shape',
          width: 3.5,
          length: 5.2,
          floorMaterial: 'tiles',
          notes: 'Páteřní rozvody Cat6A a potrubí.',
          enabled: true,
        },
        {
          id: 'room-living',
          name: 'Obývací pokoj',
          floor: 1,
          shape: 'l_shape',
          width: 6.0,
          length: 4.5,
          floorMaterial: 'wood_parquet',
          notes: 'Samoučící zásuvky EMOS P0065.',
          enabled: true,
        },
        {
          id: 'room-kitchen',
          name: 'Kuchyň & Jídelna',
          floor: 1,
          shape: 'rectangle',
          width: 4.0,
          length: 3.8,
          floorMaterial: 'tiles',
          notes: 'Indukce a mikrovlnné rušení.',
          enabled: true,
        },
        {
          id: 'room-bath',
          name: 'Koupelna & TUV',
          floor: 1,
          shape: 'square',
          width: 3.2,
          length: 3.2,
          floorMaterial: 'tiles',
          notes: 'Bojler TUV, stoupačka HT50.',
          enabled: true,
        },
        {
          id: 'room-bedroom',
          name: 'Ložnice',
          floor: 1,
          shape: 'rectangle',
          width: 4.5,
          length: 3.8,
          floorMaterial: 'wood_parquet',
          notes: 'Zigbee multisenzory.',
          enabled: true,
        },
      ]);
    } else if (presetType === 'extended') {
      // 9 místností s patrem
      setFloorsCount(2);
      setRoomsList([
        {
          id: 'room-tech',
          name: 'Serverovna / Technická místnost',
          floor: 1,
          shape: 'rectangle',
          width: 3.5,
          length: 2.8,
          floorMaterial: 'tiles',
          notes: 'Dell R510, HAOS MiniPC, TrueNAS, FVE Carspa.',
          enabled: true,
        },
        {
          id: 'room-office',
          name: 'Pracovna (PC stanice)',
          floor: 1,
          shape: 'rectangle',
          width: 4.5,
          length: 3.8,
          floorMaterial: 'wood_parquet',
          notes: 'PC 2.5G & 1G, ESP32-S3 CC1101 Gateway.',
          enabled: true,
        },
        {
          id: 'room-corridor',
          name: 'Centrální chodba',
          floor: 1,
          shape: 'l_shape',
          width: 3.5,
          length: 5.2,
          floorMaterial: 'tiles',
          notes: 'Páteřní rozvody Cat6A a potrubí.',
          enabled: true,
        },
        {
          id: 'room-living',
          name: 'Obývací pokoj',
          floor: 1,
          shape: 'l_shape',
          width: 6.0,
          length: 4.5,
          floorMaterial: 'wood_parquet',
          notes: 'Samoučící zásuvky EMOS P0065.',
          enabled: true,
        },
        {
          id: 'room-kitchen',
          name: 'Kuchyň & Jídelna',
          floor: 1,
          shape: 'rectangle',
          width: 4.0,
          length: 3.8,
          floorMaterial: 'tiles',
          notes: 'Indukce a mikrovlnné rušení.',
          enabled: true,
        },
        {
          id: 'room-bath',
          name: 'Koupelna Přízemí',
          floor: 1,
          shape: 'square',
          width: 3.2,
          length: 3.2,
          floorMaterial: 'tiles',
          notes: 'Bojler TUV, stoupačka HT50.',
          enabled: true,
        },
        {
          id: 'room-guest',
          name: 'Hostinský pokoj',
          floor: 1,
          shape: 'rectangle',
          width: 4.0,
          length: 3.5,
          floorMaterial: 'wood_parquet',
          notes: 'Přízemní pokoj pro hosty.',
          enabled: true,
        },
        {
          id: 'room-bedroom-up',
          name: 'Hlavní ložnice (1.NP)',
          floor: 2,
          shape: 'rectangle',
          width: 5.0,
          length: 4.0,
          floorMaterial: 'wood_parquet',
          notes: 'Horní patro, Zigbee zóna.',
          enabled: true,
        },
        {
          id: 'room-hall-up',
          name: 'Horní hala & Schodiště (1.NP)',
          floor: 2,
          shape: 't_shape',
          width: 4.0,
          length: 4.5,
          floorMaterial: 'wood_parquet',
          notes: 'Schodišťová šachta, AP PoE Wi-Fi.',
          enabled: true,
        },
      ]);
    }
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-[#090d16] border-cyan-500/50' : 'bg-[#ffffff] border-slate-300';
  const headerBg = isDark ? 'bg-[#05070e] border-slate-800' : 'bg-[#f1f5f9] border-slate-300';
  const cardBg = isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-[#f8fafc] border-slate-200';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';

  // Helper pro generování zdí a polygonů podle tvaru
  const buildRoomWallsAndPolygon = (
    r: RoomConfig,
    originX: number,
    originY: number,
    wallMat: WallSegment['material'],
    thicknessCm: number,
    heightM: number
  ) => {
    const walls: WallSegment[] = [];
    let polygon: { x: number; y: number }[] = [];
    const w = r.width;
    const l = r.length;

    if (r.shape === 'square') {
      const side = Math.min(w, l);
      polygon = [
        { x: originX, y: originY },
        { x: originX + side, y: originY },
        { x: originX + side, y: originY + side },
        { x: originX, y: originY + side },
      ];
    } else if (r.shape === 'l_shape') {
      // 6-bodový L-tvar polygon
      const w1 = w * 0.55;
      const l1 = l * 0.55;
      polygon = [
        { x: originX, y: originY },
        { x: originX + w, y: originY },
        { x: originX + w, y: originY + l1 },
        { x: originX + w1, y: originY + l1 },
        { x: originX + w1, y: originY + l },
        { x: originX, y: originY + l },
      ];
    } else if (r.shape === 't_shape') {
      // 8-bodový T-tvar polygon
      const wingW = w * 0.25;
      const wingL = l * 0.45;
      polygon = [
        { x: originX, y: originY },
        { x: originX + w, y: originY },
        { x: originX + w, y: originY + wingL },
        { x: originX + w - wingW, y: originY + wingL },
        { x: originX + w - wingW, y: originY + l },
        { x: originX + wingW, y: originY + l },
        { x: originX + wingW, y: originY + wingL },
        { x: originX, y: originY + wingL },
      ];
    } else if (r.shape === 'angled') {
      // 5-bodový polygon se zkoseným rohem
      const chamfer = Math.min(w, l) * 0.3;
      polygon = [
        { x: originX, y: originY },
        { x: originX + w - chamfer, y: originY },
        { x: originX + w, y: originY + chamfer },
        { x: originX + w, y: originY + l },
        { x: originX, y: originY + l },
      ];
    } else {
      // Standardní obdélník
      polygon = [
        { x: originX, y: originY },
        { x: originX + w, y: originY },
        { x: originX + w, y: originY + l },
        { x: originX, y: originY + l },
      ];
    }

    // Vytvoření stěn ze sousedních vrcholů polygonu
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      walls.push({
        id: `w-${r.id}-${i}`,
        p1: { x: p1.x, y: p1.y },
        p2: { x: p2.x, y: p2.y },
        thicknessCm,
        heightM,
        material: wallMat,
      });
    }

    return { walls, polygon };
  };

  const handleGenerate = () => {
    const rooms: Room[] = [];
    const walls: WallSegment[] = [];
    const conduits: InWallConduit[] = [];
    const furniture: FurnitureItem[] = [];

    const activeRooms = roomsList.filter((r) => r.enabled);

    // Automatický layout místností s inteligentním uspořádáním
    let curX = 0;
    let curY = 0;
    let maxRowHeight = 0;
    const maxRowWidth = 14.0; // maximální šířka domu před zalomením do další řady

    activeRooms.forEach((rc) => {
      // Pokud by místnost přetekla řádek, posuneme na další řádek
      if (curX > 0 && curX + rc.width > maxRowWidth) {
        curX = 0;
        curY += maxRowHeight + 0.5; // mezera mezi zónami
        maxRowHeight = 0;
      }

      const { walls: roomWalls, polygon } = buildRoomWallsAndPolygon(
        rc,
        curX,
        curY,
        wallMaterial,
        wallThicknessCm,
        rc.ceilingHeight || ceilingHeight
      );

      rooms.push({
        id: rc.id,
        name: rc.name,
        floor: rc.floor,
        x: curX,
        y: curY,
        width: rc.width,
        length: rc.length,
        ceilingHeight: rc.ceilingHeight || ceilingHeight,
        floorMaterial: rc.floorMaterial,
        shape: rc.shape,
        polygon,
        notes: rc.notes,
      });

      walls.push(...roomWalls);

      // Nábytek specifický pro klíčové místnosti
      if (rc.id === 'room-tech' || rc.name.toLowerCase().includes('server')) {
        furniture.push({
          id: 'furn-rack',
          name: 'Server Rack 19" (Dell R510, HAOS, TrueNAS)',
          type: 'rack_server',
          position: { x: curX + 0.9, y: curY + 0.8, z: 0 },
          width: 0.8,
          length: 1.0,
          height: 1.8,
          rotationY: 0,
          rfAttenuationDb: 18,
        });

        furniture.push({
          id: 'furn-inverter',
          name: 'CARSPA MKS1000-12 Střídač FVE',
          type: 'fve_inverter',
          position: { x: curX + 0.5, y: curY + 2.0, z: 1.0 },
          width: 0.4,
          length: 0.25,
          height: 0.5,
          rotationY: 90,
          rfAttenuationDb: 12,
        });

        furniture.push({
          id: 'furn-battery',
          name: 'LiFePO4 Akumulátor 12V 100Ah (JBD Smart BMS)',
          type: 'fve_battery_bank',
          position: { x: curX + 0.5, y: curY + 1.4, z: 0 },
          width: 0.45,
          length: 0.35,
          height: 0.3,
          rotationY: 0,
          rfAttenuationDb: 14,
        });
      }

      if (rc.id === 'room-office' || rc.name.toLowerCase().includes('pracov')) {
        furniture.push({
          id: 'furn-desk',
          name: 'Pracovní stůl s PC stanicí (2.5G & 1G)',
          type: 'desk',
          position: { x: curX + rc.width * 0.5, y: curY + 1.0, z: 0 },
          width: 1.6,
          length: 0.8,
          height: 0.75,
          rotationY: 0,
          rfAttenuationDb: 2,
        });
      }

      curX += rc.width + 0.2; // tloušťka mezery
      maxRowHeight = Math.max(maxRowHeight, rc.length);
    });

    // EXTERIÉR A VENKOVNÍ ZÓNY
    const exteriorBaseX = Math.max(curX, 12.0) + 1.0;

    // 1. Zastřešená terasa
    if (includeTerrace) {
      const terraceX = 0;
      const terraceY = curY + maxRowHeight + 1.0;

      const { walls: terraceWalls, polygon: tPoly } = buildRoomWallsAndPolygon(
        {
          id: 'room-terrace',
          name: `Zastřešená terasa (${terraceType === 'pergola' ? 'Pergola s lamelami' : 'Venkovní terasa'})`,
          floor: 1,
          shape: terraceShape,
          width: terraceWidth,
          length: terraceLength,
          floorMaterial: 'concrete_screed',
          enabled: true,
        },
        terraceX,
        terraceY,
        'plasterboard',
        15,
        2.5
      );

      rooms.push({
        id: 'room-terrace',
        name: `Zastřešená terasa (${terraceType === 'pergola' ? 'Pergola' : 'Terasa'})`,
        floor: 1,
        x: terraceX,
        y: terraceY,
        width: terraceWidth,
        length: terraceLength,
        ceilingHeight: 2.5,
        floorMaterial: 'concrete_screed',
        shape: terraceShape,
        polygon: tPoly,
        notes: 'Venkovní posezení, venkovní Zigbee osvětlení a dosah RF 433MHz klíčenky.',
      });

      walls.push(...terraceWalls);

      furniture.push({
        id: 'furn-pergola',
        name: 'Hliníková pergola s otočnými lamelami',
        type: 'terrace_pergola',
        position: { x: terraceX + terraceWidth / 2, y: terraceY + terraceLength / 2, z: 0 },
        width: terraceWidth,
        length: terraceLength,
        height: 2.5,
        rotationY: 0,
        rfAttenuationDb: 4,
      });
    }

    // 2. Vnitřní dvůr / zahrada
    if (includeCourtyard) {
      const yardX = includeTerrace ? terraceWidth + 1.5 : 0;
      const yardY = curY + maxRowHeight + 1.0;

      rooms.push({
        id: 'room-courtyard',
        name: `Vnitřní dvůr / Zahrada (${courtyardType === 'paved' ? 'Dlážděný' : 'Okrasný trávník'})`,
        floor: 1,
        x: yardX,
        y: yardY,
        width: courtyardWidth,
        length: courtyardLength,
        ceilingHeight: 0,
        floorMaterial: 'concrete_screed',
        shape: 'rectangle',
        polygon: [
          { x: yardX, y: yardY },
          { x: yardX + courtyardWidth, y: yardY },
          { x: yardX + courtyardWidth, y: yardY + courtyardLength },
          { x: yardX, y: yardY + courtyardLength },
        ],
        notes: 'Volné prostranství pro přímé měření RF šíření (line-of-sight bez útlumu zdí), zavlažovací IoT ventil.',
      });

      furniture.push({
        id: 'furn-yard-paving',
        name: 'Zpevněná plocha vnitřního dvora',
        type: 'courtyard_paving',
        position: { x: yardX + courtyardWidth / 2, y: yardY + courtyardLength / 2, z: 0 },
        width: courtyardWidth,
        length: courtyardLength,
        height: 0.05,
        rotationY: 0,
        rfAttenuationDb: 0,
      });
    }

    // 3. Samostatná technická dílna / garáž
    if (includeWorkshop) {
      const workshopX = exteriorBaseX;
      const workshopY = 0;

      const { walls: wsWalls, polygon: wsPoly } = buildRoomWallsAndPolygon(
        {
          id: 'room-workshop',
          name: `Samostatná dílna / Garáž (${workshopType === 'workshop' ? 'Technická dílna' : 'Dvojgaráž'})`,
          floor: 1,
          shape: 'rectangle',
          width: workshopWidth,
          length: workshopLength,
          floorMaterial: 'concrete_screed',
          enabled: true,
        },
        workshopX,
        workshopY,
        'brick_30cm',
        30,
        3.2
      );

      rooms.push({
        id: 'room-workshop',
        name: `Samostatná dílna & Garáž (Exteriér)`,
        floor: 1,
        x: workshopX,
        y: workshopY,
        width: workshopWidth,
        length: workshopLength,
        ceilingHeight: 3.2,
        floorMaterial: 'concrete_screed',
        shape: 'rectangle',
        polygon: wsPoly,
        notes: `Podružný rozvaděč FVE, elektromotor ${workshopEmi ? '(simulace silného EMI rušení 50Hz / RF šum)' : ''}, podzemní chránička Kopoflex Cat6A.`,
      });

      walls.push(...wsWalls);

      furniture.push({
        id: 'furn-ws-bench',
        name: 'Masivní dílenský ponk se svěrákem a nářadím',
        type: 'workshop_bench',
        position: { x: workshopX + 1.2, y: workshopY + 1.0, z: 0 },
        width: 2.2,
        length: 0.9,
        height: 0.9,
        rotationY: 0,
        rfAttenuationDb: 8,
      });
    }

    // 4. Příjezdová cesta s parkovacím stáním
    if (includeDriveway) {
      const driveX = exteriorBaseX;
      const driveY = (includeWorkshop ? workshopLength : 0) + 1.0;

      rooms.push({
        id: 'room-driveway',
        name: `Příjezdová cesta & Parkování (${parkingSpots} stání)`,
        floor: 1,
        x: driveX,
        y: driveY,
        width: drivewayWidth,
        length: drivewayLength,
        ceilingHeight: 0,
        floorMaterial: 'concrete_screed',
        shape: 'rectangle',
        polygon: [
          { x: driveX, y: driveY },
          { x: driveX + drivewayWidth, y: driveY },
          { x: driveX + drivewayWidth, y: driveY + drivewayLength },
          { x: driveX, y: driveY + drivewayLength },
        ],
        notes: 'Vjezdová brána 433.92MHz (EV1527 kód), venkovní PoE bezpečnostní kamera Hikvision.',
      });

      furniture.push({
        id: 'furn-car-park',
        name: `Parkovací stání s přístřeškem (${parkingSpots} vozidla)`,
        type: 'car_parking',
        position: { x: driveX + drivewayWidth / 2, y: driveY + drivewayLength / 2, z: 0 },
        width: drivewayWidth - 0.4,
        length: drivewayLength - 0.4,
        height: 2.2,
        rotationY: 0,
        rfAttenuationDb: 6,
      });
    }

    // PÁTEŘNÍ IN-WALL VEDENÍ (Ethernet Cat6A, Silová elektřina FVE, Voda PEX, Odpad HT50, Podzemní Kopoflex)
    conduits.push(
      {
        id: 'c-eth-main',
        name: 'Cat6A S/FTP Páteř: Serverovna -> Pracovna',
        layer: 'ethernet',
        specification: 'Cat6A S/FTP 10Gbps měděná páteř',
        diameterMm: 20,
        points: [
          { x: 1.0, y: 1.0, z: 2.4 },
          { x: 3.5, y: 1.0, z: 2.4 },
          { x: 5.5, y: 1.2, z: 0.4 },
        ],
        status: 'installed',
        notes: 'Páteřní spoj mezi L2/L3 switchem a stanicí PC (192.168.1.82).',
      },
      {
        id: 'c-pwr-fve',
        name: 'CYKY Silový okruh: FVE MKS1000-12',
        layer: 'power',
        specification: 'CYKY-J 3x2.5mm² solární střídač',
        diameterMm: 14,
        points: [
          { x: 0.8, y: 2.2, z: 1.5 },
          { x: 0.8, y: 0.5, z: 1.2 },
        ],
        status: 'installed',
        notes: 'Silový přívod z AC výstupu střídače do podružného domovního rozvaděče.',
      },
      {
        id: 'c-water-main',
        name: 'PEX-AL-PEX Rozvod TUV & SV',
        layer: 'water',
        specification: 'PEX-AL-PEX 20x2mm izolované potrubí',
        diameterMm: 26,
        points: [
          { x: 0.5, y: 3.0, z: 0.2 },
          { x: 0.5, y: 7.0, z: 0.2 },
        ],
        status: 'installed',
        notes: 'Technická šachta s hlavním uzávěrem a IoT čidlem průtoku.',
      },
      {
        id: 'c-drain-main',
        name: 'Kanalizační stoupačka HT50 / HT110',
        layer: 'drainage',
        specification: 'HT-Systém PP 110/50mm',
        diameterMm: 50,
        points: [
          { x: 0.8, y: 3.0, z: 0.1 },
          { x: 0.8, y: 7.5, z: 0.1 },
        ],
        status: 'installed',
      }
    );

    // Podzemní kabelová trasa do dílny v chráničce Kopoflex
    if (includeWorkshop) {
      conduits.push({
        id: 'c-eth-workshop',
        name: 'Podzemní chránička Kopoflex Ø40mm: Dům -> Dílna',
        layer: 'ethernet',
        specification: 'Cat6A Outdoor Gel S/FTP v PE chráničce Kopoflex Ø40mm',
        diameterMm: 40,
        points: [
          { x: 3.5, y: 1.0, z: 0.1 },
          { x: exteriorBaseX - 2.0, y: 1.0, z: -0.7 },
          { x: exteriorBaseX + 1.0, y: 1.5, z: 0.8 },
        ],
        status: 'planned',
        notes: 'Nezámrzná hloubka 70 cm pro venkovní 10Gbps páteř a optický záložní kabel.',
      });
    }

    // ZAŘÍZENÍ ZE ZADANÉHO INVENTÁŘE (Dell R510, HAOS, ESP32-S3 brána, Router, Zásuvky EMOS, Klíčenka, Brána)
    const devices: RFDevice[] = [
      {
        id: 'dev-pve',
        name: 'Dell PowerEdge R510 (Proxmox VE 7.4)',
        ip: '192.168.1.108',
        mac: '78:2B:CB:19:0D:FD',
        position: { x: 0.9, y: 0.8, z: 0.6 },
        frequencyMHz: 2400,
        txPowerDbm: 0,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 0,
        protocol: 'ETHERNET',
        hardwareModel: 'Dell PowerEdge R510 (Westmere-EP bez AVX)',
        firmwareVersion: 'Proxmox VE 7.4 (Kernel 5.15)',
        roomName: 'Serverovna / Technická místnost',
      },
      {
        id: 'dev-haos',
        name: 'Home Assistant MiniPC (BARE-METAL HAOS)',
        ip: '192.168.1.110',
        mac: 'B0:5C:DA:3B:05:A9',
        position: { x: 0.9, y: 0.8, z: 1.2 },
        frequencyMHz: 2400,
        txPowerDbm: 12,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 2,
        protocol: 'ZIGBEE_2_4',
        hardwareModel: 'HAOS 18.3 Baremetal s Sonoff Dongle-E',
        firmwareVersion: 'Core 2026.10.2 / EmberZNet',
        roomName: 'Serverovna / Technická místnost',
      },
      {
        id: 'dev-subghz-gw',
        name: 'ESP32-S3 433MHz CC1101 Gateway',
        ip: '192.168.1.109',
        mac: '30:ED:A0:BD:31:F4',
        position: { x: 4.8, y: 2.2, z: 1.2 },
        frequencyMHz: 433.92,
        txPowerDbm: 10,
        hardwareAttenuationOffsetDb: -30, // 868MHz LC balun filtr útlum
        antennaGainDbi: 2,
        protocol: 'RF433_EV1527',
        hardwareModel: 'ESP32-S3-WROOM-1-N16R8 CAM (ESP-IDF v5.5+)',
        firmwareVersion: 'ESPHome v2026.10 (ESP-IDF)',
        roomName: 'Pracovna (PC stanice)',
      },
      {
        id: 'dev-router',
        name: 'ROUTERBE3600 (OpenWrt)',
        ip: '192.168.1.1',
        mac: '78:2B:CB:19:0D:F1',
        position: { x: 1.8, y: 0.6, z: 2.1 },
        frequencyMHz: 2400,
        txPowerDbm: 20,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 4,
        protocol: 'WIFI_2_4',
        hardwareModel: 'OpenWrt BE3600 / GWN7721 Gateway',
        firmwareVersion: 'OpenWrt 24.10 SNAPSHOT',
        roomName: 'Serverovna / Technická místnost',
      },
      {
        id: 'dev-adguard',
        name: 'AdGuard Home (CT 103 v PVE)',
        ip: '192.168.1.50',
        mac: '78:2B:CB:19:0D:50',
        position: { x: 0.9, y: 0.8, z: 0.7 },
        frequencyMHz: 2400,
        txPowerDbm: 0,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 0,
        protocol: 'ETHERNET',
        hardwareModel: 'LXC Container na Proxmox VE 7.4',
        roomName: 'Serverovna / Technická místnost',
      },
      {
        id: 'dev-truenas',
        name: 'truenas2 (TrueNAS SCALE 27.0)',
        ip: '192.168.1.115',
        mac: '78:2B:CB:19:0D:B2',
        position: { x: 0.9, y: 0.8, z: 0.4 },
        frequencyMHz: 2400,
        txPowerDbm: 0,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 0,
        protocol: 'ETHERNET',
        hardwareModel: 'TrueNAS SCALE 27.0 Angelfish (ZFS RAIDZ2)',
        roomName: 'Serverovna / Technická místnost',
      },
      {
        id: 'dev-pc-25g',
        name: 'PC Pracovna (2.5G PCIe & 1G LAN)',
        ip: '192.168.1.82',
        mac: '00:D8:61:94:42:1E',
        position: { x: 5.5, y: 1.2, z: 0.8 },
        frequencyMHz: 2400,
        txPowerDbm: 0,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 0,
        protocol: 'ETHERNET',
        hardwareModel: 'Windows 11 Multi-Homed (Metric 10 na 2.5G, 20 na 1G)',
        roomName: 'Pracovna (PC stanice)',
      },
      {
        id: 'dev-fve-carspa',
        name: 'CARSPA MKS1000-12 (Solar Bridge ESP32)',
        ip: '192.168.1.112',
        mac: '44:17:93:11:88:20',
        position: { x: 0.5, y: 2.0, z: 1.0 },
        frequencyMHz: 2400,
        txPowerDbm: 14,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 1.5,
        protocol: 'WIFI_2_4',
        hardwareModel: 'CARSPA MKS1000-12 (G445) + MAX3232 na ESP32',
        roomName: 'Serverovna / Technická místnost',
      },
      {
        id: 'dev-emos-socket-1',
        name: 'Zásuvka EMOS P0065 A (Obývák)',
        ip: '0.0.0.0',
        mac: 'EV1527:0x2F2F41',
        position: { x: 5.2, y: 4.8, z: 0.3 },
        frequencyMHz: 433.92,
        txPowerDbm: 0,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 0,
        protocol: 'RF433_EV1527',
        hardwareModel: 'EMOS P0065 samoučící zásuvka (Protokol 3 / 2)',
        roomName: 'Obývací pokoj & Smart zásuvky',
      },
      {
        id: 'dev-keyfob',
        name: '4-tlačítkový dálkový ovladač CC1101',
        ip: '0.0.0.0',
        mac: '0x2F2F44',
        position: { x: 5.8, y: 5.4, z: 1.0 },
        frequencyMHz: 433.92,
        txPowerDbm: 10,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 1,
        protocol: 'RF433_EV1527',
        hardwareModel: 'Sub-GHz Keyfob 433.92 MHz (Protokol 1)',
        roomName: 'Obývací pokoj & Smart zásuvky',
      },
    ];

    // Pokud je vybrána vjezdová brána, přidáme bránu jako RF uzel
    if (includeDriveway) {
      devices.push({
        id: 'dev-gate-motor',
        name: 'Pohon vjezdové brány (RF 433.92MHz)',
        ip: '0.0.0.0',
        mac: 'EV1527:0x2F2F48',
        position: { x: exteriorBaseX + 1.0, y: (includeWorkshop ? workshopLength : 0) + 2.0, z: 0.5 },
        frequencyMHz: 433.92,
        txPowerDbm: 0,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 1.5,
        protocol: 'RF433_EV1527',
        hardwareModel: 'Pohon posuvné brány s EV1527 přijímačem',
        roomName: 'Příjezdová cesta & Parkování',
      });
    }

    const newProject: TopologyProject = {
      id: `proj-${Date.now()}`,
      name: `Rodinný dům (${floorsCount} ${floorsCount === 1 ? 'patro' : 'patra'}) s exteriérem`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rooms,
      walls,
      conduits,
      furniture,
      devices,
      connections: [
        { id: 'c1', sourceDeviceId: 'dev-router', targetDeviceId: 'dev-pve', medium: 'CAT6A', speedMbps: 1000, status: 'UP' },
        { id: 'c2', sourceDeviceId: 'dev-router', targetDeviceId: 'dev-haos', medium: 'CAT6A', speedMbps: 1000, status: 'UP' },
        { id: 'c3', sourceDeviceId: 'dev-router', targetDeviceId: 'dev-truenas', medium: 'CAT6A', speedMbps: 1000, status: 'UP' },
        { id: 'c4', sourceDeviceId: 'dev-router', targetDeviceId: 'dev-pc-25g', medium: 'CAT6A', speedMbps: 2500, metric: 10, status: 'UP' },
        { id: 'c5', sourceDeviceId: 'dev-router', targetDeviceId: 'dev-subghz-gw', medium: 'WIFI_2_4', speedMbps: 72, status: 'UP' },
        { id: 'c6', sourceDeviceId: 'dev-subghz-gw', targetDeviceId: 'dev-emos-socket-1', medium: 'RF433', status: 'UP' },
      ],
      notes: `# Konfigurace stavebního modelu budovy & exteriéru
- Počet podlaží: ${floorsCount}
- Světlá výška stropů: ${ceilingHeight} m
- Typ půdního prostoru: ${roofType}
- Zdivo: ${wallMaterial} (${wallThicknessCm} cm)
- Počet definovaných místností: ${rooms.length}
- Zahrnuté exteriérové zóny:
  * Zastřešená terasa: ${includeTerrace ? `Ano (${terraceType}, tvar: ${terraceShape}, ${terraceWidth}x${terraceLength}m)` : 'Ne'}
  * Vnitřní dvůr / zahrada: ${includeCourtyard ? `Ano (${courtyardType}, ${courtyardWidth}x${courtyardLength}m)` : 'Ne'}
  * Samostatná technická dílna: ${includeWorkshop ? `Ano (${workshopType}, ${workshopWidth}x${workshopLength}m)` : 'Ne'}
  * Příjezdová cesta & parkování: ${includeDriveway ? `Ano (${drivewayType}, ${parkingSpots} stání)` : 'Ne'}`,
      nasConfig: {
        truenasIp: '192.168.1.115',
        dataset: 'tank/backups/iot-topology',
        lastBackupTimestamp: new Date().toISOString(),
      },
    };

    localStorage.setItem('house_wizard_started', 'true');
    onGenerateProject(newProject);
    onClose();
  };

  const activeRoomsCount = roomsList.filter((r) => r.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-mono select-none">
      <div className={`${modalBg} border rounded-2xl max-w-5xl w-full h-[92vh] flex flex-col shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`p-4 ${headerBg} border-b flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm tracking-wide ${textPrimary}`}>
                  KONFIGURÁTOR ZÁKLADNÍHO MODELU DOMU & EXTERIÉRU
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                  Krok {step} ze 3
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Parametrický generátor stavebního půdorysu, stěn, pater, půdního prostoru a venkovních zón
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                localStorage.setItem('house_wizard_started', 'true');
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Zavřít"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-slate-800 text-xs bg-slate-950/40">
          <button
            onClick={() => setStep(1)}
            className={`flex-1 py-3 text-center font-bold border-b-2 flex items-center justify-center gap-2 transition ${
              step === 1
                ? 'border-amber-400 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-[10px]">
              1
            </span>
            <span>1. Patra, Půdní prostor & Zdivo</span>
          </button>
          <button
            onClick={() => setStep(2)}
            className={`flex-1 py-3 text-center font-bold border-b-2 flex items-center justify-center gap-2 transition ${
              step === 2
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-[10px]">
              2
            </span>
            <span>2. Počet & Tvar místností ({activeRoomsCount})</span>
          </button>
          <button
            onClick={() => setStep(3)}
            className={`flex-1 py-3 text-center font-bold border-b-2 flex items-center justify-center gap-2 transition ${
              step === 3
                ? 'border-emerald-400 text-emerald-400 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>3. Exteriér (Terasy, Dvory, Dílny, Parking)</span>
          </button>
        </div>

        {/* Step Content Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* STEP 1: PARAMETRY BUDOVY, PATRA & PŮDNÍ PROSTOR */}
          {step === 1 && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-sm font-bold text-amber-400">
                  ZÁKLADNÍ GEOMETRICKÁ KONFIGURACE BUDOVY
                </span>
                <span className="text-[11px] text-slate-400">
                  Definujte globální podlažnost a tloušťky nosných zdí
                </span>
              </div>

              {/* Počet pater & výška */}
              <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
                <span className="text-xs font-bold text-amber-400 block border-b border-slate-700/60 pb-1.5">
                  POČET PATER A VÝŠKOVÁ ÚROVEŇ
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 block mb-1">Počet podlaží (Pater):</label>
                    <select
                      value={floorsCount}
                      onChange={(e) => setFloorsCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-cyan-300 font-bold focus:border-cyan-400 outline-none"
                    >
                      <option value={1}>1 Podlaží (Přízemní bungalov / Byt)</option>
                      <option value={2}>2 Podlaží (Přízemí + 1.NP)</option>
                      <option value={3}>3 Podlaží (Suterén / Sklep + Přízemí + 1.NP)</option>
                      <option value={4}>4 Podlaží (Suterén + 2 Nadzemní NP + Podkroví)</option>
                    </select>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Umožňuje 3D vertikální simulaci signálu mezi stropy
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Světlá výška stropů:</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        min="2.2"
                        max="4.5"
                        value={ceilingHeight}
                        onChange={(e) => setCeilingHeight(parseFloat(e.target.value) || 2.7)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-cyan-300 font-bold focus:border-cyan-400 outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-500 font-bold">m</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Standardní výška stropu pro výpočet vertikálního útlumu
                    </div>
                  </div>
                </div>
              </div>

              {/* Obvodové nosné zdivo */}
              <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
                <span className="text-xs font-bold text-cyan-400 block border-b border-slate-700/60 pb-1.5">
                  OBVODOVÉ A NOSNÉ ZDIVO (RF ÚTLUM)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 block mb-1">Materiál obvodových zdí:</label>
                    <select
                      value={wallMaterial}
                      onChange={(e) => {
                        const mat = e.target.value as WallSegment['material'];
                        setWallMaterial(mat);
                        if (mat === 'stone' && wallThicknessCm < 45) {
                          setWallThicknessCm(60);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-cyan-400 outline-none font-bold"
                    >
                      <option value="stone">Kamenná zeď / Lomové zdivo 50-80cm (-28 dB silný útlum)</option>
                      <option value="brick_30cm">Cihla Porotherm 30cm (-12 dB útlum)</option>
                      <option value="reinforced_concrete">Železobeton (-25 dB silný útlum)</option>
                      <option value="brick_15cm">Příčková cihla 15cm (-7 dB střední útlum)</option>
                      <option value="plasterboard">Sádrokarton / SDK (-3 dB minimální útlum)</option>
                      <option value="metal_shield">Faradayova klec / Plech (-40 dB blokace)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Vlastní tloušťka obvodové zdi:</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        max="150"
                        value={wallThicknessCm}
                        onChange={(e) => setWallThicknessCm(parseInt(e.target.value) || 30)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-cyan-300 font-bold focus:border-cyan-400 outline-none"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-500 font-bold">cm</span>
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                      {[15, 30, 45, 60, 80].map((th) => (
                        <button
                          key={th}
                          type="button"
                          onClick={() => setWallThicknessCm(th)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                            wallThicknessCm === th
                              ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {th}cm
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Typ půdního prostoru / střechy */}
              <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
                <span className="text-xs font-bold text-purple-400 block border-b border-slate-700/60 pb-1.5">
                  TYP PŮDNÍHO PROSTORU A STŘECHY
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                  <label
                    onClick={() => setRoofType('flat_fve')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      roofType === 'flat_fve'
                        ? 'bg-amber-950/60 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center justify-between">
                        <span>Plochá střecha s FVE panely</span>
                        {roofType === 'flat_fve' && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                        Příprava pro DC solární svody (1000V) přímo do střídače CARSPA MKS1000-12 a rozvaděče.
                      </div>
                    </div>
                    <span className="text-[9px] text-amber-400/80 mt-2 font-mono">FVE STRING 12V/240V</span>
                  </label>

                  <label
                    onClick={() => setRoofType('attic_storage')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      roofType === 'attic_storage'
                        ? 'bg-purple-950/60 border-purple-400 text-purple-200 ring-1 ring-purple-400/50'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center justify-between">
                        <span>Neobytná půda (Dřevěné vazníky)</span>
                        {roofType === 'attic_storage' && <Check className="w-4 h-4 text-purple-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                        Kabelové lávky v podhledu, anténní svod Starlink, koaxiální RF kabely 433 / 868 MHz.
                      </div>
                    </div>
                    <span className="text-[9px] text-purple-400/80 mt-2 font-mono">KABELOVÉ LÁVKY & ANTÉNY</span>
                  </label>

                  <label
                    onClick={() => setRoofType('loft_living')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      roofType === 'loft_living'
                        ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/50'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center justify-between">
                        <span>Obytné podkroví / Loft</span>
                        {roofType === 'loft_living' && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                        Šikmé sádrokartonové stěny, střešní okna, Zigbee termostatické hlavice na radiátorech.
                      </div>
                    </div>
                    <span className="text-[9px] text-cyan-400/80 mt-2 font-mono">OBYTNÉ PODKROVÍ ZÓNA</span>
                  </label>

                  <label
                    onClick={() => setRoofType('gabled_mast')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      roofType === 'gabled_mast'
                        ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400/50'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center justify-between">
                        <span>Sedlová střecha se stožárem</span>
                        {roofType === 'gabled_mast' && <Check className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                        Vyvýšený RF anténní stožár (Sub-GHz + Wi-Fi venkovní sektor), hromosvod a přepěťové ochrany.
                      </div>
                    </div>
                    <span className="text-[9px] text-emerald-400/80 mt-2 font-mono">ANTÉNNÍ STOŽÁR 360°</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: POČET A TVAR MÍSTNOSTÍ */}
          {step === 2 && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <span className="text-sm font-bold text-cyan-400 block">
                    KONFIGURACE MÍSTNOSTÍ A JEJICH TVARU
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Nastavte tvar (Obdélník, Čtverec, L-tvar, T-tvar, Zkosený) a rozměry každé místnosti
                  </span>
                </div>

                {/* Rychlé presety */}
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[10px]">
                  <span className="text-slate-500 px-1 font-bold">Rychlá volba:</span>
                  <button
                    onClick={() => applyPresetRooms('minimal')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
                  >
                    4 místnosti
                  </button>
                  <button
                    onClick={() => applyPresetRooms('family')}
                    className="px-2 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold hover:bg-cyan-900 transition"
                  >
                    7 místností
                  </button>
                  <button
                    onClick={() => applyPresetRooms('extended')}
                    className="px-2 py-1 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold hover:bg-purple-900 transition"
                  >
                    9 + Patro
                  </button>
                </div>
              </div>

              {/* Seznam místností */}
              <div className="space-y-3">
                {roomsList.map((room, idx) => (
                  <div
                    key={room.id}
                    className={`p-3.5 rounded-xl border transition ${
                      room.enabled
                        ? `${cardBg} ring-1 ring-cyan-500/20`
                        : 'bg-slate-950/40 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Název a stav */}
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <input
                          type="checkbox"
                          checked={room.enabled}
                          onChange={(e) => handleUpdateRoom(room.id, { enabled: e.target.checked })}
                          className="w-4 h-4 accent-cyan-400 cursor-pointer"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={room.name}
                            onChange={(e) => handleUpdateRoom(room.id, { name: e.target.value })}
                            className="bg-transparent font-bold text-xs text-slate-100 hover:bg-slate-900/60 focus:bg-slate-900 px-1.5 py-0.5 rounded border border-transparent focus:border-cyan-500 outline-none w-full"
                          />
                          <div className="text-[10px] text-slate-500 px-1.5 truncate max-w-[260px]">
                            {room.notes || 'Bez poznámky'}
                          </div>
                        </div>
                      </div>

                      {/* Volba tvaru místnosti */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Tvar:</span>
                        <div className="grid grid-cols-5 gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-700">
                          <button
                            type="button"
                            onClick={() => handleUpdateRoom(room.id, { shape: 'rectangle' })}
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition ${
                              room.shape === 'rectangle'
                                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Obdélník (Standardní pravoúhlý půdorys)"
                          >
                            <span>🟦</span>
                            <span className="hidden sm:inline">Obdélník</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateRoom(room.id, { shape: 'square' })}
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition ${
                              room.shape === 'square'
                                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Čtverec (Kompaktní symetrická místnost)"
                          >
                            <span>🔲</span>
                            <span className="hidden sm:inline">Čtverec</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateRoom(room.id, { shape: 'l_shape' })}
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition ${
                              room.shape === 'l_shape'
                                ? 'bg-amber-400 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="L-tvar (Rohová dispozice - obývák s jídelnou, rohová chodba)"
                          >
                            <span>📐</span>
                            <span className="hidden sm:inline">L-tvar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateRoom(room.id, { shape: 't_shape' })}
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition ${
                              room.shape === 't_shape'
                                ? 'bg-purple-400 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="T-tvar (Křižovatková centrální hala)"
                          >
                            <span>🔀</span>
                            <span className="hidden sm:inline">T-tvar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateRoom(room.id, { shape: 'angled' })}
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition ${
                              room.shape === 'angled'
                                ? 'bg-emerald-400 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Zkosený / Atypický (Moderní zkosená stěna)"
                          >
                            <span>🔷</span>
                            <span className="hidden sm:inline">Zkos.</span>
                          </button>
                        </div>
                      </div>

                      {/* Rozměry a Patro */}
                      <div className="flex items-center gap-2">
                        {/* Patro */}
                        {floorsCount > 1 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Patro:</span>
                            <select
                              value={room.floor}
                              onChange={(e) =>
                                handleUpdateRoom(room.id, { floor: parseInt(e.target.value) || 1 })
                              }
                              className="bg-slate-900 border border-slate-700 rounded p-1 text-[11px] text-slate-300 font-bold"
                            >
                              {Array.from({ length: floorsCount }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  {i === 0 ? 'Přízemí (1.NP)' : `${i + 1}. Patro`}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Šířka */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">Š:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="1.5"
                            max="15.0"
                            value={room.width}
                            onChange={(e) =>
                              handleUpdateRoom(room.id, { width: parseFloat(e.target.value) || 3.0 })
                            }
                            className="w-14 bg-slate-900 border border-slate-700 rounded p-1 text-[11px] text-cyan-300 font-bold text-center"
                          />
                          <span className="text-[10px] text-slate-500">m</span>
                        </div>

                        {/* Délka */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500">D:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="1.5"
                            max="15.0"
                            value={room.length}
                            onChange={(e) =>
                              handleUpdateRoom(room.id, { length: parseFloat(e.target.value) || 3.0 })
                            }
                            className="w-14 bg-slate-900 border border-slate-700 rounded p-1 text-[11px] text-cyan-300 font-bold text-center"
                          />
                          <span className="text-[10px] text-slate-500">m</span>
                        </div>

                        {/* Smazání */}
                        <button
                          type="button"
                          onClick={() => handleRemoveRoom(room.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition ml-1"
                          title="Odebrat místnost"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tlačítko Přidat místnost */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleAddRoom}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-cyan-500/30 font-bold text-xs flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Přidat další místnost</span>
                </button>

                <div className="text-[11px] text-slate-400 font-mono">
                  Aktivních místností: <span className="font-bold text-cyan-400">{activeRoomsCount}</span> | Celková plocha cca:{' '}
                  <span className="font-bold text-amber-400">
                    {roomsList
                      .filter((r) => r.enabled)
                      .reduce((acc, r) => acc + r.width * r.length, 0)
                      .toFixed(1)}{' '}
                    m²
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EXTERIÉR (TERASY, DVORY, DÍLNY, PŘÍJEZDOVÁ CESTA S PARKOVÁNÍM) */}
          {step === 3 && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="pb-1 border-b border-slate-800">
                <span className="text-sm font-bold text-emerald-400 block">
                  EXTERIÉROVÉ ZÓNY, VENKOVNÍ PROSTORY & INFRASTRUKTURA
                </span>
                <span className="text-[11px] text-slate-400">
                  Přidejte terasy, dvory, samostatné dílny s podružným rozvaděčem a příjezdovou cestu s parkovacím stáním
                </span>
              </div>

              {/* 1. Zastřešená terasa */}
              <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2.5">
                    <Sun className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="font-bold text-amber-300 text-xs">1. Zastřešená terasa / Pergola</div>
                      <div className="text-[10px] text-slate-400">
                        Venkovní posezení, venkovní Zigbee osvětlení a dosah RF 433MHz klíčenky
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeTerrace}
                    onChange={(e) => setIncludeTerrace(e.target.checked)}
                    className="w-4 h-4 accent-amber-400 cursor-pointer"
                  />
                </div>

                {includeTerrace && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Typ terasy:</label>
                      <select
                        value={terraceType}
                        onChange={(e) => setTerraceType(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                      >
                        <option value="pergola">Hliníková pergola s lamelami</option>
                        <option value="deck">Dřevěná terasa (Decking)</option>
                        <option value="patio">Zděná dlážděná veranda</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Tvar terasy:</label>
                      <select
                        value={terraceShape}
                        onChange={(e) => setTerraceShape(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                      >
                        <option value="rectangle">🟦 Obdélníková</option>
                        <option value="l_shape">📐 Rohová L-tvar</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Šířka (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={terraceWidth}
                        onChange={(e) => setTerraceWidth(parseFloat(e.target.value) || 4.5)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Délka (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={terraceLength}
                        onChange={(e) => setTerraceLength(parseFloat(e.target.value) || 4.0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Vnitřní dvůr / zahrada */}
              <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2.5">
                    <Trees className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="font-bold text-green-300 text-xs">2. Vnitřní dvůr / Okrasná zahrada</div>
                      <div className="text-[10px] text-slate-400">
                        Otevřená plocha pro přímé měření útlumu bez zdí (line-of-sight), zahradní IoT závlaha
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeCourtyard}
                    onChange={(e) => setIncludeCourtyard(e.target.checked)}
                    className="w-4 h-4 accent-green-400 cursor-pointer"
                  />
                </div>

                {includeCourtyard && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Typ povrchu:</label>
                      <select
                        value={courtyardType}
                        onChange={(e) => setCourtyardType(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                      >
                        <option value="paved">Dlážděný vnitřní dvůr</option>
                        <option value="lawn">Trávník se závlahou</option>
                        <option value="gravel">Štěrkový dvůr</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Šířka (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={courtyardWidth}
                        onChange={(e) => setCourtyardWidth(parseFloat(e.target.value) || 7.0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Délka (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={courtyardLength}
                        onChange={(e) => setCourtyardLength(parseFloat(e.target.value) || 5.5)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Samostatná dílna / Garáž */}
              <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2.5">
                    <Wrench className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="font-bold text-cyan-300 text-xs">3. Samostatná technická dílna / Garáž</div>
                      <div className="text-[10px] text-slate-400">
                        Podružný rozvaděč, pracovní ponk, podzemní chránička Kopoflex Cat6A S/FTP
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeWorkshop}
                    onChange={(e) => setIncludeWorkshop(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 cursor-pointer"
                  />
                </div>

                {includeWorkshop && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Typ dílny:</label>
                      <select
                        value={workshopType}
                        onChange={(e) => setWorkshopType(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                      >
                        <option value="workshop">Samostatná dílna</option>
                        <option value="garage_workshop">Dvojgaráž s dílnou</option>
                        <option value="outbuilding">Hospodářská budova</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Šířka (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={workshopWidth}
                        onChange={(e) => setWorkshopWidth(parseFloat(e.target.value) || 5.5)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Délka (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={workshopLength}
                        onChange={(e) => setWorkshopLength(parseFloat(e.target.value) || 6.0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs"
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 p-1.5 bg-slate-900 rounded border border-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={workshopEmi}
                          onChange={(e) => setWorkshopEmi(e.target.checked)}
                          className="w-3.5 h-3.5 accent-cyan-400"
                        />
                        <span className="text-[10px] text-slate-300 font-bold">Simulovat EMI rušení</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Příjezdová cesta s parkovacím stáním */}
              <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2.5">
                    <Car className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="font-bold text-emerald-300 text-xs">
                        4. Příjezdová cesta & Parkovací stání
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Vjezdová brána 433.92MHz (EV1527 protokol 3), PoE venkovní bezpečnostní kamera
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeDriveway}
                    onChange={(e) => setIncludeDriveway(e.target.checked)}
                    className="w-4 h-4 accent-emerald-400 cursor-pointer"
                  />
                </div>

                {includeDriveway && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Typ provedení:</label>
                      <select
                        value={drivewayType}
                        onChange={(e) => setDrivewayType(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                      >
                        <option value="carport">Přístřešek (Carport) + Zámková dlažba</option>
                        <option value="paved_drive">Dlážděná plocha</option>
                        <option value="asphalt">Asfaltový povrch</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Parkovací stání:</label>
                      <select
                        value={parkingSpots}
                        onChange={(e) => setParkingSpots(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-emerald-300 font-bold text-xs"
                      >
                        <option value={1}>1 Osobní vozidlo</option>
                        <option value={2}>2 Vozidla (Dvoustání)</option>
                        <option value={3}>3 Vozidla (Rozšířené stání)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Šířka cesty (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={drivewayWidth}
                        onChange={(e) => setDrivewayWidth(parseFloat(e.target.value) || 6.0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Délka cesty (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={drivewayLength}
                        onChange={(e) => setDrivewayLength(parseFloat(e.target.value) || 7.0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-cyan-300 font-bold text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className={`p-4 ${headerBg} border-t flex items-center justify-between shrink-0`}>
          <div>
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>← Zpět na Krok {step - 1}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  localStorage.setItem('house_wizard_started', 'true');
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition"
              >
                Ponechat stávající projekt
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                localStorage.setItem('house_wizard_started', 'true');
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Zrušit
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition"
              >
                <span>Pokračovat na Krok {step + 1}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Vygenerovat základní model domu & zóny</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
