import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // janela
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),

  // dispositivo
  connect: (mode?: string): Promise<{ok:boolean,mode?:string,error?:string}> => ipcRenderer.invoke('device:connect', mode),
  disconnect: () => ipcRenderer.invoke('device:disconnect'),
  battery: (): Promise<number|null> => ipcRenderer.invoke('device:battery'),

  // [BUG-6] listeners retornam função de cleanup para evitar acúmulo em HMR
  onBattery: (cb: (pct: number) => void) => {
    const h = (_: unknown, pct: number) => cb(pct)
    ipcRenderer.on('mouse:battery', h)
    return () => ipcRenderer.off('mouse:battery', h)
  },
  onDpiStage: (cb: (stage: number) => void) => {
    const h = (_: unknown, stage: number) => cb(stage)
    ipcRenderer.on('mouse:dpiStage', h)
    return () => ipcRenderer.off('mouse:dpiStage', h)
  },
  onDisconnected: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('mouse:disconnected', h)
    return () => ipcRenderer.off('mouse:disconnected', h)
  },
  onTraySearch: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('tray:search', h)
    return () => ipcRenderer.off('tray:search', h)
  },

  // config
  getConfig: () => ipcRenderer.invoke('config:get'),
  applyConfig: (patch: object) => ipcRenderer.invoke('config:apply', patch),
  resetConfig: () => ipcRenderer.invoke('config:reset'),

  // perfis
  profilesList: (): Promise<string[]> => ipcRenderer.invoke('profiles:list'),
  profilesSave: (name: string, cfg?: object): Promise<string[]> => ipcRenderer.invoke('profiles:save', name, cfg),
  profilesLoad: (name: string) => ipcRenderer.invoke('profiles:load', name),
  profilesDelete: (name: string): Promise<string[]> => ipcRenderer.invoke('profiles:delete', name),
}

try {
  contextBridge.exposeInMainWorld('api', api)
  console.log('[preload] window.api exposto com sucesso')
} catch (e) {
  console.error('[preload] FALHA ao expor window.api:', e)
}
