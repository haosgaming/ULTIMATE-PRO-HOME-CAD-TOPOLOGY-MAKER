import React, { useState } from 'react';
import { TopologyProject } from '../types/topology.ts';
import { FileText, Save, Check, Plus, Tag, HelpCircle } from 'lucide-react';

interface NotesEditorProps {
  project: TopologyProject;
  onUpdateProject: (updated: TopologyProject) => void;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({ project, onUpdateProject }) => {
  const [notes, setNotes] = useState<string>(project.notes);
  const [saved, setSaved] = useState<boolean>(false);

  const handleSave = () => {
    onUpdateProject({
      ...project,
      notes,
      updatedAt: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const insertSnippet = (snippet: string) => {
    setNotes((prev) => prev + '\n' + snippet);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 shadow-xl space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span>PROJEKTOVÝ DENÍK & TECHNICKÉ POZNÁMKY K SEKCÍM</span>
        </div>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Uloženo!' : 'Uložit poznámky'}
        </button>
      </div>

      {/* Snippet Insert Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        <span className="text-[11px] text-slate-400">Rychlé šablony:</span>
        <button
          onClick={() =>
            insertSnippet(`### Revize vedení ve zdi (Datum: ${new Date().toLocaleDateString('cs-CZ')})
- Trasa: Cat6A S/FTP v chráničce Ø20mm
- Naměřený odpor / průchodnost: OK (10 Gbps certifikováno)
- Umístění prostupů: Nosná zeď 35cm mezi serverovnou a chodbou.`)
          }
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-cyan-300 border border-slate-700"
        >
          + Revize zdi
        </button>

        <button
          onClick={() =>
            insertSnippet(`### Záznam RF měření signálu
- Frekvence: 433.92 MHz (EV1527 protokol 3)
- CC1101 TX: 10 dBm (-30 dB LC balun offset)
- Naměřené RSSI na zásuvce EMOS: -62 dBm na vzdálenost 35 cm.`)
          }
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-purple-300 border border-slate-700"
        >
          + RF Záznam CC1101
        </button>

        <button
          onClick={() =>
            insertSnippet(`### Záznam FVE a silové trasy
- Střídač: CARSPA MKS1000-12 (G445), RS-232 Voltronic PI30
- Baterie: 12V LiFePO4
- Průřez kabelu AC: CYKY-J 3x2.5mm²`)
          }
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-300 border border-slate-700"
        >
          + FVE Poznámka
        </button>
      </div>

      {/* Textarea */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Zapisujte technické detaily, revizní poznámky k prostupům zdmi, zapojení svorkovnic..."
        className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:border-cyan-500"
      />

      <div className="text-[11px] text-slate-500 flex items-center justify-between">
        <span>Podporuje standardní Markdown syntaxi. Ukládá se do offline zálohy projektu.</span>
        <span>Znaků: {notes.length}</span>
      </div>
    </div>
  );
};
