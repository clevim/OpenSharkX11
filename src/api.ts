import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

// Single IPC surface for the UI, backed by Tauri invoke/listen.

export const api = {
  // Window controls
  minimize: () => getCurrentWindow().minimize(),
  maximize: () => getCurrentWindow().toggleMaximize(),
  close:    () => getCurrentWindow().close(),

  // Device
  connect:    (mode?: string) =>
    invoke<{ ok: boolean; mode?: string; error?: string }>('connect', { mode }),
  disconnect: () => invoke<void>('disconnect'),
  battery:    () => invoke<number | null>('battery'),

  // Events — each registers the listener async internally but exposes a
  // sync unlisten so callers can clean up in a React effect return.
  onBattery: (cb: (pct: number) => void): (() => void) => {
    let unlisten: UnlistenFn | undefined
    listen<number>('mouse:battery', e => cb(e.payload)).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  },

  onDpiStage: (cb: (stage: number) => void): (() => void) => {
    let unlisten: UnlistenFn | undefined
    listen<number>('mouse:dpi_stage', e => cb(e.payload)).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  },

  onDisconnected: (cb: () => void): (() => void) => {
    let unlisten: UnlistenFn | undefined
    listen('mouse:disconnected', () => cb()).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  },

  onTraySearch: (cb: () => void): (() => void) => {
    let unlisten: UnlistenFn | undefined
    listen('tray:search', () => cb()).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  },

  // Config
  getConfig:   ()           => invoke<object>('get_config'),
  applyConfig: (patch: object) => invoke<object>('apply_config', { patch }),
  resetConfig: ()           => invoke<object>('reset_config'),

  // Profiles
  profilesList:   ()                          => invoke<string[]>('profiles_list'),
  profilesSave:   (name: string, cfg?: object) =>
    invoke<string[]>('profiles_save', { name, cfg }),
  profilesLoad:   (name: string)               => invoke<object | null>('profiles_load', { name }),
  profilesDelete: (name: string)               => invoke<string[]>('profiles_delete', { name }),
}
