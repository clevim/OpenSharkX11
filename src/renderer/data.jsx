/* ============ data + icons ============ */
import React from 'react'

export const I = {
  shark:'<svg viewBox="0 0 24 24" fill="none"><path d="M3 14c4 1 6-1 7-4 1 3 4 7 11 6-2 2-5 3-8 3l-2 3-1-3c-3 0-6-2-7-5Z" fill="currentColor"/><circle cx="14" cy="12.5" r="1" fill="var(--bg-2)"/></svg>',
  console:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dpi:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke-linecap="round"/><circle cx="12" cy="12" r="3.2"/></svg>',
  light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11Z"/><path d="M10 20h4M11 22h2" stroke-linecap="round"/></svg>',
  buttons:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v8M9 7h-2M17 7h-2" stroke-linecap="round"/></svg>',
  perf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 14a8 8 0 0 1 16 0" /><path d="M12 14l4-3" stroke-linecap="round"/><circle cx="12" cy="14" r="1.3" fill="currentColor" stroke="none"/></svg>',
  profiles:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" stroke-linecap="round"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>',
  palette:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.8.7-1.3 1.5-1.3H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z"/><circle cx="7.5" cy="11.5" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="11" r="1" fill="currentColor"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" stroke-linecap="round"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 14a8 8 0 1 1-9-11 6.5 6.5 0 0 0 9 11Z"/></svg>',
  batt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4" stroke-linecap="round"/></svg>',
  bolt:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7M8 14h8" stroke-linecap="round"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 6v12M6 12h12" stroke-linecap="round"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12a7 7 0 1 1 2 5M5 12V8M5 12h4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
}
export function Ico({n,style}){
  return <span className="ico-wrap" style={{width:20,height:20,display:'inline-flex',alignItems:'center',justifyContent:'center',...style}} dangerouslySetInnerHTML={{__html:I[n]||''}}/>
}

export const NAV = [
  {id:'console',  lbl:'CONSOLE', ico:'console'},
  {id:'dpi',      lbl:'DPI',     ico:'dpi'},
  {id:'lighting', lbl:'LUZ',     ico:'light'},
  {id:'buttons',  lbl:'BOTÕES',  ico:'buttons'},
  {id:'perf',     lbl:'PERF',    ico:'perf'},
  {id:'profiles', lbl:'PERFIS',  ico:'profiles'},
  {id:'settings', lbl:'CONFIG',  ico:'settings'},
]

export const DPI_DEFAULT = [
  {dpi:400,  color:'#0000ff'},
  {dpi:800,  color:'#00ff00'},
  {dpi:1600, color:'#ffff00'},
  {dpi:3200, color:'#ff8800'},
  {dpi:6400, color:'#ff0000'},
  {dpi:12000,color:'#ff00ff'},
]
export const DPI_MAX = 26000

export const POLLING = [125,250,500,1000]

export const MODES = [
  {id:'off',            name:'Off',            desc:'LEDs desligados'},
  {id:'static',         name:'Static',         desc:'Cor sólida fixa'},
  {id:'breathing',      name:'Breathing',      desc:'Pulsa a cor global'},
  {id:'neon',           name:'Neon',           desc:'Cicla o arco-íris'},
  {id:'colorbreathing', name:'ColorBreathing', desc:'Respira ciclando cores'},
  {id:'staticdpi',      name:'StaticDpi',      desc:'Cor fixa do estágio ativo'},
  {id:'breathingdpi',   name:'BreathingDpi',   desc:'Respira a cor do estágio'},
]

export const SWATCHES = [
  '#ff0000','#ff8800','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ffffff',
  '#ff4466','#ff6a00','#ffe600','#39ff14','#00e5ff','#2979ff','#d500f9','#c0c0c0',
]

export const BUTTONS = [
  {id:'left',  label:'Botão Esquerdo', def:'Clique Esquerdo', x:28.3, y:25.9, w:62, h:130},
  {id:'right', label:'Botão Direito',  def:'Clique Direito',  x:71.7, y:25.5, w:62, h:130},
  {id:'wheel', label:'Clique do Meio', def:'Clique Meio',     x:50,   y:21.7, w:30, h:42},
  {id:'sup',   label:'Scroll Cima',    def:'Rolar Cima',      x:50,   y:15,   w:30, h:22},
  {id:'sdn',   label:'Scroll Baixo',   def:'Rolar Baixo',     x:50,   y:29,   w:30, h:22},
  {id:'dpi',   label:'Botão DPI',      def:'Ciclar DPI',      x:50.3, y:48.9, w:42, h:26},
  {id:'fwd',   label:'Lateral Frente', def:'Lateral Frente',  x:9.7,  y:41.4, w:28, h:24},
  {id:'back',  label:'Lateral Trás',   def:'Lateral Trás',    x:9.3,  y:53.6, w:28, h:24},
]

export const NATIVE_ACTIONS = [
  {group:'Mouse',   items:['Clique Esquerdo','Clique Direito','Clique Meio','Lateral Frente','Lateral Trás','Rolar Cima','Rolar Baixo','Duplo Clique','Ciclar DPI','DPI +','DPI −','Desativar Botão']},
  {group:'Sistema', items:['Copiar','Colar','Cortar','Desfazer','Refazer','Selecionar Tudo','Trocar Janela','Bloquear PC','Captura de Tela','Abrir Calculadora','Imprimir']},
]

export const SHORTCUT_PRESETS = [
  {mods:['Alt'],key:'F4'},{mods:['Ctrl','Shift'],key:'Esc'},{mods:['Super'],key:'L'},
  {mods:['Ctrl'],key:'C'},{mods:['Ctrl'],key:'V'},{mods:['Ctrl'],key:'Z'},
  {mods:['Ctrl','Shift'],key:'Z'},{mods:['Alt'],key:'Tab'},
]

export const BOOT_LOG = [
  {tag:'sys', cls:'sys', t:'00:00.00', m:'sharkctl v1.0.0 · electron 34 · linux x86_64'},
  {tag:'usb', cls:'inf', t:'00:00.01', m:'aguardando conexão com o mouse…'},
]

export const SECTION_IDX = {
  console:'00 / OVERVIEW', dpi:'01 / SENSOR', lighting:'02 / RGB', buttons:'03 / REMAP',
  perf:'04 / TIMING', profiles:'05 / STATE', settings:'06 / SYSTEM',
}
