<div align="center">
  <img src="assets/icon.svg" width="108" alt="SharkCtl">
  <h1>SharkCtl</h1>
  <p>Configurador nativo do <strong>Attack Shark X11</strong> para Linux</p>

  <p>
    <img src="https://img.shields.io/badge/platform-linux-informational?style=flat-square&logo=linux&logoColor=white">
    <img src="https://img.shields.io/badge/electron-34-47848f?style=flat-square&logo=electron&logoColor=white">
    <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react&logoColor=black">
    <img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square">
  </p>
</div>

---

App de desktop (Electron 34 + React 19) para configurar o mouse **Attack Shark X11** no Linux — sem software Windows. Funciona tanto via **dongle 2.4 GHz** quanto **cabo USB**.

A interface tem estilo *cockpit*: janela sem barra de título, sidebar com diagrama clicável do mouse e cor de acento que sincroniza com o RGB configurado.

---

## Funcionalidades

| Seção | O que você configura |
|---|---|
| **DPI** | 6 estágios independentes · até 26 000 DPI · cor por estágio · Angle Snap · Ripple Control |
| **Iluminação** | 7 modos (Off, Static, Breathing, Neon, ColorBreathing, StaticDPI, BreathingDPI) · velocidade · cor global |
| **Botões** | Remap dos 8 botões: ações nativas do mouse, atalhos de teclado personalizados |
| **Performance** | Taxa de polling (125 / 250 / 500 / 1000 Hz) · debounce (4–50 ms) |
| **Perfis** | Salvar, carregar e deletar perfis de configuração |
| **Bateria** | Monitor em tempo real · override automático do LED em nível crítico |
| **Console** | Log ao vivo de conexão USB, comandos enviados e erros |

---

## Pré-requisitos

- **Arch / CachyOS**: `sudo pacman -S electron34 libusb nodejs npm`
- Qualquer distro com **Electron 34** instalado no sistema e **libusb**

---

## Instalação

### Arch / CachyOS — via AUR (recomendado)

Instala com ícone no menu, atalho `.desktop`, regra udev e binário em `/usr/bin/sharkctl`.

**Com yay / paru:**
```bash
yay -S sharkctl-git
# ou
paru -S sharkctl-git
```

**Manual (build local do repositório clonado):**
```bash
cd aur
makepkg -si
```

Para atualizar:
```bash
cd aur && makepkg -si
```

Para remover:
```bash
sudo pacman -R sharkctl
```

---

### AppImage — qualquer distro Linux

```bash
# 1. baixe SharkCtl-1.0.0.AppImage da página de releases
chmod +x SharkCtl-1.0.0.AppImage

# 2. instale a regra udev (acesso USB sem root)
sudo cp aur/99-attack-shark-x11.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger

# 3. execute
./SharkCtl-1.0.0.AppImage
```

---

### .deb — Ubuntu / Debian

```bash
# 1. baixe sharkctl-1.0.0.deb da página de releases
sudo dpkg -i sharkctl-1.0.0.deb
# a regra udev é instalada automaticamente
```

---

### Desenvolvimento — hot reload

```bash
npm install      # configura o Electron do sistema via postinstall (uma vez só)
npm run dev
```

---

## Gerar pacotes de distribuição

> **Requer Arch / CachyOS** com `electron34` instalado em `/usr/lib/electron34`.

```bash
npm run dist
# gera dist/SharkCtl-1.0.0.AppImage e dist/sharkctl-1.0.0.deb
```

---

## Comandos

```bash
npm run dev              # desenvolvimento com hot reload
npm run build            # build de produção (sem empacotar)
npm run dist             # build + gera AppImage e .deb em dist/
npm run test-usb         # verifica se o módulo usb enxerga o mouse
npm run diag-rgb-safe    # diagnóstico de iluminação (variação segura do payload DPI)
```

---

## Estrutura do projeto

```
src/
├── main/                  — processo principal (IPC, fila USB, persistência JSON)
│   └── driver/            — driver USB (fork de HarukaYamamoto0)
│       └── protocols/     — builders de payload (DPI, Macro, Polling, Lighting)
├── preload/               — bridge contextBridge → window.api
└── renderer/              — UI React 19
    ├── app.jsx            — componente raiz e estado global
    ├── sections.jsx       — seções de cada aba da interface
    ├── data.jsx           — constantes, ícones SVG e dados do mouse
    ├── i18n.jsx           — traduções e temas de cor de acento
    └── style.css          — design system cockpit

assets/                    — ícones (SVG + PNG) e sharkctl.desktop
aur/                       — PKGBUILD para Arch / CachyOS
docs/protocol/             — engenharia reversa do protocolo USB HID
scripts/                   — diagnóstico de iluminação e setup do Electron
```

---

## Protocolo USB

O protocolo reverso do X11 está documentado em [`docs/protocol/PROTOCOL.md`](docs/protocol/PROTOCOL.md):

- Payloads funcionais confirmados (report `0x04` para DPI, `0x05` para preferências)
- Report IDs **perigosos** — `0x0b` causa despareamento do dongle 2.4 GHz
- Histórico da investigação de iluminação RGB e próximos passos

---

## Créditos

- Driver USB base: [HarukaYamamoto0/attack-shark-x11-driver](https://github.com/HarukaYamamoto0/attack-shark-x11-driver) (MIT)
- Correções de protocolo de iluminação: [dressedinblack5/attack-shark-x11-electron](https://github.com/dressedinblack5/attack-shark-x11-electron) (MIT)

---

## Licença

[MIT](LICENSE) © Clevs
