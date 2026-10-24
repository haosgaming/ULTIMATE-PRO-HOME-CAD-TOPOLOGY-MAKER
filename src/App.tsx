import React, { useState, useRef } from 'react';
import {
  TopologyProject,
  ConduitLayer,
  SignalSimParams,
} from './types/topology.ts';
import { INITIAL_PROJECT } from './data/default-inventory.ts';
import { useProjectHistory } from './hooks/useProjectHistory.ts';
import { Scene3D } from './components/Scene3D.tsx';
import { FloorplanEditor } from './components/FloorplanEditor.tsx';
import { FloorplanCanvas2D } from './components/FloorplanCanvas2D.tsx';
import { SignalControlsPanel } from './components/SignalControlsPanel.tsx';
import { LaserMeterModal } from './components/LaserMeterModal.tsx';
import { AiAgentModal } from './components/AiAgentModal.tsx';
import { NasSyncModal } from './components/NasSyncModal.tsx';
import { InventoryModal } from './components/InventoryModal.tsx';
import { NotesEditor } from './components/NotesEditor.tsx';
import { exportTopologyToPdf } from './utils/pdf-exporter.ts';
import { HouseWizardModal } from './components/HouseWizardModal.tsx';
import { CiscoDeviceModal } from './components/CiscoDeviceModal.tsx';
import { RFDevice, calculateSignalAtPoint } from './utils/rf-engine.ts';
import {
  Box,
  PenTool,
  Network,
  FileText,
  Ruler,
  Bot,
  Server,
  Database,
  Layers,
  Activity,
  AlertTriangle,
  Radio,
  Printer,
  Undo2,
  Redo2,
  Sun,
  Moon,
  Cpu,
  Terminal,
  Compass,
  Home,
  Cable,
} from 'lucide-react';

export default function App() {
  const {
    project,
    setProject,
    undo,
    redo,
    canUndo,
    canRedo,
    historyDepth,
  } = useProjectHistory(INITIAL_PROJECT);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'3d' | 'editor' | '2d' | 'topology' | 'notes'>('editor');
  const [selectedItemId, setSelectedItemId] = useState<string | null>('dev-subghz-gw');
  const [selectedItemType, setSelectedItemType] = useState<
    'device' | 'wall' | 'furniture' | 'conduit' | 'room' | undefined
  >('device');

  // Modals - House Wizard opens on start if not already completed or dismissed
  const [isHouseWizardOpen, setIsHouseWizardOpen] = useState<boolean>(() => {
    return !localStorage.getItem('house_wizard_started');
  });
  const [isLaserModalOpen, setIsLaserModalOpen] = useState<boolean>(false);
  const [isAiAgentModalOpen, setIsAiAgentModalOpen] = useState<boolean>(false);
  const [isNasSyncModalOpen, setIsNasSyncModalOpen] = useState<boolean>(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState<boolean>(false);
  const [isCiscoModalOpen, setIsCiscoModalOpen] = useState<boolean>(false);
  const [ciscoModalDevice, setCiscoModalDevice] = useState<RFDevice | null>(null);

  // Active layers for 2D coverage view
  const [activeLayers, setActiveLayers] = useState<
    Record<ConduitLayer | 'rf' | 'walls' | 'furniture' | 'devices', boolean>
  >({
    ethernet: true,
    power: true,
    water: true,
    drainage: true,
    rf_bus: true,
    rf: true,
    walls: true,
    furniture: true,
    devices: true,
  });

  const toggleLayer = (layer: ConduitLayer | 'rf' | 'walls' | 'furniture' | 'devices') => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Signal simulation parameters
  const [simParams, setSimParams] = useState<SignalSimParams>({
    activeTxDeviceId: 'dev-subghz-gw',
    frequencyBand: '433',
    txPowerDbm: 10,
    antennaGainDbi: 2,
    noiseFloorDbm: -105,
    interferenceType: 'none',
    interferenceIntensityDb: 0,
    enableBalunFilterPenalty: true,
    showIsolines: true,
    resolutionCm: 20,
  });

  const captured2dImageRef = useRef<string | undefined>(undefined);
  const captured3dImageRef = useRef<string | undefined>(undefined);

  const handleSelectItem = (
    id: string | null,
    type?: 'device' | 'wall' | 'furniture' | 'conduit' | 'room'
  ) => {
    setSelectedItemId(id);
    setSelectedItemType(type);
  };

  const handleExportPdf = () => {
    exportTopologyToPdf(project, {
      projectName: project.name,
      selectedLayers: ['ethernet', 'power', 'water', 'drainage', 'rf_bus'],
      includeInventoryTable: true,
      includeCalculations: true,
      canvasImageUri: captured2dImageRef.current || captured3dImageRef.current,
    });
  };

  const activeDevice = project.devices.find((d) => d.id === selectedItemId);

  // Theme-dependent styling classes
  const isDark = theme === 'dark';
  const themeContainerBg = isDark ? 'bg-[#05070d] text-slate-100' : 'bg-[#f1f5f9] text-slate-900';
  const themeHeaderBg = isDark
    ? 'bg-gradient-to-r from-[#04060b] via-[#090f1d] to-[#04060b] border-slate-800'
    : 'bg-gradient-to-r from-[#ffffff] via-[#f8fafc] to-[#ffffff] border-slate-300 shadow-sm';
  const themeSidebarBg = isDark ? 'bg-[#080d1a]/95 border-slate-800/80' : 'bg-[#ffffff]/95 border-slate-300';
  const themeCardBg = isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-[#f8fafc] border-slate-200 shadow-sm';

  return (
    <div className={`flex flex-col h-screen w-screen ${themeContainerBg} font-mono overflow-hidden select-none transition-colors duration-200`}>
      {/* Precision Technical Top Navbar */}
      <header className={`h-14 ${themeHeaderBg} border-b px-3 flex items-center justify-between z-30 shrink-0 shadow-lg`}>
        {/* Brand & Hardware Specs Telemetry */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950 font-bold">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs tracking-wider text-cyan-400">
                IOT CAD & RF TOPOLOGY STUDIO
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono ${
                isDark ? 'bg-cyan-950 text-cyan-300 border-cyan-800' : 'bg-cyan-100 text-cyan-800 border-cyan-300'
              }`}>
                v2.6 BAREMETAL
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
              <span className="truncate max-w-[160px]">{project.name}</span>
              <span>•</span>
              <span className="text-emerald-500 font-bold">TrueNAS: 192.168.1.115</span>
            </div>
          </div>
        </div>

        {/* Undo / Redo & View Tabs */}
        <div className="flex items-center gap-2">
          {/* Global Undo / Redo Controls */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg flex items-center gap-1 text-xs transition ${
                canUndo
                  ? isDark
                    ? 'text-amber-400 hover:bg-slate-800'
                    : 'text-amber-600 hover:bg-slate-100'
                  : 'opacity-30 cursor-not-allowed'
              }`}
              title="Vrátit poslední krok (Undo) [Ctrl+Z]"
            >
              <Undo2 className="w-4 h-4" />
              <span className="text-[11px] font-bold hidden sm:inline">Zpět</span>
              {historyDepth > 0 && <span className="text-[9px] opacity-70">({historyDepth})</span>}
            </button>

            <button
              onClick={redo}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg flex items-center gap-1 text-xs transition ${
                canRedo
                  ? isDark
                    ? 'text-cyan-400 hover:bg-slate-800'
                    : 'text-cyan-600 hover:bg-slate-100'
                  : 'opacity-30 cursor-not-allowed'
              }`}
              title="Zopakovat vrácený krok (Redo) [Ctrl+Y / Ctrl+Shift+Z]"
            >
              <Redo2 className="w-4 h-4" />
              <span className="text-[11px] font-bold hidden sm:inline">Vpřed</span>
            </button>
          </div>

          {/* Primary View Mode Switcher */}
          <div className={`flex items-center p-1 rounded-xl border text-xs ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-bold ${
                activeTab === 'editor'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dedikovaný CAD editor pro zdi, místnosti a rozvody s úpravou vrcholů"
            >
              <PenTool className="w-3.5 h-3.5" /> CAD Editor Půdorysu
            </button>

            <button
              onClick={() => setActiveTab('3d')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-bold ${
                activeTab === '3d'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5" /> 3D Model & RF
            </button>

            <button
              onClick={() => setActiveTab('2d')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-bold ${
                activeTab === '2d'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="2D analýza rádiového pokrytí a tepelná mapa"
            >
              <Activity className="w-3.5 h-3.5" /> 2D Pokrytí & Heatmapa
            </button>

            <button
              onClick={() => setActiveTab('topology')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-bold ${
                activeTab === 'topology'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" /> Topologie & Matice
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-bold ${
                activeTab === 'notes'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Deník
            </button>
          </div>
        </div>

        {/* Technical Tools & Theme Toggle */}
        <div className="flex items-center gap-1.5">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs transition ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-indigo-600 hover:bg-slate-100 shadow-sm'
            }`}
            title={isDark ? 'Přepnout na světlý CAD blueprint' : 'Přepnout na tmavý ROG režim'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            <span className="hidden md:inline text-[11px] font-bold">
              {isDark ? 'Světlý' : 'Tmavý'}
            </span>
          </button>

          <button
            onClick={() => setIsHouseWizardOpen(true)}
            className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 font-bold transition ${
              isDark
                ? 'bg-amber-950/70 border-amber-500/70 text-amber-300 hover:bg-amber-900 shadow-sm shadow-amber-950'
                : 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 shadow-sm'
            }`}
            title="Konfigurační formulář pro vytvoření základního modelu domu, místností a exteriéru"
          >
            <Home className="w-3.5 h-3.5 text-amber-400" />
            <span>Konfigurátor Domu</span>
          </button>

          <button
            onClick={() => setIsLaserModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm'
            }`}
            title="Laserový dálkoměr / kalibrace rozměrů"
          >
            <Ruler className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden xl:inline">Laser</span>
          </button>

          <button
            onClick={() => setIsAiAgentModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition ${
              isDark ? 'bg-slate-900 border-cyan-800/80 text-cyan-300 hover:bg-slate-800' : 'bg-white border-cyan-400 text-cyan-800 hover:bg-slate-100 shadow-sm'
            }`}
            title="Standardizovaný export a import pro AI agenty (Zero Placeholders)"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">AI Agent</span>
          </button>

          <button
            onClick={() => setIsNasSyncModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition ${
              isDark ? 'bg-slate-900 border-emerald-800/80 text-emerald-300 hover:bg-slate-800' : 'bg-white border-emerald-400 text-emerald-800 hover:bg-slate-100 shadow-sm'
            }`}
            title="Záloha na TrueNAS SCALE (192.168.1.115)"
          >
            <Server className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden xl:inline">NAS</span>
          </button>

          <button
            onClick={() => setIsInventoryModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm'
            }`}
            title="Import inventáře (XML, CSV, TXT)"
          >
            <Database className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden lg:inline">Import</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition"
            title="Export výkresové dokumentace a vrstev do PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Only in 3D and 2D coverage views) */}
        {(activeTab === '3d' || activeTab === '2d') && (
          <aside className={`w-80 ${themeSidebarBg} border-r flex flex-col p-3 overflow-y-auto space-y-4 shrink-0 text-xs z-10 shadow-xl`}>
            {/* Simulation controls */}
            <SignalControlsPanel
              project={project}
              simParams={simParams}
              onChangeSimParams={setSimParams}
            />

            {/* Layer Visibility Matrix */}
            <div className={`p-3 rounded-xl border space-y-2.5 ${themeCardBg}`}>
              <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-slate-700/60 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> SEPARACE VRSTEV VEDENÍ
                </span>
                <span className="text-[10px] text-slate-500">L1 Rozvody</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <label className="flex items-center justify-between p-1 rounded hover:bg-slate-800/40 cursor-pointer">
                  <span className="flex items-center gap-2 text-cyan-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    Ethernet Cat6A S/FTP
                  </span>
                  <input
                    type="checkbox"
                    checked={activeLayers.ethernet}
                    onChange={() => toggleLayer('ethernet')}
                    className="accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between p-1 rounded hover:bg-slate-800/40 cursor-pointer">
                  <span className="flex items-center gap-2 text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Elektro & FVE (CYKY 230V)
                  </span>
                  <input
                    type="checkbox"
                    checked={activeLayers.power}
                    onChange={() => toggleLayer('power')}
                    className="accent-amber-400"
                  />
                </label>

                <label className="flex items-center justify-between p-1 rounded hover:bg-slate-800/40 cursor-pointer">
                  <span className="flex items-center gap-2 text-sky-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    Voda (PEX 16mm)
                  </span>
                  <input
                    type="checkbox"
                    checked={activeLayers.water}
                    onChange={() => toggleLayer('water')}
                    className="accent-sky-400"
                  />
                </label>

                <label className="flex items-center justify-between p-1 rounded hover:bg-slate-800/40 cursor-pointer">
                  <span className="flex items-center gap-2 text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                    Kanalizace (HT 50)
                  </span>
                  <input
                    type="checkbox"
                    checked={activeLayers.drainage}
                    onChange={() => toggleLayer('drainage')}
                    className="accent-slate-400"
                  />
                </label>

                <label className="flex items-center justify-between p-1 rounded hover:bg-slate-800/40 cursor-pointer">
                  <span className="flex items-center gap-2 text-purple-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    RF Sub-GHz & Antény
                  </span>
                  <input
                    type="checkbox"
                    checked={activeLayers.rf_bus}
                    onChange={() => toggleLayer('rf_bus')}
                    className="accent-purple-400"
                  />
                </label>

                <div className="h-px bg-slate-700/60 my-1" />

                <label className="flex items-center justify-between p-1 rounded hover:bg-slate-800/40 cursor-pointer">
                  <span className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    RF Pokrytí (Heatmap)
                  </span>
                  <input
                    type="checkbox"
                    checked={activeLayers.rf}
                    onChange={() => toggleLayer('rf')}
                    className="accent-emerald-400"
                  />
                </label>
              </div>
            </div>
          </aside>
        )}

        {/* View Surface */}
        <main className="flex-1 relative overflow-hidden">
          {/* 1. DEDICATED CAD FLOORPLAN & WALL EDITOR */}
          {activeTab === 'editor' && (
            <FloorplanEditor
              project={project}
              onUpdateProject={setProject}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              selectedItemId={selectedItemId}
              onSelectItem={handleSelectItem}
              theme={theme}
            />
          )}

          {/* 2. 3D ARCHITECTURAL & RF SCENE */}
          {activeTab === '3d' && (
            <Scene3D
              project={project}
              simParams={simParams}
              onUpdateProject={setProject}
              selectedItemId={selectedItemId}
              onSelectItem={handleSelectItem}
              onCaptureImageUri={(uri) => {
                captured3dImageRef.current = uri;
              }}
              theme={theme}
            />
          )}

          {/* 3. 2D COVERAGE & HEATMAP ANALYSIS */}
          {activeTab === '2d' && (
            <FloorplanCanvas2D
              project={project}
              simParams={simParams}
              onUpdateProject={setProject}
              selectedItemId={selectedItemId}
              onSelectItem={handleSelectItem}
              activeLayers={activeLayers}
              onToggleLayer={toggleLayer}
              onCaptureImageUri={(uri) => {
                captured2dImageRef.current = uri;
              }}
              theme={theme}
            />
          )}

          {/* 4. TOPOLOGY MATRIX & LINK BUDGET */}
          {activeTab === 'topology' && (
            <div className="w-full h-full p-5 overflow-y-auto space-y-4">
              <div className={`p-4 rounded-2xl border shadow-xl space-y-3 ${themeCardBg}`}>
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                    <Network className="w-4 h-4" />
                    <span>L2/L3 SÍŤOVÁ TOPOLOGIE & LINK BUDGET MATICE</span>
                  </div>
                  <span className="text-slate-400 text-xs">Páteřní rozsah: 192.168.1.0/24</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-700/60 text-slate-400 text-[11px]">
                        <th className="py-2.5 px-3">Zdrojový Prvek</th>
                        <th className="py-2.5 px-3">Cílový Prvek</th>
                        <th className="py-2.5 px-3">Médium</th>
                        <th className="py-2.5 px-3">3D Vzdálenost</th>
                        <th className="py-2.5 px-3">Zdi v trase</th>
                        <th className="py-2.5 px-3">RSSI</th>
                        <th className="py-2.5 px-3">Stav Linky</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {project.connections.map((conn) => {
                        const src = project.devices.find((d) => d.id === conn.sourceDeviceId);
                        const tgt = project.devices.find((d) => d.id === conn.targetDeviceId);
                        if (!src || !tgt) return null;
                        const signal = calculateSignalAtPoint(src, tgt.position, project.walls);

                        return (
                          <tr key={conn.id} className="hover:bg-slate-800/20 transition">
                            <td className="py-2.5 px-3 font-bold">
                              {src.name} <span className="text-cyan-400">({src.ip})</span>
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {tgt.name} <span className="text-slate-400">({tgt.ip})</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                                {conn.medium}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">{signal.distanceMeters} m</td>
                            <td className="py-2.5 px-3">
                              {signal.intersectionsCount > 0 ? (
                                <span className="text-amber-400">
                                  {signal.intersectionsCount}x zeď (-{signal.wallLossDb} dB)
                                </span>
                              ) : (
                                <span className="text-emerald-400">Přímá viditelnost</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              <span
                                className={
                                  signal.rssiDbm > -75
                                    ? 'text-cyan-400'
                                    : signal.rssiDbm > -88
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                                }
                              >
                                {signal.rssiDbm} dBm
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  signal.linkStatus === 'NOMINAL'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : signal.linkStatus === 'MARGINAL'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-red-950 text-red-300 border border-red-800'
                                }`}
                              >
                                {signal.linkStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. NOTES AND SECTION DOCUMENTATION */}
          {activeTab === 'notes' && (
            <div className="w-full h-full p-4">
              <NotesEditor project={project} onUpdateProject={setProject} />
            </div>
          )}
        </main>

        {/* Right Telemetry Sidebar (in 3D and 2D views) */}
        {(activeTab === '3d' || activeTab === '2d') && (
          <aside className={`w-80 ${themeSidebarBg} border-l flex flex-col p-3 overflow-y-auto space-y-4 shrink-0 text-xs z-10 shadow-xl`}>
            {/* Inspector */}
            <div className={`p-3 rounded-xl border space-y-2.5 ${themeCardBg}`}>
              <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-slate-700/60 pb-1.5">
                <span>INSPEKTOR PRVKU</span>
                <span className="text-[10px] text-slate-500">{selectedItemType?.toUpperCase() || 'ŽÁDNÝ'}</span>
              </div>

              {activeDevice ? (
                <div className="space-y-2 text-[11px]">
                  <div className="font-bold text-sm text-cyan-300">{activeDevice.name}</div>
                  <div>IP: <span className="text-cyan-400 font-bold">{activeDevice.ip}</span></div>
                  <div>MAC: <span className="text-slate-400">{activeDevice.mac}</span></div>
                  <div>Protokol: <span className="text-emerald-400 font-bold">{activeDevice.protocol}</span></div>
                  <div>Frekvence: <span className="text-purple-400">{activeDevice.frequencyMHz} MHz</span></div>
                  <div>TX Výkon: <span className="text-amber-400 font-bold">{activeDevice.txPowerDbm} dBm</span></div>

                  {activeDevice.hardwareAttenuationOffsetDb <= -25 && (
                    <div className="p-2 rounded bg-red-950/80 border border-red-700 text-red-200 text-[10px] leading-relaxed">
                      POZOR: Hardwarový 868MHz LC balun filtr utlumuje vysílání na 433.92 MHz o 30 dB.
                      Reálný dosah TX je 15–50 cm!
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1 pt-1 text-center">
                    <div className="bg-slate-800/40 p-1 rounded border border-slate-700/50">
                      <span className="text-slate-500 block text-[9px]">X</span>
                      <span className="text-cyan-300 font-bold">{activeDevice.position.x}m</span>
                    </div>
                    <div className="bg-slate-800/40 p-1 rounded border border-slate-700/50">
                      <span className="text-slate-500 block text-[9px]">Y</span>
                      <span className="text-cyan-300 font-bold">{activeDevice.position.y}m</span>
                    </div>
                    <div className="bg-slate-800/40 p-1 rounded border border-slate-700/50">
                      <span className="text-slate-500 block text-[9px]">Z (výška)</span>
                      <span className="text-cyan-300 font-bold">{activeDevice.position.z}m</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSimParams((prev) => ({
                        ...prev,
                        activeTxDeviceId: activeDevice.id,
                        frequencyBand: activeDevice.frequencyMHz <= 600 ? '433' : '2400',
                      }));
                    }}
                    className="w-full mt-2 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold flex items-center justify-center gap-1.5 transition shadow-md shadow-cyan-600/20"
                  >
                    <Activity className="w-3.5 h-3.5" /> Nastavit jako Vysílač
                  </button>

                  <button
                    onClick={() => {
                      setCiscoModalDevice(activeDevice);
                      setIsCiscoModalOpen(true);
                    }}
                    className="w-full mt-1.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 transition shadow-md shadow-amber-500/20"
                    title="Otevřít Cisco Packet Tracer šasi, konektory s pinoutem a interaktivní terminál"
                  >
                    <Cable className="w-3.5 h-3.5" /> Cisco Porty & CLI Konfigurace
                  </button>
                </div>
              ) : (
                <div className="text-slate-500 text-center py-6">
                  Klikněte na prvek v prostoru pro detailní telemetrii a link budget.
                </div>
              )}
            </div>

            {/* Hardware Node List */}
            <div className={`p-3 rounded-xl border space-y-2 ${themeCardBg}`}>
              <div className="flex items-center justify-between text-slate-400 font-bold border-b border-slate-700/60 pb-1.5">
                <span>INVENTÁŘ ({project.devices.length})</span>
                <span className="text-cyan-400">192.168.1.0/24</span>
              </div>

              <div className="space-y-1.5 overflow-y-auto max-h-56 pr-1 text-[11px]">
                {project.devices.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleSelectItem(d.id, 'device')}
                    className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between border ${
                      selectedItemId === d.id
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                        : 'bg-slate-800/30 border-slate-700/40 hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold truncate">{d.name}</div>
                      <div className="text-[10px] text-slate-500">{d.ip}</div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-400 shrink-0">
                      {d.protocol}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Modals */}
      <LaserMeterModal
        isOpen={isLaserModalOpen}
        onClose={() => setIsLaserModalOpen(false)}
        project={project}
        onUpdateProject={setProject}
      />

      <AiAgentModal
        isOpen={isAiAgentModalOpen}
        onClose={() => setIsAiAgentModalOpen(false)}
        project={project}
        onUpdateProject={setProject}
      />

      <NasSyncModal
        isOpen={isNasSyncModalOpen}
        onClose={() => setIsNasSyncModalOpen(false)}
        project={project}
        onUpdateProject={setProject}
      />

      <InventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        project={project}
        onUpdateProject={setProject}
      />

      <HouseWizardModal
        isOpen={isHouseWizardOpen}
        onClose={() => setIsHouseWizardOpen(false)}
        onGenerateProject={(newProj) => {
          setProject(newProj);
        }}
        theme={theme}
      />

      <CiscoDeviceModal
        isOpen={isCiscoModalOpen}
        onClose={() => {
          setIsCiscoModalOpen(false);
          setCiscoModalDevice(null);
        }}
        device={ciscoModalDevice}
        project={project}
        onUpdateDevice={(updatedDev) => {
          setProject({
            ...project,
            devices: project.devices.map((d) => (d.id === updatedDev.id ? updatedDev : d)),
          });
          setCiscoModalDevice(updatedDev);
        }}
        theme={theme}
      />
    </div>
  );
}
