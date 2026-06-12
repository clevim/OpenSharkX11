import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'

// ─── driver ──────────────────────────────────────────────────────────────────
import { AttackSharkX11 } from './driver/src/core/AttackSharkX11.js'
import { ConnectionMode } from './driver/src/types.js'
import { DpiBuilder } from './driver/src/protocols/DpiBuilder.js'
import { MacrosBuilder, macroTemplates, type MacroTuple, FirmwareAction, Modifiers } from './driver/src/protocols/MacrosBuilder.js'
import { PollingRateBuilder, Rate } from './driver/src/protocols/PollingRateBuilder.js'
import { UserPreferencesBuilder, LightMode } from './driver/src/protocols/UserPreferencesBuilder.js'
import { CustomMacroBuilder, MacroMode } from './driver/src/protocols/CustomMacroBuilder.js'

// ─── persistência ─────────────────────────────────────────────────────────────
const CFG = join(homedir(), '.config', 'sharkctl')
mkdirSync(CFG, { recursive: true })
const STATE_FILE = join(CFG, 'state.json')
const PROFILES_FILE = join(CFG, 'profiles.json')

function loadJson<T>(f: string, fb: T): T {
  try { if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8')) } catch {}
  return structuredClone(fb)
}
const save = (f: string, d: unknown) => writeFileSync(f, JSON.stringify(d, null, 2))

// ─── fila segura (min 300ms entre comandos USB) ───────────────────────────────
const SAFE_DELAY = 300
let driver: AttackSharkX11 | null = null
let queue: Promise<unknown> = Promise.resolve()
let mainWin: BrowserWindow | null = null

function run<T>(fn: () => Promise<T>): Promise<T> {
  const t = queue.then(fn)
  queue = t.catch(() => {})
  return t
}

// ─── tipos e estado ───────────────────────────────────────────────────────────
const BUTTON_KEYS = ['left','right','middle','forward','backward','dpi','scrollUp','scrollDown']
const BTN_ENUM: Record<string, number> = {
  left:0, right:1, middle:2, forward:3, backward:4, dpi:5, scrollUp:6, scrollDown:7
}
const RATE_MAP: Record<number, Rate> = {
  125: Rate.powerSaving, 250: Rate.office, 500: Rate.gaming, 1000: Rate.eSports
}

type Binding = { type: string; template?: string; modifiers?: number; keyCode?: number }
interface AppState {
  dpi: { values: [number,number,number,number,number,number]; activeStage: number; angleSnap: boolean; rippleControl: boolean }
  pollingRate: number
  lighting: { mode: number; rgb: {r:number;g:number;b:number}; ledSpeed: number }
  performance: { keyResponse: number }
  power: { sleepTime: number; deepSleepTime: number }
  buttons: Record<string, Binding>
  customMacro: { enabled: boolean; targetButton: number; mode: number; repeat: number; events: {key:number;delay:number;release:boolean}[] }
}

const DEFAULT_STATE: AppState = {
  dpi: { values: [800,1600,2400,3200,5000,22000], activeStage: 2, angleSnap: false, rippleControl: true },
  pollingRate: 1000,
  lighting: { mode: LightMode.Neon, rgb: {r:91,g:227,b:210}, ledSpeed: 3 },
  performance: { keyResponse: 8 },
  power: { sleepTime: 5, deepSleepTime: 30 },
  buttons: {
    left:    { type:'template', template:'global-left-click' },
    right:   { type:'template', template:'global-right-click' },
    middle:  { type:'template', template:'global-middle' },
    forward: { type:'template', template:'global-forward' },
    backward:{ type:'template', template:'global-backward' },
    dpi:     { type:'template', template:'global-dpi-cycle' },
    scrollUp:{ type:'template', template:'global-scroll-up' },
    scrollDown:{ type:'template', template:'global-scroll-down' },
  },
  customMacro: { enabled: false, targetButton: 4, mode: 0, repeat: 1, events: [] }
}

let state: AppState = loadJson(STATE_FILE, DEFAULT_STATE)
// garantir que campos novos existem se state estava desatualizado
state = { ...DEFAULT_STATE, ...state, buttons: { ...DEFAULT_STATE.buttons, ...state.buttons } }

let profiles: Record<string, AppState> = loadJson(PROFILES_FILE, {})

// ─── helpers do driver ────────────────────────────────────────────────────────
function bindingToTuple(b: Binding): MacroTuple {
  if (b.type === 'keyboard') {
    return [FirmwareAction.KEYBOARD, (b.modifiers ?? 0) as Modifiers, b.keyCode ?? 0] as const
  }
  const tpl = macroTemplates[b.template as keyof typeof macroTemplates]
  if (!tpl) throw new Error(`Template desconhecido: ${b.template}`)
  return tpl
}

async function applyAll(d: AttackSharkX11, cfg: AppState) {
  const stage = (Math.min(5, Math.max(0, cfg.dpi.activeStage)) + 1) as 1|2|3|4|5|6

  await d.setDpi(new DpiBuilder({
    dpiValues: cfg.dpi.values,
    activeStage: stage,
    angleSnap: cfg.dpi.angleSnap,
    ripplerControl: cfg.dpi.rippleControl,
  }))

  await d.setPollingRate(new PollingRateBuilder({
    rate: RATE_MAP[cfg.pollingRate] ?? Rate.eSports
  }))

  await d.setUserPreferences(new UserPreferencesBuilder({
    lightMode: cfg.lighting.mode as LightMode,
    rgb: cfg.lighting.rgb,
    ledSpeed: cfg.lighting.ledSpeed as 1|2|3|4|5,
    keyResponse: cfg.performance.keyResponse as never,
    sleepTime: cfg.power.sleepTime as never,
    deepSleepTime: cfg.power.deepSleepTime as never,
  }))

  const mb = new MacrosBuilder()
  for (const key of BUTTON_KEYS) {
    const b = cfg.buttons[key]
    if (b) mb.setMacro(BTN_ENUM[key] as never, bindingToTuple(b))
  }
  await d.setMacro(mb)

  // macro custom opcional
  const m = cfg.customMacro
  if (m.enabled && m.events.length > 0) {
    const mb2 = new MacrosBuilder()
    for (const key of BUTTON_KEYS) {
      const b = cfg.buttons[key]; if (b) mb2.setMacro(BTN_ENUM[key] as never, bindingToTuple(b))
    }
    const cb = new CustomMacroBuilder()
      .setPlayOptions(m.mode as MacroMode, m.repeat)
      .setTargetButton(m.targetButton, mb2)
    for (const ev of m.events) cb.addEvent(ev.key, ev.delay, ev.release)
    await d.setCustomMacro(cb)
  }
}

// ─── janela ───────────────────────────────────────────────────────────────────
function createWindow(): void {
  nativeTheme.themeSource = 'dark'

  mainWin = new BrowserWindow({
    width: 1060, height: 720,
    minWidth: 900, minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#070b10',
    show: false,
    autoHideMenuBar: true,
    // assets/ é empacotado dentro do app.asar (PKGBUILD via asar pack), acessível
    // via __dirname relativo tanto em dev quanto empacotado
    icon: join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWin.on('ready-to-show', () => mainWin!.show())

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWin.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWin.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.clevs.sharkctl')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // ── controles da janela ──
  ipcMain.on('win:minimize', () => mainWin?.minimize())
  ipcMain.on('win:maximize', () => mainWin?.isMaximized() ? mainWin!.unmaximize() : mainWin?.maximize())
  ipcMain.on('win:close',   () => mainWin?.close())

  // ── conexão ──
  // Tenta um modo específico; se não passado, tenta adapter depois wired
  ipcMain.handle('device:connect', async (_evt, preferredMode?: 'wireless' | 'wired') => {
    // fechar conexão anterior se existir
    if (driver) {
      try { await driver.close() } catch {}
      driver = null
    }

    // diagnóstico: lista TODOS os dispositivos USB visíveis pelo módulo nativo
    try {
      const usbModule = await import('usb')
      const all = usbModule.getDeviceList()
      console.log(`[connect] usb.getDeviceList() retornou ${all.length} dispositivos`)
      const shark = all.filter((d: any) => d.deviceDescriptor.idVendor === 0x1d57)
      console.log(`[connect] dispositivos com vendorId 0x1d57 (Attack Shark): ${shark.length}`)
      for (const d of shark) {
        console.log(`[connect]   -> idProduct=0x${d.deviceDescriptor.idProduct.toString(16)} bus=${d.busNumber} addr=${d.deviceAddress}`)
      }
      if (all.length === 0) {
        return { ok: false, error: 'Módulo USB nativo não retornou nenhum dispositivo — possível incompatibilidade de ABI com o Electron. Veja o terminal para detalhes.' }
      }
      if (shark.length === 0) {
        return { ok: false, error: `Nenhum dispositivo Attack Shark (vendor 0x1d57) encontrado entre ${all.length} dispositivos USB. Verifique se o mouse/dongle está conectado.` }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[connect] erro ao listar dispositivos USB:', msg)
      return { ok: false, error: `Falha ao acessar o módulo USB nativo: ${msg}` }
    }

    const modes: ConnectionMode[] = preferredMode === 'wired'
      ? [ConnectionMode.Wired, ConnectionMode.Adapter]
      : [ConnectionMode.Adapter, ConnectionMode.Wired]

    let lastError = ''
    for (const mode of modes) {
      try {
        console.log(`[connect] tentando modo ${mode === ConnectionMode.Adapter ? '2.4GHz' : 'USB'} (idProduct=0x${mode.toString(16)})...`)
        const d = new AttackSharkX11({ connectionMode: mode, delayMs: SAFE_DELAY })
        await d.open()
        driver = d
        const modeName = mode === ConnectionMode.Adapter ? 'wireless' : 'wired'
        console.log(`[connect] conectado via ${modeName}`)
        return { ok: true, mode: modeName }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
        console.warn(`[connect] falhou modo 0x${mode.toString(16)}:`, lastError)
      }
    }

    return { ok: false, error: lastError || 'Mouse não encontrado' }
  })

  ipcMain.handle('device:disconnect', async () => {
    try { await driver?.close() } catch {}
    driver = null
    return { ok: true }
  })

  ipcMain.handle('device:battery', async () => {
    if (!driver) return null
    try { return await driver.getBatteryLevel(1500) } catch { return null }
  })

  // ── config ──
  ipcMain.handle('config:get', () => state)

  ipcMain.handle('config:apply', async (_evt, patch: Partial<AppState>) => {
    if (!driver) throw new Error('Mouse não conectado')
    const merged: AppState = {
      ...state,
      ...patch,
      buttons: { ...state.buttons, ...(patch.buttons ?? {}) },
      dpi: { ...state.dpi, ...(patch.dpi ?? {}) },
      lighting: { ...state.lighting, ...(patch.lighting ?? {}) },
      performance: { ...state.performance, ...(patch.performance ?? {}) },
      power: { ...state.power, ...(patch.power ?? {}) },
      customMacro: { ...state.customMacro, ...(patch.customMacro ?? {}) },
    }
    await run(() => applyAll(driver!, merged))
    state = merged
    save(STATE_FILE, state)
    return state
  })

  ipcMain.handle('config:reset', async () => {
    if (!driver) throw new Error('Mouse não conectado')
    await run(() => driver!.reset())
    state = structuredClone(DEFAULT_STATE)
    save(STATE_FILE, state)
    return state
  })

  // ── perfis ──
  ipcMain.handle('profiles:list',   () => Object.keys(profiles))
  ipcMain.handle('profiles:save',   (_evt, name: string, cfg?: AppState) => {
    profiles[name] = cfg ? { ...DEFAULT_STATE, ...cfg } : structuredClone(state)
    save(PROFILES_FILE, profiles)
    return Object.keys(profiles)
  })
  ipcMain.handle('profiles:load',   (_evt, name: string) => profiles[name] ?? null)
  ipcMain.handle('profiles:delete', (_evt, name: string) => {
    delete profiles[name]
    save(PROFILES_FILE, profiles)
    return Object.keys(profiles)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
