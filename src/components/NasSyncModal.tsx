import React, { useState } from 'react';
import { TopologyProject } from '../types/topology.ts';
import { HardDrive, Download, Upload, Check, X, Shield, Clock, Server } from 'lucide-react';

interface NasSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TopologyProject;
  onUpdateProject: (updated: TopologyProject) => void;
}

export const NasSyncModal: React.FC<NasSyncModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
}) => {
  const [truenasIp, setTruenasIp] = useState<string>(project.nasConfig.truenasIp || '192.168.1.115');
  const [dataset, setDataset] = useState<string>(project.nasConfig.dataset || 'tank/backups/iot-topology');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  // Offline / Local file download snapshot
  const handleDownloadSnapshot = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.name.replace(/\s+/g, '_')}_TrueNAS_Backup.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    const timestamp = new Date().toISOString();
    onUpdateProject({
      ...project,
      nasConfig: {
        ...project.nasConfig,
        truenasIp,
        dataset,
        lastBackupTimestamp: timestamp,
      },
    });

    setSyncStatus(`Záloha vygenerována a připravena pro uložení do TrueNAS datasetu: ${dataset}`);
  };

  const handleRestoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const restored = JSON.parse(content) as TopologyProject;
        onUpdateProject(restored);
        setSyncStatus('Projekt byl úspěšně obnoven ze souboru zálohy.');
      } catch (err) {
        setSyncStatus('Chyba při čtení záložního souboru JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
            <Server className="w-5 h-5 text-emerald-400" />
            <span>LOKÁLNÍ NAS ZÁLOHOVÁNÍ & SYNC</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-slate-400 flex items-center justify-between">
              <span>Cílový NAS server:</span>
              <span className="text-emerald-400 font-bold">truenas2 (TrueNAS SCALE 27.0)</span>
            </div>

            <div>
              <label className="text-slate-500 block mb-1">IP adresa v lokální síti:</label>
              <input
                type="text"
                value={truenasIp}
                onChange={(e) => setTruenasIp(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300 font-bold"
              />
            </div>

            <div>
              <label className="text-slate-500 block mb-1">ZFS Dataset / Cesta:</label>
              <input
                type="text"
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
              />
            </div>

            <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Poslední záloha: {project.nasConfig.lastBackupTimestamp ? new Date(project.nasConfig.lastBackupTimestamp).toLocaleString('cs-CZ') : 'Zatím nezálohováno'}</span>
            </div>
          </div>

          {syncStatus && (
            <div className="p-2 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs">
              {syncStatus}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleDownloadSnapshot}
              className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
            >
              <Download className="w-4 h-4" />
              <span>Stáhnout NAS Zálohu (.json)</span>
            </button>

            <label className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition">
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Obnovit ze zálohy</span>
              <input type="file" accept=".json" onChange={handleRestoreFromFile} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
