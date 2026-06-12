# SharkCtl

App Electron nativo para configurar o **Attack Shark X11** no Linux.

Interface de cockpit — janela sem barra de título do sistema, sidebar com diagrama clicável do mouse, cor de acento que segue o RGB configurado.

## Instalação fixa (recomendado — Arch / CachyOS)

Isso instala o app no sistema com ícone no menu, atalho `.desktop`, regra udev
e binário em `/usr/bin/sharkctl` — não depende mais de `npm run dev`.

```bash
# dependências de build (uma vez só)
sudo pacman -S nodejs npm electron34 base-devel

cd aur
makepkg -si
```

O `makepkg -si` compila (`npm install` + `electron-vite build` + empacota com
`asar`), gera o pacote `.pkg.tar.zst` e já instala com `pacman -U`.

Depois disso:
- O app aparece no menu de aplicativos como **SharkCtl**
- Pode abrir via terminal com `sharkctl`
- A regra udev é instalada automaticamente (acesso USB sem root)

### Atualizar após mudanças no código

```bash
cd aur
makepkg -si      # recompila e reinstala
```

### Remover

```bash
sudo pacman -R sharkctl
```

## Desenvolvimento (hot reload)

```bash
npm install   # primeira vez: configura o Electron do sistema via postinstall
npm run dev
```

## Diagnóstico

```bash
npm run test-usb   # verifica se o módulo usb enxerga o mouse
```

## Acesso USB sem root (udev) — manual, se não usar o pacote

```bash
sudo cp aur/99-attack-shark-x11.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## Créditos

Driver USB: [HarukaYamamoto0/attack-shark-x11-driver](https://github.com/HarukaYamamoto0/attack-shark-x11-driver) (MIT)  
Correções de protocolo de iluminação: [dressedinblack5/attack-shark-x11-electron](https://github.com/dressedinblack5/attack-shark-x11-electron) (MIT)
