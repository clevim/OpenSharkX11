// Teste isolado: verifica se o módulo nativo `usb` enxerga o Attack Shark X11.
// Roda fora do Electron normal — usa Electron como runtime headless via `electron .`
// Uso: ELECTRON_OVERRIDE_DIST_PATH=/usr/lib/electron34 node_modules/electron/dist/electron scripts/test-usb.js
const usb = require('usb')

const all = usb.getDeviceList()
console.log('total de dispositivos USB visíveis:', all.length)

const shark = all.filter((d) => d.deviceDescriptor.idVendor === 0x1d57)
console.log('dispositivos Attack Shark (vendor 0x1d57):', shark.length)
for (const d of shark) {
  console.log(
    `  idProduct=0x${d.deviceDescriptor.idProduct.toString(16)}`,
    `bus=${d.busNumber}`,
    `addr=${d.deviceAddress}`,
  )
}

if (all.length === 0) {
  console.log('\n=> Módulo usb não retornou NADA. Provável incompatibilidade de ABI entre Node e Electron.')
} else if (shark.length === 0) {
  console.log('\n=> usb funciona, mas o Attack Shark não está entre os dispositivos. Verifique conexão/dongle.')
  console.log('Todos os vendorIds vistos:', [...new Set(all.map(d => '0x'+d.deviceDescriptor.idVendor.toString(16)))])
} else {
  console.log('\n=> OK! O driver deveria conseguir abrir o dispositivo.')
}

process.exit(0)
