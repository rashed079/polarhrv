// ─────────────────────────────────────────────────────────────
// ble.js — Polar H10 Bluetooth Low Energy connection handler
// Requires: Chrome/Edge with Web Bluetooth enabled
// ─────────────────────────────────────────────────────────────

const BLE = (() => {

  // BLE service & characteristic UUIDs (standard heart_rate profile)
  const HR_SERVICE    = 'heart_rate';
  const HR_MEASURE    = 'heart_rate_measurement';
  const DEVICE_PREFIX = 'Polar H10';

  let device    = null;
  let server    = null;
  let char      = null;
  let connected = false;

  // Callbacks set by the caller (dashboard.js)
  let onData       = null;
  let onConnect    = null;
  let onDisconnect = null;

  // ── Connect ──────────────────────────────────────────────
  async function connect(callbacks = {}) {
    onData       = callbacks.onData       || (() => {});
    onConnect    = callbacks.onConnect    || (() => {});
    onDisconnect = callbacks.onDisconnect || (() => {});

    if (!navigator.bluetooth) {
      console.error('Web Bluetooth not supported in this browser. Use Chrome or Edge.');
      return false;
    }

    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: DEVICE_PREFIX }],
        optionalServices: [HR_SERVICE],
      });

      device.addEventListener('gattserverdisconnected', handleDisconnect);

      server = await device.gatt.connect();
      const service = await server.getPrimaryService(HR_SERVICE);
      char = await service.getCharacteristic(HR_MEASURE);

      char.addEventListener('characteristicvaluechanged', handleData);
      await char.startNotifications();

      connected = true;
      onConnect({ deviceName: device.name });
      console.log('Connected to', device.name);
      return true;

    } catch (err) {
      console.error('BLE connection failed:', err.message);
      return false;
    }
  }

  // ── Disconnect ───────────────────────────────────────────
  async function disconnect() {
    if (char) {
      try { await char.stopNotifications(); } catch (_) {}
    }
    if (server && server.connected) {
      server.disconnect();
    }
    connected = false;
  }

  // ── Parse incoming BLE data packet ───────────────────────
  // Heart Rate Measurement characteristic format (Bluetooth spec):
  //   Byte 0: Flags
  //     bit 0: 0 = HR is uint8, 1 = HR is uint16
  //     bit 4: RR-interval present
  //   Byte 1 (or 1-2): Heart rate value
  //   Remaining bytes: RR intervals in 1/1024s units
  function handleData(event) {
    const data  = event.target.value;
    const flags = data.getUint8(0);

    const hrIs16bit  = (flags & 0x01) !== 0;
    const rrPresent  = (flags & 0x10) !== 0;

    let offset = 1;
    let hr;

    if (hrIs16bit) {
      hr = data.getUint16(offset, true);
      offset += 2;
    } else {
      hr = data.getUint8(offset);
      offset += 1;
    }

    // RR intervals — convert from 1/1024 s units to milliseconds
    const rrIntervals = [];
    if (rrPresent) {
      while (offset + 1 < data.byteLength) {
        const raw = data.getUint16(offset, true);
        rrIntervals.push(Math.round((raw / 1024) * 1000));
        offset += 2;
      }
    }

    onData({ hr, rrIntervals, timestamp: new Date().toISOString() });
  }

  // ── Handle unexpected disconnect ─────────────────────────
  function handleDisconnect() {
    connected = false;
    console.warn('Polar H10 disconnected unexpectedly');
    onDisconnect();

    // Auto-reconnect after 3 seconds
    setTimeout(async () => {
      if (device) {
        console.log('Attempting reconnect...');
        try {
          server = await device.gatt.connect();
          const service = await server.getPrimaryService(HR_SERVICE);
          char = await service.getCharacteristic(HR_MEASURE);
          char.addEventListener('characteristicvaluechanged', handleData);
          await char.startNotifications();
          connected = true;
          onConnect({ deviceName: device.name, reconnected: true });
        } catch (err) {
          console.error('Reconnect failed:', err.message);
        }
      }
    }, 3000);
  }

  // ── Public API ───────────────────────────────────────────
  return { connect, disconnect, isConnected: () => connected };

})();
