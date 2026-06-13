/* ============ App ============ */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import mouseLineSvg from './assets/mouse-line.svg?raw'
import appIconUrl from './assets/app-icon.png'
import { I, Ico, NAV, DPI_DEFAULT, MODES, BUTTONS, BOOT_LOG, SECTION_IDX } from './data.jsx'
import { makeT, tAct as _tAct, ACCENTS } from './i18n.jsx'
import {
  ConsoleSection, DpiSection, LightingSection, ButtonsSection,
  PerfSection, ProfilesSection, SettingsSection
} from './sections.jsx'

// ─── helpers de conversão ─────────────────────────────────────────────────────
const hexToRgb = (hex) => ({
  r: parseInt(hex.slice(1,3),16),
  g: parseInt(hex.slice(3,5),16),
  b: parseInt(hex.slice(5,7),16),
})
const rgbToHex = ({r,g,b}) => '#'+[r,g,b].map(x=>(x??0).toString(16).padStart(2,'0')).join('')
const ts = () => new Date().toLocaleTimeString('pt-BR',{hour12:false})

const MODE_TO_NUM = {
  off:0x00, static:0x10, breathing:0x20, neon:0x30,
  colorbreathing:0x40, staticdpi:0x50, breathingdpi:0x60,
}
const NUM_TO_MODE = Object.fromEntries(Object.entries(MODE_TO_NUM).map(([k,v])=>[v,k]))

const ACTION_TO_TPL = {
  // mouse
  'Clique Esquerdo':  'global-left-click',
  'Clique Direito':   'global-right-click',
  'Clique Meio':      'global-middle',
  'Lateral Frente':   'global-forward',
  'Lateral Trás':     'global-backward',
  'Rolar Cima':       'global-scroll-up',
  'Rolar Baixo':      'global-scroll-down',
  'Duplo Clique':     'global-double-click',
  'Ciclar DPI':       'global-dpi-cycle',
  'DPI +':            'global-dpi-+',
  'DPI −':            'global-dpi--',
  'Desativar Botão':  'global-disable-button',
  // sistema
  'Copiar':           'shortcut-copy',
  'Colar':            'shortcut-paste',
  'Cortar':           'shortcut-cut',
  'Desfazer':         'shortcut-undo',
  'Refazer':          'shortcut-redo',
  'Selecionar Tudo':  'shortcut-select-all',
  'Trocar Janela':    'shortcut-swap-window',
  'Bloquear PC':      'shortcut-lock-pc',
  'Captura de Tela':  'shortcut-screen-capture',
  'Abrir Calculadora':'browser-calculator',
  'Imprimir':         'shortcut-print',
  // multimídia
  'Play / Pause':     'multimedia-play-pause',
  'Próxima Faixa':    'multimedia-next-track',
  'Faixa Anterior':   'multimedia-previous-track',
  'Parar Música':     'multimedia-stop-music',
  'Volume +':         'multimedia-volume-+',
  'Volume −':         'multimedia-volume--',
  'Mudo':             'multimedia-mute',
  'Player de Mídia':  'multimedia-media-player',
  // browser
  'Home':             'browser-home',
  'Email':            'browser-email',
  'Buscar':           'browser-search',
}
const TPL_TO_ACTION = Object.fromEntries(Object.entries(ACTION_TO_TPL).map(([k,v])=>[v,k]))
const MOD_BITS = {Ctrl:1,Shift:2,Alt:4,Super:8}
const HID = (() => {
  const m = {Enter:0x28,Escape:0x29,Backspace:0x2a,Tab:0x2b,Space:0x2c,Minus:0x2d,Equal:0x2e,
    BracketLeft:0x2f,BracketRight:0x30,Backslash:0x31,Semicolon:0x33,Quote:0x34,Backquote:0x35,
    Comma:0x36,Period:0x37,Slash:0x38,CapsLock:0x39,Delete:0x4c,Home:0x4a,End:0x4d,
    PageUp:0x4b,PageDown:0x4e,ArrowRight:0x4f,ArrowLeft:0x50,ArrowDown:0x51,ArrowUp:0x52}
  for(let i=0;i<26;i++) m['Key'+String.fromCharCode(65+i)]=0x04+i
  for(let i=1;i<=9;i++) m['Digit'+i]=0x1e+i-1; m.Digit0=0x27
  for(let i=1;i<=12;i++) m['F'+i]=0x3a+i-1
  return m
})()
const KEY_TO_HID = (() => {
  const m = {...HID}
  const byCode = Object.fromEntries(Object.entries(HID).map(([k,v])=>[k.replace(/^Key|^Digit/,''),v]))
  return Object.assign(byCode, m)
})()

// mapeamento de chaves React ↔ main process (nomes dos botões diferem)
const RX_TO_MAIN = {wheel:'middle', fwd:'forward', back:'backward', sup:'scrollUp', sdn:'scrollDown'}
const MAIN_TO_RX  = Object.fromEntries(Object.entries(RX_TO_MAIN).map(([k,v])=>[v,k]))

function bindingToMain(b) {
  if(!b || b.type==='native') {
    return {type:'template', template: ACTION_TO_TPL[b?.action]||'global-left-click'}
  }
  if(b.type==='shortcut') {
    const mods = (b.mods||[]).reduce((acc,m)=>acc|(MOD_BITS[m]||0),0)
    const hid = KEY_TO_HID[b.key] || KEY_TO_HID['Key'+(b.key||'A')] || 0
    return {type:'keyboard', modifiers:mods, keyCode:hid}
  }
  return {type:'template', template:'global-left-click'}
}

function mainCfgToReact(cfg) {
  if(!cfg) return null
  const fallbackColors = DPI_DEFAULT.map(d=>d.color)
  return {
    dpi: (cfg.dpi?.values||[400,800,1600,3200,5000,22000]).map((v,i)=>({
      dpi: v,
      color: cfg.lighting?.stageColors?.[i] ? rgbToHex(cfg.lighting.stageColors[i]) : fallbackColors[i],
      active: i===cfg.dpi?.activeStage,
    })),
    activeStage: cfg.dpi?.activeStage ?? 2,
    angleSnap: cfg.dpi?.angleSnap ?? false,
    ripple: cfg.dpi?.rippleControl ?? true,
    mode: NUM_TO_MODE[cfg.lighting?.mode] || 'staticdpi',
    color: cfg.lighting?.globalColor ? rgbToHex(cfg.lighting.globalColor) : '#2dd4ee',
    speed: Math.max(1, Math.min(10, Math.round((cfg.lighting?.ledSpeed||3)*10/5))),
    polling: cfg.pollingRate || 1000,
    debounce: cfg.performance?.keyResponse || 4,
    bindings: cfg.buttons
      ? Object.fromEntries(Object.entries(cfg.buttons).map(([k,b])=>{
          const rxKey = MAIN_TO_RX[k] || k  // converte chave do main process para chave React
          if(b.type==='template') return [rxKey,{type:'native',action:TPL_TO_ACTION[b.template]||b.template}]
          if(b.type==='keyboard') return [rxKey,{type:'shortcut',mods:[],key:''}]
          return [rxKey,{type:'native',action:'Clique Esquerdo'}]
        }))
      : Object.fromEntries(BUTTONS.map(b=>[b.id,{type:'native',action:b.def}])),
  }
}

function reactCfgToMain(state) {
  return {
    dpi: {
      values: state.dpi.map(d=>d.dpi),
      activeStage: state.activeStage,
      angleSnap: state.angleSnap,
      rippleControl: state.ripple,
    },
    lighting: {
      mode: MODE_TO_NUM[state.mode] ?? 0x50,
      stageColors: state.dpi.map(d=>hexToRgb(d.color)),
      globalColor: hexToRgb(state.color),
      ledSpeed: Math.max(1, Math.min(5, Math.round(state.speed*5/10))),
    },
    pollingRate: state.polling,
    performance: { keyResponse: Math.max(4, Math.min(50, state.debounce % 2 === 0 ? state.debounce : state.debounce + 1)) },
    buttons: Object.fromEntries(
      Object.entries(state.bindings||{}).map(([k,b])=>[RX_TO_MAIN[k]||k, bindingToMain(b)])
    ),
  }
}

function loadLS(k,def){ try{ const v=localStorage.getItem(k); return v===null?def:JSON.parse(v) }catch(_){ return def } }

const api = window.api

export default function App(){
  const [theme,setThemeSt] = useState(()=>loadLS('sharkctl_theme','dark'))
  const [lang,setLangSt]   = useState(()=>loadLS('sharkctl_lang','pt'))
  const [accent,setAccentSt]= useState(()=>loadLS('sharkctl_accent','cyan'))
  const [section,setSection] = useState('console')

  const [connected, setConnected]   = useState(false)
  const [connMode, setConnMode]     = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [toastMsg, setToastMsg]     = useState(null)
  const appliedRef = useRef(null)
  const autoApplyTimerRef = useRef(null)
  const hwStageRef = useRef(false) // true when activeStage was set by hardware event

  const [state,setState] = useState(()=>{
    let btnPos = Object.fromEntries(BUTTONS.map(b=>[b.id,{x:b.x,y:b.y}]))
    try{ const saved=JSON.parse(localStorage.getItem('sharkctl_btnpos')||'null'); if(saved) btnPos={...btnPos,...saved} }catch(_){}
    return {
      conn:'disconnected', autoReconnect:true, batt:0,
      dpi:DPI_DEFAULT.map(d=>({...d})), activeStage:2,
      angleSnap:false, ripple:true,
      mode:'staticdpi', color:'#2dd4ee', speed:6, battOverride:true,
      polling:1000, debounce:4,
      bindings:Object.fromEntries(BUTTONS.map(b=>[b.id,{type:'native',action:b.def}])),
      btnPos,
      profiles:[],
      log:BOOT_LOG,
    }
  })
  const set = useCallback((patch)=>setState(s=>({...s,...patch})),[])

  const addLog = useCallback((entry)=>{
    setState(s=>({...s, log:[...s.log.slice(-99), entry]}))
  },[])

  const showToast = useCallback((msg, err=false)=>{
    setToastMsg({msg,err})
    setTimeout(()=>setToastMsg(null), 3000)
  },[])

  const setTheme = (v)=>{ setThemeSt(v); localStorage.setItem('sharkctl_theme',JSON.stringify(v)) }
  const setLang  = (v)=>{ setLangSt(v);  localStorage.setItem('sharkctl_lang',JSON.stringify(v)); document.documentElement.lang=v }
  const setAccent= (v)=>{ setAccentSt(v);localStorage.setItem('sharkctl_accent',JSON.stringify(v)) }

  const t = useMemo(()=>makeT(lang),[lang])

  useEffect(()=>{ document.documentElement.setAttribute('data-theme',theme) },[theme])
  useEffect(()=>{
    const c=(ACCENTS.find(a=>a.id===accent)||ACCENTS[0]).c
    const r=document.documentElement.style
    r.setProperty('--live',c)
    r.setProperty('--live-soft',`color-mix(in oklab, ${c} 15%, transparent)`)
    r.setProperty('--live-line',`color-mix(in oklab, ${c} 50%, transparent)`)
  },[accent])
  useEffect(()=>{ try{ localStorage.setItem('sharkctl_btnpos',JSON.stringify(state.btnPos)) }catch(_){} },[state.btnPos])

  // auto-apply — DPI muda instantaneamente; iluminação, remap e perf têm botão manual
  useEffect(()=>{
    if(!connected||!appliedRef.current||!api) return
    if(hwStageRef.current){ hwStageRef.current=false; return }
    const a=appliedRef.current
    const cfg_keys=['dpi','activeStage','angleSnap','ripple']
    const same=JSON.stringify(cfg_keys.map(k=>state[k]))===JSON.stringify(cfg_keys.map(k=>a[k]))
    if(same) return
    if(autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current)
    const snap={...state}
    autoApplyTimerRef.current=setTimeout(async()=>{
      try{
        const patch=reactCfgToMain(snap)
        const newCfg=await api.applyConfig(patch)
        const rx=mainCfgToReact(newCfg)
        if(rx) appliedRef.current=rx
      }catch(e){
        addLog({t:ts(),tag:'CFG',cls:'err',m:'Auto-apply: '+e.message})
        showToast('Erro ao aplicar: '+e.message, true)
      }
    },300)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state.dpi,state.activeStage,state.angleSnap,state.ripple,connected])

  // ── connect helper (chamado no boot e pelo botão "buscar mouse") ─────────────
  const reconnect = useCallback(async ()=>{
    if(!api||connecting) return
    setConnecting(true)
    addLog({t:ts(),tag:'USB',cls:'info',m:'Procurando mouse...'})
    try {
      const res = await api.connect()
      if(res.ok){
        setConnected(true); setConnMode(res.mode)
        set({conn:res.mode==='wireless'?'2.4ghz':'usb'})
        addLog({t:ts(),tag:'USB',cls:'ok',m:`Conectado via ${res.mode}`})
        const cfg = await api.getConfig()
        const rx = mainCfgToReact(cfg)
        if(rx){ setState(s=>({...s,...rx})); appliedRef.current=rx }
        const batt = await api.battery()
        if(batt!==null&&batt>=0) set({batt})
        const names = await api.profilesList()
        if(names) setState(s=>({...s, profiles: names.map(n=>({name:n,meta:''}))}))

      } else {
        addLog({t:ts(),tag:'USB',cls:'warn',m:res.error||'Mouse não encontrado'})
        showToast(res.error||'Mouse não encontrado', true)
      }
    } catch(e){
      addLog({t:ts(),tag:'USB',cls:'err',m:e.message})
      showToast(e.message, true)
    } finally {
      setConnecting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[connecting])

  // ── IPC bootstrap ──────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!api) return

    api.onBattery((pct)=>{
      set({batt:pct})
    })
    api.onDpiStage((stage)=>{
      hwStageRef.current=true
      setState(s=>({...s, activeStage:stage}))
      if(appliedRef.current) appliedRef.current={...appliedRef.current, activeStage:stage}
      addLog({t:ts(),tag:'DPI',cls:'info',m:`Estágio ${stage+1} ativo`})
    })
    api.onDisconnected(()=>{
      setConnected(false); setConnMode(null)
      set({conn:'disconnected',batt:0})
      appliedRef.current=null
      addLog({t:ts(),tag:'USB',cls:'err',m:'Mouse desconectado'})
      showToast('Mouse desconectado',true)
    })

    reconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  const glow = useMemo(()=>{
    if(state.battOverride){ if(state.batt<15&&state.batt>0) return '#f43f6b'; if(state.batt<30&&state.batt>0) return '#f5a524' }
    if(state.mode==='staticdpi'||state.mode==='breathingdpi') return state.dpi[state.activeStage].color
    if(state.mode==='neon'||state.mode==='colorbreathing') return '#ff0000' // base fixa pra hue-rotate ciclar arco-íris completo
    return state.color
  },[state])
  const lit = state.mode!=='off'
  const mouseProps = {markup:mouseLineSvg, glow, mode:state.mode, speed:state.speed, lit}

  const applyLighting = async ()=>{
    if(!api||!connected) return
    try {
      const patch = reactCfgToMain(state)
      const newCfg = await api.applyConfig(patch)
      const rx = mainCfgToReact(newCfg)
      if(rx) appliedRef.current=rx
      showToast('Iluminação aplicada ✓')
      addLog({t:ts(),tag:'RGB',cls:'ok',m:'Iluminação enviada ao mouse'})
    } catch(e){
      showToast('Erro: '+e.message, true)
      addLog({t:ts(),tag:'RGB',cls:'err',m:e.message})
    }
  }

  const applyBindings = async ()=>{
    if(!api||!connected) return
    try {
      const patch = reactCfgToMain(state)
      const newCfg = await api.applyConfig(patch)
      const rx = mainCfgToReact(newCfg)
      if(rx) appliedRef.current=rx
      showToast('Remap aplicado ✓')
      addLog({t:ts(),tag:'BTN',cls:'ok',m:'Botões enviados ao mouse'})
    } catch(e){
      showToast('Erro: '+e.message, true)
      addLog({t:ts(),tag:'BTN',cls:'err',m:e.message})
    }
  }

  const applyPerf = async ()=>{
    if(!api||!connected) return
    try {
      const patch = reactCfgToMain(state)
      const newCfg = await api.applyConfig(patch)
      const rx = mainCfgToReact(newCfg)
      if(rx) appliedRef.current=rx
      showToast('Performance aplicada ✓')
      addLog({t:ts(),tag:'PERF',cls:'ok',m:`Polling ${state.polling}Hz · Debounce ${state.debounce}ms`})
    } catch(e){
      showToast('Erro: '+e.message, true)
      addLog({t:ts(),tag:'PERF',cls:'err',m:e.message})
    }
  }

  const refreshProfiles = async ()=>{
    if(!api) return []
    const names = await api.profilesList()
    const list = (names||[]).map(n=>({name:n,meta:''}))
    setState(s=>({...s, profiles:list}))
    return list
  }

  const profileSave = async (name)=>{
    if(!api||!name.trim()) return
    try{
      const patch = reactCfgToMain(state)
      await api.profilesSave(name.trim(), patch)
      await refreshProfiles()
      showToast('Perfil "'+name.trim()+'" salvo ✓')
      addLog({t:ts(),tag:'PRF',cls:'ok',m:'Perfil salvo: '+name.trim()})
    }catch(e){ showToast('Erro: '+e.message, true) }
  }

  const profileLoad = async (name)=>{
    if(!api) return
    try{
      const cfg = await api.profilesLoad(name)
      if(!cfg){ showToast('Perfil não encontrado', true); return }
      const rx = mainCfgToReact(cfg)
      if(rx){ setState(s=>({...s,...rx})); appliedRef.current=rx }
      showToast('Perfil "'+name+'" carregado ✓')
      addLog({t:ts(),tag:'PRF',cls:'ok',m:'Perfil carregado: '+name})
    }catch(e){ showToast('Erro: '+e.message, true) }
  }

  const profileDelete = async (name)=>{
    if(!api) return
    try{
      await api.profilesDelete(name)
      await refreshProfiles()
      showToast('Perfil "'+name+'" excluído')
      addLog({t:ts(),tag:'PRF',cls:'warn',m:'Perfil excluído: '+name})
    }catch(e){ showToast('Erro: '+e.message, true) }
  }

  const ctx = {state, set, mouseProps, t, lang, tAct:(s)=>_tAct(s,lang),
    theme, setTheme, setLang, accent, setAccent,
    connected, connecting, reconnect, applyLighting, applyBindings, applyPerf,
    profileSave, profileLoad, profileDelete}
  const battColor = state.batt<15?'var(--danger)':state.batt<30?'var(--warn)':'var(--good)'

  const Section = {
    console:ConsoleSection, dpi:DpiSection, lighting:LightingSection, buttons:ButtonsSection,
    perf:PerfSection, profiles:ProfilesSection, settings:SettingsSection,
  }[section]

  const connLabel = state.conn==='usb'?'USB-C':state.conn==='2.4ghz'?'2.4GHz':'—'

  const win = (action)=>{
    if(!api) return
    if(action==='min') api.minimize()
    else if(action==='max') api.maximize()
    else if(action==='close') api.close()
  }

  return (
    <div className="app">
      {/* toast */}
      {toastMsg && (
        <div className={'app-toast'+(toastMsg.err?' err':'')}>{toastMsg.msg}</div>
      )}


<div className="titlebar">
        <div className="brand">
          <span className="glyph"><img src={appIconUrl} alt="X11 Control"/></span>
          <span className="nm">SHARKCTL</span>
          <span className="sub">ATTACK SHARK · X11 · LINUX</span>
        </div>
        <div className="tb-spacer"></div>
        <div className="conn-pill">
          <span className={'conn-dot'+(connected?' ok':'')}></span>
          <span className="ctype">{connected?t('tb.linked'):t('tb.disconnected')}</span>
          {connected && <span style={{color:'var(--text)'}}>{connLabel}</span>}
        </div>
        <div className="tb-btns">
          <button className="tb-btn" title={t('tb.theme')} onClick={()=>setTheme(th=>th==='dark'?'light':'dark')}>
            <span style={{width:18,height:18,display:'inline-flex',alignItems:'center'}} dangerouslySetInnerHTML={{__html:theme==='dark'?I.sun:I.moon}}/>
          </button>
        </div>
        <div className="win-ctrls">
          <button className="win-dot wd-min" title={t('tb.min')} onClick={()=>win('min')}></button>
          <button className="win-dot wd-max" title={t('tb.max')} onClick={()=>win('max')}></button>
          <button className="win-dot wd-close" title={t('tb.close')} onClick={()=>win('close')}></button>
        </div>
      </div>

      <div className="body">
        <div className="rail">
          {NAV.map(n=>(
            <button key={n.id} className={'nav-item'+(section===n.id?' active':'')} onClick={()=>setSection(n.id)}>
              <span className="ico" style={{width:20,height:20,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                <span dangerouslySetInnerHTML={{__html:I[n.ico]}}/>
              </span>
              <span className="lbl">{t('nav.'+n.id)}</span>
            </button>
          ))}
          <div className="rail-sp"></div>
          <div className="rail-foot">
            <div className="batt-mini">
              <div className="pct" style={{color:connected?battColor:'var(--dim)'}}>{connected?state.batt+'%':'—'}</div>
              {connected && <div className="batt-bar"><i style={{width:state.batt+'%',background:battColor}}></i></div>}
            </div>
            <div className="ver">v0.4.2</div>
          </div>
        </div>

        <div className="main">
          <div className="sec">
            <span className="decal" style={{top:'14px',right:'30px'}}>✕ ✕ ╳ ┼ ▢ ◇</span>
            <span className="decal" style={{bottom:'20px',left:'30px',writingMode:'vertical-rl'}}>X11 · SHARKCTL · ╳╳╳</span>
            <div className="sec-head">
              <div className="ttl">
                <h1>{t('sec.'+section+'.h')}</h1>
                <span className="idx">{SECTION_IDX[section]}</span>
              </div>
              <div className="desc">{t('sec.'+section+'.d')}</div>
            </div>
            <Section ctx={ctx}/>
          </div>
        </div>
      </div>

      <div className="statusbar">
        <div className="s">
          <span className={'conn-dot'+(connected?' ok':'')} style={{position:'static',width:'6px',height:'6px'}}></span>
          <b>{connected?connLabel+' '+t('sb.linked'):t('sb.disconnected')}</b>
        </div>
        <div className="s path">~/.config/sharkctl/state.json</div>
        <div className="sb-sp"></div>
        {connected && <>
          <div className="s"><b>DPI</b> <span className="live-tx" style={{color:state.dpi[state.activeStage].color}}>{state.dpi[state.activeStage].dpi.toLocaleString()}</span></div>
          <div className="s"><b>POLL</b> {state.polling}Hz</div>
          <div className="s"><b>{t('sb.light')}</b> {MODES.find(m=>m.id===state.mode)?.name||'—'}</div>
          <div className="s"><b>BAT</b> <span style={{color:battColor}}>{state.batt}%</span></div>
        </>}
      </div>
    </div>
  )
}
