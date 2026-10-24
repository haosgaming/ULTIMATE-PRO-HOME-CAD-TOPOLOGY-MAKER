import { RFDevice } from './rf-engine.ts';

export function parseInventoryFromXml(xmlText: string): Partial<RFDevice>[] {
  const devices: Partial<RFDevice>[] = [];
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check <host>
  const hosts = xmlDoc.getElementsByTagName('host');
  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i];
    const name = host.getAttribute('name') || 'Proxmox Host';
    const hypervisor = host.getElementsByTagName('hypervisor')[0];
    const ip = hypervisor?.getAttribute('ip') || '192.168.1.108';
    const mac = hypervisor?.getAttribute('mac') || '78:2B:CB:19:0D:FD';
    devices.push({
      id: `dev-xml-host-${i}`,
      name,
      ip,
      mac,
      frequencyMHz: 2400,
      protocol: 'ETHERNET',
      txPowerDbm: 0,
      hardwareAttenuationOffsetDb: 0,
      antennaGainDbi: 0,
      position: { x: 1.0, y: 0.8, z: 0.6 },
    });
  }

  // Check <ha_baremetal>
  const has = xmlDoc.getElementsByTagName('ha_baremetal');
  for (let i = 0; i < has.length; i++) {
    const ha = has[i];
    const name = ha.getAttribute('name') || 'Home Assistant MiniPC';
    const ipElem = ha.getElementsByTagName('ip')[0]?.textContent || '192.168.1.110:8123';
    const ip = ipElem.split(':')[0].trim();
    const macMatch = ipElem.match(/MAC:\s*([0-9A-Fa-f:]+)/);
    const mac = macMatch ? macMatch[1] : 'B0:5C:DA:3B:05:A9';
    devices.push({
      id: `dev-xml-ha-${i}`,
      name,
      ip,
      mac,
      frequencyMHz: 2400,
      protocol: 'ZIGBEE_2_4',
      txPowerDbm: 12,
      hardwareAttenuationOffsetDb: 0,
      antennaGainDbi: 2,
      position: { x: 1.0, y: 0.8, z: 1.2 },
    });
  }

  // Check <subghz_gateway>
  const gateways = xmlDoc.getElementsByTagName('subghz_gateway');
  for (let i = 0; i < gateways.length; i++) {
    const gw = gateways[i];
    const name = gw.getAttribute('name') || 'ESP32-S3 433MHz Gateway';
    const ip = gw.getElementsByTagName('ip')[0]?.textContent?.split(' ')[0] || '192.168.1.109';
    const macMatch = gw.getElementsByTagName('ip')[0]?.textContent?.match(/MAC:\s*([0-9A-Fa-f:]+)/);
    const mac = macMatch ? macMatch[1] : '30:ED:A0:BD:31:F4';
    devices.push({
      id: `dev-xml-subghz-${i}`,
      name,
      ip,
      mac,
      frequencyMHz: 433.92,
      protocol: 'RF433_EV1527',
      txPowerDbm: 10,
      hardwareAttenuationOffsetDb: -30,
      antennaGainDbi: 2,
      position: { x: 4.8, y: 2.2, z: 1.2 },
    });
  }

  // Check <node>
  const nodes = xmlDoc.getElementsByTagName('node');
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const ip = node.getAttribute('ip') || '';
    const name = node.getAttribute('name') || `Uzel ${ip}`;
    if (devices.some((d) => d.ip === ip)) continue;
    devices.push({
      id: `dev-xml-node-${i}`,
      name,
      ip,
      mac: '78:2B:CB:00:00:00',
      frequencyMHz: 2400,
      protocol: 'ETHERNET',
      txPowerDbm: 0,
      hardwareAttenuationOffsetDb: 0,
      antennaGainDbi: 0,
      position: { x: 2 + (i % 4), y: 1 + Math.floor(i / 4), z: 0.8 },
    });
  }

  return devices;
}

export function parseInventoryFromCsv(csvText: string): Partial<RFDevice>[] {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  const devices: Partial<RFDevice>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('ip'))) {
      continue; // header
    }
    const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length >= 2) {
      const name = cols[0] || `Zarizeni-${i}`;
      const ip = cols[1] || '192.168.1.1';
      const mac = cols[2] || '00:00:00:00:00:00';
      const protocol = (cols[3] || 'ETHERNET') as any;
      const freq = parseFloat(cols[4]) || 2400;
      const x = parseFloat(cols[5]) || 2 + (i % 3);
      const y = parseFloat(cols[6]) || 2 + Math.floor(i / 3);
      const z = parseFloat(cols[7]) || 1.0;

      devices.push({
        id: `dev-csv-${i}`,
        name,
        ip,
        mac,
        protocol,
        frequencyMHz: freq,
        txPowerDbm: 10,
        hardwareAttenuationOffsetDb: freq === 433.92 ? -30 : 0,
        antennaGainDbi: 2,
        position: { x, y, z },
      });
    }
  }

  return devices;
}

export function parseInventoryFromTxt(txt: string): Partial<RFDevice>[] {
  const devices: Partial<RFDevice>[] = [];
  const lines = txt.split('\n');
  const ipRegex = /(\b192\.168\.\d{1,3}\.\d{1,3}\b)/;
  const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;

  lines.forEach((line, idx) => {
    const ipMatch = line.match(ipRegex);
    if (ipMatch) {
      const ip = ipMatch[1];
      const macMatch = line.match(macRegex);
      const mac = macMatch ? macMatch[0] : '78:2B:CB:19:0D:00';
      // Clean name from line
      const cleanName = line.replace(ipRegex, '').replace(macRegex, '').replace(/[^\w\s\-\.\(\)]/gi, '').trim() || `Zařízení ${ip}`;
      devices.push({
        id: `dev-txt-${idx}`,
        name: cleanName,
        ip,
        mac,
        protocol: 'ETHERNET',
        frequencyMHz: 2400,
        txPowerDbm: 0,
        hardwareAttenuationOffsetDb: 0,
        antennaGainDbi: 0,
        position: { x: 1 + (idx % 4), y: 1 + Math.floor(idx / 4), z: 1.0 },
      });
    }
  });

  return devices;
}
