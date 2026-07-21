<div align="center">
  <img src="assets/icon.png" width="108" alt="OpenSharkX11">
  <h1>OpenSharkX11</h1>
  <p>Native Linux configurator for the <strong>Attack Shark X11</strong> mouse</p>

  <p>
    <img src="https://img.shields.io/badge/platform-linux-informational?style=flat-square&logo=linux&logoColor=white">
    <img src="https://img.shields.io/badge/tauri-2-ffc131?style=flat-square&logo=tauri&logoColor=black">
    <img src="https://img.shields.io/badge/rust-backend-dea584?style=flat-square&logo=rust&logoColor=white">
    <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react&logoColor=black">
    <img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square">
  </p>
</div>

---

Desktop app (Tauri 2 + Rust backend + React 19 UI) to configure the **Attack Shark X11** on Linux — no Windows software needed. Works via **2.4 GHz dongle**, **wired USB-C**, and **Bluetooth 5.0 (BLE)**.

Cockpit-style interface: frameless window, sidebar with a clickable mouse diagram, and accent color that syncs with the configured RGB. USB (rusb) and BLE (zbus/BlueZ) drivers run entirely in Rust — no Node.js runtime.

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

**Runtime:**
- **Arch / CachyOS**: `sudo pacman -S webkit2gtk-4.1 libusb gtk3 libayatana-appindicator bluez bluez-utils`
- Other distros: **WebKitGTK 4.1** (≥ 2.44 recommended), **libusb**, **GTK 3**, and **BlueZ** (for BLE)
- BLE requires the mouse to be paired before launching (`bluetoothctl pair <MAC>`)
- USB access requires the udev rule (installed automatically by the packages)

**Build (from source):**
- `rust` / `cargo`, `nodejs` / `npm`, `pkg-config`, plus the runtime deps above with `-dev`/`-devel` headers
- Arch / CachyOS: `sudo pacman -S rust nodejs npm pkg-config webkit2gtk-4.1`

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

To remove:
```bash
sudo pacman -R opensharkx11
```

---

### AppImage — any Linux distro

```bash
# 1. Download OpenSharkX11_2.0.0_amd64.AppImage from the releases page
chmod +x OpenSharkX11_2.0.0_amd64.AppImage

# 2. Install the udev rule (USB access without root)
sudo cp aur/99-attack-shark-x11.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger

# 3. Run
./OpenSharkX11_1.0.0_amd64.AppImage
```

---

### .deb — Ubuntu / Debian

```bash
# Download OpenSharkX11_1.0.0_amd64.deb from the releases page
sudo dpkg -i OpenSharkX11_1.0.0_amd64.deb
# udev rule is installed automatically
```

---

### Development — hot reload

```bash
npm install      # frontend deps + Tauri CLI (once)
npm run dev      # tauri dev — compiles the Rust backend and starts Vite HMR
```

The first `npm run dev` compiles the Rust backend (a few minutes); subsequent runs are incremental.

---

## Build distribution packages

```bash
npm run build
# outputs, under src-tauri/target/release/bundle/:
#   appimage/OpenSharkX11_1.0.0_amd64.AppImage
#   deb/OpenSharkX11_1.0.0_amd64.deb
```

> On rolling-release distros (CachyOS/Arch) the AppImage step needs these env vars so the
> bundled `linuxdeploy` works with a modern toolchain:
> `APPIMAGE_EXTRACT_AND_RUN=1 ARCH=x86_64 NO_STRIP=1 npm run build`

---

## Commands

```bash
npm run dev              # tauri dev (Rust backend + Vite HMR)
npm run build            # tauri build → AppImage + .deb
npm run dev:renderer     # Vite only (frontend, no Rust — fast UI iteration)
npm run build:renderer   # Vite production build only
```

---

## Project structure

```
src/                    — React 19 frontend (Vite)
├── app.jsx             — root component and global state
├── api.ts              — Tauri IPC wrapper (invoke / listen)
├── sections.jsx        — tab sections
├── data.jsx            — constants, SVG icons, mouse data
├── i18n.jsx            — translations and accent color themes
└── style.css           — cockpit design system

src-tauri/              — Rust backend (Tauri 2)
├── src/
│   ├── commands.rs     — #[tauri::command] IPC handlers
│   ├── driver/         — USB (rusb) + BLE (zbus/BlueZ) drivers
│   ├── protocols/      — payload builders (DPI, Macro, Polling, Lighting)
│   ├── state.rs        — config persistence (~/.config/opensharkx11)
│   └── tray.rs         — system tray (battery + connection mode)
└── tauri.conf.json

reference/              — original TypeScript driver (source of the Rust port)
assets/                 — icons + opensharkx11.desktop
aur/                    — PKGBUILD for Arch / CachyOS
docs/protocol/          — USB HID reverse engineering
scripts/                — .deb udev install/remove hooks
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
