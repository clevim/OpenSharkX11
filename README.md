<div align="center">
  <img src="assets/icon.png" width="108" alt="OpenSharkX11">
  <h1>OpenSharkX11</h1>
  <p>Native Linux configurator for the <strong>Attack Shark X11</strong> mouse</p>

  <p>
    <img src="https://img.shields.io/badge/platform-linux-informational?style=flat-square&logo=linux&logoColor=white">
    <img src="https://img.shields.io/badge/electron-34-47848f?style=flat-square&logo=electron&logoColor=white">
    <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react&logoColor=black">
    <img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square">
  </p>
</div>

---

Desktop app (Electron 34 + React 19) to configure the **Attack Shark X11** on Linux — no Windows software needed. Works via **2.4 GHz dongle**, **wired USB-C**, and **Bluetooth 5.0 (BLE)**.

Cockpit-style interface: frameless window, sidebar with a clickable mouse diagram, and accent color that syncs with the configured RGB.

---

## Features

| Section | What you can configure |
|---|---|
| **DPI** | 6 independent stages · up to 22,000 DPI · color per stage · Angle Snap · Ripple Control |
| **Lighting** | 7 modes (Off, Static, Breathing, Neon, ColorBreathing, StaticDPI, BreathingDPI) · speed · global color |
| **Buttons** | Remap all 8 buttons: native mouse actions, custom keyboard shortcuts |
| **Performance** | Polling rate (125 / 250 / 500 / 1000 Hz) · debounce (4–50 ms) · 250–1000 Hz disabled in USB-C mode (max 125 Hz) |
| **Profiles** | Save, load, and delete configuration profiles |
| **Battery** | Real-time monitor · automatic LED override at critical level |
| **Console** | Live log of connection, sent commands, and errors · auto-detects 2.4 GHz, USB-C, and Bluetooth |

> **Tri-mode support**: the "Search mouse" button automatically tries 2.4 GHz dongle → USB-C cable → Bluetooth BLE in sequence. A dedicated BT button is also available when disconnected.

---

## Requirements

- **Arch / CachyOS**: `sudo pacman -S electron34 libusb bluez bluez-utils nodejs npm`
- Any distro with **Electron 34** installed system-wide, **libusb**, and **BlueZ** (for BLE support)
- BLE requires the mouse to be paired before launching the app (`bluetoothctl pair <MAC>`)
- USB access requires the udev rule (see Installation)

---

## Installation

### Arch / CachyOS — AUR (recommended)

Installs with app menu icon, `.desktop` shortcut, udev rule, and binary at `/usr/bin/opensharkx11`.

**With yay / paru:**
```bash
yay -S opensharkx11-git
# or
paru -S opensharkx11-git
```

**Manual build from the cloned repository:**
```bash
cd aur
makepkg -si
```

To update:
```bash
cd aur && makepkg -si
```

To remove:
```bash
sudo pacman -R opensharkx11
```

---

### AppImage — any Linux distro

```bash
# 1. Download opensharkx11-1.0.0.AppImage from the releases page
chmod +x opensharkx11-1.0.0.AppImage

# 2. Install the udev rule (USB access without root)
sudo cp aur/99-attack-shark-x11.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger

# 3. Run
./opensharkx11-1.0.0.AppImage
```

---

### .deb — Ubuntu / Debian

```bash
# Download opensharkx11-1.0.0.deb from the releases page
sudo dpkg -i opensharkx11-1.0.0.deb
# udev rule is installed automatically
```

---

### Development — hot reload

```bash
npm install      # sets up system Electron via postinstall (once)
npm run dev
```

---

## Build distribution packages

> **Requires Arch / CachyOS** with `electron34` installed at `/usr/lib/electron34`.

```bash
npm run dist
# outputs dist/opensharkx11-1.0.0.AppImage and dist/opensharkx11-1.0.0.deb
```

---

## Commands

```bash
npm run dev              # development with hot reload
npm run build            # production build (no packaging)
npm run dist             # build + generate AppImage and .deb in dist/
npm run test-usb         # check if the usb module can see the mouse
```

---

## Project structure

```
src/
├── main/                  — main process (IPC, USB queue, JSON persistence)
│   └── driver/            — USB driver (fork of HarukaYamamoto0)
│       └── protocols/     — payload builders (DPI, Macro, Polling, Lighting)
├── preload/               — contextBridge → window.api
└── renderer/              — React 19 UI
    ├── app.jsx            — root component and global state
    ├── sections.jsx       — tab sections
    ├── data.jsx           — constants, SVG icons, mouse data
    ├── i18n.jsx           — translations and accent color themes
    └── style.css          — cockpit design system

assets/                    — icons (SVG + PNG) and opensharkx11.desktop
aur/                       — PKGBUILD for Arch / CachyOS
docs/protocol/             — USB HID reverse engineering
scripts/                   — lighting diagnostics and Electron setup
```

---

## Protocol Documentation

Full reverse-engineering notes in [`docs/protocol/PROTOCOL_EN.md`](docs/protocol/PROTOCOL_EN.md):

- Confirmed working payloads (report `0x04` for DPI, `0x05` for preferences)
- **Dangerous** Report IDs — `0x0b` causes 2.4 GHz dongle unpairing
- RGB lighting investigation history and findings
- **Bluetooth BLE** — GATT service map, fee3/fee4 protocol, confirmed limitations

Also available in: [Português](docs/protocol/PROTOCOL.md) · [中文](docs/protocol/PROTOCOL_ZH.md)

---

## Credits

- USB driver base: [HarukaYamamoto0/attack-shark-x11-driver](https://github.com/HarukaYamamoto0/attack-shark-x11-driver) (MIT)
- Protocol fixes: [dressedinblack5/attack-shark-x11-electron](https://github.com/dressedinblack5/attack-shark-x11-electron) (MIT)

---

## License

[MIT](LICENSE) © Clevs
