# ❤️ Polar HRV — Orthostatic Testing Application

**Clinical heart rate variability monitoring for orthostatic testing research**  
Built at **CROSH (Centre for Research in Occupational Safety and Health), Laurentian University**, Sudbury ON

---

## 🔍 Overview

A web-based clinical application for recording and analyzing heart rate variability (HRV) during orthostatic testing — a standardized protocol where participants transition from supine (lying) to standing to assess autonomic nervous system function. Used in research contexts to detect orthostatic intolerance, ANS dysregulation, and occupational fatigue.

Connects to **Polar H10** chest-strap heart rate monitors via Bluetooth Low Energy (BLE) Web API, streams R-R interval data in real time, and scores the orthostatic response against normative clinical ranges.

---

## ✨ Features

- **Live ECG trace** — Animated R-R interval waveform rendering in real time
- **HRV metrics** — RMSSD, SDNN, and HRV score computed per 5-second window
- **Orthostatic protocol phases** — Colour-coded supine / stand / standing timeline
- **Poincaré scatter plot** — Classic non-linear HRV visualization (SD1 / SD2)
- **Automated clinical scoring** — Flags orthostatic intolerance based on HR and HRV thresholds
- **Session report** — Per-participant summary table for export to research database
- **Polar H10 BLE integration** — Web Bluetooth API; no native app required
- **Responsive layout** — Runs on any tablet or laptop in the clinical testing room

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | JavaScript (ES6+), HTML5, CSS3 |
| Charts | Chart.js 4.x |
| Hardware | Polar H10 chest strap via Web Bluetooth BLE |
| Backend | PHP 8.1, RESTful API |
| Database | MySQL 8 (session storage, anonymized) |
| Deployment | Apache, cPanel |

---

## 🚀 Getting Started

```bash
git clone https://github.com/rashed079/polar-hrv-orthostatic.git
cd polar-hrv-orthostatic
cp config.example.php config.php
# Configure DB and BLE device UUID in config.php
```

Open `index.html` in Chrome/Edge (Web Bluetooth requires a Chromium browser) for simulated demo.  
Pair a Polar H10 for live data.

---

## 📡 BLE Integration

```javascript
// Connect to Polar H10 via Web Bluetooth API
async function connectPolar() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'Polar H10' }],
    optionalServices: ['heart_rate']
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const char = await service.getCharacteristic('heart_rate_measurement');
  char.startNotifications();
  char.addEventListener('characteristicvaluechanged', handleHRData);
}

function handleHRData(event) {
  const value = event.target.value;
  const hr = value.getUint8(1);       // Heart rate in bpm
  const rrInterval = value.getUint16(2, true); // R-R in ms
  updateDashboard(hr, rrInterval);
}
```

---

## 📊 HRV Metrics Computed

| Metric | Description |
|---|---|
| **RMSSD** | Root mean square of successive RR differences — parasympathetic tone |
| **SDNN** | Standard deviation of all RR intervals — overall HRV |
| **HRV Score** | Normalized composite (0–100) |
| **Poincaré SD1/SD2** | Short-term vs long-term variability |

---

## 📁 Project Structure

```
polar-hrv-orthostatic/
├── index.html              # Main clinical interface (demo mode)
├── config.example.php      # Config template
├── api/
│   ├── session.php         # Create/close test sessions
│   ├── readings.php        # Store RR interval stream
│   └── report.php          # Generate session summary
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── ble.js          # Polar H10 BLE connection handler
│       ├── hrv.js          # RMSSD, SDNN, Poincaré computation
│       └── dashboard.js    # Chart rendering and UI updates
└── README.md
```

---

## 👤 Author

**Md Rashed Azad Chowdhury, PMP®**  
Research Web Developer · CROSH, Laurentian University  
[github.com/rashed079](https://github.com/rashed079) · [LinkedIn](https://linkedin.com/in/rashed-azad)

---

## ⚠️ Disclaimer

This application is a **research tool only** and is not intended for clinical diagnosis. All participant data is anonymized and stored in accordance with Laurentian University ethics board requirements.

---

## 📄 License

Research use — CROSH, Laurentian University. Contact CROSH for licensing inquiries.
