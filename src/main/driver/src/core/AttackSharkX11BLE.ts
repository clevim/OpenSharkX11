import { EventEmitter } from 'node:events'
import dbus from 'dbus-next'
import { DpiBuilder, type DpiBuilderOptions } from '../protocols/DpiBuilder.js'
import { UserPreferencesBuilder, type UserPreferencesBuilderOptions } from '../protocols/UserPreferencesBuilder.js'
import { MacrosBuilder, type MacroBuilderOptions } from '../protocols/MacrosBuilder.js'
import { ConnectionMode } from '../types.js'
import { delay } from '../utils/delay.js'

const { systemBus, Variant } = dbus

const BLUEZ    = 'org.bluez'
const GATT_CH  = 'org.bluez.GattCharacteristic1'
const DEV_IF   = 'org.bluez.Device1'
const PROPS_IF = 'org.freedesktop.DBus.Properties'

// Service that confirms this is a configurable X11 (not present on standard BT mice)
const FEE0_UUID = '0000fee0-0000-1000-8000-00805f9b34fb'
// Command channel: write here to configure the mouse
const FEE3_UUID = '0000fee3-0000-1000-8000-00805f9b34fb'
// Response channel: notifications with ACK (55 50 XX YY), battery (55 40 01 XX), DPI stage (55 10 XX)
const FEE4_UUID = '0000fee4-0000-1000-8000-00805f9b34fb'
// Battery poll trigger (writing here causes fee4 to emit battery notification)
const FFC2_UUID = 'f000ffc2-0451-4000-b000-000000000000'

export interface AttackSharkX11BLEEvents {
  batteryChange:  [battery: number]
  dpiStageChange: [stage: number]
  error:          [error: Error]
  disconnect:     []
}

export class AttackSharkX11BLE extends EventEmitter<AttackSharkX11BLEEvents> {
  private bus:        ReturnType<typeof systemBus> | null = null
  private fee3Path  = ''
  private fee4Path  = ''
  private ffc2Path  = ''
  private devicePath = ''
  private isOpen    = false
  private lastBattery = -1
  private cleanups: Array<() => unknown> = []

  // ── Open / Close ─────────────────────────────────────────────────────────

  async open(): Promise<void> {
    this.bus = systemBus()

    const paths = await this.discoverPaths()
    this.devicePath = paths.devicePath
    this.fee3Path   = paths.fee3Path
    this.fee4Path   = paths.fee4Path
    this.ffc2Path   = paths.ffc2Path

    // Subscribe to fee4 notifications (battery, DPI stage, ACKs)
    const fee4Obj   = await this.bus.getProxyObject(BLUEZ, this.fee4Path)
    const fee4Props = fee4Obj.getInterface(PROPS_IF)
    const fee4Char  = fee4Obj.getInterface(GATT_CH)

    const onFee4 = (iface: string, changed: Record<string, dbus.Variant>) => {
      if (iface !== GATT_CH || !changed['Value']) return
      const raw = changed['Value'].value as number[]
      this.handleFee4(Buffer.from(raw))
    }
    fee4Props.on('PropertiesChanged', onFee4)
    this.cleanups.push(() => fee4Props.removeListener('PropertiesChanged', onFee4))

    await fee4Char.StartNotify()
    this.cleanups.push(() => fee4Char.StopNotify().catch(() => {}))

    // Watch for device disconnect
    const devObj   = await this.bus.getProxyObject(BLUEZ, this.devicePath)
    const devProps = devObj.getInterface(PROPS_IF)

    const onDevProp = (iface: string, changed: Record<string, dbus.Variant>) => {
      if (iface !== DEV_IF) return
      if (changed['Connected']?.value === false) {
        this.isOpen = false
        this.emit('disconnect')
      }
    }
    devProps.on('PropertiesChanged', onDevProp)
    this.cleanups.push(() => devProps.removeListener('PropertiesChanged', onDevProp))

    this.isOpen = true
  }

  async close(): Promise<void> {
    this.isOpen = false
    for (const fn of [...this.cleanups].reverse()) {
      try { await fn() } catch {}
    }
    this.cleanups = []
    try { this.bus?.disconnect() } catch {}
    this.bus = null
    this.removeAllListeners()
  }

  // ── Discovery ─────────────────────────────────────────────────────────────

  private async discoverPaths() {
    if (!this.bus) throw new Error('Bus not initialised')

    const root = await this.bus.getProxyObject(BLUEZ, '/')
    const om   = root.getInterface('org.freedesktop.DBus.ObjectManager')
    const objs = await om.GetManagedObjects() as Record<
      string, Record<string, Record<string, dbus.Variant>>
    >

    // Find connected BLE device that has the fee0 vendor service
    let devicePath = ''
    for (const [path, ifaces] of Object.entries(objs)) {
      const dev = ifaces[DEV_IF]
      if (!dev?.['Connected']?.value) continue
      const uuids = (dev['UUIDs']?.value ?? []) as string[]
      if (uuids.some(u => u.toLowerCase() === FEE0_UUID)) {
        devicePath = path
        break
      }
    }
    if (!devicePath) throw new Error('X11 BLE device not found or not connected')

    let fee3Path = '', fee4Path = '', ffc2Path = ''
    for (const [path, ifaces] of Object.entries(objs)) {
      if (!path.startsWith(devicePath + '/')) continue
      const ch = ifaces[GATT_CH]
      if (!ch) continue
      const uuid = ((ch['UUID']?.value) as string ?? '').toLowerCase()
      if (uuid === FEE3_UUID) fee3Path = path
      else if (uuid === FEE4_UUID) fee4Path = path
      else if (uuid === FFC2_UUID) ffc2Path = path
    }

    if (!fee3Path || !fee4Path) {
      throw new Error(`BLE characteristics not found — fee3:${!!fee3Path} fee4:${!!fee4Path}`)
    }

    console.log(`[ble] device:   ${devicePath}`)
    console.log(`[ble] fee3 cmd: ${fee3Path}`)
    console.log(`[ble] fee4 evt: ${fee4Path}`)
    if (ffc2Path) console.log(`[ble] ffc2 bat: ${ffc2Path}`)

    return { devicePath, fee3Path, fee4Path, ffc2Path }
  }

  // ── fee4 event handler ────────────────────────────────────────────────────

  private handleFee4(data: Buffer): void {
    if (data.length < 3) return

    // Battery notification: 55 40 01 <pct>
    if (data[0] === 0x55 && data[1] === 0x40 && data[2] === 0x01 && data.length >= 4) {
      const batt = data[3]!
      if (batt !== this.lastBattery) {
        this.lastBattery = batt
        this.emit('batteryChange', batt)
      }
      return
    }

    // DPI stage change: 55 10 <stage 1-6>
    if (data[0] === 0x55 && data[1] === 0x10 && data.length >= 3) {
      const stage = data[2]!
      if (stage >= 1 && stage <= 6) {
        this.emit('dpiStageChange', stage - 1)  // convert to 0-indexed
      }
      return
    }
  }

  // ── Write helper ──────────────────────────────────────────────────────────

  private async writeToFee3(payload: Buffer): Promise<void> {
    if (!this.bus || !this.fee3Path) throw new Error('BLE driver not open')
    const obj  = await this.bus.getProxyObject(BLUEZ, this.fee3Path)
    const char = obj.getInterface(GATT_CH)
    await char.WriteValue(Array.from(payload), { type: new Variant('s', 'request') })
  }

  // ── Public API (mirrors AttackSharkX11) ──────────────────────────────────

  getBatteryLevel(timeoutMs = 2000): Promise<number> {
    if (!this.isOpen) return Promise.reject(new Error('Not open'))
    if (this.lastBattery !== -1) return Promise.resolve(this.lastBattery)

    return new Promise((resolve, reject) => {
      let done = false
      const cleanup = () => {
        done = true
        clearTimeout(t)
        this.removeListener('batteryChange', handler)
      }
      const handler = (bat: number) => { if (!done) { cleanup(); resolve(bat) } }
      const t = setTimeout(() => {
        if (!done) { cleanup(); reject(new Error('BLE battery timeout')) }
      }, timeoutMs)
      this.on('batteryChange', handler)

      // Trigger battery notification via ffc2 (writes any data, mouse responds on fee4)
      if (this.ffc2Path && this.bus) {
        this.bus.getProxyObject(BLUEZ, this.ffc2Path).then(obj => {
          const ch = obj.getInterface(GATT_CH)
          return ch.WriteValue([0x05, 0x0f, 0x01], { type: new Variant('s', 'request') })
        }).catch(() => {})
      }
    })
  }

  onBatteryChange(listener: (battery: number) => void): () => void {
    this.on('batteryChange', listener)
    return () => this.removeListener('batteryChange', listener)
  }

  async setDpi(options: DpiBuilder | DpiBuilderOptions): Promise<void> {
    if (!this.isOpen) throw new Error('BLE driver not open')
    const builder = options instanceof DpiBuilder ? options : new DpiBuilder(options)
    await this.writeToFee3(builder.build(ConnectionMode.Adapter))
    await delay(150)
  }

  async setUserPreferences(options: UserPreferencesBuilder | UserPreferencesBuilderOptions): Promise<void> {
    if (!this.isOpen) throw new Error('BLE driver not open')
    const builder = options instanceof UserPreferencesBuilder ? options : new UserPreferencesBuilder(options)
    await this.writeToFee3(builder.build(ConnectionMode.Adapter))
    await delay(150)
  }

  // Polling rate is a USB-only feature — silently ignored on BLE
  async setPollingRate(_rate: unknown): Promise<void> { /* no-op on BLE */ }

  async setMacro(config: MacroBuilderOptions | MacrosBuilder): Promise<void> {
    if (!this.isOpen) throw new Error('BLE driver not open')
    const builder = config instanceof MacrosBuilder ? config : new MacrosBuilder(config)
    const payload = builder.build(ConnectionMode.Adapter)
    console.log(`[ble] setMacro — report 0x${payload[0]!.toString(16).padStart(2,'0')}, ${payload.length}B`)
    await this.writeToFee3(payload)
    await delay(150)
  }

  // CustomMacro sends 4 packets (report 0x08 multi-step) — not tested on BLE, skipped
  async setCustomMacro(_options: unknown): Promise<void> { /* no-op on BLE */ }
  async sendInternalStateResetReportBuilder(): Promise<void> { /* no-op on BLE */ }
  async reset(): Promise<void> { /* no-op on BLE */ }
}

export default AttackSharkX11BLE
