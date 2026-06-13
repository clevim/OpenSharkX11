import './style.css'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

// ─── constantes / catálogos ──────────────────────────────────────────────
const TEMPLATES = {
  'Mouse': {
    'global-left-click':'Clique esquerdo','global-right-click':'Clique direito','global-middle':'Clique do meio',
    'global-forward':'Avançar','global-backward':'Voltar','global-double-click':'Duplo clique',
    'global-fire-button':'Botão de fogo','global-easy-aim':'Easy aim (DPI reduzido)','global-disable-button':'Desativar',
    'global-scroll-up':'Rolar ↑','global-scroll-down':'Rolar ↓',
  },
  'DPI': {'global-dpi-cycle':'Ciclar DPI','global-dpi-+':'DPI +','global-dpi--':'DPI −'},
  'Mídia': {
    'multimedia-play-pause':'Play/Pause','multimedia-next-track':'Próxima','multimedia-previous-track':'Anterior',
    'multimedia-stop-music':'Parar','multimedia-volume-+':'Vol +','multimedia-volume--':'Vol −',
    'multimedia-mute':'Mudo','multimedia-media-player':'Abrir player',
  },
  'Navegador': {
    'browser-backward':'Voltar','browser-forward':'Avançar','browser-refresh':'Recarregar','browser-home':'Início',
    'browser-search':'Buscar','browser-email':'E-mail','browser-calculator':'Calculadora',
  },
  'Atalhos': {
    'shortcut-copy':'Copiar','shortcut-paste':'Colar','shortcut-cut':'Recortar','shortcut-select-all':'Selecionar tudo',
    'shortcut-undo':'Desfazer','shortcut-redo':'Refazer','shortcut-save':'Salvar','shortcut-find':'Buscar',
    'shortcut-swap-window':'Alt+Tab','shortcut-close-window':'Fechar janela','shortcut-show-desktop':'Desktop',
    'shortcut-lock-pc':'Bloquear PC','shortcut-screen-capture':'Captura de tela',
  },
}
const tplLabel = (n) => { for (const cat of Object.values(TEMPLATES)) if (cat[n]) return cat[n]; return n }
const BTN_NAMES = { left:'Esquerdo', right:'Direito', middle:'Scroll', forward:'Avançar', backward:'Voltar', dpi:'DPI', scrollUp:'Scroll ↑', scrollDown:'Scroll ↓' }
const MOD_BITS = { ControlLeft:1,ControlRight:1,ShiftLeft:2,ShiftRight:2,AltLeft:4,AltRight:4,MetaLeft:8,MetaRight:8 }
const MOD_LABEL = (m) => [m&1&&'Ctrl',m&2&&'Shift',m&4&&'Alt',m&8&&'⊞'].filter(Boolean)
const HID = (() => {
  const m = {Enter:0x28,Escape:0x29,Backspace:0x2a,Tab:0x2b,Space:0x2c,Minus:0x2d,Equal:0x2e,BracketLeft:0x2f,BracketRight:0x30,
    Backslash:0x31,Semicolon:0x33,Quote:0x34,Backquote:0x35,Comma:0x36,Period:0x37,Slash:0x38,CapsLock:0x39,
    PrintScreen:0x46,ScrollLock:0x47,Pause:0x48,Insert:0x49,Home:0x4a,PageUp:0x4b,Delete:0x4c,End:0x4d,PageDown:0x4e,
    ArrowRight:0x4f,ArrowLeft:0x50,ArrowDown:0x51,ArrowUp:0x52,NumLock:0x53,NumpadDivide:0x54,NumpadMultiply:0x55,
    NumpadSubtract:0x56,NumpadAdd:0x57,NumpadEnter:0x58,NumpadDecimal:0x63,ContextMenu:0x65}
  for (let i=0;i<26;i++) m['Key'+String.fromCharCode(65+i)]=0x04+i
  for (let i=1;i<=9;i++) m['Digit'+i]=0x1e+i-1; m.Digit0=0x27
  for (let i=1;i<=12;i++) m['F'+i]=0x3a+i-1
  for (let i=1;i<=9;i++) m['Numpad'+i]=0x59+i-1; m.Numpad0=0x62
  return m
})()
const HID_NAME = Object.fromEntries(Object.entries(HID).map(([k,v])=>[v,k.replace(/^Key|^Digit/,'')]))
const LIGHT_MODES = [[0x00,'Off (desligado)'],[0x10,'Estático'],[0x20,'Respiração'],[0x30,'Neon'],[0x40,'Respiração colorida'],[0x50,'DPI estático'],[0x60,'DPI respiração']]
const BREATHING_MODES = new Set([0x20,0x30,0x40,0x60])
const DEFAULT_BTNS = {
  left:{type:'template',template:'global-left-click'},right:{type:'template',template:'global-right-click'},
  middle:{type:'template',template:'global-middle'},forward:{type:'template',template:'global-forward'},
  backward:{type:'template',template:'global-backward'},dpi:{type:'template',template:'global-dpi-cycle'},
  scrollUp:{type:'template',template:'global-scroll-up'},scrollDown:{type:'template',template:'global-scroll-down'},
}
const SWATCHES = [
  '#ff0000','#ff6600','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ffffff', // primárias puras
  '#ff4444','#ff9933','#ccff00','#00ff88','#00ccff','#6644ff','#ff44cc','#aaaaaa', // variações vivas
]

// ─── estado ──────────────────────────────────────────────────────────────
const api = window.api
let config = null, applied = null, dirty = false
let connected = false, connMode = null
let selBtn = null, kbCaptured = null, recording = false, lastRecTs = 0
let selSection = 'dpi'
let selStage = 0
let batteryPct = null

const deep = (o) => JSON.parse(JSON.stringify(o))

// ─── helpers ──────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const h = (tag, cls, inner='') => { const el = document.createElement(tag); el.className=cls; el.innerHTML=inner; return el }

function toast(msg, err=false) {
  const t = document.createElement('div')
  t.className = 'toast' + (err?' err':'')
  t.textContent = msg
  $('#toasts').append(t)
  setTimeout(() => t.remove(), 3600)
}
function sonar() {
  const r = document.createElement('div')
  r.className = 'sonar-ring'
  document.body.append(r)
  setTimeout(() => r.remove(), 900)
}
function markDirty() {
  dirty = JSON.stringify(config) !== JSON.stringify(applied)
  $('#apply-bar').classList.toggle('show', dirty)
}

function rgbToHex({r,g,b}) { return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('') }
function hexToRgb(h) { return {r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)} }

function setAccentColor(rgb) {
  const {r,g,b} = rgb
  const hex = rgbToHex(rgb)
  // luminância — mantém acento legível
  const lum = 0.299*r + 0.587*g + 0.114*b
  const acc = lum < 30 ? '#5be3d2' : hex
  document.documentElement.style.setProperty('--acc', acc)
  document.documentElement.style.setProperty('--acc-glow', `rgba(${r},${g},${b},.16)`)
  document.documentElement.style.setProperty('--acc-dim', `rgba(${r},${g},${b},.22)`)
  // brilho no diagrama do mouse
  const svg = document.querySelector('#mouse-svg')
  if (svg) svg.style.filter = `drop-shadow(0 0 22px rgba(${r},${g},${b},.35))`
}

// ─── render do diagrama do mouse ──────────────────────────────────────────
function buildMouseSvg() {
  return `<svg id="mouse-svg" viewBox="0 0 240 330" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="var(--bg3)"/>
      <stop offset="100%" stop-color="var(--bg1)"/>
    </linearGradient>
    <radialGradient id="led-grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--acc)" stop-opacity="1"/>
      <stop offset="100%" stop-color="var(--acc)" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
  </defs>

  <!-- corpo assimétrico — X11 é mouse para destros: lado direito mais largo -->
  <!-- vista de cima: lado esquerdo levemente côncavo (zona do polegar), direito convexo -->
  <path d="
    M 78 8
    L 100 8
    C 101 8 103 9 104 12
    L 110 28
    L 116 28
    L 122 12
    C 123 9 125 8 126 8
    L 155 8
    C 192 8 212 34 214 68
    L 216 195
    C 217 262 198 310 168 320
    C 144 328 100 328 76 320
    C 46 310 26 262 27 195
    L 29 130
    C 27 108 26 92 32 78
    C 40 58 58 8 78 8 Z"
    fill="url(#mg)" stroke="var(--line2)" stroke-width="1.5"/>

  <!-- botão esquerdo principal -->
  <path class="btn-zone" data-btn="left"
    d="M 78 8 L 100 8 C 101 8 103 9 104 12 L 110 28 L 112 28
       L 112 128 C 88 128 58 124 34 116 L 32 78 C 40 58 58 8 78 8 Z"
    fill="var(--bg3)" stroke="none" opacity=".5"/>

  <!-- botão direito principal -->
  <path class="btn-zone" data-btn="right"
    d="M 155 8 L 126 8 C 125 8 123 9 122 12 L 116 28 L 112 28
       L 112 128 C 140 128 174 124 208 113 L 214 68 C 212 34 192 8 155 8 Z"
    fill="var(--bg3)" stroke="none" opacity=".5"/>

  <!-- divisória central (scroll → linha dos botões) -->
  <line x1="112" y1="28" x2="112" y2="128" stroke="var(--line2)" stroke-width="1.5"/>
  <!-- linha inferior que separa a área dos cliques do corpo -->
  <path d="M 33 118 C 72 136 158 136 208 118" stroke="var(--line2)" stroke-width="1.2" fill="none"/>

  <!-- scroll wheel -->
  <rect class="btn-zone" data-btn="middle" x="97" y="24" width="30" height="72" rx="14"
        fill="var(--bg)" stroke="var(--line2)" stroke-width="1.2"/>
  <line x1="98"  y1="38"  x2="126" y2="38"  stroke="var(--line2)" stroke-width=".9"/>
  <line x1="98"  y1="45"  x2="126" y2="45"  stroke="var(--line2)" stroke-width=".9"/>
  <line x1="98"  y1="52"  x2="126" y2="52"  stroke="var(--line2)" stroke-width=".9"/>
  <line x1="98"  y1="59"  x2="126" y2="59"  stroke="var(--line2)" stroke-width=".9"/>
  <line x1="98"  y1="66"  x2="126" y2="66"  stroke="var(--line2)" stroke-width=".9"/>
  <line x1="98"  y1="73"  x2="126" y2="73"  stroke="var(--line2)" stroke-width=".9"/>
  <line x1="98"  y1="80"  x2="126" y2="80"  stroke="var(--line2)" stroke-width=".9"/>
  <line x1="98"  y1="87"  x2="126" y2="87"  stroke="var(--line2)" stroke-width=".9"/>

  <!-- setas scroll up / down (hitbox discreta acima/abaixo da roda) -->
  <path class="btn-zone" data-btn="scrollUp"
    d="M 112 13 l 9 11 h-18 Z" fill="var(--acc)" opacity=".22"/>
  <path class="btn-zone" data-btn="scrollDown"
    d="M 112 116 l 9 -11 h-18 Z" fill="var(--acc)" opacity=".22"/>

  <!-- botão DPI — abaixo da roda, no centro -->
  <rect class="btn-zone" data-btn="dpi" x="101" y="134" width="22" height="12" rx="5"
        fill="var(--bg)" stroke="var(--line2)" stroke-width="1"/>

  <!-- botões laterais esquerda (polegar) — dois botões bem definidos -->
  <!-- forward (frente / superior) -->
  <rect class="btn-zone" data-btn="forward"
    x="18" y="130" width="14" height="42" rx="7"
    fill="var(--bg2,#1e1e2a)" stroke="var(--line2)" stroke-width="1.3"
    transform="rotate(-4 25 151)"/>
  <!-- backward (trás / inferior) -->
  <rect class="btn-zone" data-btn="backward"
    x="17" y="178" width="14" height="42" rx="7"
    fill="var(--bg2,#1e1e2a)" stroke="var(--line2)" stroke-width="1.3"
    transform="rotate(-7 24 199)"/>

  <!-- LED central — círculo com brilho irradiante -->
  <circle cx="122" cy="190" r="11" fill="url(#led-grad)" opacity=".18" id="led-halo" filter="url(#glow)"/>
  <circle cx="122" cy="190" r="6"  fill="var(--acc)" opacity=".7"  id="led-el"/>
  <circle cx="122" cy="190" r="6"  fill="var(--acc)" opacity=".85" filter="url(#glow)" id="led-glow"/>
</svg>`
}

// ─── template HTML completo ────────────────────────────────────────────────
function buildShell() {
  document.getElementById('app').innerHTML = `
<div id="titlebar">
  <div class="logo">
    <svg viewBox="0 0 256 256" fill="none">
      <path d="M128 30 C150 30 168 84 176 148 C180 182 174 208 156 208 C144 208 134 197 128 180 C122 197 112 208 100 208 C82 208 76 182 80 148 C88 84 106 30 128 30 Z" fill="currentColor"/>
      <path d="M48 206 C76 218 100 222 128 222 C156 222 180 218 208 206" stroke="currentColor" stroke-width="14" fill="none" stroke-linecap="round" opacity=".5"/>
    </svg>
    SharkCtl
  </div>
  <div class="titlebar-spacer"></div>
  <div class="win-btns">
    <button class="win-btn" id="wb-min" title="Minimizar" aria-label="Minimizar">
      <svg viewBox="0 0 12 12" width="12" height="12"><rect x="2" y="5.5" width="8" height="1.4" fill="currentColor"/></svg>
    </button>
    <button class="win-btn" id="wb-max" title="Maximizar" aria-label="Maximizar">
      <svg viewBox="0 0 12 12" width="11" height="11"><rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
    </button>
    <button class="win-btn close" id="wb-close" title="Fechar" aria-label="Fechar">
      <svg viewBox="0 0 12 12" width="12" height="12">
        <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</div>

<div id="shell">
  <aside id="sidebar">
    <div id="mouse-diagram">
      <h2>Attack Shark X11</h2>
      ${buildMouseSvg()}
      <p class="mouse-hint">Clique em um botão<br>para configurar</p>
    </div>
    <nav id="sidebar-nav">
      <div class="nav-section-label">Configuração</div>
      <button class="nav-btn active" data-section="dpi">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        DPI &amp; Sensor
      </button>
      <button class="nav-btn" data-section="light">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 0 1 5 5c0 3-2 5-5 8-3-3-5-5-5-8a5 5 0 0 1 5-5z"/><path d="M12 15v7M9 18h6"/></svg>
        Iluminação RGB
      </button>
      <button class="nav-btn" data-section="perf">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Desempenho
      </button>
      <button class="nav-btn" data-section="power">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
        Energia
      </button>
      <div class="nav-section-label">Entradas</div>
      <button class="nav-btn" data-section="buttons">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M8 4v16M2 12h20"/></svg>
        Botões
      </button>
      <button class="nav-btn" data-section="macro">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        Macro
      </button>
      <div class="nav-section-label">Sistema</div>
      <button class="nav-btn" data-section="profiles">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Perfis
      </button>
    </nav>
    <div id="sidebar-footer">
      <div class="conn-badge">
        <span class="conn-dot" id="conn-dot"></span>
        <span id="conn-txt">desconectado</span>
      </div>
      <div id="batt-bar-wrap" hidden>
        <div class="batt-shell"><div class="batt-fill" id="batt-fill"></div></div>
        <span id="batt-txt" style="font-family:var(--font-mono);font-size:.75rem;color:var(--dim)">--%</span>
      </div>
    </div>
  </aside>

  <div id="content" style="position:relative">
    <div id="panel-header">
      <div>
        <div id="panel-title">DPI &amp; Sensor</div>
        <div id="panel-sub">Configure os estágios de sensibilidade e comportamento do sensor</div>
      </div>
      <div class="hdr-spacer"></div>
      <div id="panel-status"></div>
    </div>
    <div id="panel-body"></div>

    <!-- tela de conexão -->
    <div id="connect-screen">
      <div class="conn-screen-inner">
        <div class="conn-logo">Shark<span>Ctl</span></div>
        <div class="conn-desc">Conecte o mouse para começar</div>
        <div class="conn-cards">
          <button class="conn-card" id="cc-wireless">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            <div class="conn-card-label">2.4 GHz</div>
            <div class="conn-card-sub">Adaptador sem fio</div>
          </button>
          <button class="conn-card" id="cc-wired">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M17 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M17 18H3"/></svg>
            <div class="conn-card-label">USB</div>
            <div class="conn-card-sub">Cabo com fio</div>
          </button>
        </div>
        <div class="conn-error" id="conn-error" hidden></div>
      </div>
    </div>
  </div>
</div>

<div id="apply-bar">
  <span class="msg">Alterações pendentes — clique em Aplicar para enviar ao mouse</span>
  <button class="btn" id="discard-btn">Descartar</button>
  <button class="btn primary" id="apply-btn">Aplicar no mouse</button>
</div>

<div id="toasts"></div>
`
}

// ─── painéis ────────────────────────────────────────────────────────────
const SECTION_META = {
  dpi:      ['DPI & Sensor',      'Configure os estágios de sensibilidade e comportamento do sensor'],
  light:    ['Iluminação RGB',     'Modos de luz, cor e velocidade de efeito'],
  perf:     ['Desempenho',         'Taxa de pooling e tempo de resposta dos cliques'],
  power:    ['Energia',            'Temporizadores de suspensão e leitura de bateria'],
  buttons:  ['Botões',             'Remapeie cada botão do mouse'],
  macro:    ['Macro',              'Grave sequências de teclas e atribua a um botão'],
  profiles: ['Perfis',             'Salve e restaure combinações completas de configuração'],
}

function renderSection(name) {
  const [title, sub] = SECTION_META[name]
  $('#panel-title').innerHTML = title
  $('#panel-sub').textContent = sub
  const body = $('#panel-body'); body.innerHTML = ''

  const panels = {
    dpi: renderDpi, light: renderLight, perf: renderPerf,
    power: renderPower, buttons: renderButtons, macro: renderMacro, profiles: renderProfiles,
  }
  panels[name]?.()
}

// ── DPI ──
function renderDpi() {
  const body = $('#panel-body')
  body.innerHTML = ''
  const card1 = h('div', 'card', `<div class="card-title">Estágios — clique no número para ativar</div><div id="dpi-stages"></div>`)
  const card2 = h('div', 'card')
  card2.innerHTML = `<div class="card-title">Sensor</div>
    <div class="field"><span class="field-label">Angle snap</span>
      <label class="sw"><input type="checkbox" id="angle-snap"><i></i></label>
      <span style="font-size:.78rem;color:var(--dim)">corrige traços retos</span></div>
    <div class="field"><span class="field-label">Ripple control</span>
      <label class="sw"><input type="checkbox" id="ripple-ctrl"><i></i></label>
      <span style="font-size:.78rem;color:var(--dim)">filtra jitter em DPI alto</span></div>`
  body.append(card1, card2)

  // stages
  const stages = card1.querySelector('#dpi-stages')
  config.dpi.values.forEach((v, i) => {
    const row = h('div', 'dpi-stage' + (config.dpi.activeStage===i?' active':''))
    const dotColor = config.lighting && config.lighting.stageColors ? rgbToHex(config.lighting.stageColors[i]) : 'var(--acc)'
    row.innerHTML = `<button class="stage-num" title="Definir como ativo">${i+1}</button>
      <span class="stage-dot-mini" style="background:${dotColor}" title="Cor do estágio ${i+1}"></span>
      <input type="range" min="50" max="22000" step="50" value="${v}">
      <span class="stage-val">${v.toLocaleString('pt-BR')}</span>`
    row.querySelector('.stage-num').onclick = () => {
      config.dpi.activeStage = i
      const isDpiLinked = config.lighting.mode === 0x50 || config.lighting.mode === 0x60
      if (isDpiLinked && config.lighting.stageColors?.[i]) setAccentColor(config.lighting.stageColors[i])
      renderSection('dpi'); markDirty()
    }
    row.querySelector('.stage-dot-mini').onclick = () => { selStage = i; switchSection('light') }
    const sl = row.querySelector('input')
    sl.oninput = () => { config.dpi.values[i]=+sl.value; row.querySelector('.stage-val').textContent=(+sl.value).toLocaleString('pt-BR'); markDirty() }
    stages.append(row)
  })

  $('#angle-snap').checked = config.dpi.angleSnap
  $('#ripple-ctrl').checked = config.dpi.rippleControl
  $('#angle-snap').onchange = e => { config.dpi.angleSnap=e.target.checked; markDirty() }
  $('#ripple-ctrl').onchange = e => { config.dpi.rippleControl=e.target.checked; markDirty() }
}

// ── Iluminação ──
function renderLight() {
  const body = $('#panel-body')
  body.innerHTML = ''
  const lt = config.lighting
  const isDpi = lt.mode === 0x50 || lt.mode === 0x60
  const isOff = lt.mode === 0x00

  // Cartão 1: Modo de animação
  const modeCard = h('div', 'card')
  modeCard.innerHTML = `<div class="card-title">Modo de animação</div>
    <div class="light-mode-grid" id="light-chips"></div>
    <div class="light-preview-bar${isOff ? '' : (BREATHING_MODES.has(lt.mode) ? ' breathing' : '')}" id="lp"></div>`
  body.append(modeCard)

  // Chips de modo
  const chips = modeCard.querySelector('#light-chips')
  LIGHT_MODES.forEach(([val, label]) => {
    const on = lt.mode === val
    const b = h('button', 'light-mode-chip' + (on ? ' on' : ''))
    b.innerHTML = `<span class="lmc-dot" style="background:${on && !isOff ? rgbToHex(isDpi ? (lt.stageColors[selStage] ?? lt.stageColors[0]) : lt.globalColor) : 'var(--line2)'}"></span>${label}`
    b.onclick = () => { lt.mode = val; renderLight(); markDirty() }
    chips.append(b)
  })

  // Atualizar preview bar
  if (!isOff) {
    const lp = modeCard.querySelector('#lp')
    const c = isDpi ? (lt.stageColors[selStage] ?? lt.stageColors[0]) : lt.globalColor
    lp.style.setProperty('--pc', rgbToHex(c))
    lp.style.background = `linear-gradient(90deg, ${rgbToHex(c)}, rgba(${c.r},${c.g},${c.b},.15))`
  }

  // Cartão 2: Cor
  if (!isOff) {
    const colorCard = h('div', 'card')
    body.append(colorCard)

    if (isDpi) {
      // Seletor de cor por estágio
      colorCard.innerHTML = `<div class="card-title">Cores por estágio DPI</div>
        <div class="stage-colors-row" id="sc-row"></div>
        <div id="sc-editor"></div>`

      const row = colorCard.querySelector('#sc-row')
      lt.stageColors.forEach((c, i) => {
        const btn = h('button', 'stage-color-btn' + (selStage === i ? ' sel' : ''))
        btn.innerHTML = `<span style="background:${rgbToHex(c)};width:28px;height:28px;border-radius:50%;display:block;margin:0 auto 4px;border:2px solid ${selStage===i?'var(--acc)':'transparent'}"></span><span style="font-size:.65rem;font-family:var(--font-display)">${i+1}</span>`
        btn.onclick = () => { selStage = i; renderLight() }
        row.append(btn)
      })

      buildStageColorEditor(colorCard.querySelector('#sc-editor'), lt.stageColors[selStage], selStage)
    } else {
      // Seletor de cor global
      const gc = lt.globalColor
      colorCard.innerHTML = `<div class="card-title">Cor ${lt.mode === 0x30 || lt.mode === 0x40 ? '(base da animação)' : ''}</div>
        <div class="field">
          <input type="color" id="rgb-pick" value="${rgbToHex(gc)}">
          <div class="swatches" id="swatches"></div>
        </div>
        <div class="field">
          <span class="field-label" style="min-width:20px">R</span>
          <input type="number" id="rc" min="0" max="255" value="${gc.r}" style="width:70px">
          <span class="field-label" style="min-width:20px">G</span>
          <input type="number" id="gc-i" min="0" max="255" value="${gc.g}" style="width:70px">
          <span class="field-label" style="min-width:20px">B</span>
          <input type="number" id="bc" min="0" max="255" value="${gc.b}" style="width:70px">
        </div>`

      // swatches
      const sw = colorCard.querySelector('#swatches')
      SWATCHES.forEach(c => {
        const d = h('div','swatch'); d.style.background=c; d.title=c
        d.onclick = () => { lt.globalColor=hexToRgb(c); renderLight(); setAccentColor(lt.globalColor); markDirty() }
        sw.append(d)
      })

      colorCard.querySelector('#rgb-pick').oninput = e => {
        lt.globalColor = hexToRgb(e.target.value)
        syncRgbInputs(); setAccentColor(lt.globalColor); updateLightPreview(); markDirty()
      }
      const syncFromNums = () => {
        lt.globalColor = {r:+$('#rc').value||0, g:+$('#gc-i').value||0, b:+$('#bc').value||0}
        $('#rgb-pick').value = rgbToHex(lt.globalColor)
        setAccentColor(lt.globalColor); updateLightPreview(); markDirty()
      }
      ;['#rc','#gc-i','#bc'].forEach(id => { const el = colorCard.querySelector(id); if(el) el.oninput = syncFromNums })
      setAccentColor(gc)
    }
  }

  // Indicador de override de bateria
  if (batteryPct !== null && batteryPct < 30) {
    const ovr = h('div', 'batt-override-notice')
    ovr.innerHTML = batteryPct < 15
      ? `<span>⚡ Bateria crítica (${batteryPct}%) — LED forçado para vermelho até carregar</span>`
      : `<span>⚡ Bateria baixa (${batteryPct}%) — LED forçado para laranja até ≥ 30%</span>`
    body.append(ovr)
  }

  // Cartão 3: Velocidade (quando há animação)
  if (!isOff && lt.mode !== 0x10 && lt.mode !== 0x50) {
    const spdCard = h('div', 'card')
    spdCard.innerHTML = `<div class="card-title">Velocidade da animação</div>
      <div class="field">
        <span style="font-size:.76rem;color:var(--dim);min-width:50px">Lento</span>
        <input type="range" id="led-spd" min="1" max="5" step="1" value="${lt.ledSpeed}">
        <span style="font-size:.76rem;color:var(--dim);min-width:50px;text-align:right">Rápido</span>
        <span class="field-val" id="led-spd-v" style="min-width:18px;text-align:center">${lt.ledSpeed}</span>
      </div>`
    body.append(spdCard)
    spdCard.querySelector('#led-spd').oninput = e => {
      lt.ledSpeed = +e.target.value
      spdCard.querySelector('#led-spd-v').textContent = e.target.value
      markDirty()
    }
  }

  // Atualiza o LED do diagrama e a barra de preview para o modo atual
  updateLightPreview()
}

function buildStageColorEditor(container, color, stageIdx) {
  container.innerHTML = `
    <div class="stage-editor-inner">
      <div style="font-family:var(--font-display);font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);margin:14px 0 10px">Estágio ${stageIdx + 1}</div>
      <div class="field">
        <input type="color" id="sc-pick" value="${rgbToHex(color)}">
        <div class="swatches" id="sc-swatches"></div>
      </div>
      <div class="field">
        <span class="field-label" style="min-width:20px">R</span>
        <input type="number" id="sc-r" min="0" max="255" value="${color.r}" style="width:70px">
        <span class="field-label" style="min-width:20px">G</span>
        <input type="number" id="sc-g" min="0" max="255" value="${color.g}" style="width:70px">
        <span class="field-label" style="min-width:20px">B</span>
        <input type="number" id="sc-b" min="0" max="255" value="${color.b}" style="width:70px">
      </div>
    </div>`

  const sw = container.querySelector('#sc-swatches')
  SWATCHES.forEach(c => {
    const d = h('div','swatch'); d.style.background=c
    d.onclick = () => {
      config.lighting.stageColors[stageIdx] = hexToRgb(c)
      renderLight(); markDirty()
    }
    sw.append(d)
  })

  container.querySelector('#sc-pick').oninput = e => {
    config.lighting.stageColors[stageIdx] = hexToRgb(e.target.value)
    syncStageInputs(container, stageIdx); updateLightPreview(); markDirty()
  }

  const syncStage = () => {
    const r = +container.querySelector('#sc-r').value||0
    const g = +container.querySelector('#sc-g').value||0
    const b = +container.querySelector('#sc-b').value||0
    config.lighting.stageColors[stageIdx] = {r,g,b}
    container.querySelector('#sc-pick').value = rgbToHex({r,g,b})
    updateLightPreview(); markDirty()
  }
  ;['#sc-r','#sc-g','#sc-b'].forEach(id => { const el = container.querySelector(id); if(el) el.oninput = syncStage })
}

function syncStageInputs(container, idx) {
  const c = config.lighting.stageColors[idx]
  const pick = container.querySelector('#sc-pick'); if(pick) pick.value = rgbToHex(c)
  const r = container.querySelector('#sc-r'), g = container.querySelector('#sc-g'), b = container.querySelector('#sc-b')
  if(r){r.value=c.r;g.value=c.g;b.value=c.b}
}

function syncRgbInputs() {
  const rgb = config.lighting.globalColor
  const pick = $('#rgb-pick'); if(pick) pick.value = rgbToHex(rgb)
  const rc=$('#rc'),gc=$('#gc-i'),bc=$('#bc')
  if(rc){rc.value=rgb.r;gc.value=rgb.g;bc.value=rgb.b}
}

function updateLightPreview() {
  const lp = $('#lp')
  const lt = config.lighting
  const off = lt.mode === 0x00
  const isDpi = lt.mode === 0x50 || lt.mode === 0x60
  const c = isDpi ? (lt.stageColors[selStage] ?? lt.stageColors[0]) : lt.globalColor
  if (lp) {
    if (off) {
      lp.style.background = 'var(--line2)'
      lp.classList.remove('breathing')
    } else {
      const {r,g,b} = c
      lp.style.background = `linear-gradient(90deg, rgb(${r},${g},${b}), rgba(${r},${g},${b},.15))`
      lp.classList.toggle('breathing', BREATHING_MODES.has(lt.mode))
    }
  }
  const ledEl = $('#led-glow'), ledEl2 = $('#led-el'), ledHalo = $('#led-halo')
  if (ledEl) {
    const fillColor = off || !c ? '#444' : rgbToHex(c)
    ledEl.setAttribute('fill', fillColor)
    ledEl.setAttribute('opacity', off ? '0' : '.85')
    ledEl2?.setAttribute('fill', fillColor)
    ledEl2?.setAttribute('opacity', off ? '0' : '.7')
    ledHalo?.setAttribute('opacity', off ? '0' : '.22')
  }
  if (!off && c) setAccentColor(c)
}

// ── Desempenho ──
function renderPerf() {
  const body = $('#panel-body')
  body.innerHTML = ''
  const card = h('div','card')
  card.innerHTML = `<div class="card-title">Polling rate</div>
    <div class="chips" id="rate-chips"></div>
    <div class="card-title" style="margin-top:18px">Tempo de resposta dos cliques</div>
    <div class="field">
      <input type="range" id="key-resp" min="4" max="50" step="2" value="${config.performance.keyResponse}">
      <span class="field-val" id="kr-v">${config.performance.keyResponse} ms</span>
    </div>
    <div style="font-size:.76rem;color:var(--dim);margin-top:4px">Debounce do clique — menor é mais rápido; maior evita duplo-clique involuntário.</div>`
  body.append(card)

  const rchips = card.querySelector('#rate-chips')
  ;[125,250,500,1000].forEach(r => {
    const b = h('button','chip'+(config.pollingRate===r?' on':''))
    b.innerHTML = `${r} <span style="font-size:.7em">Hz</span>`
    b.onclick = () => { config.pollingRate=r; renderPerf(); markDirty() }
    rchips.append(b)
  })
  card.querySelector('#key-resp').oninput = e => { config.performance.keyResponse=+e.target.value; card.querySelector('#kr-v').textContent=e.target.value+' ms'; markDirty() }
}

// ── Energia ──
function renderPower() {
  const body = $('#panel-body')
  body.innerHTML = ''
  const card = h('div','card')
  card.innerHTML = `<div class="card-title">Suspensão (sem fio)</div>
    <div class="field"><span class="field-label">Dormir após</span>
      <input type="range" id="sleep" min="0.5" max="30" step="0.5" value="${config.power.sleepTime}">
      <span class="field-val" id="sl-v">${config.power.sleepTime} min</span></div>
    <div class="field"><span class="field-label">Sono profundo após</span>
      <input type="range" id="deep-sleep" min="1" max="60" step="1" value="${config.power.deepSleepTime}">
      <span class="field-val" id="ds-v">${config.power.deepSleepTime} min</span></div>
    <div class="card-title" style="margin-top:18px">Bateria</div>
    <div class="field">
      <span id="batt-big" style="font-family:var(--font-display);font-size:2.2rem;font-weight:700">--%</span>
      <button class="btn" id="batt-refresh">Atualizar</button>
    </div>
    <div style="font-size:.76rem;color:var(--dim)">Leitura disponível apenas no modo sem fio (2.4GHz).</div>`
  body.append(card)

  card.querySelector('#sleep').oninput = e => { config.power.sleepTime=+e.target.value; card.querySelector('#sl-v').textContent=e.target.value+' min'; markDirty() }
  card.querySelector('#deep-sleep').oninput = e => { config.power.deepSleepTime=+e.target.value; card.querySelector('#ds-v').textContent=e.target.value+' min'; markDirty() }
  card.querySelector('#batt-refresh').onclick = refreshBattery
  refreshBattery()
}

// ── Botões ──
function renderButtons() {
  const body = $('#panel-body')
  body.innerHTML = ''
  const card = h('div','card')
  card.innerHTML = `<div class="card-title">Mapeamento</div><div class="bind-grid" id="bind-grid"></div>
    <div id="bind-editor" style="display:none"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
      <span style="font-size:.8rem;color:var(--dim);flex:1">Restaurar todos os botões ao padrão de fábrica</span>
      <button class="btn danger" id="reset-all-btns">Resetar todos</button>
    </div>`
  body.append(card)

  renderBindings()
  card.querySelector('#reset-all-btns').onclick = () => {
    config.buttons = deep(DEFAULT_BTNS); renderBindings(); markDirty()
    toast('Todos os botões restaurados ao padrão.')
  }
}

function bindingLabel(b) {
  if (!b) return '—'
  if (b.type === 'keyboard') return [...MOD_LABEL(b.modifiers||0), HID_NAME[b.keyCode]||'??'].join('+')
  return tplLabel(b.template)
}

function renderBindings() {
  const grid = $('#bind-grid'); if(!grid) return; grid.innerHTML=''
  for (const [key, label] of Object.entries(BTN_NAMES)) {
    const card = h('button','bind-card'+(selBtn===key?' sel':''))
    card.innerHTML = `<div class="bind-name">${label}</div><div class="bind-val">${bindingLabel(config.buttons[key])}</div>`
    card.onclick = () => openBindEditor(key)
    grid.append(card)
  }
  $$('.btn-zone, .btn-zone').forEach(el => el.classList.toggle('sel', el.dataset.btn === selBtn))
}

function openBindEditor(key) {
  selBtn = key
  renderBindings()
  // vai para a aba de botões se necessário
  if (selSection !== 'buttons') switchSection('buttons')
  const ed = $('#bind-editor'); if(!ed) return
  const b = config.buttons[key] || {type:'template',template:'global-left-click'}
  ed.style.display = ''
  ed.innerHTML = `
    <div class="bind-editor">
      <div style="font-family:var(--font-display);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);margin-bottom:14px">
        Configurar: ${BTN_NAMES[key]}
      </div>
      <div class="bind-segs">
        <button class="bind-seg${b.type!=='keyboard'?' on':''}" data-type="template">Função pronta</button>
        <button class="bind-seg${b.type==='keyboard'?' on':''}" data-type="keyboard">Atalho</button>
      </div>
      <div id="be-tpl-area" ${b.type==='keyboard'?'style="display:none"':''}>
        <div class="field">
          <span class="field-label">Categoria</span>
          <select id="be-cat"></select>
          <select id="be-tpl"></select>
        </div>
      </div>
      <div id="be-kb-area" ${b.type!=='keyboard'?'style="display:none"':''}>
        <div class="field">
          <span class="field-label">Combinação</span>
          <button id="kbCapture" style="${b.type==='keyboard'?'':'display:none'}">${b.type==='keyboard' ? bindingLabel(b) : 'clique e pressione…'}</button>
        </div>
      </div>
      <div class="field" style="margin-top:14px;gap:8px">
        <button class="btn primary" id="be-save">Definir</button>
        <button class="btn" id="be-cancel">Cancelar</button>
        <button class="btn danger" id="be-reset-one" style="margin-left:auto">Restaurar padrão</button>
      </div>
    </div>`

  // preencher cats/tpl
  const catSel = ed.querySelector('#be-cat')
  Object.keys(TEMPLATES).forEach(c => { const o = document.createElement('option'); o.value=c; o.textContent=c; catSel.append(o) })
  let curCat = Object.keys(TEMPLATES).find(c => TEMPLATES[c][b.template]) || Object.keys(TEMPLATES)[0]
  catSel.value = curCat
  fillTpls(curCat, b.template)
  catSel.onchange = () => fillTpls(catSel.value)

  kbCaptured = b.type==='keyboard' ? {modifiers:b.modifiers||0,keyCode:b.keyCode||0} : null
  const kbc = ed.querySelector('#kbCapture')
  if (kbc) {
    kbc.style.display = b.type==='keyboard' ? '' : 'none'
    kbc.textContent = kbCaptured ? bindingLabel(b) : 'clique e pressione…'
    kbc.onclick = function() {
      this.classList.add('arm'); this.textContent='pressione agora…'
      const onKey = e => {
        e.preventDefault()
        if (MOD_BITS[e.code] && !HID[e.code]) return
        const mods = (e.ctrlKey?1:0)|(e.shiftKey?2:0)|(e.altKey?4:0)|(e.metaKey?8:0)
        const code = HID[e.code]
        if (code===undefined||code>=0xe0) return
        kbCaptured={modifiers:mods,keyCode:code}
        this.textContent=bindingLabel({type:'keyboard',...kbCaptured})
        this.classList.remove('arm')
        window.removeEventListener('keydown',onKey,true)
      }
      window.addEventListener('keydown',onKey,true)
    }
  }

  // segmentos
  ed.querySelectorAll('.bind-seg').forEach(seg => {
    seg.onclick = () => {
      ed.querySelectorAll('.bind-seg').forEach(s=>s.classList.remove('on'))
      seg.classList.add('on')
      const isKb = seg.dataset.type==='keyboard'
      ed.querySelector('#be-tpl-area').style.display = isKb ? 'none' : ''
      ed.querySelector('#be-kb-area').style.display = isKb ? '' : 'none'
      if(isKb && kbc) { kbc.style.display=''; kbc.textContent=kbCaptured?bindingLabel({type:'keyboard',...kbCaptured}):'clique e pressione…' }
      else if(kbc) kbc.style.display='none'
    }
  })

  ed.querySelector('#be-save').onclick = () => {
    const type = ed.querySelector('.bind-seg.on')?.dataset.type||'template'
    if (type==='keyboard') {
      if (!kbCaptured) { toast('Capture uma combinação primeiro.', true); return }
      config.buttons[selBtn]={type:'keyboard',...kbCaptured}
    } else {
      config.buttons[selBtn]={type:'template',template:ed.querySelector('#be-tpl').value}
    }
    ed.style.display='none'; selBtn=null; renderBindings(); markDirty()
  }
  ed.querySelector('#be-cancel').onclick = () => { ed.style.display='none'; selBtn=null; renderBindings() }
  ed.querySelector('#be-reset-one').onclick = () => {
    config.buttons[selBtn]=deep(DEFAULT_BTNS[selBtn])||{type:'template',template:'global-disable-button'}
    ed.style.display='none'; selBtn=null; renderBindings(); markDirty()
    toast('Botão restaurado ao padrão.')
  }

  ed.scrollIntoView({behavior:'smooth',block:'start'})
}

function fillTpls(cat, sel='') {
  const tp = $('#be-tpl'); if(!tp) return; tp.innerHTML=''
  Object.entries(TEMPLATES[cat]||{}).forEach(([v,l]) => {
    const o = document.createElement('option'); o.value=v; o.textContent=l; tp.append(o)
  })
  if (sel && TEMPLATES[cat]?.[sel]) tp.value=sel
}

// ── Macro ──
let macroType = 'template' // 'template' | 'custom'
function renderMacro() {
  const body = $('#panel-body')
  body.innerHTML = `<div class="sub-tabs">
    <button class="sub-tab${macroType==='template'?' active':''}" data-mt="template">Funções de botão</button>
    <button class="sub-tab${macroType==='custom'?' active':''}" data-mt="custom">Macro gravado</button>
  </div>
  <div id="macro-content"></div>`

  body.querySelectorAll('.sub-tab').forEach(t => {
    t.onclick = () => { macroType=t.dataset.mt; renderMacro() }
  })

  if (macroType === 'template') {
    renderMacroTemplate()
  } else {
    renderMacroCustom()
  }
}

function renderMacroTemplate() {
  const mc = $('#macro-content')
  const card = h('div','card')
  card.innerHTML = `<div class="card-title">Funções rápidas de botão</div>
    <div style="font-size:.82rem;color:var(--dim);margin-bottom:14px">
      Atribua ações predefinidas a botões do mouse — use a aba <strong>Botões</strong> para mapeamento completo.
    </div>`
  mc.append(card)
}

function renderMacroCustom() {
  const mc = $('#macro-content')
  const cm = config.customMacro
  const card = h('div','card')
  card.innerHTML = `<div class="card-title">Gravador de macro</div>
    <div class="field"><span class="field-label">Ativar macro</span>
      <label class="sw"><input type="checkbox" id="cm-en"${cm.enabled?' checked':''}><i></i></label></div>
    <div class="field"><span class="field-label">Botão alvo</span>
      <select id="cm-target">
        <option value="4"${cm.targetButton==4?' selected':''}>Voltar (lateral)</option>
        <option value="3"${cm.targetButton==3?' selected':''}>Avançar (lateral)</option>
        <option value="2"${cm.targetButton==2?' selected':''}>Scroll (clique)</option>
        <option value="5"${cm.targetButton==5?' selected':''}>Botão DPI</option>
        <option value="0"${cm.targetButton==0?' selected':''}>Esquerdo</option>
        <option value="1"${cm.targetButton==1?' selected':''}>Direito</option>
      </select></div>
    <div class="field"><span class="field-label">Reprodução</span>
      <select id="cm-mode">
        <option value="0"${cm.mode==0?' selected':''}>N repetições</option>
        <option value="1"${cm.mode==1?' selected':''}>Até apertar tecla</option>
        <option value="2"${cm.mode==2?' selected':''}>Enquanto segurar</option>
      </select>
      <input type="number" id="cm-rep" min="1" max="255" value="${cm.repeat}" style="width:72px;${cm.mode!=0?'display:none':''}"></div>
    <div class="field" style="gap:8px">
      <button class="btn rec-btn" id="rec-btn">● Gravar</button>
      <button class="btn" id="rec-clear">Limpar</button>
      <span style="font-size:.78rem;color:var(--dim)" id="rec-hint"></span>
    </div>
    <div class="ev-list" id="ev-list"></div>`
  mc.append(card)

  renderEvents()
  card.querySelector('#cm-en').onchange = e => { config.customMacro.enabled=e.target.checked; markDirty() }
  card.querySelector('#cm-target').onchange = e => { config.customMacro.targetButton=+e.target.value; markDirty() }
  card.querySelector('#cm-mode').onchange = e => {
    config.customMacro.mode=+e.target.value
    card.querySelector('#cm-rep').style.display=e.target.value=='0'?'':'none'
    markDirty()
  }
  card.querySelector('#cm-rep').onchange = e => { config.customMacro.repeat=Math.min(255,Math.max(1,+e.target.value||1)); markDirty() }
  card.querySelector('#rec-btn').onclick = toggleRecording
  card.querySelector('#rec-clear').onclick = () => { config.customMacro.events=[]; renderEvents(); markDirty() }
}

function toggleRecording() {
  recording = !recording
  const btn = $('#rec-btn'); if(!btn) return
  btn.classList.toggle('recording', recording)
  btn.textContent = recording ? '■ Parar' : '● Gravar'
  $('#rec-hint').textContent = recording ? 'Gravando… pressione as teclas' : ''
  lastRecTs = performance.now()
}

function renderEvents() {
  const el = $('#ev-list'); if(!el) return
  const evs = config.customMacro.events
  if (!evs.length) { el.innerHTML='<span style="color:var(--dim);padding:6px;display:block">Nenhum evento gravado.</span>'; return }
  el.innerHTML=''
  evs.forEach((ev,i) => {
    const row = h('div','ev-row')
    row.innerHTML = `<span class="${ev.release?'ev-up':'ev-down'}">${ev.release?'↑':'↓'}</span>
      <span class="keycap">${HID_NAME[ev.key]||'0x'+ev.key.toString(16)}</span>
      <span style="color:var(--dim)">+${ev.delay}ms</span>
      <button class="ev-del" title="Remover">✕</button>`
    row.querySelector('.ev-del').onclick = () => { evs.splice(i,1); renderEvents(); markDirty() }
    el.append(row)
  })
}

window.addEventListener('keydown', e => {
  if (!recording) return; if (e.repeat) return
  const code = HID[e.code]; if (code===undefined) return
  e.preventDefault()
  const delay = Math.max(2, Math.round(performance.now()-lastRecTs))
  lastRecTs = performance.now()
  config.customMacro.events.push({key:code, delay, release:false})
  if (config.customMacro.events.length>=60) toggleRecording()
  renderEvents(); markDirty()
}, true)
window.addEventListener('keyup', e => {
  if (!recording) return
  const code = HID[e.code]; if (code===undefined) return
  e.preventDefault()
  const delay = Math.max(2, Math.round(performance.now()-lastRecTs))
  lastRecTs = performance.now()
  config.customMacro.events.push({key:code, delay, release:true})
  renderEvents(); markDirty()
}, true)

// ── Perfis ──
async function renderProfiles() {
  const body = $('#panel-body')
  body.innerHTML = ''
  const profiles = await api.profilesList()
  const card = h('div','card')
  card.innerHTML = `<div class="card-title">Perfis salvos</div>
    <div id="prof-list"></div>
    <div class="field" style="margin-top:14px">
      <input type="text" id="prof-name" placeholder="Nome do perfil…" style="flex:1;min-width:200px">
      <button class="btn primary" id="prof-save">Salvar atual</button>
    </div>
    <div class="field" style="margin-top:4px">
      <button class="btn" id="prof-export">Exportar JSON</button>
      <button class="btn" id="prof-import-btn">Importar JSON</button>
      <input type="file" id="prof-import" accept="application/json" hidden>
    </div>
    <div class="card-title" style="margin-top:20px">Zona de risco</div>
    <div style="font-size:.82rem;color:var(--dim);margin-bottom:12px">
      Restaura as configurações de fábrica do firmware do mouse. Se o mouse travar, alterne para Bluetooth e volte para 2.4GHz.
    </div>
    <button class="btn danger" id="factory-reset">Reset de fábrica do mouse</button>`
  body.append(card)

  renderProfileList(profiles)

  $('#prof-save').onclick = async () => {
    const n = $('#prof-name').value.trim(); if(!n){toast('Digite um nome.',true);return}
    const list = await api.profilesSave(n); renderProfileList(list)
    $('#prof-name').value=''; toast(`Perfil "${n}" salvo.`)
  }
  $('#prof-export').onclick = () => {
    const blob = new Blob([JSON.stringify(config,null,2)],{type:'application/json'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='sharkctl-perfil.json'; a.click()
  }
  $('#prof-import-btn').onclick = () => $('#prof-import').click()
  $('#prof-import').onchange = async e => {
    const f = e.target.files[0]; if(!f) return
    try { Object.assign(config, JSON.parse(await f.text())); renderSection(selSection); markDirty(); toast('Perfil importado — revise e aplique.') }
    catch { toast('Arquivo inválido.', true) }
    e.target.value=''
  }
  $('#factory-reset').onclick = async () => {
    if (!confirm('Restaurar configurações de fábrica do mouse?')) return
    try { config=await api.resetConfig(); applied=deep(config); renderSection(selSection); markDirty(); toast('Mouse restaurado ao padrão.') }
    catch(e) { toast('Falha: '+e.message,true) }
  }
}

function renderProfileList(names) {
  const list = $('#prof-list'); if(!list) return; list.innerHTML=''
  if (!names.length) { list.innerHTML='<p style="font-size:.8rem;color:var(--dim);margin-bottom:8px">Nenhum perfil salvo ainda.</p>'; return }
  names.forEach(n => {
    const row = h('div','profile-row')
    row.innerHTML = `<span class="profile-name">${n}</span>
      <button class="btn primary">Aplicar</button>
      <button class="btn danger">Excluir</button>`
    const [bAp, bDel] = row.querySelectorAll('button')
    bAp.onclick = async () => {
      const cfg = await api.profilesLoad(n)
      if (!cfg) return
      const res = await api.applyConfig(cfg)
      applied=deep(res); config=deep(res); renderSection(selSection); markDirty()
      toast(`Perfil "${n}" aplicado ✓`)
    }
    bDel.onclick = async () => {
      if (!confirm(`Excluir "${n}"?`)) return
      const list = await api.profilesDelete(n); renderProfileList(list)
    }
    list.append(row)
  })
}

// ─── navegação ────────────────────────────────────────────────────────────
function switchSection(name) {
  selSection = name
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section===name))
  renderSection(name)
}

// ─── conexão / status ────────────────────────────────────────────────────
// aplica o estado de conexão bem-sucedida (usado por tryConnect e reconexão automática)
async function onConnectSuccess(res) {
  connected = true; connMode = res.mode
  reconnectStop()
  $('#connect-screen').style.display = 'none'
  $('#conn-dot').className = 'conn-dot ok'
  $('#conn-txt').textContent = res.mode === 'wireless' ? '2.4 GHz' : 'USB'
  config = await api.getConfig()
  applied = deep(config)
  setAccentColor(config.lighting.globalColor)
  renderSection(selSection)
  refreshBattery()
}

async function tryConnect(preferredMode) {
  const err = $('#conn-error')
  const btn = preferredMode === 'wired' ? $('#cc-wired') : $('#cc-wireless')
  err.hidden = true
  reconnectStop() // cancela reconexão automática se usuário está clicando manualmente
  if (btn) { btn.disabled = true; btn.style.opacity = '.5' }

  let res
  try {
    res = await api.connect(preferredMode || 'wireless')
  } catch(e) {
    res = { ok: false, error: e.message }
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '' }
  }

  if (res.ok) {
    await onConnectSuccess(res)
  } else {
    const msg = res.error || 'Mouse não encontrado'
    err.innerHTML = `<strong>Falha ao conectar:</strong> ${msg}<br>
      <small style="opacity:.7">Verifique: (1) regra udev instalada, (2) mouse ligado, (3) dongle conectado</small>`
    err.hidden = false
  }
}

// ── reconexão automática ──────────────────────────────────────────────────────
let _reconnectTimer = null

function reconnectStop() {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null }
}

function reconnectSchedule(delayMs = 3000) {
  reconnectStop()
  _reconnectTimer = setTimeout(async () => {
    _reconnectTimer = null
    if (connected) return
    try {
      const res = await api.connect(connMode || 'wireless')
      if (res.ok) {
        await onConnectSuccess(res)
        toast('Mouse reconectado ✓')
        return
      }
    } catch {}
    reconnectSchedule() // retry em loop
  }, delayMs)
}

function enterReconnectMode() {
  connected = false
  $('#conn-dot').className = 'conn-dot'
  $('#conn-txt').textContent = 'reconectando…'
  $('#batt-bar-wrap').hidden = true
  // mostra connect-screen com indicador de reconexão
  const screen = $('#connect-screen')
  const desc = screen?.querySelector('.conn-desc')
  if (desc) desc.textContent = 'Reconectando ao mouse…'
  const errEl = $('#conn-error'); if (errEl) errEl.hidden = true
  screen.style.display = ''
  reconnectSchedule(1500) // primeira tentativa em 1.5s
}

// ── auto-connect no startup ───────────────────────────────────────────────────
async function tryAutoConnect() {
  const screen = $('#connect-screen')
  const desc = screen?.querySelector('.conn-desc')
  if (desc) desc.textContent = 'Conectando…'
  const errEl = $('#conn-error'); if (errEl) errEl.hidden = true

  for (const mode of ['wireless', 'wired']) {
    try {
      const res = await api.connect(mode)
      if (res.ok) { await onConnectSuccess(res); return }
    } catch {}
  }

  // falhou — restaura tela manual de conexão
  if (desc) desc.textContent = 'Conecte o mouse para começar'
}

async function refreshBattery() {
  const batt = await api.battery()
  const wrap = $('#batt-bar-wrap')
  const big = $('#batt-big')
  if (batt !== null && batt >= 0) {
    if(wrap) wrap.hidden = connMode !== 'wireless'
    const pct = batt+'%'
    if(big) big.textContent = pct
    $('#batt-txt').textContent = pct
    $('#batt-fill').style.width = pct
    $('#batt-fill').style.background = batt < 20 ? 'var(--red)' : 'var(--green)'
  }
}

// ─── aplicar ──────────────────────────────────────────────────────────────
async function applyConfig() {
  const btn = $('#apply-btn'); if(btn){btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Enviando…'}
  try {
    const res = await api.applyConfig(config)
    applied = deep(res); config = deep(res)
    markDirty(); renderSection(selSection); sonar()
    toast('Configuração aplicada no mouse ✓')
  } catch(e) {
    toast('Falha: '+e.message, true)
  } finally {
    if(btn){btn.disabled=false; btn.textContent='Aplicar no mouse'}
  }
}

// ─── bootstrap ────────────────────────────────────────────────────────────
buildShell()

// janela
$$('#wb-close, #wb-min, #wb-max').forEach(el => {
  el.onclick = () => {
    if(el.id==='wb-close') api.close()
    else if(el.id==='wb-min') api.minimize()
    else api.maximize()
  }
})

// sidebar nav
$$('.nav-btn').forEach(b => b.onclick = () => switchSection(b.dataset.section))

// diagrama — cliques
document.addEventListener('click', e => {
  const zone = e.target.closest('.btn-zone')
  if (zone?.dataset.btn) openBindEditor(zone.dataset.btn)
})

// conexão
$('#cc-wireless').onclick = () => tryConnect('wireless')
$('#cc-wired').onclick = () => tryConnect('wired')

// aplicar / descartar
$('#apply-btn').onclick = applyConfig
$('#discard-btn').onclick = () => { config=deep(applied); renderSection(selSection); markDirty() }

// Reconexão automática quando o mouse desconecta inesperadamente
if (api.onDisconnected) {
  api.onDisconnected(() => {
    if (connected) enterReconnectMode()
  })
}

// Sincronização do estágio DPI pelo botão físico do mouse
if (api.onDpiStage) {
  api.onDpiStage((stage) => {
    if (stage < 0 || stage > 5) return
    config.dpi.activeStage = stage
    // atualiza visual se o painel DPI estiver aberto
    if (selSection === 'dpi') renderSection('dpi')
    // atualiza cor de acento se o modo for DPI-linked
    if (config.lighting.mode === 0x50 || config.lighting.mode === 0x60) {
      const stageColor = config.lighting.stageColors?.[stage]
      if (stageColor) setAccentColor(stageColor)
    }
  })
}

// Atualização de bateria em tempo real
if (api.onBattery) {
  api.onBattery((pct) => {
    batteryPct = pct
    const wrap = $('#batt-bar-wrap')
    const txt = $('#batt-txt')
    const fill = $('#batt-fill')
    const big = $('#batt-big')
    if(wrap) wrap.hidden = false
    if(txt) txt.textContent = pct+'%'
    if(fill) { fill.style.width=pct+'%'; fill.style.background = pct < 20 ? 'var(--red)' : pct < 30 ? 'var(--amber)' : 'var(--green)' }
    if(big) big.textContent = pct+'%'
    // re-renderiza o painel de luz se estiver aberto (override pode ter mudado)
    if (selSection === 'light') renderSection('light')
  })
}

// tenta conectar automaticamente; se falhar, mostra tela manual
tryAutoConnect()
