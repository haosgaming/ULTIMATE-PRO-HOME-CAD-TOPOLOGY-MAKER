import React, { useState } from 'react';
import { TopologyProject } from '../types/topology.ts';
import { generateAiAgentPrompt, importAiAgentData } from '../utils/ai-agent-format.ts';
import { Bot, Copy, Check, ArrowDownToLine, RefreshCw, X, ShieldCheck, Terminal, FileCode } from 'lucide-react';

interface AiAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TopologyProject;
  onUpdateProject: (updated: TopologyProject) => void;
}

export const AiAgentModal: React.FC<AiAgentModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
}) => {
  const [tab, setTab] = useState<'export' | 'import' | 'presets'>('export');
  const [copied, setCopied] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const generatedPrompt = generateAiAgentPrompt(project);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    try {
      const updated = importAiAgentData(importText, project);
      onUpdateProject(updated);
      setImportStatus({
        success: true,
        message: `Úspěšně importováno! Místností: ${updated.rooms.length}, Zdí: ${updated.walls.length}, Zařízení: ${updated.devices.length}`,
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: err.message || 'Chyba importu. Neplatný formát.',
      });
    }
  };

  // Dedicated production presets adhering strictly to axioms
  const esphomeCc1101Preset = `substitutions:
  name: "esp32-s3-subghz-gw"
  friendly_name: "ESP32-S3 433MHz Gateway"

esphome:
  name: \${name}
  friendly_name: \${friendly_name}

esp32:
  board: esp32-s3-devkitc-1
  framework:
    type: esp-idf

# STRIKTNÍ JEDNO-SBĚRNICOVÁ SYNTAXE BEZ ID PRO CC1101
spi:
  clk_pin: GPIO38
  miso_pin: GPIO37
  mosi_pin: GPIO35

cc1101:
  id: rf_transceiver
  cs_pin: GPIO21
  frequency: 433.92MHz
  modulation_type: ASK/OOK
  output_power: 10

# LIMITOVANÁ RMT PAMĚŤ (ESP32-S3 MÁ POUZE 384 SYMBOLŮ)
remote_transmitter:
  pin: GPIO40
  carrier_duty_percent: 100%
  rmt_symbols: 64
  non_blocking: true
  on_transmit:
    then:
      - cc1101.begin_tx
  on_complete:
    then:
      - cc1101.begin_rx

remote_receiver:
  pin: GPIO47
  rmt_symbols: 128
  tolerance: 35%
  filter: 100us
  idle: 4ms
  dump:
    - rc_switch

# VYSÍLÁNÍ PRO SAMOUČÍCÍ ZÁSUVKY EMOS P0065 (PROTOKOL 3)
button:
  - platform: template
    name: "EMOS Zásuvka A - Sepnout"
    on_press:
      - remote_transmitter.transmit_rc_switch_raw:
          transmitter_id: rf_tx
          protocol: 3
          code: 0x2F2F41
          repeat:
            times: 16
            wait_time: 0s
`;

  const lovelaceRogPreset = `type: custom:stack-in-card
title: "ROG CYBER IOT TOPOLOGIE & GATEWAY"
cards:
  - type: custom:mushroom-entity-card
    entity: binary_sensor.esp32_s3_cc1101_status
    name: "ESP32-S3 CC1101 Gateway"
    icon: mdi:radio-tower
    card_mod:
      style: |
        ha-card {
          background: linear-gradient(145deg, rgba(20, 26, 38, 0.9) 0%, rgba(10, 13, 20, 0.95) 100%) !important;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(0, 240, 255, 0.3) !important;
          border-radius: 14px !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
        }
  - type: markdown
    content: |
      | Uzel | IP | Frekvence | Stav |
      | :--- | :--- | :--- | :--- |
      | **Dell R510** | 192.168.1.108 | - | Proxmox VE 7.4 (Kernel 5.15) |
      | **HAOS Baremetal** | 192.168.1.110 | 2.4 GHz | HAOS 18.3 |
      | **ESP32-S3 GW** | 192.168.1.109 | 433.92 MHz | CC1101 (868M Balun -30dB) |
      | **TrueNAS SCALE** | 192.168.1.115 | - | truenas2 (ZFS) |
      | **OpenWrt** | 192.168.1.1 | 2.4 / 5 GHz | ROUTERBE3600 |
`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-slate-900 border border-cyan-500/60 rounded-2xl max-w-4xl w-full h-[88vh] flex flex-col p-5 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span>AI AGENT BRIDGE (STANDARDIZOVANÝ EXPORT & IMPORT)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 py-2">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('export')}
              className={`px-3 py-1.5 rounded text-xs transition flex items-center gap-1.5 ${
                tab === 'export'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileCode className="w-4 h-4" /> Export Promptu pro AI Agenta
            </button>
            <button
              onClick={() => setTab('import')}
              className={`px-3 py-1.5 rounded text-xs transition flex items-center gap-1.5 ${
                tab === 'import'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" /> Import Dat z AI Odpovědi
            </button>
            <button
              onClick={() => setTab('presets')}
              className={`px-3 py-1.5 rounded text-xs transition flex items-center gap-1.5 ${
                tab === 'presets'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Terminal className="w-4 h-4" /> Produkční Kódy & Konfigurace
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded">
            <ShieldCheck className="w-3.5 h-3.5" /> ZERO PLACEHOLDERS AKTIVNÍ
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-hidden py-3 flex flex-col">
          {tab === 'export' && (
            <div className="flex-1 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Formát obsahuje exaktní XML specifikace zařízení, 3D polohy, matici RF útlumu a JSON model:
                </span>
                <button
                  onClick={() => handleCopy(generatedPrompt)}
                  className="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Zkopírováno!' : 'Kopírovat Prompt pro Agenta'}
                </button>
              </div>

              <textarea
                readOnly
                value={generatedPrompt}
                className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-cyan-300/90 font-mono resize-none focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {tab === 'import' && (
            <div className="flex-1 flex flex-col space-y-3">
              <div className="text-xs text-slate-400">
                Vložte výstup z AI agenta (může obsahovat blok <code className="text-cyan-400">```json ... ```</code> nebo přímo JSON strukturu s místnostmi, zdmi, zařízením a kabeláží):
              </div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='Vložte sem odpověď od AI agenta nebo JSON data projektu...'
                className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono resize-none focus:outline-none focus:border-cyan-500"
              />

              {importStatus && (
                <div
                  className={`p-2 rounded text-xs ${
                    importStatus.success
                      ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
                      : 'bg-red-950/80 border border-red-700 text-red-300'
                  }`}
                >
                  {importStatus.message}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleImport}
                  disabled={!importText.trim()}
                  className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20"
                >
                  <ArrowDownToLine className="w-4 h-4" /> Provést import a aktualizovat topologii
                </button>
              </div>
            </div>
          )}

          {tab === 'presets' && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400">
                    ESPHome CC1101 ESP-IDF Konfigurace (ESP32-S3 @ 192.168.1.109)
                  </span>
                  <button
                    onClick={() => handleCopy(esphomeCc1101Preset)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Kopírovat
                  </button>
                </div>
                <pre className="text-[11px] text-slate-300 overflow-x-auto bg-slate-900 p-2.5 rounded border border-slate-800">
                  {esphomeCc1101Preset}
                </pre>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400">
                    Home Assistant Lovelace Karta (Cyber Slate Glass / ROG Styl)
                  </span>
                  <button
                    onClick={() => handleCopy(lovelaceRogPreset)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> Kopírovat
                  </button>
                </div>
                <pre className="text-[11px] text-slate-300 overflow-x-auto bg-slate-900 p-2.5 rounded border border-slate-800">
                  {lovelaceRogPreset}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
