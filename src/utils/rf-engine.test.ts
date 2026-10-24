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


