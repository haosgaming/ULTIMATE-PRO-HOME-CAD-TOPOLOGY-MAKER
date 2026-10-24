import React, { useState } from 'react';
import {
  SignalSimParams,
  InterferenceType,
  TopologyProject,
  RFInterferenceSource,
  InterferenceSourceType,
} from '../types/topology.ts';
import {
  Sliders,
  Radio,
  AlertTriangle,
  Activity,
  Wifi,
  ShieldAlert,
  Plus,
  Trash2,
  Power,
  Zap,
  Bluetooth,
  ChevronDown,
  ChevronUp,
  Flame,
  Gauge,
} from 'lucide-react';
import { calculateInterferenceAtPoint } from '../utils/rf-engine.ts';

interface SignalControlsPanelProps {
  project: TopologyProject;
  simParams: SignalSimParams;
  onChangeSimParams: (params: SignalSimParams) => void;
  onUpdateProject?: (updated: TopologyProject) => void;
}

export const SignalControlsPanel: React.FC<SignalControlsPanelProps> = ({
  project,
  simParams,
  onChangeSimParams,
  onUpdateProject,
}) => {
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  const activeTx =
    project.devices.find((d) => d.id === simParams.activeTxDeviceId) || project.devices[0];

  const updateParam = <K extends keyof SignalSimParams>(key: K, val: SignalSimParams[K]) => {
    onChangeSimParams({
      ...simParams,
      [key]: val,
    });
  };

  const interferenceSources = project.interferenceSources || [];

  // Update interference sources helper
  const handleUpdateSources = (newSources: RFInterferenceSource[]) => {
    if (onUpdateProject) {
      onUpdateProject({
        ...project,
        interferenceSources: newSources,
      });
    }
  };

  // Add source preset
  const handleAddPreset = (type: InterferenceSourceType) => {
    let preset: Omit<RFInterferenceSource, 'id'>;

    if (type === 'microwave') {
      preset = {
        name: `Mikrovlnná trouba (${interferenceSources.length + 1})`,
        type: 'microwave',
        position: { x: 5.5, y: 4.8, z: 0.9 },
        frequencyMHz: 2450,
        txPowerDbm: 12,
        bandwidthMHz: 40,
        isActive: true,
        notes: 'Únik mikrovlnného magnetronu (~2.45 GHz). Silné lokální rušení Wi-Fi a Zigbee.',
      };
    } else if (type === 'bluetooth') {
      preset = {
        name: `BLE Beacon Storm (${interferenceSources.length + 1})`,
        type: 'bluetooth',
        position: { x: 4.0, y: 2.0, z: 1.2 },
        frequencyMHz: 2440,
        txPowerDbm: 4,
        bandwidthMHz: 80,
        isActive: true,
        notes: 'Frekvenčně skákající Bluetooth Low Energy vysílání na 2.4 GHz.',
      };
    } else if (type === 'wifi_cochannel') {
      preset = {
        name: `Sousední Wi-Fi AP (${interferenceSources.length + 1})`,
        type: 'wifi_cochannel',
        position: { x: 7.0, y: -0.5, z: 1.5 },
        frequencyMHz: 2437,
        txPowerDbm: 18,
        bandwidthMHz: 20,
        isActive: true,
        notes: 'Ko-kanálové rušení na 2.4 GHz (kanál 6).',
      };
    } else {
      preset = {
        name: `FVE Střídač / EMI zdroj (${interferenceSources.length + 1})`,
        type: 'motor_emi',
        position: { x: 1.2, y: 1.5, z: 1.6 },
        frequencyMHz: 433.92,
        txPowerDbm: -5,
        bandwidthMHz: 10,
        isActive: true,
        notes: 'Spínací harmonické a elektromagnetické vyzařování DC/AC střídače.',
      };
    }

    const newSource: RFInterferenceSource = {
      ...preset,
      id: `int-${Date.now()}`,
    };

    handleUpdateSources([...interferenceSources, newSource]);
    setExpandedSourceId(newSource.id);
  };

  const handleToggleSourceActive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = interferenceSources.map((s) =>
      s.id === id ? { ...s, isActive: !s.isActive } : s
    );
    handleUpdateSources(updated);
  };

  const handleModifySource = (id: string, updates: Partial<RFInterferenceSource>) => {
    const updated = interferenceSources.map((s) => (s.id === id ? { ...s, ...updates } : s));
    handleUpdateSources(updated);
  };

  const handleDeleteSource = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = interferenceSources.filter((s) => s.id !== id);
    handleUpdateSources(updated);
    if (expandedSourceId === id) setExpandedSourceId(null);
  };

  // Calculate live telemetry at active transmitter position
  const activeTxFreq = activeTx?.frequencyMHz || 433.92;
  const interferenceAtTx = calculateInterferenceAtPoint(
    activeTx?.position || { x: 0, y: 0, z: 1 },
    activeTxFreq,
    interferenceSources,
    project.walls,
    project.customAttenuation
  );

  const thermalNoiseMw = Math.pow(10, simParams.noiseFloorDbm / 10);
  const interferenceMw =
    interferenceAtTx.totalInterferenceDbm > -140
      ? Math.pow(10, interferenceAtTx.totalInterferenceDbm / 10)
      : 0;
  const effectiveNoiseDbm = 10 * Math.log10(thermalNoiseMw + interferenceMw);
  const snrDegradationDb = effectiveNoiseDbm - simParams.noiseFloorDbm;

  return (
    <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-4 text-xs font-mono text-slate-200 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-cyan-400 font-bold">
          <Activity className="w-4 h-4" />
          <span>PARAMETRY RF SIMULACE POKRYTÍ</span>
        </div>
        <span className="text-[10px] text-slate-500 uppercase">ITU-R P.1238 / FSPL Model</span>
      </div>

      {/* Transmitter selection */}
      <div className="space-y-1">
        <label className="text-slate-400 block">Vysílací uzel (Transmitter):</label>
        <select
          value={simParams.activeTxDeviceId}
          onChange={(e) => updateParam('activeTxDeviceId', e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-cyan-300 font-semibold"
        >
          {project.devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.ip} | {d.protocol})
            </option>
          ))}
        </select>
      </div>

      {/* Balun filter warning if CC1101 selected */}
      {activeTx?.hardwareAttenuationOffsetDb <= -25 && (
        <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-800/80 text-red-200 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-red-400">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>KRITICKÁ RF VÝSTRAHA: 868MHz Balun filtr</span>
          </div>
          <p className="text-[10px] text-red-300 leading-relaxed">
            CC1101 M115 modul má fyzický LC filtr naladěný na 868 MHz. Při provozu na 433.92 MHz dochází k hardwarovému útlumu o 25–35 dB.
            Reálný vysílací dosah zásuvek EMOS je 15–50 cm! (Příjem RX funguje nominálně).
          </p>
        </div>
      )}

      {/* Frequency band */}
      <div className="space-y-1">
        <label className="text-slate-400 block">Frekvenční pásmo:</label>
        <div className="grid grid-cols-4 gap-1">
          {(['433', '868', '2400', '5000'] as const).map((band) => (
            <button
              key={band}
              onClick={() => updateParam('frequencyBand', band)}
              className={`py-1 rounded text-center transition ${
                simParams.frequencyBand === band
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {band === '433' ? '433 MHz' : band === '868' ? '868 MHz' : band === '2400' ? '2.4 GHz' : '5 GHz'}
            </button>
          ))}
        </div>
      </div>

      {/* TX Power slider */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Vysílací výkon (TX Power):</span>
          <span className="text-cyan-400 font-bold">{simParams.txPowerDbm} dBm</span>
        </div>
        <input
          type="range"
          min="-10"
          max="30"
          value={simParams.txPowerDbm}
          onChange={(e) => updateParam('txPowerDbm', parseInt(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>

      {/* Noise floor slider */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Šumové pozadí (Tepelný šum N0):</span>
          <span className="text-slate-300">{simParams.noiseFloorDbm} dBm</span>
        </div>
        <input
          type="range"
          min="-115"
          max="-70"
          value={simParams.noiseFloorDbm}
          onChange={(e) => updateParam('noiseFloorDbm', parseInt(e.target.value))}
          className="w-full accent-slate-400"
        />
      </div>

      {/* Heatmap Metric Selector */}
      <div className="space-y-1 pt-1 border-t border-slate-800">
        <div className="flex justify-between">
          <span className="text-slate-400">Metrika zobrazení pokrytí:</span>
          <span className="text-cyan-400 font-bold uppercase">{simParams.heatmapMetric || 'rssi'}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => updateParam('heatmapMetric', 'rssi')}
            className={`py-1 px-2 rounded text-center transition flex items-center justify-center gap-1.5 ${
              (simParams.heatmapMetric || 'rssi') === 'rssi'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> RSSI (dBm)
          </button>
          <button
            onClick={() => updateParam('heatmapMetric', 'snr')}
            className={`py-1 px-2 rounded text-center transition flex items-center justify-center gap-1.5 ${
              simParams.heatmapMetric === 'snr'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Poměr signál/šum ovlivněný prostorovými zdroji rušení"
          >
            <Gauge className="w-3.5 h-3.5" /> SNR (dB) & Rušení
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* NEW SECTION: PROSTOROVÉ ZDROJE RUŠENÍ & SNR DEGRADACE          */}
      {/* ============================================================== */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>ZDROJE RUŠENÍ V PROSTORU</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-800 text-amber-300">
            {interferenceSources.filter((s) => s.isActive).length} aktivní
          </span>
        </div>

        <p className="text-[10px] text-slate-400 leading-tight">
          Simulované prostorové vysílače snižující poměr signálu k šumu (SNR) podle frekvenčního překryvu, vzdálenosti a zdí.
        </p>

        {/* Live SNR Impact Telemetry Pill */}
        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[10px] space-y-1">
          <div className="flex justify-between items-center text-slate-300">
            <span>Uzel: <strong className="text-cyan-300">{activeTx?.name}</strong></span>
            <span className="text-purple-300 font-bold">{activeTxFreq} MHz</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Efektivní šum (N_eff):</span>
            <span className={snrDegradationDb > 3 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              {effectiveNoiseDbm.toFixed(1)} dBm
              {snrDegradationDb > 0.5 && ` (+${snrDegradationDb.toFixed(1)} dB)`}
            </span>
          </div>
          {interferenceAtTx.dominantInterferer && snrDegradationDb > 1 && (
            <div className="text-[9px] text-amber-300 truncate">
              Dominantní rušič: <strong>{interferenceAtTx.dominantInterferer}</strong>
            </div>
          )}
        </div>

        {/* Quick Add Preset Buttons */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 block font-semibold">Přidat simulovaný zdroj rušení:</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleAddPreset('microwave')}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition flex items-center gap-1.5 text-amber-300 hover:border-amber-500/50"
              title="Přidat mikrovlnku 2.45 GHz (+12 dBm leakage)"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="truncate">
                <div className="font-bold text-[10px] truncate">Mikrovlnka</div>
                <div className="text-[9px] text-slate-400">2.45 GHz (+12dBm)</div>
              </div>
            </button>

            <button
              onClick={() => handleAddPreset('bluetooth')}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition flex items-center gap-1.5 text-purple-300 hover:border-purple-500/50"
              title="Přidat Bluetooth Low Energy beacon flood"
            >
              <Bluetooth className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <div className="truncate">
                <div className="font-bold text-[10px] truncate">Bluetooth</div>
                <div className="text-[9px] text-slate-400">2.4 GHz (+4dBm)</div>
              </div>
            </button>

            <button
              onClick={() => handleAddPreset('wifi_cochannel')}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition flex items-center gap-1.5 text-cyan-300 hover:border-cyan-500/50"
              title="Přidat sousední Wi-Fi AP 2.4 GHz"
            >
              <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="truncate">
                <div className="font-bold text-[10px] truncate">Sousední Wi-Fi</div>
                <div className="text-[9px] text-slate-400">2.4 GHz Ch6 (+18dBm)</div>
              </div>
            </button>

            <button
              onClick={() => handleAddPreset('motor_emi')}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition flex items-center gap-1.5 text-red-300 hover:border-red-500/50"
              title="Přidat spínaný FVE střídač / EMI motoru"
            >
              <Zap className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div className="truncate">
                <div className="font-bold text-[10px] truncate">Střídač EMI</div>
                <div className="text-[9px] text-slate-400">433 MHz (-5dBm)</div>
              </div>
            </button>
          </div>
        </div>

        {/* List of Defined Interference Sources */}
        <div className="space-y-1.5 pt-1">
          {interferenceSources.map((source) => {
            const isExpanded = expandedSourceId === source.id;
            const isSourceActive = source.isActive;

            return (
              <div
                key={source.id}
                className={`rounded-lg border transition ${
                  isSourceActive
                    ? 'bg-slate-800/60 border-amber-500/40 shadow-sm'
                    : 'bg-slate-800/20 border-slate-700/40 opacity-70'
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedSourceId(isExpanded ? null : source.id)}
                  className="p-2 flex items-center justify-between cursor-pointer select-none hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2 truncate">
                    <button
                      onClick={(e) => handleToggleSourceActive(source.id, e)}
                      className={`p-1 rounded transition ${
                        isSourceActive
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                      title={isSourceActive ? 'Deaktivovat zdroj' : 'Aktivovat zdroj rušení'}
                    >
                      <Power className="w-3 h-3" />
                    </button>

                    <div className="truncate">
                      <div className="font-bold text-slate-200 truncate flex items-center gap-1.5">
                        {source.type === 'microwave' && <Flame className="w-3 h-3 text-amber-400 shrink-0" />}
                        {source.type === 'bluetooth' && <Bluetooth className="w-3 h-3 text-purple-400 shrink-0" />}
                        {source.type === 'wifi_cochannel' && <Wifi className="w-3 h-3 text-cyan-400 shrink-0" />}
                        {source.type === 'motor_emi' && <Zap className="w-3 h-3 text-red-400 shrink-0" />}
                        <span className="truncate">{source.name}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 flex items-center gap-2">
                        <span>{source.frequencyMHz} MHz</span>
                        <span>•</span>
                        <span className="text-amber-400">{source.txPowerDbm} dBm</span>
                        <span>•</span>
                        <span>[{source.position.x}m, {source.position.y}m]</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleDeleteSource(source.id, e)}
                      className="p-1 text-slate-500 hover:text-red-400 transition"
                      title="Smazat zdroj rušení"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Parameter Sliders */}
                {isExpanded && (
                  <div className="p-2.5 pt-0 border-t border-slate-700/50 space-y-2 text-[11px] bg-slate-950/40 rounded-b-lg">
                    {/* Name input */}
                    <div className="pt-2">
                      <label className="text-[10px] text-slate-400 block">Název zdroje:</label>
                      <input
                        type="text"
                        value={source.name}
                        onChange={(e) => handleModifySource(source.id, { name: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-slate-200 text-xs font-mono"
                      />
                    </div>

                    {/* Coordinates X and Y */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Pozice X (m):</span>
                          <span className="text-cyan-400 font-bold">{source.position.x} m</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="12"
                          step="0.1"
                          value={source.position.x}
                          onChange={(e) =>
                            handleModifySource(source.id, {
                              position: { ...source.position, x: parseFloat(e.target.value) },
                            })
                          }
                          className="w-full accent-cyan-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Pozice Y (m):</span>
                          <span className="text-cyan-400 font-bold">{source.position.y} m</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.1"
                          value={source.position.y}
                          onChange={(e) =>
                            handleModifySource(source.id, {
                              position: { ...source.position, y: parseFloat(e.target.value) },
                            })
                          }
                          className="w-full accent-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Frequency (MHz) slider */}
                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Frekvence rušení:</span>
                        <span className="text-purple-400 font-bold">{source.frequencyMHz} MHz</span>
                      </div>
                      <input
                        type="range"
                        min="400"
                        max="5800"
                        step="10"
                        value={source.frequencyMHz}
                        onChange={(e) =>
                          handleModifySource(source.id, {
                            frequencyMHz: parseInt(e.target.value),
                          })
                        }
                        className="w-full accent-purple-400"
                      />
                    </div>

                    {/* TX / Leakage Power slider */}
                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Vyzařovaný výkon (EIRP):</span>
                        <span className="text-amber-400 font-bold">{source.txPowerDbm} dBm</span>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="30"
                        value={source.txPowerDbm}
                        onChange={(e) =>
                          handleModifySource(source.id, {
                            txPowerDbm: parseInt(e.target.value),
                          })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>

                    {/* Bandwidth slider */}
                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Šířka rušícího pásma:</span>
                        <span className="text-slate-300 font-bold">{source.bandwidthMHz} MHz</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="160"
                        value={source.bandwidthMHz}
                        onChange={(e) =>
                          handleModifySource(source.id, {
                            bandwidthMHz: parseInt(e.target.value),
                          })
                        }
                        className="w-full accent-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resolution */}
      <div className="space-y-1 pt-1 border-t border-slate-800">
        <div className="flex justify-between">
          <span className="text-slate-400">Rozlišení výpočtu (Grid step):</span>
          <span className="text-slate-300">{simParams.resolutionCm} cm</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateParam('resolutionCm', 20)}
            className={`py-1 rounded text-center transition ${
              simParams.resolutionCm === 20 ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            Vysoké (20 cm)
          </button>
          <button
            onClick={() => updateParam('resolutionCm', 50)}
            className={`py-1 rounded text-center transition ${
              simParams.resolutionCm === 50 ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            Rychlé (50 cm)
          </button>
        </div>
      </div>
    </div>
  );
};
