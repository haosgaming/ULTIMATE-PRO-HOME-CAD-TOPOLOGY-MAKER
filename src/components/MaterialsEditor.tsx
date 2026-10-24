import React, { useState } from 'react';
import {
  TopologyProject,
  WallMaterial,
  MaterialAttenuationMap,
  MATERIAL_METADATA,
  WALL_ATTENUATION_DB,
} from '../types/topology.ts';
import {
  calculateSignalAtPoint,
  calculateFSPL,
  getFrequencyBandKey,
} from '../utils/rf-engine.ts';
import {
  Layers,
  Radio,
  Sliders,
  RotateCcw,
  Sparkles,
  Check,
  AlertTriangle,
  Info,
  Shield,
  Activity,
  Calculator,
  Search,
  CheckCircle2,
} from 'lucide-react';

interface MaterialsEditorProps {
  project: TopologyProject;
  onUpdateProject: (updated: TopologyProject) => void;
  theme?: 'dark' | 'light';
  onNavigateToEditor?: () => void;
}

const FREQUENCY_BANDS: { key: '433' | '868' | '2400' | '5000'; label: string; desc: string; hardware: string }[] = [
  {
    key: '433',
    label: '433.92 MHz',
    desc: 'Sub-GHz ISM pásmo',
    hardware: 'ESP32-S3 Gateway, EMOS P0065 (EV1527)',
  },
  {
    key: '868',
    label: '868.00 MHz',
    desc: 'Sub-GHz SRD / LoRa',
    hardware: 'CC1101 M115 Balun filtr, LoRaWAN',
  },
  {
    key: '2400',
    label: '2.4 GHz',
    desc: 'Wi-Fi 4/6 & Zigbee 3.0',
    hardware: 'EmberZNet Dongle-E, BLE Proxy, JBD BMS',
  },
  {
    key: '5000',
    label: '5.0 GHz',
    desc: 'Wi-Fi 6/7 UNII pásmo',
    hardware: 'OpenWrt ROUTERBE3600 (vysoká absorpce)',
  },
];

export const MaterialsEditor: React.FC<MaterialsEditorProps> = ({
  project,
  onUpdateProject,
  theme = 'dark',
  onNavigateToEditor,
}) => {
  const isDark = theme === 'dark';
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // RF Simulator State
  const [simTxDeviceId, setSimTxDeviceId] = useState<string>(
    project.devices[0]?.id || 'dev-subghz-gw'
  );
  const [simMaterial, setSimMaterial] = useState<WallMaterial>('stone');
  const [simThicknessCm, setSimThicknessCm] = useState<number>(50);
  const [simDistanceM, setSimDistanceM] = useState<number>(5);

  const customAtt = project.customAttenuation || {};

  // Helper to get attenuation value for a material and frequency band
  const getAttenuation = (material: WallMaterial, band: '433' | '868' | '2400' | '5000'): number => {
    return customAtt[material]?.[band] ?? WALL_ATTENUATION_DB[material][band];
  };

  // Helper to check if a material is customized
  const isMaterialCustomized = (material: WallMaterial): boolean => {
    return !!customAtt[material] && Object.keys(customAtt[material]).length > 0;
  };

  // Update specific attenuation
  const handleUpdateAttenuation = (
    material: WallMaterial,
    band: '433' | '868' | '2400' | '5000',
    value: number
  ) => {
    const clamped = Math.max(0.1, Math.min(90, Math.round(value * 10) / 10));
    const currentMatValues = {
      ...WALL_ATTENUATION_DB[material],
      ...(customAtt[material] || {}),
    };
    currentMatValues[band] = clamped;

    const newCustom: MaterialAttenuationMap = {
      ...customAtt,
      [material]: currentMatValues,
    };

    onUpdateProject({
      ...project,
      customAttenuation: newCustom,
    });
  };

  // Reset a single material
  const handleResetMaterial = (material: WallMaterial) => {
    const newCustom = { ...customAtt };
    delete newCustom[material];
    onUpdateProject({
      ...project,
      customAttenuation: Object.keys(newCustom).length > 0 ? newCustom : undefined,
    });
    setCopiedNotification(`Materiál "${MATERIAL_METADATA[material].name}" obnoven na výchozí normu ITU-R.`);
    setTimeout(() => setCopiedNotification(null), 3500);
  };

  // Reset all materials
  const handleResetAll = () => {
    onUpdateProject({
      ...project,
      customAttenuation: undefined,
    });
    setCopiedNotification('Všechny útlumy zdí byly obnoveny na výchozí normy ITU-R P.1238 / ČSN.');
    setTimeout(() => setCopiedNotification(null), 3500);
  };

  // Presets
  const applyPreset = (presetName: string) => {
    let presetValues: MaterialAttenuationMap = {};

    if (presetName === 'old_stone_house') {
      // Old stone house: very heavy masonry walls, thick stone with mortar and moisture
      presetValues = {
        stone: { '433': 24, '868': 30, '2400': 42, '5000': 55 },
        brick_30cm: { '433': 12, '868': 15, '2400': 20, '5000': 28 },
        brick_15cm: { '433': 7, '868': 9, '2400': 12, '5000': 18 },
        wood: { '433': 2.5, '868': 3.2, '2400': 4.5, '5000': 6.5 },
      };
    } else if (presetName === 'modern_drywall') {
      // Modern drywall: light partitions, highly penetrable
      presetValues = {
        plasterboard: { '433': 1.2, '868': 1.8, '2400': 2.5, '5000': 3.8 },
        wood: { '433': 1.2, '868': 1.6, '2400': 2.2, '5000': 3.2 },
        glass: { '433': 2.5, '868': 3.2, '2400': 4.5, '5000': 6.8 }, // Triple glazed low-e
      };
    } else if (presetName === 'heavy_concrete_bunker') {
      // Industrial concrete & metal shielding
      presetValues = {
        reinforced_concrete: { '433': 26, '868': 32, '2400': 40, '5000': 52 },
        metal_shield: { '433': 45, '868': 52, '2400': 62, '5000': 70 },
        stone: { '433': 22, '868': 28, '2400': 38, '5000': 48 },
      };
    }

    onUpdateProject({
      ...project,
      customAttenuation: {
        ...(project.customAttenuation || {}),
        ...presetValues,
      },
    });

    setCopiedNotification(`Aplikován profil "${presetName}".`);
    setTimeout(() => setCopiedNotification(null), 3500);
  };

  const materialsList = (Object.keys(MATERIAL_METADATA) as WallMaterial[]).filter((m) => {
    const meta = MATERIAL_METADATA[m];
    const matchesFilter = filterCategory === 'all' || meta.category === filterCategory;
    const matchesSearch =
      searchQuery === '' ||
      meta.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Count walls per material in project
  const wallsCountByMaterial = project.walls.reduce((acc, w) => {
    acc[w.material] = (acc[w.material] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Total length of walls per material in project
  const wallsLengthByMaterial = project.walls.reduce((acc, w) => {
    const len = Math.sqrt((w.p2.x - w.p1.x) ** 2 + (w.p2.y - w.p1.y) ** 2);
    acc[w.material] = (acc[w.material] || 0) + len;
    return acc;
  }, {} as Record<string, number>);

  // Simulator calculations
  const simDev = project.devices.find((d) => d.id === simTxDeviceId) || project.devices[0];
  const simFreqBand = simDev ? getFrequencyBandKey(simDev.frequencyMHz) : '433';
  const simBaseAttenuation = getAttenuation(simMaterial, simFreqBand);
  const simThicknessFactor = Math.max(0.5, simThicknessCm / 15);
  const simTotalWallLoss = Math.round(simBaseAttenuation * simThicknessFactor * 10) / 10;
  const simFspl = simDev ? Math.round(calculateFSPL(simDistanceM, simDev.frequencyMHz) * 10) / 10 : 40;
  const simEffectiveTx = simDev ? simDev.txPowerDbm + simDev.hardwareAttenuationOffsetDb : 10;
  const simRssi = simDev
    ? Math.round((simEffectiveTx + simDev.antennaGainDbi - simFspl - simTotalWallLoss) * 10) / 10
    : -70;

  let simStatus: 'NOMINAL' | 'MARGINAL' | 'DROPPED' = 'NOMINAL';
  if (simRssi < -88) simStatus = 'DROPPED';
  else if (simRssi < -75) simStatus = 'MARGINAL';

  return (
    <div
      className={`w-full h-full overflow-y-auto p-4 md:p-6 font-mono text-xs ${
        isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Banner notification */}
        {copiedNotification && (
          <div className="p-3 rounded-xl bg-cyan-950/90 border border-cyan-500 text-cyan-200 flex items-center justify-between shadow-lg shadow-cyan-950/40 animate-fade-in">
            <span className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              {copiedNotification}
            </span>
            <button
              onClick={() => setCopiedNotification(null)}
              className="text-cyan-400 hover:text-white text-xs px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Header & Overview */}
        <div
          className={`p-5 rounded-2xl border backdrop-blur-md shadow-2xl relative overflow-hidden ${
            isDark
              ? 'bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/95 border-slate-800'
              : 'bg-white border-slate-200 shadow-slate-200'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>DATABÁZE ÚTLUMŮ ZDIVA A PŘÍČEK (RF ENGINE & LINK BUDGET)</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-3xl">
                Definujte specifický útlum elektromagnetického signálu (v dB) pro každý typ zdiva napříč frekvenčními
                pásmy 433 MHz, 868 MHz, 2.4 GHz a 5.0 GHz. Výpočtový engine okamžitě přepočítá 2D tepelnou mapu pokrytí,
                3D RF volumetrii a link budget matici.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-cyan-300 font-bold">
                  Referenční tloušťka: 15 cm
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-amber-300">
                  Škálovací model: A(d) = A_base × max(0.5, d / 15 cm)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-emerald-300">
                  Standardy: ITU-R P.1238-11 / ČSN EN 300 220
                </span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap lg:flex-col items-stretch gap-2 shrink-0">
              <button
                onClick={handleResetAll}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold flex items-center justify-center gap-2 transition shadow-md"
                title="Vrátit všechny materiály na tovární hodnoty ITU-R P.1238"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Obnovit výchozí ITU-R</span>
              </button>

              {onNavigateToEditor && (
                <button
                  onClick={onNavigateToEditor}
                  className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold flex items-center justify-center gap-2 transition shadow-md shadow-cyan-600/30"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Zpět do 2D Editoru</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Preset Profiles & Filter Bar */}
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-bold flex items-center gap-1.5 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Rychlé profily zástavby:
            </span>
            <button
              onClick={() => applyPreset('old_stone_house')}
              className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-600/60 text-amber-300 font-bold transition"
            >
              Staré kamenné stavení (vysoký útlum)
            </button>
            <button
              onClick={() => applyPreset('modern_drywall')}
              className="px-2.5 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900 border border-sky-600/60 text-sky-300 font-bold transition"
            >
              Moderní sádrokarton / Dřevostavba
            </button>
            <button
              onClick={() => applyPreset('heavy_concrete_bunker')}
              className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900 border border-purple-600/60 text-purple-300 font-bold transition"
            >
              Železobeton & Průmyslové stínění
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Filtrovat materiál..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-400 w-44"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-300 text-xs focus:outline-none"
            >
              <option value="all">Všechny kategorie</option>
              <option value="masonry">Zdivo a kámen</option>
              <option value="concrete">Beton a panely</option>
              <option value="drywall">Sádrokarton</option>
              <option value="aperture">Okna a sklo</option>
              <option value="shield">Kovové stínění</option>
              <option value="organic">Dřevo</option>
            </select>
          </div>
        </div>

        {/* Frequency Band Legend Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FREQUENCY_BANDS.map((band) => (
            <div
              key={band.key}
              className={`p-3 rounded-xl border flex flex-col justify-between space-y-1 ${
                isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400 text-sm">{band.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {band.key} MHz
                </span>
              </div>
              <div className="text-slate-300 font-medium text-[11px]">{band.desc}</div>
              <div className="text-[10px] text-slate-500 truncate" title={band.hardware}>
                {band.hardware}
              </div>
            </div>
          ))}
        </div>

        {/* Main Materials Matrix */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-slate-400 font-bold border-b border-slate-800 pb-2">
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>KATALOG MATERIÁLŮ ZDIVA ({materialsList.length})</span>
            </span>
            <span className="text-xs text-slate-500">
              Všechny hodnoty jsou vztaženy na referenční tloušťku zdi 15 cm.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {materialsList.map((matId) => {
              const meta = MATERIAL_METADATA[matId];
              const isCustom = isMaterialCustomized(matId);
              const wallsInProject = wallsCountByMaterial[matId] || 0;
              const totalMeters = wallsLengthByMaterial[matId] || 0;

              return (
                <div
                  key={matId}
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    isCustom
                      ? isDark
                        ? 'bg-slate-900/90 border-cyan-500/60 shadow-lg shadow-cyan-950/20'
                        : 'bg-cyan-50/50 border-cyan-300'
                      : isDark
                      ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: meta.badgeColor }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-100">{meta.name}</span>
                          {isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950 border border-cyan-500 text-cyan-300">
                              Uživatelsky upraveno
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-800">
                            {meta.standardNorm}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{meta.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      {wallsInProject > 0 ? (
                        <span className="px-2 py-1 rounded bg-amber-950/60 border border-amber-600/60 text-amber-300 text-[10px] font-bold">
                          Použito v projektu: {wallsInProject}x ({totalMeters.toFixed(1)} m)
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-slate-800/60 text-slate-500 text-[10px]">
                          V projektu zatím nepoužito
                        </span>
                      )}

                      {isCustom && (
                        <button
                          onClick={() => handleResetMaterial(matId)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition"
                          title="Obnovit tento materiál na ITU-R normu"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" />
                          <span>Obnovit</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4 Frequency Bands Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {FREQUENCY_BANDS.map((band) => {
                      const currentVal = getAttenuation(matId, band.key);
                      const defaultVal = WALL_ATTENUATION_DB[matId][band.key];
                      const delta = Math.round((currentVal - defaultVal) * 10) / 10;

                      return (
                        <div
                          key={band.key}
                          className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 font-bold">{band.label}</span>
                            <div className="flex items-center gap-1.5">
                              {delta !== 0 && (
                                <span
                                  className={`text-[9px] font-bold px-1 rounded ${
                                    delta > 0
                                      ? 'text-red-400 bg-red-950/60'
                                      : 'text-emerald-400 bg-emerald-950/60'
                                  }`}
                                >
                                  {delta > 0 ? `+${delta}` : delta} dB
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500">výchozí: {defaultVal} dB</span>
                            </div>
                          </div>

                          {/* Numeric input and dB label */}
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0.1"
                              max="90"
                              step="0.5"
                              value={currentVal}
                              onChange={(e) =>
                                handleUpdateAttenuation(
                                  matId,
                                  band.key,
                                  parseFloat(e.target.value) || 0.1
                                )
                              }
                              className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-bold text-center focus:outline-none focus:border-cyan-400"
                            />
                            <span className="text-slate-400 text-xs font-bold">dB / 15cm</span>
                          </div>

                          {/* Range slider */}
                          <input
                            type="range"
                            min="0.5"
                            max="60"
                            step="0.5"
                            value={currentVal}
                            onChange={(e) =>
                              handleUpdateAttenuation(matId, band.key, parseFloat(e.target.value))
                            }
                            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                          />

                          {/* Quick bar indicator */}
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                currentVal < 5
                                  ? 'bg-emerald-400'
                                  : currentVal < 15
                                  ? 'bg-cyan-400'
                                  : currentVal < 28
                                  ? 'bg-amber-400'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, (currentVal / 50) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Link Budget & Penetration Calculator */}
        <div
          className={`p-5 rounded-2xl border backdrop-blur-md shadow-2xl space-y-4 ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Calculator className="w-4 h-4 text-cyan-400" />
              <span>INTERAKTIVNÍ LINK BUDGET SIMULÁTOR PRŮCHODU ZDÍ</span>
            </div>
            <span className="text-slate-500 text-[10px]">
              Ověření útlumu pro Home Assistant & ESPHome uzly
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Input 1: Device */}
            <div className="space-y-1">
              <label className="text-slate-400 block text-[11px]">Vysílací uzel (Transmitter):</label>
              <select
                value={simTxDeviceId}
                onChange={(e) => setSimTxDeviceId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-cyan-300 font-bold"
              >
                {project.devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.frequencyMHz} MHz | {d.txPowerDbm} dBm)
                  </option>
                ))}
              </select>
              {simDev?.hardwareAttenuationOffsetDb <= -25 && (
                <div className="text-[10px] text-red-400 flex items-center gap-1 pt-1">
                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                  <span>868MHz Balun filtr: -30 dB útlum!</span>
                </div>
              )}
            </div>

            {/* Input 2: Material */}
            <div className="space-y-1">
              <label className="text-slate-400 block text-[11px]">Typ zdiva v dráze paprsku:</label>
              <select
                value={simMaterial}
                onChange={(e) => setSimMaterial(e.target.value as WallMaterial)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 font-bold"
              >
                {(Object.keys(MATERIAL_METADATA) as WallMaterial[]).map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_METADATA[m].name}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-slate-500 pt-1">
                Základní útlum ({simFreqBand} MHz):{' '}
                <span className="text-cyan-400 font-bold">{simBaseAttenuation} dB</span> (při 15 cm)
              </div>
            </div>

            {/* Input 3: Thickness */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <label className="text-slate-400">Tloušťka zdiva:</label>
                <span className="text-cyan-300 font-bold">{simThicknessCm} cm</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={simThicknessCm}
                onChange={(e) => setSimThicknessCm(parseInt(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer mt-2"
              />
              <div className="text-[10px] text-slate-500 pt-1">
                Faktor tloušťky: <span className="text-amber-400 font-bold">{simThicknessFactor.toFixed(2)}x</span>
              </div>
            </div>

            {/* Input 4: Distance */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <label className="text-slate-400">Celková vzdálenost (m):</label>
                <span className="text-cyan-300 font-bold">{simDistanceM} m</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="25"
                step="0.5"
                value={simDistanceM}
                onChange={(e) => setSimDistanceM(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer mt-2"
              />
              <div className="text-[10px] text-slate-500 pt-1">
                Ztráta šířením FSPL: <span className="text-slate-300 font-bold">{simFspl} dB</span>
              </div>
            </div>
          </div>

          {/* Results Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Útlum v překážce</span>
              <div className="text-lg font-bold text-amber-400">-{simTotalWallLoss} dB</div>
              <div className="text-[10px] text-slate-400">
                {simBaseAttenuation} dB × {simThicknessFactor.toFixed(2)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Ztráta prostoru (FSPL)</span>
              <div className="text-lg font-bold text-slate-300">-{simFspl} dB</div>
              <div className="text-[10px] text-slate-400">při {simDistanceM} m na {simDev?.frequencyMHz} MHz</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Výsledný signál (RSSI)</span>
              <div
                className={`text-lg font-bold ${
                  simRssi > -75 ? 'text-cyan-400' : simRssi > -88 ? 'text-amber-400' : 'text-red-400'
                }`}
              >
                {simRssi} dBm
              </div>
              <div className="text-[10px] text-slate-400">Šumové dno: -105 dBm</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 uppercase">Kvalita RF linky</span>
              <div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    simStatus === 'NOMINAL'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-600'
                      : simStatus === 'MARGINAL'
                      ? 'bg-amber-950 text-amber-400 border border-amber-600'
                      : 'bg-red-950 text-red-400 border border-red-600'
                  }`}
                >
                  {simStatus === 'NOMINAL' && 'NOMINÁLNÍ SPOJENÍ'}
                  {simStatus === 'MARGINAL' && 'HRANIČNÍ SIGNÁL (RISK VÝPADKŮ)'}
                  {simStatus === 'DROPPED' && 'SPOJENÍ ROZPADNUTO (ZTRÁTA PAKETŮ)'}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">
                {simStatus === 'NOMINAL' ? 'Zásuvka sepne spolehlivě' : 'Nutný opakovač nebo přiblížení'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
