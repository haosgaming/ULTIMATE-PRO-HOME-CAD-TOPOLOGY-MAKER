import React, { useState, useRef } from 'react';
import { RFDevice, DevicePort } from '../utils/rf-engine.ts';
import { TopologyProject } from '../types/topology.ts';
import {
  Server,
  Cpu,
  Network,
  Terminal,
  Upload,
  Image as ImageIcon,
  Check,
  X,
  Sliders,
  Radio,
  Activity,
  AlertTriangle,
  Zap,
  Cable,
  HardDrive,
  Wifi,
} from 'lucide-react';

interface CiscoDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: RFDevice | null;
  project: TopologyProject;
  onUpdateDevice: (updated: RFDevice) => void;
  theme?: 'dark' | 'light';
}

export const CiscoDeviceModal: React.FC<CiscoDeviceModalProps> = ({
  isOpen,
  onClose,
  device,
  project,
  onUpdateDevice,
  theme = 'dark',
}) => {
  const [activeTab, setActiveTab] = useState<'physical' | 'config' | 'cli'>('physical');
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);

  // Edit form state
  const [editedName, setEditedName] = useState<string>('');
  const [editedIp, setEditedIp] = useState<string>('');
  const [editedMac, setEditedMac] = useState<string>('');
  const [editedTxPower, setEditedTxPower] = useState<number>(10);
  const [editedFreq, setEditedFreq] = useState<number>(2400);

  // CLI state
  const [cliInput, setCliInput] = useState<string>('');
  const [cliHistory, setCliHistory] = useState<string[]>([]);
  const cliBottomRef = useRef<HTMLDivElement>(null);

  // Sync state when device opens
  React.useEffect(() => {
    if (device) {
      setEditedName(device.name);
      setEditedIp(device.ip);
      setEditedMac(device.mac);
      setEditedTxPower(device.txPowerDbm);
      setEditedFreq(device.frequencyMHz);
      setSelectedPortId(device.ports?.[0]?.id || null);

      // Initial realistic CLI banner
      let promptPrefix = `root@${device.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}:~#`;
      if (device.id.includes('subghz')) promptPrefix = `[ESP-IDF v5.5 esp32s3-cc1101]$`;
      if (device.id.includes('haos')) promptPrefix = `ha >`;
      if (device.id.includes('router')) promptPrefix = `root@OpenWrt:~#`;

      setCliHistory([
        `*** CISCO/ENTERPRISE TERMINAL SESSION INITIALIZED ***`,
        `Hardware: ${device.hardwareModel || 'Generic Network Node'}`,
        `Firmware: ${device.firmwareVersion || 'Bare-Metal OS'}`,
        `MAC: ${device.mac} | IP: ${device.ip}`,
        `Zadejte příkazy: 'help', 'ip addr', 'ping 192.168.1.1', 'status', 'ethtool', 'rf_check'`,
        promptPrefix,
      ]);
    }
  }, [device]);

  if (!isOpen || !device) return null;

  const isDark = theme === 'dark';
  const modalBg = isDark ? 'bg-[#090d16] border-cyan-500/50' : 'bg-[#ffffff] border-slate-300';
  const headerBg = isDark ? 'bg-[#05070e] border-slate-800' : 'bg-[#f1f5f9] border-slate-300';
  const cardBg = isDark ? 'bg-[#0d1424] border-slate-800' : 'bg-[#f8fafc] border-slate-200';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const selectedPort = device.ports?.find((p) => p.id === selectedPortId) || device.ports?.[0];

  // Handle uploading custom connector illustration image
  const handleConnectorImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPort) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      const updatedPorts = (device.ports || []).map((p) =>
        p.id === selectedPort.id ? { ...p, connectorImageUrl: dataUri } : p
      );

      onUpdateDevice({
        ...device,
        ports: updatedPorts,
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle saving config
  const handleSaveConfig = () => {
    onUpdateDevice({
      ...device,
      name: editedName,
      ip: editedIp,
      mac: editedMac,
      txPowerDbm: editedTxPower,
      frequencyMHz: editedFreq,
    });
    onClose();
  };

  // CLI command executor
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const cmd = cliInput.trim().toLowerCase();
    const newLogs = [...cliHistory, `> ${cliInput}`];

    if (cmd === 'help') {
      newLogs.push(
        'Dostupné příkazy:',
        '  ip addr           - výpis IP rozhraní a MAC adres',
        '  ping <ip>         - ICMP echo test přes lokální L2/L3 síť',
        '  ethtool           - stav fyzického linku, duplex a rychlost',
        '  rf_check          - diagnostika CC1101 transceiveru / Zigbee dongle',
        '  conduits          - přiřazené trasy ve zdi a prostupy',
        '  clear             - vymazat obrazovku'
      );
    } else if (cmd === 'clear') {
      setCliHistory([]);
      setCliInput('');
      return;
    } else if (cmd.startsWith('ip addr') || cmd === 'ifconfig') {
      newLogs.push(
        `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN`,
        `    inet 127.0.0.1/8 scope host lo`,
        `2: ${selectedPort?.name || 'eth0'}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP`,
        `    link/ether ${device.mac} brd ff:ff:ff:ff:ff:ff`,
        `    inet ${device.ip}/24 brd 192.168.1.255 scope global dynamic`
      );
    } else if (cmd.startsWith('ping')) {
      newLogs.push(
        `PING 192.168.1.1 (192.168.1.1) 56(84) bytes of data.`,
        `64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.342 ms`,
        `64 bytes from 192.168.1.1: icmp_seq=2 ttl=64 time=0.298 ms`,
        `64 bytes from 192.168.1.1: icmp_seq=3 ttl=64 time=0.315 ms`,
        `--- 192.168.1.1 ping statistics ---`,
        `3 packets transmitted, 3 received, 0% packet loss, time 2004ms`
      );
    } else if (cmd === 'ethtool') {
      newLogs.push(
        `Settings for ${selectedPort?.name || 'eth0'}:`,
        `    Supported ports: [ TP MII ]`,
        `    Supported link modes:   1000baseT/Full, 2500baseT/Full`,
        `    Speed: ${selectedPort?.speedMbps || 1000}Mb/s`,
        `    Duplex: ${selectedPort?.duplex || 'Full'}`,
        `    Auto-negotiation: on`,
        `    Link detected: ${selectedPort?.status === 'UP' ? 'yes' : 'no'}`
      );
    } else if (cmd === 'rf_check') {
      if (device.hardwareAttenuationOffsetDb <= -25) {
        newLogs.push(
          `[CC1101 SUB-GHZ HARDWARE CHECK]`,
          `  SPI Bus: SCK=GPIO38, MISO=GPIO37, MOSI=GPIO35, CSN=GPIO21`,
          `  Frekvence: 433.92 MHz (ASK/OOK Modulation)`,
          `  VÝSTRAHA: LC Balun filtr je fyzicky 868 MHz!`,
          `  Naměřený útlum LC filtru: -30 dB (TX dosah: 15–50 cm)`,
          `  RMT paměť symbolů: 64 TX / 128 RX (Non-blocking: OK)`
        );
      } else {
        newLogs.push(
          `[RF PROTOCOL CHECK]`,
          `  Protokol: ${device.protocol}`,
          `  Frekvence: ${device.frequencyMHz} MHz`,
          `  TX Power: ${device.txPowerDbm} dBm (Anténa: ${device.antennaGainDbi} dBi)`
        );
      }
    } else {
      newLogs.push(`Neznámý příkaz: '${cmd}'. Zadejte 'help'.`);
    }

    setCliHistory(newLogs);
    setCliInput('');
    setTimeout(() => {
      cliBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-mono">
      <div className={`${modalBg} border rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden`}>
        {/* Header - Cisco Packet Tracer Chassis Title */}
        <div className={`p-4 ${headerBg} border-b flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm tracking-wide ${textPrimary}`}>
                  {device.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {device.hardwareModel || 'Cisco Packet Tracer Compatible'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-0.5">
                <span>IP: <strong className="text-cyan-400">{device.ip}</strong></span>
                <span>•</span>
                <span>MAC: <strong className="text-slate-300">{device.mac}</strong></span>
                <span>•</span>
                <span>OS: {device.firmwareVersion || 'Firmware v1.0'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab navigation */}
            <div className={`flex rounded-xl p-1 border text-xs ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
              <button
                onClick={() => setActiveTab('physical')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                  activeTab === 'physical'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cable className="w-3.5 h-3.5" /> Fyzický Pohled & Konektory
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                  activeTab === 'config'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Konfigurace L2/L3 & RF
              </button>
              <button
                onClick={() => setActiveTab('cli')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                  activeTab === 'cli'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" /> Příkazový Řádek (CLI)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Physical View & Port Matrix & Connector Illustrations */}
        {activeTab === 'physical' && (
          <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-4">
            {/* Chassis Physical Port Panel (Cisco Style Interactive Bezel) */}
            <div className={`p-4 rounded-xl border ${cardBg} shadow-inner space-y-3`}>
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  FYZICKÝ PANEL ROZHRANÍ & ŠASI (INTERAKTIVNÍ PORTY)
                </span>
                <span className="text-[10px] text-slate-400">
                  Klikněte na port pro schéma zapojení pinů a ilustrační foto
                </span>
              </div>

              {/* Ports Bay */}
              <div className="flex flex-wrap items-center gap-3 py-2">
                {(device.ports || []).map((port) => {
                  const isSelected = selectedPort?.id === port.id;
                  const isUp = port.status === 'UP';

                  return (
                    <button
                      key={port.id}
                      onClick={() => setSelectedPortId(port.id)}
                      className={`p-2.5 rounded-xl border text-left transition flex items-center gap-3 ${
                        isSelected
                          ? 'bg-cyan-950/80 border-cyan-400 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400'
                          : isDark
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                          : 'bg-white border-slate-300 hover:border-slate-400 shadow-sm'
                      }`}
                    >
                      {/* Port LED indicator */}
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isUp ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-slate-600'
                          }`}
                        />
                        <span className="text-[9px] text-slate-500 font-bold">LINK</span>
                      </div>

                      {/* Port icon & label */}
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <span>{port.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-0.5">
                          <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                            {port.type}
                          </span>
                          {port.speedMbps && <span>{port.speedMbps} Mbps</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Port Detailed Pinout & Connector Illustration */}
            {selectedPort && (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
                {/* Left: Port Specs & Pinout Mapping Table */}
                <div className={`p-4 rounded-xl border ${cardBg} overflow-y-auto space-y-3`}>
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <span className="text-xs font-bold text-amber-400">
                      MAPOVÁNÍ PINŮ: {selectedPort.name}
                    </span>
                    <span className="text-[10px] text-slate-400">Typ: {selectedPort.type}</span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    {selectedPort.ip && <div>Přiřazená IP: <strong className="text-cyan-400">{selectedPort.ip}</strong></div>}
                    {selectedPort.mac && <div>Hardwarová MAC: <strong className="text-slate-300">{selectedPort.mac}</strong></div>}
                    {selectedPort.speedMbps && <div>Přenosová rychlost: <strong>{selectedPort.speedMbps} Mbps ({selectedPort.duplex || 'Full'})</strong></div>}
                  </div>

                  {/* Pinout Table */}
                  {selectedPort.pinout && selectedPort.pinout.length > 0 ? (
                    <div className="overflow-x-auto pt-2">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-700/60 text-slate-400 text-[10px]">
                            <th className="py-1 px-2">Pin #</th>
                            <th className="py-1 px-2">Signál / Funkce</th>
                            <th className="py-1 px-2">Barevné značení</th>
                            <th className="py-1 px-2">Detail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-[11px]">
                          {selectedPort.pinout.map((pin) => (
                            <tr key={pin.pin} className="hover:bg-slate-800/30">
                              <td className="py-1.5 px-2 font-bold text-cyan-400">Pin {pin.pin}</td>
                              <td className="py-1.5 px-2 font-bold text-slate-200">{pin.label}</td>
                              <td className="py-1.5 px-2">
                                <div className="flex items-center gap-1.5">
                                  {pin.wireColor && (
                                    <span
                                      className="w-3 h-3 rounded-full border border-slate-600 inline-block"
                                      style={{ backgroundColor: pin.wireColor }}
                                    />
                                  )}
                                  <span className="text-slate-400 text-[10px]">{pin.wireColor || '-'}</span>
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-slate-300 text-[10px]">{pin.signal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs py-4 text-center">
                      Standardní gigabitové autonegotiation rozhraní bez nutnosti manuálního křížení vodičů (Auto-MDIX).
                    </div>
                  )}
                </div>

                {/* Right: Connector Illustration & Custom Upload */}
                <div className={`p-4 rounded-xl border ${cardBg} flex flex-col space-y-3`}>
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      ILUSTRAČNÍ SCHÉMA A FOTO KONEKTORU
                    </span>

                    {/* Upload Custom Image Button */}
                    <label className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Nahrát foto konektoru</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleConnectorImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Image Display or Technical Vector Graphic */}
                  <div className="flex-1 rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex flex-col items-center justify-center relative overflow-hidden">
                    {selectedPort.connectorImageUrl ? (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <img
                          src={selectedPort.connectorImageUrl}
                          alt={`Konektor ${selectedPort.name}`}
                          className="max-h-56 max-w-full object-contain rounded-lg border border-slate-700 shadow-xl"
                        />
                        <span className="text-[10px] text-emerald-400 pt-2 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Vlastní nahrané ilustrační foto konektoru
                        </span>
                      </div>
                    ) : (
                      /* High-Res Technical Vector Diagram based on port type */
                      <div className="w-full flex flex-col items-center text-center space-y-3">
                        {selectedPort.type.includes('RJ45') && (
                          <div className="space-y-2">
                            <div className="w-44 h-28 mx-auto rounded-lg bg-slate-900 border-2 border-cyan-500 p-2 flex flex-col justify-between shadow-lg shadow-cyan-500/10">
                              <div className="flex justify-between items-center text-[10px] text-cyan-400 font-bold border-b border-cyan-500/40 pb-1">
                                <span>8P8C Cat6A STP</span>
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              </div>
                              <div className="grid grid-cols-8 gap-1 py-1">
                                {[
                                  '#fff',
                                  '#f97316',
                                  '#fff',
                                  '#0284c7',
                                  '#fff',
                                  '#22c55e',
                                  '#fff',
                                  '#92400e',
                                ].map((color, idx) => (
                                  <div
                                    key={idx}
                                    className="h-8 rounded-sm border border-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-900"
                                    style={{ backgroundColor: color }}
                                  >
                                    {idx + 1}
                                  </div>
                                ))}
                              </div>
                              <span className="text-[9px] text-slate-400">TIA/EIA-568-B Norma</span>
                            </div>
                            <span className="text-[11px] text-slate-300 font-bold block">
                              Technické schéma: RJ45 8P8C (Cat6A S/FTP Stíněný)
                            </span>
                          </div>
                        )}

                        {selectedPort.type === 'SPI_BUS' && (
                          <div className="space-y-2">
                            <div className="w-56 h-28 mx-auto rounded-lg bg-slate-900 border-2 border-purple-500 p-2 flex flex-col justify-between shadow-lg">
                              <div className="text-[10px] text-purple-400 font-bold border-b border-purple-500/40 pb-1 flex justify-between">
                                <span>CC1101 SPI Header (2.0mm)</span>
                                <span>ESP-IDF v5.5</span>
                              </div>
                              <div className="grid grid-cols-4 gap-1 text-[9px] text-slate-300 py-1">
                                <span className="bg-slate-800 p-1 rounded">SCLK: 38</span>
                                <span className="bg-slate-800 p-1 rounded">MISO: 37</span>
                                <span className="bg-slate-800 p-1 rounded">MOSI: 35</span>
                                <span className="bg-slate-800 p-1 rounded">CSN: 21</span>
                                <span className="bg-slate-800 p-1 rounded text-red-400">GDO0: 40</span>
                                <span className="bg-slate-800 p-1 rounded text-emerald-400">GDO2: 47</span>
                                <span className="bg-slate-800 p-1 rounded text-pink-400">LED: 48</span>
                                <span className="bg-slate-800 p-1 rounded text-slate-400">GND</span>
                              </div>
                              <span className="text-[9px] text-amber-400 font-bold">Zákaz WS2812 RMT při RF!</span>
                            </div>
                            <span className="text-[11px] text-slate-300 font-bold block">
                              Technické schéma: 8-pin SPI sběrnice CC1101 M115
                            </span>
                          </div>
                        )}

                        {selectedPort.type === 'SMA_RF' && (
                          <div className="space-y-2">
                            <div className="w-40 h-28 mx-auto rounded-full bg-slate-900 border-4 border-amber-500 flex flex-col items-center justify-center p-2 shadow-lg">
                              <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-slate-950 font-bold text-[10px]">
                                RF
                              </div>
                              <span className="text-[9px] text-amber-300 font-bold pt-1">50 Ω Coaxial</span>
                              <span className="text-[8px] text-red-400 font-bold">-30dB Balun</span>
                            </div>
                            <span className="text-[11px] text-slate-300 font-bold block">
                              Zlacený SMA konektor (868MHz Balun filtr)
                            </span>
                          </div>
                        )}

                        {selectedPort.type === 'RS232_RJ45' && (
                          <div className="space-y-2">
                            <div className="w-48 h-28 mx-auto rounded-lg bg-slate-900 border-2 border-emerald-500 p-2 flex flex-col justify-between shadow-lg">
                              <div className="text-[10px] text-emerald-400 font-bold border-b border-emerald-500/40 pb-1">
                                RJ45 Serial RS-232 (Voltronic PI30)
                              </div>
                              <div className="text-[10px] text-slate-300 space-y-0.5 text-left pl-2">
                                <div>Pin 1: <strong className="text-amber-400">TXD</strong> (2400 baud 8N1)</div>
                                <div>Pin 2: <strong className="text-emerald-400">RXD</strong> (do MAX3232)</div>
                                <div>Pin 3: <strong className="text-slate-400">GND</strong> (Společná zem)</div>
                              </div>
                              <span className="text-[9px] text-slate-500">MKS1000-12 Střídač</span>
                            </div>
                            <span className="text-[11px] text-slate-300 font-bold block">
                              Technické schéma: RJ45 RS-232 Port měniče
                            </span>
                          </div>
                        )}

                        {selectedPort.type === 'SCREW_TERMINAL' && (
                          <div className="space-y-2">
                            <div className="w-48 h-24 mx-auto rounded-lg bg-slate-900 border-2 border-amber-500 p-2 flex flex-col justify-between shadow-lg">
                              <div className="text-[10px] text-amber-400 font-bold border-b border-amber-500/40 pb-1">
                                Masivní šroubové svorkovnice
                              </div>
                              <div className="flex justify-around items-center py-2">
                                <span className="w-7 h-7 rounded bg-red-950 border border-red-500 flex items-center justify-center text-red-400 font-bold text-xs">+</span>
                                <span className="w-7 h-7 rounded bg-slate-800 border border-slate-500 flex items-center justify-center text-slate-300 font-bold text-xs">-</span>
                                <span className="w-7 h-7 rounded bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-400 font-bold text-xs">PE</span>
                              </div>
                              <span className="text-[9px] text-slate-500">Průřez vodiče až 16 mm²</span>
                            </div>
                            <span className="text-[11px] text-slate-300 font-bold block">
                              Silové DC / AC šroubové svorky
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Config Tab */}
        {activeTab === 'config' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className={`p-4 rounded-xl border ${cardBg} space-y-4 max-w-2xl mx-auto shadow-xl`}>
              <div className="text-xs font-bold text-cyan-400 border-b border-slate-700/60 pb-2 flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <span>PARAMETRY SÍŤOVÉHO A RF ROZHRANÍ</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Hostname / Označení uzlu:</label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-cyan-300 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">IP adresa (L3):</label>
                    <input
                      type="text"
                      value={editedIp}
                      onChange={(e) => setEditedIp(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-cyan-300 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Fyzická MAC adresa (L2):</label>
                    <input
                      type="text"
                      value={editedMac}
                      onChange={(e) => setEditedMac(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Vysílací RF výkon (dBm):</label>
                    <input
                      type="number"
                      value={editedTxPower}
                      onChange={(e) => setEditedTxPower(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-amber-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Nosná frekvence (MHz):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editedFreq}
                      onChange={(e) => setEditedFreq(parseFloat(e.target.value) || 2400)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-purple-400 font-bold"
                    />
                  </div>
                </div>

                {device.hardwareAttenuationOffsetDb <= -25 && (
                  <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      Hardwarový filtr LC 868 MHz aktivní
                    </div>
                    <p className="text-[11px] text-red-300 leading-relaxed">
                      Při frekvenci 433.92 MHz způsobuje filtr útlum -30 dB. Reálný dosah je 15–50 cm.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
                  <button
                    onClick={onClose}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                  >
                    <Check className="w-4 h-4" /> Uložit a aplikovat změny
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Interactive CLI / Terminal */}
        {activeTab === 'cli' && (
          <div className="flex-1 flex flex-col p-4 space-y-2 bg-black text-emerald-400 font-mono text-xs">
            <div className="flex-1 overflow-y-auto space-y-1 p-2">
              {cliHistory.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {line}
                </div>
              ))}
              <div ref={cliBottomRef} />
            </div>

            <form onSubmit={handleCliSubmit} className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <span className="text-cyan-400 font-bold">&gt;</span>
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="Zadejte příkaz (např. 'help', 'ip addr', 'ethtool', 'rf_check')..."
                className="flex-1 bg-transparent border-none text-emerald-300 font-mono text-xs focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-bold hover:bg-emerald-900"
              >
                Odeslat
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
