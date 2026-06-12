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
const LIGHT_MODES = [[0,'Desligado'],[0x10,'Estático'],[0x20,'Respiração'],[0x30,'Neon'],[0x40,'Respiração colorida'],[0x50,'DPI estático'],[0x60,'DPI respiração']]
const BREATHING_MODES = new Set([0x20,0x30,0x40,0x60])
const DEFAULT_BTNS = {
  left:{type:'template',template:'global-left-click'},right:{type:'template',template:'global-right-click'},
  middle:{type:'template',template:'global-middle'},forward:{type:'template',template:'global-forward'},
  backward:{type:'template',template:'global-backward'},dpi:{type:'template',template:'global-dpi-cycle'},
  scrollUp:{type:'template',template:'global-scroll-up'},scrollDown:{type:'template',template:'global-scroll-down'},
}
const SWATCHES = ['#ff4444','#ff8c00','#ffe100','#5be38a','#5be3d2','#2e8fff','#a259ff','#ff59d6','#ffffff']

// ─── estado ──────────────────────────────────────────────────────────────
const api = window.api
let config = null, applied = null, dirty = false
let connected = false, connMode = null
let selBtn = null, kbCaptured = null, recording = false, lastRecTs = 0
let selSection = 'dpi'

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
  return `<svg id="mouse-svg" viewBox="0 0 220 320" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--bg3)"/><stop offset="100%" stop-color="var(--bg1)"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>

  <!-- corpo: ombros com "V" largo central (entalhe do scroll), afunilando para base oval -->
  <path d="M82 6
           L98 6 C100 6 101 7 102 9 L108 26 L112 26 L118 9 C119 7 120 6 122 6
           L138 6
           C166 6 182 24 184 50
           L187 158
           C189 240 174 300 150 314
           C128 326 92 326 70 314
           C46 300 31 240 33 158
           L36 50
           C38 24 54 6 82 6 Z"
        fill="url(#mg)" stroke="var(--line2)" stroke-width="1.5"/>

  <!-- botão esquerdo -->
  <path class="btn-zone" data-btn="left"
    d="M82 6 L98 6 C100 6 101 7 102 9 L108 26 L110 26 L110 120 C82 120 52 117 37 111 L36 50 C38 24 54 6 82 6 Z"
    fill="var(--bg3)" stroke="none" opacity=".55"/>
  <!-- botão direito -->
  <path class="btn-zone" data-btn="right"
    d="M138 6 L122 6 C120 6 119 7 118 9 L112 26 L110 26 L110 120 C138 120 168 117 183 111 L184 50 C182 24 166 6 138 6 Z"
    fill="var(--bg3)" stroke="none" opacity=".55"/>

  <!-- divisão central entre cliques (desce até a borda do corpo, abaixo do scroll) -->
  <line x1="110" y1="26" x2="110" y2="120" stroke="var(--line2)" stroke-width="1.5"/>
  <!-- divisão inferior dos botões -->
  <path d="M36 114 C72 130 148 130 184 114" stroke="var(--line2)" stroke-width="1.5" fill="none"/>

  <!-- scroll wheel -->
  <rect class="btn-zone" data-btn="middle" x="95" y="22" width="30" height="66" rx="14"
        fill="var(--bg)" stroke="var(--line2)" stroke-width="1.2"/>
  <line x1="96" y1="36" x2="124" y2="36" stroke="var(--line2)" stroke-width="1"/>
  <line x1="96" y1="43" x2="124" y2="43" stroke="var(--line2)" stroke-width="1"/>
  <line x1="96" y1="50" x2="124" y2="50" stroke="var(--line2)" stroke-width="1"/>
  <line x1="96" y1="57" x2="124" y2="57" stroke="var(--line2)" stroke-width="1"/>
  <line x1="96" y1="64" x2="124" y2="64" stroke="var(--line2)" stroke-width="1"/>
  <line x1="96" y1="71" x2="124" y2="71" stroke="var(--line2)" stroke-width="1"/>
  <line x1="96" y1="78" x2="124" y2="78" stroke="var(--line2)" stroke-width="1"/>

  <!-- scroll up/down -->
  <path class="btn-zone" data-btn="scrollUp" d="M110 12 l8 10 h-16Z" fill="var(--acc)" opacity=".25"/>
  <path class="btn-zone" data-btn="scrollDown" d="M110 110 l8 -10 h-16Z" fill="var(--acc)" opacity=".25"/>

  <!-- botão DPI -->
  <rect class="btn-zone" data-btn="dpi" x="100" y="126" width="20" height="11" rx="4"
        fill="var(--bg)" stroke="var(--line2)" stroke-width="1"/>

  <!-- laterais esquerdo (forward/backward) — encaixados na curva do corpo -->
  <rect class="btn-zone" data-btn="forward"  x="26" y="122" width="12" height="40" rx="6"
        fill="var(--bg)" stroke="var(--line2)" stroke-width="1.2" transform="rotate(-3 32 142)"/>
  <rect class="btn-zone" data-btn="backward" x="25" y="168" width="12" height="44" rx="6"
        fill="var(--bg)" stroke="var(--line2)" stroke-width="1.2" transform="rotate(-5 31 190)"/>

  <!-- LED indicator -->
  <ellipse cx="110" cy="150" rx="8" ry="3.5" fill="var(--acc)" opacity=".55" id="led-el"/>
  <ellipse cx="110" cy="150" rx="8" ry="3.5" fill="var(--acc)" opacity=".9" filter="url(#glow)" id="led-glow"/>
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
    row.innerHTML = `<button class="stage-num" title="Definir como ativo">${i+1}</button>
      <input type="range" min="50" max="22000" step="50" value="${v}">
      <span class="stage-val">${v.toLocaleString('pt-BR')}</span>`
    row.querySelector('.stage-num').onclick = () => { config.dpi.activeStage=i; renderSection('dpi'); markDirty() }
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
  const card = h('div', 'card')
  const rgb = config.lighting.rgb
  card.innerHTML = `<div class="card-title">Modo e cor</div>
    <div class="light-preview" id="lp"></div>
    <div class="chips" id="light-chips"></div>
    <div class="field" style="margin-top:16px">
      <span class="field-label">Cor</span>
      <input type="color" id="rgb-pick" value="${rgbToHex(rgb)}">
      <div class="swatches" id="swatches"></div>
    </div>
    <div class="field">
      <span class="field-label">R</span>
      <input type="number" id="rc" min="0" max="255" value="${rgb.r}" style="width:70px">
      <span class="field-label" style="min-width:20px">G</span>
      <input type="number" id="gc" min="0" max="255" value="${rgb.g}" style="width:70px">
      <span class="field-label" style="min-width:20px">B</span>
      <input type="number" id="bc" min="0" max="255" value="${rgb.b}" style="width:70px">
    </div>
    <div class="field">
      <span class="field-label">Velocidade do efeito</span>
      <input type="range" id="led-spd" min="1" max="5" step="1" value="${config.lighting.ledSpeed}">
      <span class="field-val" id="led-spd-v">${config.lighting.ledSpeed}</span>
    </div>`
  body.append(card)

  // chips de modo
  const chips = card.querySelector('#light-chips')
  LIGHT_MODES.forEach(([val,label]) => {
    const b = h('button', 'chip'+(config.lighting.mode===val?' on':''))
    b.textContent = label
    b.onclick = () => { config.lighting.mode=val; renderLight(); markDirty() }
    chips.append(b)
  })

  // preview bar
  updateLightPreview()

  // swatches
  const sw = card.querySelector('#swatches')
  SWATCHES.forEach(c => {
    const d = h('div','swatch'); d.style.background=c; d.title=c
    d.onclick = () => { config.lighting.rgb=hexToRgb(c); renderLight(); setAccentColor(config.lighting.rgb); markDirty() }
    sw.append(d)
  })

  // color picker
  card.querySelector('#rgb-pick').oninput = e => {
    config.lighting.rgb=hexToRgb(e.target.value)
    syncRgbInputs(); setAccentColor(config.lighting.rgb); updateLightPreview(); markDirty()
  }
  // canais numéricos
  const syncFromNums = () => {
    config.lighting.rgb = {r:+$('#rc').value||0, g:+$('#gc').value||0, b:+$('#bc').value||0}
    $('#rgb-pick').value = rgbToHex(config.lighting.rgb)
    setAccentColor(config.lighting.rgb); updateLightPreview(); markDirty()
  }
  ;['#rc','#gc','#bc'].forEach(id => card.querySelector(id).oninput = syncFromNums)

  card.querySelector('#led-spd').oninput = e => { config.lighting.ledSpeed=+e.target.value; card.querySelector('#led-spd-v').textContent=e.target.value; markDirty() }
}

function syncRgbInputs() {
  const rgb = config.lighting.rgb
  const pick = $('#rgb-pick'); if(pick) pick.value = rgbToHex(rgb)
  const rc=$('#rc'),gc=$('#gc'),bc=$('#bc')
  if(rc){rc.value=rgb.r;gc.value=rgb.g;bc.value=rgb.b}
}

function updateLightPreview() {
  const lp = $('#lp'); if(!lp) return
  const {r,g,b} = config.lighting.rgb
  lp.style.background = `linear-gradient(90deg, rgb(${r},${g},${b}), transparent)`
  lp.classList.toggle('breathing', BREATHING_MODES.has(config.lighting.mode))
  // atualizar LED do diagrama
  const ledEl = $('#led-glow'), ledEl2 = $('#led-el')
  if(ledEl) {
    const off = config.lighting.mode === 0
    ledEl.setAttribute('fill', off ? '#333' : rgbToHex({r,g,b}))
    ledEl.setAttribute('opacity', off ? '0' : '.9')
    ledEl2?.setAttribute('fill', off ? '#333' : rgbToHex({r,g,b}))
    ledEl2?.setAttribute('opacity', off ? '0' : '.55')
  }
  setAccentColor(config.lighting.rgb)
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
          <button id="kbCapture" ${b.type==='keyboard'?'':'hidden'}>${b.type==='keyboard' ? bindingLabel(b) : 'clique e pressione…'}</button>
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
async function tryConnect(preferredMode) {
  const err = $('#conn-error')
  const btn = preferredMode === 'wired' ? $('#cc-wired') : $('#cc-wireless')
  err.hidden = true
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
    connected = true; connMode = res.mode
    $('#connect-screen').style.display = 'none'
    $('#conn-dot').className = 'conn-dot ok'
    $('#conn-txt').textContent = res.mode === 'wireless' ? '2.4 GHz' : 'USB'
    config = await api.getConfig()
    applied = deep(config)
    setAccentColor(config.lighting.rgb)
    renderSection(selSection)
    refreshBattery()
  } else {
    const msg = res.error || 'Mouse não encontrado'
    err.innerHTML = `<strong>Falha ao conectar:</strong> ${msg}<br>
      <small style="opacity:.7">Verifique: (1) regra udev instalada, (2) mouse ligado, (3) dongle conectado</small>`
    err.hidden = false
  }
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

// render inicial (sem conexão) — mostra tela de conexão
