import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFSPL,
  calculateSignalAtPoint,
  checkLineIntersection,
} from './rf-engine.ts';
import type { RFDevice, WallSegment } from './rf-engine.ts';

test('checkLineIntersection identifies crossing lines', () => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 10, y: 10 };
  const p3 = { x: 0, y: 10 };
  const p4 = { x: 10, y: 0 };
  assert.equal(checkLineIntersection(p1, p2, p3, p4), true);

  // Parallel lines
  const p5 = { x: 0, y: 1 };
  const p6 = { x: 10, y: 11 };
  assert.equal(checkLineIntersection(p1, p2, p5, p6), false);
});

test('calculateFSPL calculates expected free space path loss', () => {
  // At 1 meter for 2400 MHz: FSPL ~ 20*log10(1) + 20*log10(2400) - 27.55 = 0 + 67.60 - 27.55 = 40.05 dB
  const loss2400 = calculateFSPL(1, 2400);
  assert.ok(Math.abs(loss2400 - 40.05) < 0.2);

  // At 1 meter for 433.92 MHz: FSPL ~ 0 + 52.75 - 27.55 = 25.2 dB
  const loss433 = calculateFSPL(1, 433.92);
  assert.ok(Math.abs(loss433 - 25.2) < 0.2);
});

test('CC1101 gateway with 868MHz balun filter on 433MHz drops power drastically at distance', () => {
  const cc1101Gateway: RFDevice = {
    id: 'subghz_gateway',
    name: 'ESP32-S3 433MHz Gateway',
    ip: '192.168.1.109',
    mac: '30:ED:A0:BD:31:F4',
    position: { x: 2, y: 2, z: 1.2 },
    frequencyMHz: 433.92,
    txPowerDbm: 10,
    hardwareAttenuationOffsetDb: -30, // 868MHz filter penalty on 433MHz
    antennaGainDbi: 2,
    protocol: 'RF433_EV1527',
  };

  const closeTarget = { x: 2.2, y: 2, z: 1.2 }; // 20cm away (within 15-50cm operating range)
  const farTarget = { x: 8, y: 8, z: 1.2 }; // ~8.5m away across room

  const closeResult = calculateSignalAtPoint(cc1101Gateway, closeTarget, []);
  const farResult = calculateSignalAtPoint(cc1101Gateway, farTarget, []);

  // At 20cm, RSSI is strong (~ -29 dBm)
  assert.ok(closeResult.rssiDbm > -40);
  assert.equal(closeResult.linkStatus, 'NOMINAL');

  // At 8.5m with -30dB balun penalty and distance, signal drops by over 30 dB
  assert.ok(closeResult.rssiDbm - farResult.rssiDbm > 30);
});

test('Wall intersection adds material attenuation', () => {
  const tx: RFDevice = {
    id: 'openwrt',
    name: 'ROUTERBE3600 (OpenWrt)',
    ip: '192.168.1.1',
    mac: '78:2B:CB:19:0D:F1',
    position: { x: 1, y: 1, z: 1.5 },
    frequencyMHz: 2400,
    txPowerDbm: 20,
    hardwareAttenuationOffsetDb: 0,
    antennaGainDbi: 3,
    protocol: 'WIFI_2_4',
  };

  const wall: WallSegment = {
    id: 'w1',
    p1: { x: 3, y: 0 },
    p2: { x: 3, y: 10 },
    thicknessCm: 30,
    heightM: 2.7,
    material: 'reinforced_concrete',
  };

  const directResult = calculateSignalAtPoint(tx, { x: 2, y: 1, z: 1.5 }, [wall]);
  const throughWallResult = calculateSignalAtPoint(tx, { x: 5, y: 1, z: 1.5 }, [wall]);

  assert.equal(directResult.intersectionsCount, 0);
  assert.equal(throughWallResult.intersectionsCount, 1);
  assert.ok(throughWallResult.wallLossDb > 20); // Concrete thickness 30cm => ~54dB loss
});

test('Stone wall with 60cm thickness produces high RF attenuation', () => {
  const txSubGhz: RFDevice = {
    id: 'gw-cc1101',
    name: 'ESP32-S3 433MHz Gateway',
    ip: '192.168.1.109',
    mac: '30:ED:A0:BD:31:F4',
    position: { x: 1, y: 1, z: 1.2 },
    frequencyMHz: 433.92,
    txPowerDbm: 10,
    hardwareAttenuationOffsetDb: 0,
    antennaGainDbi: 2,
    protocol: 'RF433_EV1527',
  };

  const stoneWall: WallSegment = {
    id: 'w-stone',
    p1: { x: 3, y: 0 },
    p2: { x: 3, y: 10 },
    thicknessCm: 60,
    heightM: 2.7,
    material: 'stone',
  };

  const throughStoneResult = calculateSignalAtPoint(txSubGhz, { x: 5, y: 1, z: 1.2 }, [stoneWall]);

  assert.equal(throughStoneResult.intersectionsCount, 1);
  // Base loss at 433 MHz is 16 dB for 15cm; at 60cm thickness (factor = 4), loss is ~64 dB
  assert.ok(throughStoneResult.wallLossDb >= 60);
});

test('calculateSignalAtPoint respects customAttenuation dictionary', () => {
  const tx: RFDevice = {
    id: 'test-tx',
    name: 'Test AP',
    ip: '192.168.1.1',
    mac: '78:2B:CB:19:0D:F1',
    position: { x: 0, y: 0, z: 1 },
    frequencyMHz: 2400,
    txPowerDbm: 20,
    hardwareAttenuationOffsetDb: 0,
    antennaGainDbi: 0,
    protocol: 'WIFI_2_4',
  };

  const wall: WallSegment = {
    id: 'w-custom',
    p1: { x: 2, y: -5 },
    p2: { x: 2, y: 5 },
    thicknessCm: 15,
    heightM: 2.7,
    material: 'brick_15cm',
  };

  // Default attenuation for brick_15cm at 2400MHz is 8 dB
  const defaultRes = calculateSignalAtPoint(tx, { x: 4, y: 0, z: 1 }, [wall]);
  assert.equal(defaultRes.wallLossDb, 8);

  // Custom attenuation overrides it to 25 dB
  const customRes = calculateSignalAtPoint(tx, { x: 4, y: 0, z: 1 }, [wall], 0, {
    brick_15cm: { '2400': 25 },
  });
  assert.equal(customRes.wallLossDb, 25);
  assert.equal(customRes.rssiDbm, defaultRes.rssiDbm - 17);
});

test('Microwave 2.45GHz interference degrades SNR on 2.4GHz Zigbee/Wi-Fi but isolates 433MHz Sub-GHz', () => {
  const zigbeeTx: RFDevice = {
    id: 'zigbee-tx',
    name: 'Home Assistant Zigbee Dongle-E',
    ip: '192.168.1.110',
    mac: 'B0:5C:DA:3B:05:A9',
    position: { x: 5, y: 5, z: 1.2 },
    frequencyMHz: 2400,
    txPowerDbm: 10,
    hardwareAttenuationOffsetDb: 0,
    antennaGainDbi: 2,
    protocol: 'ZIGBEE_2_4',
  };

  const subGhzTx: RFDevice = {
    id: 'subghz-tx',
    name: 'ESP32-S3 CC1101 Gateway',
    ip: '192.168.1.109',
    mac: '30:ED:A0:BD:31:F4',
    position: { x: 5, y: 5, z: 1.2 },
    frequencyMHz: 433.92,
    txPowerDbm: 10,
    hardwareAttenuationOffsetDb: 0,
    antennaGainDbi: 2,
    protocol: 'RF433_EV1527',
  };

  const rxTarget = { x: 6, y: 5, z: 1.2 }; // 1 meter away from transmitter

  // Spatial Microwave Interferer placed 0.5m away from receiver
  const microwaveSource = {
    id: 'microwave-1',
    name: 'Mikrovlnná trouba',
    type: 'microwave' as const,
    position: { x: 6.5, y: 5, z: 1.0 },
    frequencyMHz: 2450,
    txPowerDbm: 12,
    bandwidthMHz: 40,
    isActive: true,
  };

  // Clean baseline (no interference sources)
  const cleanZigbee = calculateSignalAtPoint(zigbeeTx, rxTarget, [], 0, undefined, [], -105);
  assert.ok(cleanZigbee.snrDb > 40);
  assert.equal(cleanZigbee.linkStatus, 'NOMINAL');

  // With active Microwave oven nearby on 2.45 GHz
  const interferedZigbee = calculateSignalAtPoint(
    zigbeeTx,
    rxTarget,
    [],
    0,
    undefined,
    [microwaveSource],
    -105
  );

  // Noise floor should increase substantially from -105 dBm
  assert.ok(interferedZigbee.noiseFloorDbm > -75);
  // SNR should degrade significantly (by at least 25 dB)
  assert.ok(cleanZigbee.snrDb - interferedZigbee.snrDb > 25);
  assert.equal(interferedZigbee.dominantInterferer, 'Mikrovlnná trouba');

  // Conversely, 433.92 MHz Sub-GHz receiver has >50 dB frontend RF filter rejection against 2.45GHz
  const subGhzResult = calculateSignalAtPoint(
    subGhzTx,
    rxTarget,
    [],
    0,
    undefined,
    [microwaveSource],
    -105
  );
  // 433MHz should stay Nominal with high SNR
  assert.ok(subGhzResult.snrDb >= 25);
  assert.equal(subGhzResult.linkStatus, 'NOMINAL');
});

test('Inactive interference source does not affect SNR, and walls attenuate interference', () => {
  const tx: RFDevice = {
    id: 'wifi-ap',
    name: 'ROUTERBE3600 (OpenWrt)',
    ip: '192.168.1.1',
    mac: '78:2B:CB:19:0D:F1',
    position: { x: 0, y: 0, z: 1.5 },
    frequencyMHz: 2400,
    txPowerDbm: 20,
    hardwareAttenuationOffsetDb: 0,
    antennaGainDbi: 3,
    protocol: 'WIFI_2_4',
  };

  const rxTarget = { x: 4, y: 0, z: 1.5 };

  const activeInterferer = {
    id: 'int-rogue-ap',
    name: 'Rogue AP',
    type: 'wifi_cochannel' as const,
    position: { x: 5, y: 0, z: 1.5 },
    frequencyMHz: 2400,
    txPowerDbm: 20,
    bandwidthMHz: 20,
    isActive: true,
  };

  const inactiveInterferer = { ...activeInterferer, isActive: false };

  // 1. Inactive source => baseline thermal noise floor
  const inactiveResult = calculateSignalAtPoint(
    tx,
    rxTarget,
    [],
    0,
    undefined,
    [inactiveInterferer],
    -105
  );
  assert.equal(inactiveResult.noiseFloorDbm, -105);

  // 2. Active source in direct line of sight => severe interference
  const directInterference = calculateSignalAtPoint(
    tx,
    rxTarget,
    [],
    0,
    undefined,
    [activeInterferer],
    -105
  );
  assert.ok(directInterference.noiseFloorDbm > -65);

  // 3. Wall placed between interferer and receiver (x=4.5)
  const shieldWall: WallSegment = {
    id: 'shield-wall',
    p1: { x: 4.5, y: -5 },
    p2: { x: 4.5, y: 5 },
    thicknessCm: 25,
    heightM: 2.7,
    material: 'reinforced_concrete', // ~27dB attenuation at 2.4GHz
  };

  const shieldedInterference = calculateSignalAtPoint(
    tx,
    rxTarget,
    [shieldWall],
    0,
    undefined,
    [activeInterferer],
    -105
  );

  // Shielded noise floor should be lower (less interference) than direct interference by > 20 dB
  assert.ok(shieldedInterference.noiseFloorDbm < directInterference.noiseFloorDbm - 20);
});



