import { LiveChart } from '../components/power-chart';
import {
  getSnapshot, onSessionChange, isActive, isPaused,
  startSession, pauseSession, resumeSession, adjustEffort, skipStep, stopSession,
  getSelectedTraining, onTrainingSelect,
} from '../state/session';
import { getFtp } from './settings';

// BLE UUIDs
const FITNESS_MACHINE_SERVICE  = 0x1826;
const FTMS_CONTROL_POINT       = '00002ad9-0000-1000-8000-00805f9b34fb';
const INDOOR_BIKE_DATA         = '00002ad2-0000-1000-8000-00805f9b34fb';
const CYCLING_POWER_SERVICE    = 0x1818;
const CYCLING_POWER_MEASUREMENT = '00002a63-0000-1000-8000-00805f9b34fb';
const HEART_RATE_SERVICE       = 0x180d;
const HEART_RATE_MEASUREMENT   = '00002a37-0000-1000-8000-00805f9b34fb';

// State
let device: BluetoothDevice | null = null;
let controlChar: BluetoothRemoteGATTCharacteristic | null = null;
let targetWatts = 150;
let chart: LiveChart | null = null;

// DOM refs
let statusDot: HTMLElement;
let statusBar: HTMLElement;
let statusText: HTMLElement;
let powerVal: HTMLElement;
let cadenceVal: HTMLElement;
let hrVal: HTMLElement;
let targetDisp: HTMLElement;
let slider: HTMLInputElement;
let controlPanel: HTMLElement;
let connectBtn: HTMLButtonElement;
let disconnectBtn: HTMLButtonElement;
let selectedTrainingBlock: HTMLElement;
let selTrainingName: HTMLElement;
let selTrainingDesc: HTMLElement;
let selectedStartBtn: HTMLButtonElement;
let sessionControls: HTMLElement;
let pauseBtn: HTMLButtonElement;
let effortDownBtn: HTMLButtonElement;
let effortUpBtn: HTMLButtonElement;
let skipBtn: HTMLButtonElement;
let endBtn: HTMLButtonElement;
// Session UI
let targetBlock: HTMLElement;
let targetWattsEl: HTMLElement;
let segNameEl: HTMLElement;
let segRemainEl: HTMLElement;
let segProgressEl: HTMLElement;
let segProgressBar: HTMLElement;

function mm_ss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// UI helpers
function setStatus(msg: string, type = '') {
  statusText.textContent = msg;
  statusBar.className = 'status-bar' + (type ? ' ' + type : '');
}

let connected = false;
let lastSentSessionWatts = -1;

function refreshRideButtons() {
  const training = getSelectedTraining();
  const active = isActive();
  const paused = isPaused();

  controlPanel.style.display          = (connected && !training && !active) ? 'block' : 'none';
  selectedTrainingBlock.style.display = (training && !active) ? 'block' : 'none';
  sessionControls.style.display       = active ? 'block' : 'none';

  if (training && !active) {
    selTrainingName.textContent    = training.name;
    selTrainingDesc.textContent    = training.description;
    selectedStartBtn.disabled      = !connected;
  }

  pauseBtn.textContent = paused ? '▶ RESUME' : '⏸ PAUSE';
}

function setConnected(val: boolean) {
  connected = val;
  statusDot.className = 'status-dot' + (val ? ' connected' : '');
  connectBtn.style.display    = val ? 'none'  : 'block';
  disconnectBtn.style.display = val ? 'block' : 'none';
  if (!val) {
    powerVal.textContent = '---';
    powerVal.classList.remove('live');
    cadenceVal.textContent = '--';
    hrVal.textContent = '--';
    document.querySelectorAll('.sm-value').forEach(el => el.classList.remove('live'));
  }
  refreshRideButtons();
}

function syncTarget(watts: number) {
  targetWatts = Math.max(0, Math.min(400, watts));
  slider.value = String(targetWatts);
  targetDisp.textContent = String(targetWatts);
}

function tickSession() {
  const snap = getSnapshot();
  targetBlock.style.display = snap ? '' : 'none';
  refreshRideButtons();
  if (!snap) { lastSentSessionWatts = -1; return; }

  targetWattsEl.textContent  = snap.isPaused ? '⏸' : String(snap.targetWatts);
  segNameEl.textContent      = snap.segmentName + (snap.effortPct !== 100 ? ` [${snap.effortPct}%]` : '');
  segRemainEl.textContent    = mm_ss(snap.segmentRemainingSec);
  segProgressEl.textContent  = `${snap.segmentIndex + 1} / ${snap.segmentTotal}`;

  const pct = snap.isPaused ? undefined
    : Math.min(100, ((snap.segmentDurationSec - snap.segmentRemainingSec) / snap.segmentDurationSec) * 100);
  if (pct !== undefined) segProgressBar.style.width = pct + '%';

  if (!snap.isPaused && snap.targetWatts !== lastSentSessionWatts) {
    lastSentSessionWatts = snap.targetWatts;
    syncTarget(snap.targetWatts);
    applyWatts();
  }
}

// BLE connection
async function connectKickr() {
  connectBtn.disabled = true;
  setStatus('Scanning for KICKR…');

  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FITNESS_MACHINE_SERVICE] }],
      optionalServices: [CYCLING_POWER_SERVICE, HEART_RATE_SERVICE],
    });

    setStatus('Connecting…');
    device.addEventListener('gattserverdisconnected', onDisconnected);

    const server = await device.gatt!.connect();
    setStatus('Discovering services…');

    let ftmsService: BluetoothRemoteGATTService | null = null;
    try { ftmsService = await server.getPrimaryService(FITNESS_MACHINE_SERVICE); } catch { /* optional */ }

    if (ftmsService) {
      try {
        controlChar = await ftmsService.getCharacteristic(FTMS_CONTROL_POINT);
        await controlChar.writeValue(new Uint8Array([0x00]));
      } catch (e) { console.warn('Control point not writable:', e); }

      try {
        const bikeData = await ftmsService.getCharacteristic(INDOOR_BIKE_DATA);
        await bikeData.startNotifications();
        bikeData.addEventListener('characteristicvaluechanged', onBikeData);
      } catch (e) { console.warn('Indoor bike data unavailable:', e); }
    }

    try {
      const cpService = await server.getPrimaryService(CYCLING_POWER_SERVICE);
      const cpMeas = await cpService.getCharacteristic(CYCLING_POWER_MEASUREMENT);
      await cpMeas.startNotifications();
      cpMeas.addEventListener('characteristicvaluechanged', onPowerMeasurement);
    } catch { /* optional */ }

    try {
      const hrService = await server.getPrimaryService(HEART_RATE_SERVICE);
      const hrMeas = await hrService.getCharacteristic(HEART_RATE_MEASUREMENT);
      await hrMeas.startNotifications();
      hrMeas.addEventListener('characteristicvaluechanged', onHRMeasurement);
    } catch { /* optional */ }

    setConnected(true);
    setStatus(`Connected to ${device.name ?? 'KICKR'}`, 'ok');
  } catch (err) {
    const error = err as Error;
    if (error.name === 'NotFoundError') {
      setStatus('No device selected.');
    } else {
      setStatus(`Error: ${error.message}`, 'err');
      statusDot.className = 'status-dot error';
    }
    connectBtn.disabled = false;
  }
}

function disconnectKickr() {
  if (device?.gatt?.connected) device.gatt.disconnect();
}

function onDisconnected() {
  setConnected(false);
  controlChar = null;
  setStatus('Disconnected.');
  connectBtn.disabled = false;
}

// Data parsers
function charValue(event: Event): DataView {
  return (event.target as BluetoothRemoteGATTCharacteristic).value!;
}

function onBikeData(event: Event) {
  const data = charValue(event);
  const flags = data.getUint16(0, true);
  let offset = 2;

  if (!(flags & 0x0001)) offset += 2;
  if (flags & 0x0002)    offset += 2;

  let cadence: number | null = null;
  if (flags & 0x0004) {
    if (offset + 1 < data.byteLength) cadence = data.getUint16(offset, true) / 2;
    offset += 2;
  }
  if (flags & 0x0008) offset += 2;
  if (flags & 0x0010) offset += 3;
  if (flags & 0x0020) offset += 2;

  let power: number | null = null;
  if (flags & 0x0040) {
    if (offset + 1 < data.byteLength) power = data.getInt16(offset, true);
  }

  if (power   !== null) updatePower(power);
  if (cadence !== null) updateCadence(Math.round(cadence));
}

function onPowerMeasurement(event: Event) {
  const data = charValue(event);
  if (data.byteLength >= 4) updatePower(data.getInt16(2, true));
}

function onHRMeasurement(event: Event) {
  const data = charValue(event);
  const flags = data.getUint8(0);
  const hr = (flags & 0x01) ? data.getUint16(1, true) : data.getUint8(1);
  hrVal.textContent = String(hr);
  hrVal.classList.add('live');
}

function updatePower(watts: number) {
  const w = Math.max(0, watts);
  powerVal.textContent = String(w);
  powerVal.classList.add('live');
  chart?.addSample(w);
}

function updateCadence(rpm: number) {
  cadenceVal.textContent = String(rpm);
  cadenceVal.classList.add('live');
}

// Set target power via FTMS
async function applyWatts() {
  if (!controlChar) { setStatus('Not connected or control not available.', 'err'); return; }

  const buildCmd = () => {
    const buf = new DataView(new ArrayBuffer(3));
    buf.setUint8(0, 0x05);
    buf.setInt16(1, targetWatts, true);
    return buf.buffer;
  };

  try {
    await controlChar.writeValueWithResponse(buildCmd());
    setStatus(`Target set to ${targetWatts}W`, 'ok');
  } catch {
    try {
      await controlChar.writeValue(new Uint8Array([0x00]));
      await controlChar.writeValueWithResponse(buildCmd());
      setStatus(`Target set to ${targetWatts}W`, 'ok');
    } catch (e) {
      setStatus(`Failed to set power: ${(e as Error).message}`, 'err');
    }
  }
}

export function init(container: HTMLElement): void {
  if (!navigator.bluetooth) {
    container.querySelector<HTMLElement>('#no-bt-warn')!.style.display = 'block';
    container.querySelector<HTMLElement>('#main-ui')!.style.display = 'none';
  }

  statusDot    = document.getElementById('statusDot')!;
  statusBar    = document.getElementById('statusBar')!;
  statusText   = document.getElementById('status-text')!;
  powerVal     = document.getElementById('powerVal')!;
  cadenceVal   = document.getElementById('cadenceVal')!;
  hrVal        = document.getElementById('hrVal')!;
  targetDisp   = document.getElementById('targetDisplay')!;
  slider       = document.getElementById('wattsSlider') as HTMLInputElement;
  controlPanel = document.getElementById('controlPanel')!;
  connectBtn   = document.getElementById('connectBtn') as HTMLButtonElement;
  disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement;
  selectedTrainingBlock = document.getElementById('selectedTrainingBlock')!;
  selTrainingName       = document.getElementById('selTrainingName')!;
  selTrainingDesc       = document.getElementById('selTrainingDesc')!;
  selectedStartBtn      = document.getElementById('selectedStartBtn') as HTMLButtonElement;
  sessionControls       = document.getElementById('sessionControls')!;
  pauseBtn              = document.getElementById('pauseBtn') as HTMLButtonElement;
  effortDownBtn         = document.getElementById('effortDownBtn') as HTMLButtonElement;
  effortUpBtn           = document.getElementById('effortUpBtn') as HTMLButtonElement;
  skipBtn               = document.getElementById('skipBtn') as HTMLButtonElement;
  endBtn                = document.getElementById('endBtn') as HTMLButtonElement;

  targetBlock    = document.getElementById('targetBlock')!;
  targetWattsEl  = document.getElementById('targetWatts')!;
  segNameEl      = document.getElementById('segName')!;
  segRemainEl    = document.getElementById('segRemain')!;
  segProgressEl  = document.getElementById('segProgress')!;
  segProgressBar = document.getElementById('segProgressBar')!;

  // Live rolling chart
  chart = new LiveChart(document.getElementById('liveChartWrap')!, getFtp());

  // Session ticker — update target card every second
  setInterval(tickSession, 1000);
  onSessionChange(tickSession);
  tickSession();

  // Event listeners
  slider.addEventListener('input', () => syncTarget(parseInt(slider.value)));
  container.querySelectorAll<HTMLButtonElement>('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => syncTarget(Number(btn.dataset.watts)));
  });
  document.getElementById('decreaseBtn')!.addEventListener('click', () => syncTarget(targetWatts - 10));
  document.getElementById('increaseBtn')!.addEventListener('click', () => syncTarget(targetWatts + 10));
  document.getElementById('applyBtn')!.addEventListener('click', applyWatts);
  connectBtn.addEventListener('click', connectKickr);
  disconnectBtn.addEventListener('click', disconnectKickr);
  selectedStartBtn.addEventListener('click', () => { startSession(); tickSession(); });
  pauseBtn.addEventListener('click', () => { isPaused() ? resumeSession() : pauseSession(); });
  effortDownBtn.addEventListener('click', () => adjustEffort(-5));
  effortUpBtn.addEventListener('click', () => adjustEffort(5));
  skipBtn.addEventListener('click', skipStep);
  endBtn.addEventListener('click', stopSession);

  onTrainingSelect(refreshRideButtons);
}
