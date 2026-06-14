/* ============ sections ============ */
import React, { useState, useEffect, useRef } from 'react'
import { Ico, I, MODES, SWATCHES, BUTTONS, NATIVE_ACTIONS, SHORTCUT_PRESETS, POLLING, DPI_MAX, USB_LED_COLOR, USB_CHARGED_COLOR } from './data.jsx'
import { tModeDesc } from './i18n.jsx'
import { MouseStage, MouseFrame } from './mouse.jsx'

/* ---- shared ---- */
export function Panel({label, idx, right, children, className}){
  return (
    <div className={'panel '+(className||'')}>
      <span className="corner tl"></span><span className="corner br"></span>
      {(label||right) && (
        <div className="panel-h">
          <div className="pl">{idx&&<span style={{color:'var(--live)'}}>{idx}</span>}<b>{label}</b></div>
          <div className="pi">{right}</div>
        </div>
      )}
      {children}
    </div>
  )
}
export function Toggle({on,onClick}){return <button className={'toggle'+(on?' on':'')} onClick={onClick}><i></i></button>}
export function Seg({options,value,onChange,live}){
  return <div className={'seg'+(live?' live':'')}>{options.map(o=>(
    <button key={o.v??o} className={(value===(o.v??o))?'on':''} onClick={()=>onChange(o.v??o)}>{o.l??o}</button>
  ))}</div>
}
function RowToggle({label,sub,on,onClick}){
  return <div className="row" style={{padding:'4px 0'}}>
    <div><div style={{fontSize:'12px'}}>{label}</div>{sub&&<div className="muted" style={{fontSize:'10px',marginTop:'2px'}}>{sub}</div>}</div>
    <Toggle on={on} onClick={onClick}/>
  </div>
}

/* ===================== CONSOLE ===================== */
export function ConsoleSection({ctx}){
  const {state, mouseProps, t, connected, connecting, reconnect, usbCharged, usbColor} = ctx
  const usbConn = state.conn==='usb'
  const battColor = state.batt<15?'var(--danger)':state.batt<30?'var(--warn)':'var(--good)'
  const activeStage = state.dpi[state.activeStage]
  const activeColor = usbConn ? (usbColor||USB_LED_COLOR) : activeStage.color
  return (
    <div className="cockpit fade-in">
      <div className="col">
        <Panel label={t('con.connection')} idx="01">
          <div className="row" style={{marginBottom:'12px'}}>
            <div className="k">{t('con.interface')}</div>
            <div className="v" style={{display:'flex',alignItems:'center',gap:'7px'}}>
              <span className={'conn-dot'+(connected?' ok':'')} style={{position:'static'}}></span>
              {connected ? (state.conn==='usb'?t('con.cable'):t('con.dongle')) : t('sb.disconnected')}
            </div>
          </div>
          <div className="divider"></div>
          <button
            className="btn"
            style={{width:'100%',marginBottom:'10px'}}
            onClick={reconnect}
            disabled={connecting}
          >
            {connecting ? t('con.searching') : connected ? t('con.reconnect') : t('con.findmouse')}
          </button>
          <RowToggle label={t('con.autorecon')} sub={t('con.autorecon.s')} on={state.autoReconnect} onClick={()=>ctx.set({autoReconnect:!state.autoReconnect})}/>
        </Panel>
        <Panel label={t('con.battery')} idx="02">
          {usbConn ? (
            <>
              <div style={{display:'flex',alignItems:'baseline',gap:'8px',marginBottom:'14px'}}>
                <span style={{color:usbColor,display:'inline-flex',width:22,height:22,flexShrink:0,alignSelf:'center'}} dangerouslySetInnerHTML={{__html:usbCharged?I.batt:I.bolt}}/>
                <div className="big-num" style={{color:usbColor,fontSize:'26px'}}>{usbCharged?t('con.charged'):t('con.charging')}</div>
                <div className="tiny" style={{color:'var(--dim)'}}>USB-C</div>
              </div>
              <div className="batt-bar" style={{width:'100%',height:'6px'}}>
                {usbCharged
                  ? <i style={{display:'block',height:'100%',borderRadius:'3px',width:'100%',background:USB_CHARGED_COLOR}}></i>
                  : <i className="batt-charge-fill"></i>
                }
              </div>
            </>
          ) : (
            <>
              <div className="big-num" style={{color:battColor}}>{state.batt}<span className="unit">%</span></div>
              <div className="batt-bar" style={{width:'100%',height:'8px',marginTop:'12px'}}><i style={{width:state.batt+'%',background:battColor}}></i></div>
              {state.batt<30 && <div className="tiny" style={{marginTop:'10px',color:'var(--warn)'}}>⚠ {t('con.battoverride')}</div>}
            </>
          )}
        </Panel>
      </div>

      <div className="center-col">
        <MouseFrame caption={t('con.live')}>
          <MouseStage {...mouseProps}/>
        </MouseFrame>
        <div style={{display:'flex',gap:'10px'}}>
          <div className="stat" style={{textAlign:'center',minWidth:'110px'}}><div className="sl">{t('con.activedpi')}</div><div className="sv" style={{justifyContent:'center',color:activeColor}}>{activeStage.dpi.toLocaleString()}</div></div>
          <div className="stat" style={{textAlign:'center',minWidth:'110px'}}><div className="sl">POLLING</div><div className="sv" style={{justifyContent:'center'}}>{state.polling}<small>Hz</small></div></div>
        </div>
      </div>

      <div className="col">
        <Panel label={t('con.devlog')} idx="03" right="LIVE">
          <div className="log">
            {state.log.map((l,i)=>(
              <div className="ln" key={i}>
                <span className="tt">{l.t}</span>
                <span className={'tg '+l.cls}>[{l.tag}]</span>
                <span className="mg">{l.m}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel label={t('con.summary')} idx="04">
          <div className="stack" style={{gap:'9px'}}>
            <div className="row"><span className="k">{t('con.profile')}</span><span className="v" style={{color:'var(--live)'}}>{state.profiles[state.activeProfile]?.name??'—'}</span></div>
            <div className="row"><span className="k">{t('con.lightmode')}</span><span className="v">{MODES.find(m=>m.id===state.mode)?.name??'Off'}</span></div>
            <div className="row"><span className="k">Angle snap</span><span className="v">{state.angleSnap?'ON':'OFF'}</span></div>
            <div className="row"><span className="k">Ripple control</span><span className="v">{state.ripple?'ON':'OFF'}</span></div>
            <div className="row"><span className="k">{t('con.debounce')}</span><span className="v">{state.debounce} ms</span></div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ===================== DPI ===================== */
const USB_LED = USB_LED_COLOR

export function DpiSection({ctx}){
  const {state, t} = ctx
  const usbConn = state.conn==='usb'
  const sel = state.activeStage
  const stage = state.dpi[sel]
  const ledColor = usbConn ? USB_LED : stage.color
  const setDpi = (v)=>{ const d=[...state.dpi]; d[sel]={...d[sel],dpi:v}; ctx.set({dpi:d}) }
  return (
    <div className="cockpit fade-in">
      <div className="col">
        <Panel label={t('dpi.stages')} idx="01" right={t('dpi.slots')}>
          <div className="dpi-stages">
            {state.dpi.map((d,i)=>(
              <div key={i} className={'dpi-stage'+(i===sel?' active':'')} style={{'--stage': usbConn ? USB_LED : d.color}} onClick={()=>ctx.set({activeStage:i})}>
                <div className="swatch"></div>
                <div><div className="lvl">{t('dpi.stage')} {i+1}</div><div className="dpiv">{d.dpi.toLocaleString()}<span className="unit" style={{marginLeft:'4px'}}>DPI</span></div></div>
                <div className="actag">{t('dpi.active')}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="center-col">
        <MouseFrame caption={t('dpi.stage')+' '+(sel+1)+' · '+stage.dpi.toLocaleString()+' DPI'}>
          <MouseStage {...ctx.mouseProps} glow={ledColor} mode="staticdpi" lit={true}/>
        </MouseFrame>
        <div className="big-num" style={{color:ledColor,fontSize:'46px'}}>{stage.dpi.toLocaleString()}<span className="unit" style={{fontSize:'13px',marginLeft:'8px'}}>DPI</span></div>
      </div>

      <div className="col">
        <Panel label={t('dpi.adjust')+' '+(sel+1)} idx="02">
          <div className="row" style={{marginBottom:'14px'}}>
            <span className="k">{t('dpi.resolution')}</span>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <button className="btn sm" onClick={()=>setDpi(Math.max(50,stage.dpi-50))}>−</button>
              <span className="v" style={{minWidth:'58px',textAlign:'center',fontWeight:600}}>{stage.dpi.toLocaleString()}</span>
              <button className="btn sm" onClick={()=>setDpi(Math.min(DPI_MAX,stage.dpi+50))}>+</button>
            </div>
          </div>
          <input type="range" min="50" max={DPI_MAX} step="50" value={stage.dpi} onChange={e=>setDpi(+e.target.value)}/>
          <div className="row" style={{marginTop:'6px'}}><span className="tiny">50</span><span className="tiny">{DPI_MAX.toLocaleString()}</span></div>
          <div className="divider"></div>
          <div className={usbConn ? 'usb-dim' : ''}>
            <div className="row" style={{marginBottom:'10px'}}>
              <span className="k">{t('dpi.ledcolor')}</span>
              <span className="swatch" style={{width:'16px',height:'16px',borderRadius:'5px',background:ledColor,boxShadow:'0 0 8px '+ledColor}}></span>
            </div>
            <div className="swatches">
              {SWATCHES.map(c=>(
                <button key={c} className={'sw'+(stage.color===c?' on':'')} style={{background:c}} onClick={()=>{const d=[...state.dpi];d[sel]={...d[sel],color:c};ctx.set({dpi:d});}}></button>
              ))}
            </div>
          </div>
          {usbConn && <div className="usb-notice"><span dangerouslySetInnerHTML={{__html:I.bolt}} style={{width:12,height:12,display:'inline-block'}}/>{t('dpi.ledlock')}</div>}
        </Panel>
        <Panel label={t('dpi.motion')} idx="03">
          <RowToggle label="Angle snap" sub={t('dpi.anglesnap.s')} on={state.angleSnap} onClick={()=>ctx.set({angleSnap:!state.angleSnap})}/>
          <div className="divider"></div>
          <RowToggle label="Ripple control" sub={t('dpi.ripple.s')} on={state.ripple} onClick={()=>ctx.set({ripple:!state.ripple})}/>
        </Panel>
      </div>
    </div>
  )
}

/* ===================== LIGHTING ===================== */
export function LightingSection({ctx}){
  const {state, t, lang} = ctx
  const usbConn = state.conn==='usb'
  const needsColor = ['static','breathing'].includes(state.mode)
  const hasSpeed   = ['breathing','neon','colorbreathing','breathingdpi'].includes(state.mode)
  return (
    <div className="cockpit fade-in">
      <div className="col">
        <Panel label={t('lt.modes')} idx="01" right={t('lt.count')}>
          <div className={`modes${usbConn?' usb-dim':''}`}>
            {MODES.map(m=>(
              <button key={m.id} className={'mode-card'+(state.mode===m.id?' on':'')} onClick={()=>!usbConn&&ctx.set({mode:m.id})}>
                <div className="mn"><span className="mdot"></span>{m.name}</div>
                <div className="md">{tModeDesc(m.id,lang)}</div>
              </button>
            ))}
          </div>
        </Panel>
        <div style={{padding:'4px 0'}}>
          <RowToggle label={t('lt.battoverride')} sub={t('lt.battoverride.s')} on={state.battOverride} onClick={()=>ctx.set({battOverride:!state.battOverride})}/>
        </div>
      </div>

      <div className="center-col">
        <MouseFrame caption={usbConn ? 'STATIC · USB' : (MODES.find(m=>m.id===state.mode)?.name??'Off').toUpperCase()+' · '+t('lt.preview')}>
          <MouseStage {...ctx.mouseProps} glow={usbConn ? USB_LED : ctx.mouseProps.glow} mode={usbConn ? 'static' : ctx.mouseProps.mode}/>
        </MouseFrame>
        <div className="muted" style={{fontSize:'10px',letterSpacing:'.08em',textAlign:'center',maxWidth:'280px',lineHeight:1.5}}>
          {usbConn ? '' : t('lt.note')}
        </div>
        {usbConn
          ? <div className="usb-notice" style={{justifyContent:'center',gap:'8px'}}>
              <span dangerouslySetInnerHTML={{__html:I.bolt}} style={{width:14,height:14,display:'inline-block'}}/>
              {t('lt.usblock')}
            </div>
          : <button className="btn primary lt-apply-btn" onClick={ctx.applyLighting} disabled={!ctx.connected}>
              ▶ {t('lt.apply')}
            </button>
        }
      </div>

      <div className="col">
        {needsColor && (
          <Panel label={t('lt.global')} idx="02">
            <div className={usbConn ? 'usb-dim' : ''}>
              <div className="swatches">
                {SWATCHES.map(c=>(
                  <button key={c} className={'sw'+(state.color===c?' on':'')} style={{background:c}} onClick={()=>ctx.set({color:c})}></button>
                ))}
              </div>
              <div className="row" style={{marginTop:'14px'}}>
                <span className="k">{t('lt.picker')}</span>
                <label className="btn sm" style={{cursor:'pointer'}}>
                  <span style={{width:'13px',height:'13px',borderRadius:'4px',background:state.color,display:'inline-block'}}></span>{state.color.toUpperCase()}
                  <input type="color" value={state.color} onChange={e=>ctx.set({color:e.target.value})} style={{width:0,height:0,opacity:0,position:'absolute'}}/>
                </label>
              </div>
            </div>
          </Panel>
        )}
        {hasSpeed && (
          <Panel label={t('lt.effect')} idx="03">
            <div className={usbConn ? 'usb-dim' : ''}>
              <div className="row" style={{marginBottom:'10px'}}><span className="k">{t('lt.speed')}</span><span className="v">{state.speed}×</span></div>
              <input type="range" min="1" max="10" step="1" value={state.speed} onChange={e=>ctx.set({speed:+e.target.value})}/>
              <div className="row" style={{marginTop:'6px'}}><span className="tiny">{t('lt.slow')}</span><span className="tiny">{t('lt.fast')}</span></div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}

/* ===================== KEY CAPTURE ===================== */
function KeyCapture({binding,onSet,t}){
  const [cap,setCap] = useState(false)
  const [live,setLive] = useState(null)
  useEffect(()=>{
    if(!cap) return
    const handler=(e)=>{
      e.preventDefault(); e.stopPropagation()
      const mods=[]
      if(e.ctrlKey)mods.push('Ctrl'); if(e.altKey)mods.push('Alt'); if(e.shiftKey)mods.push('Shift'); if(e.metaKey)mods.push('Super')
      const k=e.key
      const isMod=['Control','Alt','Shift','Meta','OS'].includes(k)
      const keyName=isMod?'':(k===' '?'Space':k.length===1?k.toUpperCase():k)
      setLive({mods,key:keyName})
      if(!isMod){ onSet({mods,key:keyName}); setCap(false); setTimeout(()=>setLive(null),300) }
    }
    window.addEventListener('keydown',handler,true)
    return ()=>window.removeEventListener('keydown',handler,true)
  },[cap])
  const cur = (cap&&live) || (binding&&binding.type==='shortcut'?{mods:binding.mods,key:binding.key}:null)
  const txt = cur && (cur.mods.length||cur.key) ? [...cur.mods,cur.key].filter(Boolean).join(' + ') : (cap? t('bt.capturing') : t('bt.noshortcut'))
  return (
    <div className={'keycap'+(cap?' on':'')} onClick={()=>setCap(c=>!c)}>
      <span className="keycap-d">{txt}</span>
      <span className="keycap-b">{cap?t('bt.cancel'):t('bt.capture')}</span>
    </div>
  )
}

/* ===================== BUTTONS ===================== */
export function ButtonsSection({ctx}){
  const {state, t, lang, tAct, applyBindings, connected} = ctx
  const [sel,setSel] = useState('left')
  const bd = state.bindings[sel] || {type:'native',action:'Clique Esquerdo'}
  const [tab,setTab] = useState(bd.type||'native')
  const selBtn = BUTTONS.find(b=>b.id===sel)
  const setBind = (val)=>ctx.set({bindings:{...state.bindings,[sel]:val}})
  const pick = (id)=>{ setSel(id); setTab((state.bindings[id]||{type:'native'}).type||'native') }
  const goTab = (tb)=>{ setTab(tb) }
  const dispBind = (b)=>{ if(!b) return '—'
    if(b.type==='shortcut') return [...(b.mods||[]),b.key].filter(Boolean).join(' + ')||'—'
    return tAct(b.action) }
  const typeTag = (ty)=> (ty==='shortcut'?t('bt.tab.shortcut'):t('bt.tab.native')).toUpperCase()

  return (
    <div className="cockpit fade-in">
      <div className="col">
        <Panel label={t('bt.map')} idx="01" right={t('bt.count')}>
          <div className="btnmap">
            {BUTTONS.map(b=>{
              const bb=state.bindings[b.id]
              return (
                <div key={b.id} className={'bm-row'+(sel===b.id?' sel':'')} onClick={()=>pick(b.id)}>
                  <div className="bi"><Ico n="buttons"/></div>
                  <div style={{minWidth:0}}>
                    <div className="bl">{t('btn.'+b.id)}</div>
                    <div className="bm-tag">{typeTag(bb.type)}</div>
                  </div>
                  <div className="ba" title={dispBind(bb)}>{dispBind(bb)}</div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      <div className="center-col">
        <MouseFrame caption={t('bt.hint')}>
          <MouseStage {...ctx.mouseProps} mapMode={true} activeButton={sel} positions={state.btnPos} onPick={pick}/>
        </MouseFrame>
      </div>

      <div className="col">
        <Panel label={t('bt.reassign')+' · '+t('btn.'+sel)} idx="02">
          <div className="tiny" style={{marginBottom:'8px'}}>{t('bt.current')}</div>
          <div className="row" style={{marginBottom:'14px'}}>
            <span style={{fontSize:'15px',fontFamily:'Archivo',fontWeight:700,color:'var(--live)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{dispBind(bd)}</span>
            <button className="btn sm ghost" onClick={()=>setBind({type:'native',action:selBtn.def})}><Ico n="reset"/>{t('bt.default')}</button>
          </div>
          <Seg live options={[{v:'native',l:t('bt.tab.native')},{v:'shortcut',l:t('bt.tab.shortcut')}]} value={tab} onChange={goTab}/>

          {tab==='native' && (
            <div className="act-scroll stack" style={{gap:'14px',marginTop:'14px'}}>
              {NATIVE_ACTIONS.map(grp=>(
                <div key={grp.group}>
                  <div className="tiny" style={{marginBottom:'7px'}}>{t('bt.grp.'+grp.group)}</div>
                  <div className="act-grid">
                    {grp.items.map(a=>(
                      <button key={a} className={'act'+(bd.type==='native'&&bd.action===a?' on':'')} onClick={()=>setBind({type:'native',action:a})}>{tAct(a)}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==='shortcut' && (
            <div style={{marginTop:'14px'}}>
              <KeyCapture binding={bd} onSet={(sc)=>setBind({type:'shortcut',...sc})} t={t}/>
              <div className="tiny" style={{margin:'14px 0 8px'}}>{t('bt.presets')}</div>
              <div className="act-grid">
                {SHORTCUT_PRESETS.map((p,i)=>{
                  const lbl=[...p.mods,p.key].join(' + ')
                  const on=bd.type==='shortcut'&&[...(bd.mods||[]),bd.key].join(' + ')===lbl
                  return <button key={i} className={'act'+(on?' on':'')} onClick={()=>setBind({type:'shortcut',...p})}>{lbl}</button>
                })}
              </div>
            </div>
          )}

          <div style={{marginTop:'16px',borderTop:'1px solid var(--line)',paddingTop:'14px'}}>
            <button className="btn primary lt-apply-btn" style={{width:'100%'}}
              onClick={applyBindings} disabled={!connected}>
              ▶ {t('bt.apply')}
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ===================== PERFORMANCE ===================== */
export function PerfSection({ctx}){
  const {state, t, connected, applyBindings} = ctx
  const applyPerf = ctx.applyPerf || applyBindings
  return (
    <div className="cockpit fade-in">
      <div className="col">
        <Panel label={t('pf.polling')} idx="01">
          <Seg live options={POLLING.map(p=>({v:p,l:p+'Hz'}))} value={state.polling} onChange={v=>ctx.set({polling:v})}/>
          <div className="muted" style={{fontSize:'10px',marginTop:'10px',lineHeight:1.5}}>{t('pf.polling.d')}</div>
        </Panel>
        <Panel label={t('pf.debounce')} idx="02">
          <div className="row" style={{marginBottom:'10px'}}>
            <span className="k">{t('pf.keyresp')}</span>
            <span className="v">{state.debounce} ms</span>
          </div>
          <input type="range" min="4" max="50" step="2" value={state.debounce} onChange={e=>ctx.set({debounce:+e.target.value})}/>
          <div className="row" style={{marginTop:'6px'}}>
            <span className="tiny">4ms · {t('pf.fast')}</span>
            <span className="tiny">50ms · {t('pf.safe')}</span>
          </div>
        </Panel>
        <div style={{marginTop:'4px'}}>
          <button className="btn primary lt-apply-btn" style={{width:'100%'}}
            onClick={applyPerf} disabled={!connected}>
            ▶ {t('pf.apply')}
          </button>
        </div>
      </div>

      <div className="center-col">
        <MouseFrame caption={t('sec.perf.h')}>
          <MouseStage {...ctx.mouseProps} sm={true}/>
        </MouseFrame>
        <div className="stat-grid" style={{width:'100%',maxWidth:'300px'}}>
          <div className="stat" style={{textAlign:'center'}}>
            <div className="sl">{t('pf.report')}</div>
            <div className="sv" style={{justifyContent:'center'}}>{state.polling}<small>Hz</small></div>
          </div>
          <div className="stat" style={{textAlign:'center'}}>
            <div className="sl">{t('pf.interval')}</div>
            <div className="sv" style={{justifyContent:'center'}}>{(1000/state.polling).toFixed(1)}<small>ms</small></div>
          </div>
        </div>
      </div>

      <div className="col"></div>
    </div>
  )
}


/* ===================== PROFILES ===================== */
export function ProfilesSection({ctx}){
  const {state, t, profileSave, profileLoad, profileDelete, connected} = ctx
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [loadingName, setLoadingName] = useState(null)

  const doSave = async ()=>{
    if(!newName.trim()) return
    await profileSave(newName)
    setNewName(''); setSaving(false)
  }

  const doLoad = async (name)=>{
    setLoadingName(name)
    await profileLoad(name)
    setLoadingName(null)
  }

  const doDelete = async (e, name)=>{
    e.stopPropagation()
    await profileDelete(name)
  }

  return (
    <div className="fade-in two-col">
      <Panel label={t('pr.profiles')} idx="01" right={state.profiles.length+' '+t('pr.saved')}>
        {state.profiles.length===0 && (
          <div className="muted" style={{fontSize:'11px',padding:'8px 0'}}>{t('pr.none')}</div>
        )}
        <div className="prof-list">
          {state.profiles.map((p,i)=>(
            <div key={p.name} className={'prof'+(loadingName===p.name?' loading':'')}
              onClick={()=>connected && doLoad(p.name)}
              style={{cursor:connected?'pointer':'default',opacity:connected?1:.5}}>
              <div className="pdot"></div>
              <div><div className="pn">{p.name}</div></div>
              <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                {loadingName===p.name && <span className="tiny" style={{color:'var(--live)'}}>{t('pr.loading')}</span>}
                <button className="btn sm ghost danger" onClick={e=>doDelete(e, p.name)}>
                  <Ico n="trash"/>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{marginTop:'14px'}}>
          {saving ? (
            <div style={{display:'flex',gap:'8px'}}>
              <input
                className="name-input"
                placeholder={t('pr.nameplaceh')}
                value={newName}
                autoFocus
                onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') doSave(); if(e.key==='Escape'){ setSaving(false); setNewName('') }}}
              />
              <button className="btn sm primary" onClick={doSave} disabled={!newName.trim()}>{t('pr.save')}</button>
              <button className="btn sm ghost" onClick={()=>{ setSaving(false); setNewName('') }}>✕</button>
            </div>
          ) : (
            <div style={{display:'flex',gap:'8px'}}>
              <button className="btn primary" disabled={!connected} onClick={()=>setSaving(true)}>
                <Ico n="save"/>{t('pr.savecur')}
              </button>
            </div>
          )}
        </div>
      </Panel>
      <div className="col">
        <Panel label={t('pr.persist')} idx="02">
          <div className="tiny" style={{marginBottom:'8px'}}>{t('pr.statefile')}</div>
          <div className="codebox">~/.config/opensharkx11/profiles.json</div>
          <div className="divider"></div>
          <div className="stack" style={{gap:'9px'}}>
            <div className="row"><span className="k">{t('pr.ondisk')}</span><span className="v">{state.profiles.length}</span></div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ===================== SETTINGS ===================== */
export function SettingsSection({ctx}){
  const {t, lang, setLang, accent, setAccent, theme, setTheme} = ctx
  const reset = ()=>{ setLang('pt'); setAccent('cyan'); setTheme('dark') }
  return (
    <div className="fade-in two-col">
      <div className="col">
        <Panel label={t('st.language')} idx="01" right={<span dangerouslySetInnerHTML={{__html:I.globe}} style={{width:14,height:14,display:'inline-block'}}/>}>
          <div className="tiny" style={{marginBottom:'10px'}}>{t('st.language.d')}</div>
          <div className="lang-grid">
            {[{id:'pt', label:'Português', tag:'PT-BR'},{id:'en', label:'English', tag:'EN'},{id:'zh', label:'中文', tag:'ZH'}].map(l=>(
              <button key={l.id} className={'lang-card'+(lang===l.id?' on':'')} onClick={()=>setLang(l.id)}>
                <span className="lang-tag">{l.tag}</span>
                <span className="lang-name">{l.label}</span>
                {lang===l.id && <span className="lang-check">●</span>}
              </button>
            ))}
          </div>
        </Panel>
        <Panel label={t('st.syscolor')} idx="02">
          <div className="tiny" style={{marginBottom:'12px'}}>{t('st.syscolor.d')}</div>
          <div className="accent-grid">
            {[
              {id:'cyan',c:'#2dd4ee',name:{pt:'Ciano',en:'Cyan',zh:'青色'}},
              {id:'green',c:'#4ade80',name:{pt:'Verde',en:'Green',zh:'绿色'}},
              {id:'lime',c:'#a3e635',name:{pt:'Lima',en:'Lime',zh:'青柠'}},
              {id:'orange',c:'#f5a524',name:{pt:'Laranja',en:'Orange',zh:'橙色'}},
              {id:'pink',c:'#ec4899',name:{pt:'Rosa',en:'Pink',zh:'粉色'}},
              {id:'purple',c:'#a855f7',name:{pt:'Roxo',en:'Purple',zh:'紫色'}},
              {id:'blue',c:'#3b82f6',name:{pt:'Azul',en:'Blue',zh:'蓝色'}},
            ].map(a=>(
              <button key={a.id} className={'accent'+(accent===a.id?' on':'')} onClick={()=>setAccent(a.id)} title={a.name[lang]}>
                <span className="accent-sw" style={{background:a.c,boxShadow:'0 0 10px '+a.c}}></span>
                <span className="accent-nm">{a.name[lang]}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <div className="col">
        <Panel label={t('st.appearance')} idx="03">
          <div className="row"><span className="k">{t('st.theme')}</span>
            <Seg live options={[{v:'dark',l:t('st.dark')},{v:'light',l:t('st.light')}]} value={theme} onChange={setTheme}/>
          </div>
        </Panel>
        <Panel label={t('st.about')} idx="04">
          <div className="stack" style={{gap:'9px'}}>
            <div className="row"><span className="k">{t('st.device')}</span><span className="v">Attack Shark X11</span></div>
            <div className="row"><span className="k">OpenSharkX11</span><span className="v">v{__APP_VERSION__}</span></div>
          </div>
          <div className="divider"></div>
          <button className="btn ghost danger" onClick={reset}><Ico n="reset"/>{t('st.reset')}</button>
        </Panel>
      </div>
    </div>
  )
}
