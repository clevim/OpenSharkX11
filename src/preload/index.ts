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

// Log de diagnóstico — aparece no DevTools (Ctrl+Shift+I) se algo der errado
try {
  contextBridge.exposeInMainWorld('api', api)
  console.log('[preload] window.api exposto com sucesso')
} catch (e) {
  console.error('[preload] FALHA ao expor window.api:', e)
}
