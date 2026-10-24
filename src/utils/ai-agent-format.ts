import { TopologyProject } from '../types/topology.ts';
import { calculateSignalAtPoint } from './rf-engine.ts';

/**
 * Generates copy-paste ready prompt/context string honoring ZERO PLACEHOLDERS & ZERO FRAGMENTS
 */
export function generateAiAgentPrompt(project: TopologyProject, focusDeviceIds?: string[]): string {
  const devicesToInclude = focusDeviceIds?.length
    ? project.devices.filter((d) => focusDeviceIds.includes(d.id))
    : project.devices;

  // Compute link matrix
  const linkMatrixRows = project.connections.map((conn) => {
    const src = project.devices.find((d) => d.id === conn.sourceDeviceId);
    const tgt = project.devices.find((d) => d.id === conn.targetDeviceId);
    if (!src || !tgt) return null;
    const signal = calculateSignalAtPoint(src, tgt.position, project.walls);
    return `| ${src.name} (${src.ip}) | -> | ${tgt.name} (${tgt.ip}) | ${conn.medium} | ${signal.distanceMeters} m | ${signal.rssiDbm} dBm | ${signal.wallLossDb} dB | ${signal.linkStatus} |`;
  }).filter(Boolean).join('\n');

  const xmlInventory = `
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
      <framework>ESP-IDF v5.5+ (Striktní zákaz Arduino frameworku!)</framework>
      <pinout>
        <spi_sclk>GPIO38</spi_sclk>
        <spi_miso>GPIO37</spi_miso>
        <spi_mosi>GPIO35</spi_mosi>
        <cc1101_cs>GPIO21</cc1101_cs>
        <rf_tx_gdo0>GPIO40</rf_tx_gdo0>
        <rf_rx_gdo2>GPIO47</rf_rx_gdo2>
        <onboard_ws2812>GPIO48 (POZOR: Neřídit přes RMT při aktivním RF vysílači kvůli vyčerpání symbolů!)</onboard_ws2812>
      </pinout>
      <rf_module>
        <model>CC1101 M115 (Fyzický LC balun filtr naladěn na 868 MHz)</model>
        <frequency>433.92MHz (Softwarově nastaveno)</frequency>
        <tx_power>10 dBm</tx_power>
        <rf_attenuation_warning>Vzhledem k 868MHz hardwarovému filtru je vysílací výkon na 433.92 MHz utlumen o 25–35 dB. Provozní dosah vysílání je 15–50 cm! Příjem (RX) funguje standardně.</rf_attenuation_warning>
      </rf_module>
      <controlled_peripherals>
        <sockets>Sada samoučících zásuvek EMOS P0065 (protokol EV1527 / RC-Switch Protocol 3 a 2)</sockets>
        <keyfob>4-tlačítkový dálkový ovladač ke CC1101 (Protokol 1, adresy 0x2F2F44, 0x2F2F41, 0x2F2F48, 0x2F2F42)</keyfob>
      </controlled_peripherals>
    </subghz_gateway>

    <fve_subsystem name="Ostrovní / Hybridní FVE">
      <inverter>CARSPA MKS1000-12 (G445), RJ45 RS-232, 2400 baud 8N1, Voltronic PI30</inverter>
      <bridge>ESP32-DevKitV1 (solar-bridge) na GPIO17 (TX) a GPIO18 (RX) přes MAX3232</bridge>
    </fve_subsystem>
  </hardware>

  <network_topology subnet="192.168.1.0/24" gateway="192.168.1.1" dns="192.168.1.50">
    <node ip="192.168.1.1" name="ROUTERBE3600 (OpenWrt)" />
    <node ip="192.168.1.50" name="AdGuard Home (CT 103)" />
    <node ip="192.168.1.81" name="PC (1G LAN)" metric="20" />
    <node ip="192.168.1.82" name="PC (2.5G PCIe)" metric="10" />
    <node ip="192.168.1.108" name="Proxmox (Dell R510)" />
    <node ip="192.168.1.109" name="ESP32-S3 433MHz Gateway" />
    <node ip="192.168.1.110" name="Home Assistant Bare-metal" />
    <node ip="192.168.1.115" name="truenas2 (TrueNAS SCALE 27.0)" />
  </network_topology>
</inventory>
`;

  const domainRules = `
<domain_rules>
  <esphome_and_subghz>
    - VÝHRADNĚ ESP-IDF FRAMEWORK: Pro desky ESP32-S3 vždy deklarovat 'framework: type: esp-idf'. ZÁKAZ Arduino knihoven.
    - SPI KONFIGURACE PRO CC1101: Komponenta 'cc1101' v ESPHome nepodporuje 'spi_id:'. Deklarovat striktně jedno-sběrnicovou syntaxi bez pomlčky a bez ID.
    - ŘÍZENÍ RMT PAMĚTI: ESP32-S3 má fond 384 symbolů RMT. Nastavit 'rmt_symbols: 64' pro remote_transmitter a 'rmt_symbols: 128' pro remote_receiver. Zákaz WS2812 přes RMT současně s RF.
    - PŘÍSNÝ ZÁKAZ ZPOŽDĚNÍ V ON_TRANSMIT: Hooky jsou synchronní callbacky. Použít 'cc1101.begin_tx' v on_transmit a 'cc1101.begin_rx' v on_complete.
    - NATIVNÍ AKCE VYSÍLAČE: Používat 'remote_transmitter.transmit_rc_switch_raw' s protokolem 3 a 'times: 16'. Zákaz 'call.perform()' v lambdě.
  </esphome_and_subghz>
</domain_rules>
`;

  const architecturalData = `
### 3D ARCHITEKTURA A ZDI
${project.rooms.map((r) => `- Místnost "${r.name}": [X:${r.x}m, Y:${r.y}m], Plocha ${r.width}m x ${r.length}m, Výška stropu ${r.ceilingHeight}m, Podlaha ${r.floorMaterial}`).join('\n')}

### ZDI A ÚTLUM
${project.walls.map((w) => `- Zeď [${w.p1.x},${w.p1.y} -> ${w.p2.x},${w.p2.y}], Tloušťka: ${w.thicknessCm}cm, Materiál: ${w.material}`).join('\n')}

### VEDENÍ VE ZDI (CONDUITS)
${project.conduits.map((c) => `- Trasa "${c.name}" [Vrstva: ${c.layer}]: ${c.specification}, Průměr: ${c.diameterMm}mm, Stav: ${c.status}`).join('\n')}

### TOPOLOGICKÁ MATICE SPOJENÍ A RF SIGNÁLŮ
| Zdroj (IP) | Směr | Cíl (IP) | Médium | Vzdálenost | RSSI | Útlum zdí | Status spoje |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
${linkMatrixRows}
`;

  const jsonDump = JSON.stringify(
    {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      projectMetadata: {
        id: project.id,
        name: project.name,
      },
      devices: devicesToInclude,
      rooms: project.rooms,
      walls: project.walls,
      conduits: project.conduits,
      furniture: project.furniture,
      connections: project.connections,
    },
    null,
    2
  );

  return `[1. PŘÍČINA / ANALÝZA]: Exaktní technické zdůvodnění a aktuální stav topologie IoT / LAN sítě
Analýza rádiového pokrytí a prostupnosti signálu prostorem budovy, včetně vlivu 868MHz balun filtru na vysílání CC1101 (433.92MHz) s útlumem -30dB, L2/L3 konektivity a vedení ve zdech.

${xmlInventory}
${domainRules}

${architecturalData}

### STANDARDIZOVANÝ JSON MODEL PRO AI AGENTY
\`\`\`json
${jsonDump}
\`\`\`
`;
}

/**
 * Parse imported AI agent payload or raw JSON and merge with existing project
 */
export function importAiAgentData(rawText: string, currentProject: TopologyProject): TopologyProject {
  // Try extracting ```json ... ``` block
  let jsonString = rawText;
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    jsonString = jsonMatch[1];
  } else {
    // Look for first '{' and last '}'
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonString = rawText.substring(firstBrace, lastBrace + 1);
    }
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      ...currentProject,
      updatedAt: new Date().toISOString(),
      rooms: parsed.rooms || currentProject.rooms,
      walls: parsed.walls || currentProject.walls,
      conduits: parsed.conduits || currentProject.conduits,
      furniture: parsed.furniture || currentProject.furniture,
      devices: parsed.devices || currentProject.devices,
      connections: parsed.connections || currentProject.connections,
    };
  } catch (err) {
    throw new Error('Chyba při parsování dat od AI agenta. Ujistěte se, že vstup obsahuje platný JSON formát.');
  }
}
