# USB 协议 — Attack Shark X11

Attack Shark X11 鼠标的 HID 协议逆向工程文档。
涵盖已确认有效的功能、危险操作以及每个命令的使用方式。

> **在向鼠标发送任何新 payload 之前：** 请阅读[安全](#8-安全)章节以及历史记录中的[配对丢失事件](#配对丢失事件)。

---

## 目录

1. [硬件识别](#1-硬件识别)
2. [HID 传输层](#2-hid-传输层)
3. [Report 0x04 — DPI + 灯光](#3-report-0x04--dpi--灯光)
4. [Report 0x05 — 动画模式](#4-report-0x05--动画模式)
5. [Report 0x06 — 轮询率](#5-report-0x06--轮询率)
6. [输入事件（中断端点 0x83）](#6-输入事件中断端点-0x83)
7. [必须遵循的操作顺序](#7-必须遵循的操作顺序)
8. [安全](#8-安全)
9. [调查历史](#9-调查历史)
10. [蓝牙 BLE — 协议与限制](#10-蓝牙-ble--协议与限制)

---

## 1. 硬件识别

| 字段 | 值 |
|---|---|
| 厂商 ID（Vendor ID） | `0x1d57` |
| 产品 ID（2.4 GHz 接收器） | `0xfa60` |
| 产品 ID（有线 USB） | `0xfa55` |
| USB 接口 | `2`（`DEVICE_INTERFACE = 0x02`） |
| 输入端点（中断） | `0x83`（`INTERRUPT_ENDPOINT`） |

鼠标支持**三种连接模式**：通过 2.4 GHz 接收器的**无线**模式（`0xfa60`）、通过 USB-C 线的**有线**模式（`0xfa55`）以及 **Bluetooth 5.0 BLE** 模式。前两种模式下 USB 协议完全相同，仅 `idProduct` 的检测不同。BLE 通道使用 GATT，详见[第 10 节](#10-蓝牙-ble--协议与限制)。

---

## 2. HID 传输层

所有命令通过 **HID Feature Report** 使用 `controlTransfer` 发送：

```
bmRequestType = 0x21   （主机 → 设备，类，接口）
bRequest      = 0x09   （SET_REPORT）
wValue        = 0x03XX （0x03 = Feature Report；XX = Report ID）
wIndex        = 0x0002 （接口 2 — 唯一有效的接口）
data          = report payload（见下文各节）
```

> `wIndex=0` 和 `wIndex=1` 返回 `LIBUSB_ERROR_IO`。请始终使用 `wIndex=2`。

---

## 3. Report 0x04 — DPI + 灯光

**56 字节**（`0x38`）报告。控制 DPI、各阶段颜色以及一次性确认动画。

### 完整布局

```
字节  值         说明
──────────────────────────────────────────────────────────
 00   0x04      Report ID
 01   0x38      大小（56）
 02   0x01      固定值
 03   angleSnap 0x00 = 关闭 · 0x01 = 开启
 04   ripple    0x01 = 开启 · 0x00 = 关闭
 05   0x3f      固定值（用途未知）
 06   stageMask 高字节（DPI 档位 6 > 12000 时为 0x20）
 07   stageMask 低字节（默认为 0x20）
08–13 DPI[1–6]  各 DPI 档位编码值（DPI_STEP_MAP）
14–15 0x00      固定值
16–21 highFlags 若 DPI > 12000 则为 0x01（按档位标志）
22–23 0x00      固定值
 24   stage     当前激活档位（1–6，从 1 开始编号）

25–27 RGB[1]    档位 1 颜色（R, G, B）
28–30 RGB[2]    档位 2 颜色
31–33 RGB[3]    档位 3 颜色
34–36 RGB[4]    档位 4 颜色
37–39 RGB[5]    档位 5 颜色
40–42 RGB[6]    档位 6 颜色
43–45 RGB[7]    额外颜色（用途未知）
46–48 RGB[8]    额外颜色（用途未知）

 49   anim      一次性动画（见下表）
50–51 checksum  uint16 大端序，字节 3–49 的累加和
52–55 0x00      填充字节（仅无线模式）
```

### 各档位颜色

LED 显示**当前激活档位**（`byte[24]`）的颜色。每个颜色块占 3 字节（R, G, B）：

| 档位 | 字节偏移 |
|------|---------|
| 1 | 25–27 |
| 2 | 28–30 |
| 3 | 31–33 |
| 4 | 34–36 |
| 5 | 37–39 |
| 6 | 40–42 |

亮度由 **RGB 数值大小**控制 — 低值（如 `0x08`）产生的 LED 亮度明显低于 `0xff`。

### 一次性动画（字节 49）

在固件收到报告的瞬间触发。动画结束后 LED 熄灭。若需持续灯光，请随后发送 Report `0x05`。

| 字节 49 | 行为 |
|---------|------|
| `0x00` | 无动画 — 立即熄灭 |
| `0x01` | 约 3 次快速闪烁，然后熄灭 |
| `0x02` | 持续约 3 秒亮灯，然后熄灭 |
| 其他值 | 熄灭（固件忽略） |

> 若要通过 `0x05` 实现持续灯光，建议使用 `0x00`（避免确认闪烁）。

### 校验和计算

```
checksum = sum(bytes[3..49]) & 0xffff
bytes[50] = (checksum >> 8) & 0xff   // 高字节
bytes[51] =  checksum & 0xff         // 低字节
```

### Payload 示例

激活档位 2，默认调色板，无一次性动画：
```
04 38 01 00 01 3f 20 20 12 25 38 4b 75 81 00 00
00 00 00 00 00 01 00 00 02 ff 00 00 00 ff 00 00
00 ff ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff
ff 00 0f 68 00 00 00 00
```

---

## 4. Report 0x05 — 动画模式

**15 字节**（`0x0f`）报告。控制**持续**灯光模式（动画不会在播放后熄灭）。

**必要前提：** 必须先发送 Report `0x04`，再发送本报告。若未收到 `0x04`，固件将忽略 `0x05`。

### 完整布局

```
字节  值           说明
──────────────────────────────────────────────────────────────────
 00   0x05         Report ID
 01   0x0f         大小（15）
 02   0x01         固定值
 03   lightMode    灯光模式（见下表）
 04   ledSpeed     速度 — 硬件使用反转比例：6 - uiSpeed
                   UI 1（慢）→ 硬件 5 · UI 5（快）→ 硬件 1
 05   0xa8         深度休眠时间 = 10 分钟（唯一确认有效的值）
 06   R            全局颜色 — 红
 07   G            全局颜色 — 绿
 08   B            全局颜色 — 蓝
 09   0x01         休眠时间 = 0.5 分钟（唯一确认有效的值）
 10   keyResponse  防抖时间，单位 ms（4–50 ms，仅偶数值有效）
 11   count        count(ch ≥ 0x64) + 若为 BreathingDpi 则 +1
 12   checksum     sum(bytes[3..10]) & 0xff
 13   0x00         无线填充字节
 14   0x00         无线填充字节
```

### 灯光模式（字节 3）

| 值 | 模式 | 行为 |
|----|------|------|
| `0x00` | Off | LED 关闭 |
| `0x10` | Static | 固定纯色（使用字节 6–8 的 RGB） |
| `0x20` | Breathing | 呼吸全局颜色（字节 6–8） |
| `0x30` | Neon | 渐变循环彩虹色 |
| `0x40` | ColorBreathing | 呼吸同时循环颜色 |
| `0x50` | StaticDpi | 当前档位的固定颜色（来自 `0x04`） |
| `0x60` | BreathingDpi | 当前档位颜色的呼吸效果（来自 `0x04`） |

> `Static` / `Breathing` / `Neon` / `ColorBreathing` 使用字节 6–8 的 RGB 颜色。
> `StaticDpi` / `BreathingDpi` 忽略字节 6–8，使用 `0x04` 中的各档位颜色。

### 校验和计算

```
checksum = sum(bytes[3..10]) & 0xff
bytes[12] = checksum
```

> `deepSleepTime` 和 `sleepTime` 已硬编码（`0xa8` = 10 分钟，`0x01` = 0.5 分钟）。测试中其他值会导致灯光模式失效 — **请勿修改**。

---

## 5. Report 0x06 — 轮询率

**9 字节**报告，格式如下：

```
06 09 01 [rate] [checksum] 00 00 00 00
```

| 轮询率 | `[rate]` 字节 | 校验和（`0xff - rate`） |
|--------|--------------|------------------------|
| 125 Hz | `0x08` | `0xf7` |
| 250 Hz | `0x04` | `0xfb` |
| 500 Hz | `0x02` | `0xfd` |
| 1000 Hz | `0x01` | `0xfe` |

校验和 = 反码：`checksum = 0xff - rate`。

---

## 6. 输入事件（中断端点 0x83）

鼠标通过端点 `0x83` 自发发送数据包。所有数据包共享前缀 `03 55`。

| 前缀 | 字节 [2] | 含义 | 数据 |
|------|----------|------|------|
| `03 55` | `0x40` | 电量 | byte[4] = 0–100 |
| `03 55` | `0x10` | DPI 按钮被按下 | byte[3] = 档位 1–6 |

电量数据包示例：`03 55 40 01 64` → 100%。
DPI 切换示例：`03 55 10 03 00` → 档位 3。

---

## 7. 必须遵循的操作顺序

配置 DPI + 持续灯光时，必须按以下顺序操作：

```
1. DpiBuilder       → report 0x04  （DPI + 各档位颜色）
                                    ↓ 等待 300ms
2. UserPrefsBuilder → report 0x05  （动画模式 + 全局颜色 + 速度）
```

`0x04` 和 `0x05` 之间必须等待 300ms — 固件需要时间处理第一条命令才能接受第二条。

轮询率：`PollingRateBuilder` → report `0x06`（可单独发送）。

按键重映射：`MacrosBuilder` → 带 macro payload 的 report `0x04`（通过 `setMacro()`）。

---

## 8. 安全

### 危险的 Report ID

| Report ID | 状态 | 原因 |
|-----------|------|------|
| `0x04` | ✅ 安全 | DPI、颜色 — 已充分验证 |
| `0x05` | ✅ 安全 | 持续动画，需在 `0x04` 之后发送 |
| `0x06` | ✅ 安全 | 轮询率 — 已验证 |
| `0x0b` | ⛔ 危险 | 导致 2.4 GHz 接收器配对丢失 |
| 其他 | ⚠️ 未知 | 从未测试 — 无充分理由请勿使用 |

### 黄金法则

1. **不得使用 `0x04`、`0x05`、`0x06` 以外的 Report ID**，除非获得明确批准。
2. **修改任何字节后必须重新计算校验和**。
3. **最小变更原则**：测试假设时，在已知有效 payload 的基础上改动尽可能少的字节。
4. **不得修改 `wIndex`** — 只有 `wIndex=2` 有效。
5. **尽量通过有线连接测试**（`0xfa55`）：出错时不会丢失 RF 配对。

### 恢复流程（配对丢失）

若 2.4 GHz 接收器丢失配对：

1. 关闭鼠标（物理开关）。
2. 重新开启。
3. 按住**DPI 按钮**（鼠标底部），直到接收器 LED 停止闪烁。

硬件不会受到永久损坏 — 鼠标固件具有良好的容错性。

---

## 9. 调查历史

以下是得出上述结论的完整调查过程记录。

### 初始状态

原始驱动（`src/main/driver/`，基于 HarukaYamamoto0 的分支）包含一个 `UserPreferencesBuilder`（report `0x05`，15 字节），但对 LED 没有任何效果 — 鼠标始终保持出厂状态的"蓝色呼吸"模式。DPI、轮询率和宏功能均正常工作（相同的传输层，不同的 builder）。

### 阶段 1 — 诊断 `wIndex`

使用 `UserPreferencesBuilder` 的 payload 测试 `wIndex=0,1,2`：
- `wIndex=0` 和 `1` → `LIBUSB_ERROR_IO`。
- `wIndex=2` → 返回 OK，但 LED 无反应。

确认 `wIndex=2` 是正确的接口。

### 阶段 2 — Report ID 扫描

保持 `wIndex=2`，将 Report ID 从 `0x01` 变化到 `0x0c`：
- `0x01`–`0x0a`，`0x0c`：无效果。
- **`0x0b`**：LED 短暂变绿后完全熄灭。

### 配对丢失事件

在继续探索 `0x0b` 及其他 ID 的过程中（Static+红色 payload，ID `0x01`–`0x0f`），2.4 GHz 接收器**丢失配对**。诊断结果：接收器仍可通过 `lsusb` 检测到（硬件完好），鼠标通过有线连接正常响应（固件完好）。按手册操作（按住 DPI 按钮）后成功恢复配对。

**结论**：Report ID `0x0b` 似乎是系统命令（如"重置 RF 信道"或"出厂配对重置"），而非持久化配置命令。

### 阶段 3 — 外部研究（libratbag）

发现 [libratbag#1807](https://github.com/libratbag/libratbag/issues/1807)，该 issue 通过 Wireshark + 官方 Windows 软件进行了独立逆向工程。证实：
- Report `0x04`（56 字节）同时控制 DPI **和** RGB 区域颜色（issue 中为字节 20–30，对应本项目 builder 的偏移 25–42）。
- Report `0x06`（9 字节）控制轮询率。

### 阶段 4 — RGB 布局确认（脚本 diag-rgb-safe.js）

对 report `0x04` 中的颜色块进行变更：
- 颜色块 1（偏移 25–27）：改为紫色 — 无可见效果（当时激活档位为 2）。
- **颜色块 2（偏移 28–30）：改为青绿色 `5be3d2` → LED 显示青绿色。已确认。**

决定性证明：颜色块 N = 档位 N 的颜色。偏移 = `25 + (N-1)*3`。

### 阶段 5 — 字节 49 与一次性模式（脚本 diag-rgb-mode.js）

变化字节 49（`0x00`–`0x08` 及高值）：
- `0x00`：熄灭。
- `0x01`：约 3 次闪烁，然后熄灭。
- `0x02`：持续约 3 秒，然后熄灭。
- 其他值：熄灭。

结论：字节 49 仅控制确认动画 — 任何值都不能产生持续效果。

### 阶段 6 — 突破：report `0x05` 可正常工作（脚本 diag-report03-05.js）

关键测试：**先**发送 `0x04`，再立即发送 `0x05`。

结果：所有模式（`0x10` Static、`0x20` Breathing、`0x30` Neon、`0x40` ColorBreathing、`0x50` StaticDpi、`0x60` BreathingDpi）均实现了持续动画效果。

`ledSpeed` 反转比例已确认：UI 1（慢）→ 硬件 5，UI 5（快）→ 硬件 1。

原始问题根本原因：`0x05` 在 `0x04` 之前发送。固件要求先通过 `0x04` 完成初始化，才能接受动画命令。

---

## 参考资料

- 基础驱动：[HarukaYamamoto0/attack-shark-x11-driver](https://github.com/HarukaYamamoto0/attack-shark-x11-driver)（MIT）
- 修复版分支：[dressedinblack5/attack-shark-x11-electron](https://github.com/dressedinblack5/attack-shark-x11-electron)（MIT）
- 独立逆向工程：[libratbag/libratbag#1807](https://github.com/libratbag/libratbag/issues/1807)
- 官方手册（配对流程）：[manuals.plus](https://manuals.plus/m/b7d8ea1afd8e24ebb87e01493bba8a35c7ef27cd3551737ffe4a9a2e81f1818c)

---

## 10. 蓝牙 BLE — 协议与限制

### BLE 设备配置

X11 是一款三模鼠标：USB-C 有线、2.4 GHz 接收器和 Bluetooth 5.0。
在 Linux 上，BLE 连接通过 BlueZ/uhid 以 HoG（HID over GATT）设备形式出现。

```
MAC 地址：78:87:11:3E:C5:A9
设备名称：X11mouse1
```

### 相关 GATT 层级

```
服务：0000fee0-0000-1000-8000-00805f9b34fb  （厂商配置）
  fee1  read                — 当前状态（10 个零字节）
  fee2  write-without-response — （OAD/固件更新，不使用）
  fee3  write               — 命令通道（主机 → 鼠标）
  fee4  notify              — 响应通道（鼠标 → 主机）
  fee5  indicate            — 状态

服务：f000ffc0-0451-4000-b000-000000000000  （TI BLE UART）
  ffc1  write + notify      — 设备信息（返回 24 00 bf 78 42 42 42 42 cc 6e）
  ffc2  write + notify      — 电量触发（写入此处 → fee4 发出电量通知）

服务：0000180f-0000-1000-8000-00805f9b34fb  （电池服务）
  2a19  read + notify       — 标准 BLE 电量（值：100%）

服务：00001812-0000-1000-8000-00805f9b34fb  （HID over GATT）
  — 仅标准鼠标输入（按键、移动、滚轮）
  — 此设备的 BLE 不支持 Feature Reports
```

### fee3/fee4 协议

**命令格式与 USB 无线模式完全相同** — 使用相同的 builder，相同的序列化方式。

发送（fee3，`WriteValue` 必须使用 `type='request'`）：
```
write-without-response → org.bluez.Error.NotSupported
type='request'         → 正常工作
```

Payload：`DpiBuilder.build(ConnectionMode.Adapter)`（56 字节）或
         `UserPreferencesBuilder.build(ConnectionMode.Adapter)`（15 字节）。

**fee4 响应（notify）：**

| 模式                | 含义                                 |
|---------------------|--------------------------------------|
| `55 40 01 XX`       | 电量：XX = 百分比（0–100）            |
| `55 50 00 04`       | DPI 确认（report 0x04 已接受）        |
| `55 50 00 05`       | 灯光确认（report 0x05 已接受）        |
| `55 10 XX`          | DPI 档位切换（XX = 档位 1–6）         |

**通过 ffc2 触发电量读取：**
向 `ffc2` 写入任意数据（`type='request'`）会使鼠标在 fee4 上发出 `55 40 01 XX`。用于初始电量读取。

### 已确认的限制

- **轮询率**：仅限 USB 模式。BLE 下无效。
- **通过 hidraw 使用 HID Feature Reports**：`HIDIOCSFEATURE` 返回 `EINVAL` — 该鼠标的 BLE HID 描述符未声明 Feature Reports。
- **write-without-response**：返回 `NotSupported`；只有 `request`（确认写入）方式有效。

### 按键重映射（BLE）— 已确认

`MacrosBuilder` 生成 **59 字节** payload，Report ID 为 `0x08`（`wValue=0x0308`）。
通过 fee3 以 `type='request'` 方式发送后，按键重映射可正常生效。

| Payload                | Report ID | 大小  | BLE 是否有效     |
|------------------------|-----------|-------|-----------------|
| DpiBuilder             | `0x04`    | 56B   | ✅ 已确认        |
| UserPreferencesBuilder | `0x05`    | 15B   | ✅ 已确认        |
| MacrosBuilder          | `0x08`    | 59B   | ✅ 已确认        |
| CustomMacroBuilder     | `0x08`×4  | 多包  | 未测试           |
| PollingRateBuilder     | `0x06`    | 9B    | ⛔ 无效          |

### USB-C 有线模式限制

通过 USB-C 线连接（`0xfa55`）时，最大支持轮询率为 **125 Hz**。有线模式下，UI 中 250 / 500 / 1000 Hz 选项将被禁用。

### 应用实现

驱动：`src/main/driver/src/core/AttackSharkX11BLE.ts`
- 使用 `dbus-next` 通过 D-Bus 与 BlueZ 通信
- 动态发现设备（在受管对象中搜索 `fee0` UUID）
- 与 `AttackSharkX11` 相同的事件接口（batteryChange、dpiStageChange、disconnect）
- `setPollingRate()` 和 `setMacro()` 为静默空操作

通过 BLE 连接时，仅调用 `applyLightingOnly()`（DPI + 灯光）。
轮询率和宏配置将被跳过。
