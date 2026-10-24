import React from 'react';
import { SignalSimParams, InterferenceType, TopologyProject } from '../types/topology.ts';
import { Sliders, Radio, AlertTriangle, Activity, Wifi, ShieldAlert } from 'lucide-react';

interface SignalControlsPanelProps {
  project: TopologyProject;
  simParams: SignalSimParams;
  onChangeSimParams: (params: SignalSimParams) => void;
}

export const SignalControlsPanel: React.FC<SignalControlsPanelProps> = ({
  project,
  simParams,
  onChangeSimParams,
}) => {
  const activeTx = project.devices.find((d) => d.id === simParams.activeTxDeviceId) || project.devices[0];

  const updateParam = <K extends keyof SignalSimParams>(key: K, val: SignalSimParams[K]) => {
    onChangeSimParams({
      ...simParams,
      [key]: val,
    });
  };

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
          <span className="text-slate-400">Šumové pozadí (Noise Floor):</span>
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

      {/* Interference Simulator */}
      <div className="space-y-1.5 pt-1 border-t border-slate-800">
        <label className="text-slate-400 block flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Simulace elektromagnetického rušení:
        </label>
        <select
          value={simParams.interferenceType}
          onChange={(e) => updateParam('interferenceType', e.target.value as InterferenceType)}
          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-amber-300"
        >
          <option value="none">Žádné rušení (Čisté spektrum)</option>
          <option value="microwave_2_4ghz">Mikrovlnná trouba 2.45 GHz (-15 dB šumový burst)</option>
          <option value="motor_emi">Průmyslový elektromotor / Střídač FVE EMI</option>
          <option value="channel_congestion">Kolize Zigbee kanálu 11 s WiFi 2.4GHz</option>
          <option value="ble_beacon_storm">BLE Advertising Flood (ESPHome Proxy zatížení)</option>
        </select>
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
