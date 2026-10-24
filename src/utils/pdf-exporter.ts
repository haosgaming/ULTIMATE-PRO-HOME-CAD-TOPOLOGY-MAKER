import { jsPDF } from 'jspdf';
import { TopologyProject, ConduitLayer } from '../types/topology.ts';
import { calculateSignalAtPoint } from './rf-engine.ts';

export interface PdfExportOptions {
  projectName: string;
  selectedLayers: (ConduitLayer | 'rf' | 'all')[];
  includeInventoryTable: boolean;
  includeCalculations: boolean;
  canvasImageUri?: string;
  scene3dImageUri?: string;
}

export function exportTopologyToPdf(project: TopologyProject, options: PdfExportOptions): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Helper styling
  const setDarkHeader = (title: string, subtitle: string) => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(0, 240, 255); // Electric Cyan
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 12);

    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, 20);

    // Date and NAS target
    doc.text(`Vygenerováno: ${new Date().toLocaleDateString('cs-CZ')} | TrueNAS: ${project.nasConfig.truenasIp}`, pageWidth - 14, 20, { align: 'right' });
  };

  // --- PAGE 1: Přehled projektu & CAD vizualizace ---
  setDarkHeader('IoT CAD & RF Topology Studio - Projektová Dokumentace', `Projekt: ${project.name} | Měřítko 1:1 laserový import`);

  let currentY = 36;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Architektonické uspořádání a souhrn infrastruktury', 14, currentY);

  currentY += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Počet místností: ${project.rooms.length} | Počet zdí: ${project.walls.length} | Počet aktivních uzlů: ${project.devices.length} | Tras vedení: ${project.conduits.length}`, 14, currentY);

  // If 2D or 3D image captured
  if (options.canvasImageUri) {
    try {
      doc.addImage(options.canvasImageUri, 'PNG', 14, currentY + 6, pageWidth - 28, 120);
      currentY += 130;
    } catch (e) {
      // Ignore image add failure
      currentY += 10;
    }
  }

  // Add notes block
  if (currentY < pageHeight - 30) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('Poznámka k RF Sub-GHz: ESP32-S3 CC1101 má 868MHz LC balun filtr. Na frekvenci 433.92MHz je vysílací dosah omezen na 15–50 cm.', 14, pageHeight - 12);
  }

  // --- PAGE 2: Vrstvy vedení (Ethernet, Elektřina, Voda, Odpad) ---
  doc.addPage('a4', 'landscape');
  setDarkHeader('Technické vrstvy rozvodů a vedení ve zdech', 'Separace instalací pro revize a montážní týmy');

  currentY = 38;
  const layerTitles: Record<ConduitLayer, { name: string; color: [number, number, number] }> = {
    ethernet: { name: 'Ethernet L2/L3 (Cat6A / 10G / PoE)', color: [0, 240, 255] },
    power: { name: 'Elektroinstalace & FVE (230V AC / 12V DC)', color: [245, 158, 11] },
    water: { name: 'Vodoinstalace (PEX pitná voda)', color: [56, 189, 248] },
    drainage: { name: 'Kanalizace & Odpady (HT 50/110)', color: [100, 116, 139] },
    rf_bus: { name: 'RF Sběrnice & Anténní svody', color: [168, 85, 247] },
  };

  (Object.keys(layerTitles) as ConduitLayer[]).forEach((layerKey) => {
    const info = layerTitles[layerKey];
    const conduitsInLayer = project.conduits.filter((c) => c.layer === layerKey);

    doc.setFillColor(info.color[0], info.color[1], info.color[2]);
    doc.circle(16, currentY - 1, 2.5, 'F');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${info.name} (${conduitsInLayer.length} tras)`, 22, currentY);

    currentY += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    if (conduitsInLayer.length === 0) {
      doc.setTextColor(148, 163, 184);
      doc.text('V této vrstvě nejsou zapsány žádné trasy.', 22, currentY);
      currentY += 8;
    } else {
      conduitsInLayer.forEach((c) => {
        doc.setTextColor(30, 41, 59);
        const pts = c.points.map((p) => `[${p.x}, ${p.y}, ${p.z}m]`).join(' -> ');
        doc.text(`- ${c.name} | Spec: ${c.specification} | Ø: ${c.diameterMm}mm | Stav: ${c.status} | Trasa: ${pts}`, 22, currentY);
        currentY += 5;
      });
      currentY += 3;
    }
  });

  // --- PAGE 3: Tabulka inventáře & RF propočtů ---
  if (options.includeInventoryTable) {
    doc.addPage('a4', 'landscape');
    setDarkHeader('Inventarizace IoT sítě & Výpočet Link Budgetu', 'Exaktní RF útlumy přes železobetonové a cihlové zdi');

    currentY = 38;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY, pageWidth - 28, 7, 'F');

    doc.setTextColor(15, 23, 42);
    doc.text('Zařízení / Host', 16, currentY + 5);
    doc.text('IP adresa', 70, currentY + 5);
    doc.text('MAC / ID', 105, currentY + 5);
    doc.text('Protokol', 150, currentY + 5);
    doc.text('Frekvence', 180, currentY + 5);
    doc.text('Pozice [X, Y, Z]', 210, currentY + 5);
    doc.text('TX Výkon / Útlum filtru', 245, currentY + 5);

    currentY += 9;
    doc.setFont('helvetica', 'normal');

    project.devices.forEach((dev, idx) => {
      if (currentY > pageHeight - 20) {
        doc.addPage('a4', 'landscape');
        setDarkHeader('Inventarizace IoT sítě (pokračování)', 'Exaktní RF útlumy a síťové parametry');
        currentY = 38;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, currentY - 4, pageWidth - 28, 6, 'F');
      }

      doc.setTextColor(30, 41, 59);
      doc.text(dev.name.substring(0, 32), 16, currentY);
      doc.text(dev.ip, 70, currentY);
      doc.text(dev.mac, 105, currentY);
      doc.text(dev.protocol, 150, currentY);
      doc.text(`${dev.frequencyMHz} MHz`, 180, currentY);
      doc.text(`[${dev.position.x}, ${dev.position.y}, ${dev.position.z}m]`, 210, currentY);
      const offsetStr = dev.hardwareAttenuationOffsetDb !== 0 ? ` (${dev.hardwareAttenuationOffsetDb} dB filtr)` : '';
      doc.text(`${dev.txPowerDbm} dBm${offsetStr}`, 245, currentY);

      currentY += 6;
    });
  }

  // Trigger browser download
  doc.save(`${project.name.replace(/\s+/g, '_')}_Dokumentace.pdf`);
}
