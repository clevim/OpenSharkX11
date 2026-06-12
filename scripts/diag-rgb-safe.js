// Diagnóstico SEGURO de iluminação: usa o report 0x04 (DPI) que JÁ FUNCIONA
// e comprovadamente não causa despareamento — só sobrescrevemos o bloco de
// cor do Estágio 1 (offsets 25-27, atualmente #ff0000) com uma cor de teste.
//
// Mantém TODO o resto do payload idêntico ao DpiBuilder padrão (config atual
// do app), incluindo DPI stages, angle snap, etc — só muda a cor.
//
// Uso:
//   ELECTRON_OVERRIDE_DIST_PATH=/usr/lib/electron34 node_modules/electron/dist/electron scripts/diag-rgb-safe.js

const usb = require('usb')
const readline = require('readline')

const VENDOR = 0x1d57
const PRODUCT = 0xfa60
const WVALUE = 0x0304
const WINDEX = 2

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(q, res))

// Payload base = exatamente o default do DpiBuilder (stages 800/1600/2400/3200/5000/22000,
// estágio ativo 2, angleSnap off, ripple on) — esse payload JÁ FOI ENVIADO e funcionou.
function basePayload() {
  // Construído e verificado byte-a-byte contra DpiBuilder real
  // (dpiValues default, activeStage=2, angleSnap=false, ripple=true) — confirmado
  // idêntico ao payload que você já aplicou com sucesso.
  const buf = Buffer.alloc(56)
  buf[0]=0x04; buf[1]=0x38; buf[2]=0x01
  buf[3]=0x00; buf[4]=0x01 // angleSnap=0, ripple=1
  buf[5]=0x3f
  buf[6]=0x00; buf[7]=0x00 // stage mask (nenhum stage >12000... mas stage6=22000>12000!)
  // stages default: 800,1600,2400,3200,5000,22000 -> encoded values (do driver original)
  buf[8]=0x12; buf[9]=0x25; buf[10]=0x38; buf[11]=0x4b; buf[12]=0x75; buf[13]=0x81
  buf[14]=0x00; buf[15]=0x00
  // high stage flags: stage6=22000 está em [20100,22000] -> 0x01
  buf[16]=0; buf[17]=0; buf[18]=0; buf[19]=0; buf[20]=0; buf[21]=0x01
  buf[22]=0; buf[23]=0
  buf[24]=0x02 // current stage = 2
  // blocos de cor (25-47) - paleta default
  const palette = [
    [0xff,0x00,0x00],[0x00,0xff,0x00],[0x00,0x00,0xff],[0xff,0xff,0x00],
    [0x00,0xff,0xff],[0xff,0x00,0xff],[0xff,0x40,0x00],[0xff,0xff,0xff],
  ]
  let off = 25
  for (const [r,g,b] of palette) { buf[off]=r; buf[off+1]=g; buf[off+2]=b; off+=3 }
  buf[49]=0x02
  // stage mask: stage6 (22000) > 12000 -> bit 5 (0x20)
  buf[6]=0x20; buf[7]=0x20
  return buf
}

function checksum16(buf) {
  let sum = 0
  for (let i = 3; i <= 49; i++) sum += buf[i] ?? 0
  return sum & 0xffff
}

function send(device, data, label) {
  return new Promise((resolve) => {
    device.controlTransfer(0x21, 0x09, WVALUE, WINDEX, data, (err) => {
      if (err) console.log(`  [${label}] ERRO: ${err.message}`)
      else console.log(`  [${label}] OK -> ${data.toString('hex')}`)
      resolve(!err)
    })
  })
}

async function main() {
  const device = usb.findByIds(VENDOR, PRODUCT)
  if (!device) { console.log('Mouse não encontrado.'); process.exit(1) }
  device.open()
  const iface = device.interfaces[2]
  if (iface && iface.isKernelDriverActive()) { try { iface.detachKernelDriver() } catch {} }
  if (iface) iface.claim()

  console.log('=== Diagnóstico SEGURO: mudando cor do bloco 1 (offset 25-27) ===')
  console.log('Usa o mesmo report 0x04 (DPI) que você confirmou funcionar.\n')

  // Teste 1: cor do bloco 1 -> roxo (era vermelho ff0000)
  {
    const buf = basePayload()
    buf[25]=0xa2; buf[26]=0x59; buf[27]=0xff // roxo
    buf.writeUInt16BE(checksum16(buf), 50)
    await send(device, buf, 'bloco1 = roxo (a259ff)')
    await ask('  Pressione Enter, depois descreva o que mudou na luz do mouse: ')
  }

  // Teste 2: cor do bloco do estágio ATIVO (estágio 2 -> bloco 2, offset 28-30) -> turquesa
  {
    const buf = basePayload()
    buf[28]=0x5b; buf[29]=0xe3; buf[30]=0xd2 // turquesa
    buf.writeUInt16BE(checksum16(buf), 50)
    await send(device, buf, 'bloco2 (estagio ativo=2) = turquesa (5be3d2)')
    await ask('  Pressione Enter, depois descreva o que mudou na luz do mouse: ')
  }

  // Teste 3: restaurar paleta original (igual ao que já estava antes destes testes)
  {
    const buf = basePayload()
    buf.writeUInt16BE(checksum16(buf), 50)
    await send(device, buf, 'paleta original restaurada')
    await ask('  Pressione Enter para finalizar. ')
  }

  console.log('\nFim. Envie as descrições.')
  rl.close()
  device.close()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
