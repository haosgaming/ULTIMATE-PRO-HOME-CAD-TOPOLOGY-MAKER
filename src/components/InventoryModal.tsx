import React, { useState } from 'react';
import { TopologyProject } from '../types/topology.ts';
import { RFDevice } from '../utils/rf-engine.ts';
import {
  parseInventoryFromXml,
  parseInventoryFromCsv,
  parseInventoryFromTxt,
} from '../utils/inventory-parser.ts';
import { Database, Upload, Check, X, FileText, Server, AlertCircle } from 'lucide-react';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TopologyProject;
  onUpdateProject: (updated: TopologyProject) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
}) => {
  const [rawText, setRawText] = useState<string>('');
  const [format, setFormat] = useState<'xml' | 'csv' | 'txt'>('xml');
  const [parsedPreview, setParsedPreview] = useState<Partial<RFDevice>[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = (text: string, fmt: 'xml' | 'csv' | 'txt') => {
    try {
      let result: Partial<RFDevice>[] = [];
      if (fmt === 'xml') {
        result = parseInventoryFromXml(text);
      } else if (fmt === 'csv') {
        result = parseInventoryFromCsv(text);
      } else {
        result = parseInventoryFromTxt(text);
      }
      setParsedPreview(result);
      setStatusMsg(`Nalezeno ${result.length} zařízení v inventáři.`);
    } catch (e: any) {
      setStatusMsg(`Chyba parsování: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      // Auto detect format from filename
      let detectedFmt: 'xml' | 'csv' | 'txt' = 'txt';
      if (file.name.endsWith('.xml')) detectedFmt = 'xml';
      else if (file.name.endsWith('.csv')) detectedFmt = 'csv';
      setFormat(detectedFmt);
      handleParse(content, detectedFmt);
    };
    reader.readAsText(file);
  };

  const handleApplyImport = (mode: 'merge' | 'replace') => {
    if (parsedPreview.length === 0) return;

    const convertedDevices: RFDevice[] = parsedPreview.map((d, i) => ({
      id: d.id || `dev-imp-${Date.now()}-${i}`,
      name: d.name || `Uzel ${d.ip || i}`,
      ip: d.ip || '192.168.1.1',
      mac: d.mac || '00:00:00:00:00:00',
      position: d.position || { x: 2 + (i % 4), y: 2 + Math.floor(i / 4), z: 1.0 },
      frequencyMHz: d.frequencyMHz || 2400,
      txPowerDbm: d.txPowerDbm ?? 10,
      hardwareAttenuationOffsetDb: d.hardwareAttenuationOffsetDb ?? 0,
      antennaGainDbi: d.antennaGainDbi ?? 2,
      protocol: d.protocol || 'ETHERNET',
    }));

    if (mode === 'replace') {
      onUpdateProject({
        ...project,
        devices: convertedDevices,
      });
    } else {
      // Merge unique by IP or ID
      const existingIps = new Set(project.devices.map((d) => d.ip));
      const newOnly = convertedDevices.filter((d) => !existingIps.has(d.ip));
      onUpdateProject({
        ...project,
        devices: [...project.devices, ...newOnly],
      });
    }

    onClose();
  };

  const loadDefaultInventoryXml = () => {
    const sampleXml = `
<inventory>
  <hardware>
    <host name="Dell PowerEdge R510 (11. gen)">
      <cpu>Intel 5520, 2x Intel Xeon L5640 (Westmere-EP @ 2.27GHz, 20 vCPU pro VM, 12 jader fyzicky). KRITICKÉ: ABSENCE AVX/AVX2!</cpu>
      <hypervisor os="Proxmox VE 7.4 (Debian 11 Bullseye, Kernel 5.15)" ip="192.168.1.108" mac="78:2B:CB:19:0D:FD" user="root" />
    </host>
    <ha_baremetal name="Home Assistant MiniPC (BARE-METAL HAOS)">
      <system>Host OS: Home Assistant OS 18.3 | Core: 2026.10.2 | Supervisor: 2026.10.2 | Frontend: 20260930.4</system>
      <ip>192.168.1.110:8123 (MAC: B0:5C:DA:3B:05:A9)</ip>
    </ha_baremetal>
    <subghz_gateway name="ESP32-S3 433MHz Gateway">
      <board>ESP32-S3-WROOM-1-N16R8 CAM (Xtensa LX7 dual-core, 16MB Flash, 8MB Octal OPI PSRAM)</board>
      <ip>192.168.1.109 (MAC: 30:ED:A0:BD:31:F4)</ip>
    </subghz_gateway>
  </hardware>
  <network_topology subnet="192.168.1.0/24" gateway="192.168.1.1" dns="192.168.1.50">
    <node ip="192.168.1.1" name="ROUTERBE3600 (OpenWrt)" />
    <node ip="192.168.1.50" name="AdGuard Home (CT 103)" />
    <node ip="192.168.1.81" name="PC (1G LAN)" />
    <node ip="192.168.1.82" name="PC (2.5G PCIe)" />
    <node ip="192.168.1.108" name="Proxmox (Dell R510)" />
    <node ip="192.168.1.109" name="ESP32-S3 433MHz Gateway" />
    <node ip="192.168.1.110" name="Home Assistant Bare-metal" />
    <node ip="192.168.1.115" name="truenas2 (TrueNAS SCALE 27.0)" />
  </network_topology>
</inventory>
`;
    setRawText(sampleXml);
    setFormat('xml');
    handleParse(sampleXml, 'xml');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col p-5 shadow-2xl text-slate-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <Database className="w-5 h-5 text-cyan-400" />
            <span>IMPORT STÁVAJÍCÍ INVENTARIZACE (XML / CSV / TXT)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Formát:</span>
            {(['xml', 'csv', 'txt'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  setFormat(fmt);
                  if (rawText) handleParse(rawText, fmt);
                }}
                className={`px-2.5 py-1 rounded uppercase font-bold transition ${
                  format === fmt ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {fmt}
              </button>
            ))}

            <label className="ml-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer border border-slate-700 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Nahrát soubor</span>
              <input type="file" accept=".xml,.csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <button
            onClick={loadDefaultInventoryXml}
            className="px-3 py-1 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Server className="w-3.5 h-3.5" /> Načíst produkční inventář z hardware
          </button>
        </div>

        {/* Text Input */}
        <div className="flex-1 min-h-[140px] flex flex-col space-y-1">
          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              handleParse(e.target.value, format);
            }}
            placeholder="Vložte text inventarizace v XML, CSV nebo TXT formátu..."
            className="w-full h-36 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono resize-none focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Preview of Parsed Items */}
        <div className="flex-1 overflow-hidden flex flex-col border border-slate-800 rounded-xl bg-slate-950/60 p-3">
          <div className="text-xs font-bold text-cyan-400 flex items-center justify-between pb-2 border-b border-slate-800">
            <span>NÁHLED ROZPOZNANÝCH ZAŘÍZENÍ ({parsedPreview.length})</span>
            {statusMsg && <span className="text-[11px] text-emerald-400 font-normal">{statusMsg}</span>}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 pr-1 max-h-48 text-[11px]">
            {parsedPreview.length === 0 ? (
              <div className="text-slate-500 text-center py-6">
                Zatím nebyla rozpoznána žádná zařízení. Vložte text nebo nahrajte soubor.
              </div>
            ) : (
              parsedPreview.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800"
                >
                  <div className="font-bold text-slate-200">{item.name}</div>
                  <div className="text-cyan-400">{item.ip}</div>
                  <div className="text-slate-400">{item.mac}</div>
                  <div className="text-emerald-400">{item.protocol}</div>
                  <div className="text-slate-400">{item.frequencyMHz} MHz</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300">
            Zavřít
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => handleApplyImport('merge')}
              disabled={parsedPreview.length === 0}
              className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
            >
              <Check className="w-4 h-4" /> Sloučit s existujícími (Merge)
            </button>
            <button
              onClick={() => handleApplyImport('replace')}
              disabled={parsedPreview.length === 0}
              className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/20"
            >
              <Check className="w-4 h-4" /> Nahradit celý inventář (Replace)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
