/* ============ MouseStage — interactive hero ============ */
import React, { useState, useRef } from 'react'
import { BUTTONS } from './data.jsx'

export function MouseStage({markup, glow, mode, speed, lit, sm, mapMode, activeButton, positions, onPick, onMove}){
  const cls = ['mouse-stage', `mode-${mode||'off'}`]
  if(lit) cls.push('lit')
  if(sm) cls.push('sm')
  const spd = Math.max(1, 11 - (speed||4))
  const style = {'--glow':glow||'#2dd4ee', '--spd':spd+'s'}
  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const [dragId, setDragId] = useState(null)

  const pos = (b) => (positions && positions[b.id]) || b

  const onDown = (e,b) => {
    if(!mapMode){ return }
    onPick && onPick(b.id)
    dragRef.current = b.id
    setDragId(b.id)
    try{ e.currentTarget.setPointerCapture(e.pointerId) }catch(_){}
  }
  const onMoveEvt = (e,b) => {
    if(dragRef.current !== b.id || !stageRef.current) return
    const r = stageRef.current.getBoundingClientRect()
    let x = (e.clientX - r.left)/r.width*100
    let y = (e.clientY - r.top)/r.height*100
    x = Math.max(2, Math.min(98, x)); y = Math.max(2, Math.min(98, y))
    onMove && onMove(b.id, {x:+x.toFixed(1), y:+y.toFixed(1)})
  }
  const onUp = () => { dragRef.current = null; setDragId(null) }

  return (
    <div className={cls.join(' ')} style={style} ref={stageRef}>
      <div className="mouse-glow"></div>
      <div className="mouse-art" dangerouslySetInnerHTML={{__html:markup||''}}></div>
      <div className="mouse-led"></div>
      {mapMode && (
        <div className="hotspots">
          {BUTTONS.map(b => {
            const p = pos(b)
            const sel = activeButton === b.id
            return (
              <button key={b.id}
                className={'hot'+(sel?' sel':'')+(dragId===b.id?' dragging':'')}
                style={{left:p.x+'%', top:p.y+'%', width:b.w+'px', height:b.h+'px'}}
                onPointerDown={(e)=>onDown(e,b)}
                onPointerMove={(e)=>onMoveEvt(e,b)}
                onPointerUp={onUp}
                title={b.label}>
                <span className="dot"></span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MouseFrame({children, caption}){
  return (
    <div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center'}}>
      <span className="corner tl"></span><span className="corner tr"></span>
      <span className="corner bl"></span><span className="corner br"></span>
      {children}
      {caption && <div className="tiny" style={{marginTop:'2px'}}>{caption}</div>}
    </div>
  )
}
