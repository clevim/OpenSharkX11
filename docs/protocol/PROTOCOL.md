# Protocolo USB — Attack Shark X11

Documentação do protocolo HID reverso do mouse Attack Shark X11.
Cobre tudo que foi confirmado funcionando, o que é perigoso, e como usar cada comando.

> **Antes de enviar qualquer payload novo ao mouse:** leia a seção [Segurança](#segurança) e o [Incidente de despareamento](#incidente-de-despareamento) no histórico.

---

## Índice

1. [Hardware e Identificação](#1-hardware-e-identificação)
2. [Transporte HID](#2-transporte-hid)
3. [Report 0x04 — DPI + Iluminação](#3-report-0x04--dpi--iluminação)
4. [Report 0x05 — Modo de Animação](#4-report-0x05--modo-de-animação)
5. [Report 0x06 — Polling Rate](#5-report-0x06--polling-rate)
6. [Eventos de Entrada (Interrupt 0x83)](#6-eventos-de-entrada-interrupt-0x83)
7. [Fluxo Obrigatório](#7-fluxo-obrigatório)
8. [Segurança](#8-segurança)
9. [Histórico da Investigação](#9-histórico-da-investigação)
10. [Bluetooth BLE — Protocolo e Limitações](#10-bluetooth-ble--protocolo-e-limitações)

---

## 1. Hardware e Identificação

| Campo | Valor |
|---|---|
| Vendor ID | `0x1d57` |
| Product ID (2.4 GHz / dongle) | `0xfa60` |
| Product ID (USB com cabo) | `0xfa55` |
| Interface USB | `2` (`DEVICE_INTERFACE = 0x02`) |
| Endpoint de entrada (interrupt) | `0x83` (`INTERRUPT_ENDPOINT`) |

O mouse é **tri-mode**: **wireless** via dongle 2.4 GHz (`0xfa60`), **wired** via cabo USB-C (`0xfa55`) e **Bluetooth 5.0** (BLE). O protocolo USB é idêntico nos dois primeiros modos; apenas a detecção do `idProduct` muda. O canal BLE usa GATT e é descrito na [seção 10](#10-bluetooth-ble--protocolo-e-limitações).

---

## 2. Transporte HID

Todos os comandos são enviados via **HID Feature Report** usando `controlTransfer`:

```
bmRequestType = 0x21   (Host → Device, Class, Interface)
bRequest      = 0x09   (SET_REPORT)
wValue        = 0x03XX (0x03 = Feature Report; XX = Report ID)
wIndex        = 0x0002 (Interface 2 — única que aceita)
data          = payload do report (ver seções abaixo)
```

> `wIndex=0` e `wIndex=1` retornam `LIBUSB_ERROR_IO`. Sempre usar `wIndex=2`.

---

## 3. Report 0x04 — DPI + Iluminação

Report de **56 bytes** (`0x38`). Controla DPI, cores por estágio e uma animação de confirmação one-shot.

### Layout completo

```
Byte  Valor     Descrição
──────────────────────────────────────────────────────────
 00   0x04      Report ID
 01   0x38      Tamanho (56)
 02   0x01      Fixo
 03   angleSnap 0x00 = desligado · 0x01 = ligado
 04   ripple    0x01 = ligado · 0x00 = desligado
 05   0x3f      Fixo (propósito desconhecido)
 06   stageMask high byte (0x20 se DPI stage 6 > 12000)
 07   stageMask low byte  (0x20 no padrão)
08–13 DPI[1–6]  Estágios DPI codificados (DPI_STEP_MAP)
14–15 0x00      Fixo
16–21 highFlags 0x01 se DPI > 12000 (flags por estágio)
22–23 0x00      Fixo
 24   stage     Estágio ativo (1–6, 1-indexed)

25–27 RGB[1]    Cor do estágio 1 (R, G, B)
28–30 RGB[2]    Cor do estágio 2
31–33 RGB[3]    Cor do estágio 3
34–36 RGB[4]    Cor do estágio 4
37–39 RGB[5]    Cor do estágio 5
40–42 RGB[6]    Cor do estágio 6
43–45 RGB[7]    Extra (propósito desconhecido)
46–48 RGB[8]    Extra (propósito desconhecido)

 49   anim      Animação one-shot (ver tabela abaixo)
50–51 checksum  uint16 big-endian, soma dos bytes 3–49
52–55 0x00      Padding (apenas modo wireless)
```

### Cores por estágio

O LED exibe a cor do **estágio ativo** (`byte[24]`). Cada bloco ocupa 3 bytes (R, G, B):

| Estágio | Offsets |
|---------|---------|
| 1 | 25–27 |
| 2 | 28–30 |
| 3 | 31–33 |
| 4 | 34–36 |
| 5 | 37–39 |
| 6 | 40–42 |

O brilho é controlado pela **magnitude dos valores RGB** — valores baixos (ex: `0x08`) produzem LED visivelmente mais fraco que `0xff`.

### Animação one-shot (byte 49)

Disparada no momento em que o firmware recebe o report. Após a animação, o LED apaga. Para iluminação contínua, usar o Report `0x05` em seguida.

| byte 49 | Comportamento |
|---------|---------------|
| `0x00` | Sem animação — apaga imediatamente |
| `0x01` | ~3 piscadas rápidas, depois apagado |
| `0x02` | Sólido ~3s, depois apagado |
| outros | Apagado (firmware ignora) |

> Usar `0x00` ao querer iluminação contínua via `0x05` (evita flash de confirmação).

### Checksum

```
checksum = sum(bytes[3..49]) & 0xffff
bytes[50] = (checksum >> 8) & 0xff   // high byte
bytes[51] =  checksum & 0xff         // low byte
```

### Payload de exemplo

Estágio ativo 2, paleta padrão, sem animação one-shot:
```
04 38 01 00 01 3f 20 20 12 25 38 4b 75 81 00 00
00 00 00 00 00 01 00 00 02 ff 00 00 00 ff 00 00
00 ff ff ff 00 00 ff ff ff 00 ff ff 40 00 ff ff
ff 00 0f 68 00 00 00 00
```

---

## 4. Report 0x05 — Modo de Animação

Report de **15 bytes** (`0x0f`). Controla o modo de iluminação **contínuo** (não apaga após a animação).

**Pré-requisito obrigatório**: o Report `0x04` deve ser enviado **antes** deste. O firmware ignora `0x05` se `0x04` nunca chegou.

### Layout completo

```
Byte  Valor        Descrição
──────────────────────────────────────────────────────────────────
 00   0x05         Report ID
 01   0x0f         Tamanho (15)
 02   0x01         Fixo
 03   lightMode    Modo de iluminação (ver tabela)
 04   ledSpeed     Velocidade — hardware usa escala invertida: 6 - uiSpeed
                   UI 1 (lento) → hw 5 · UI 5 (rápido) → hw 1
 05   0xa8         deepSleepTime = 10 min (único valor confirmado funcional)
 06   R            Cor global — vermelho
 07   G            Cor global — verde
 08   B            Cor global — azul
 09   0x01         sleepTime = 0.5 min (único valor confirmado funcional)
 10   keyResponse  Debounce em ms (4–50 ms, apenas valores pares)
 11   count        count(ch ≥ 0x64) + 1 se BreathingDpi
 12   checksum     sum(bytes[3..10]) & 0xff
 13   0x00         Padding wireless
 14   0x00         Padding wireless
```

### Modos de iluminação (byte 3)

| Valor | Modo | Comportamento |
|-------|------|---------------|
| `0x00` | Off | LED apagado |
| `0x10` | Static | Cor sólida fixa (usa RGB bytes 6–8) |
| `0x20` | Breathing | Pulsa a cor global (bytes 6–8) |
| `0x30` | Neon | Cicla o arco-íris com fade |
| `0x40` | ColorBreathing | Breathing mudando de cor |
| `0x50` | StaticDpi | Cor fixa do estágio ativo (vem do `0x04`) |
| `0x60` | BreathingDpi | Breathing na cor do estágio ativo (vem do `0x04`) |

> Modos `Static` / `Breathing` / `Neon` / `ColorBreathing` usam o RGB dos bytes 6–8.
> Modos `StaticDpi` / `BreathingDpi` ignoram bytes 6–8 e usam as cores dos estágios do `0x04`.

### Checksum

```
checksum = sum(bytes[3..10]) & 0xff
bytes[12] = checksum
```

> `deepSleepTime` e `sleepTime` estão hardcoded no código (`0xa8` = 10 min, `0x01` = 0.5 min). Outros valores quebraram os modos de iluminação nos testes — **não alterar**.

---

## 5. Report 0x06 — Polling Rate

Report de **9 bytes**. Formato:

```
06 09 01 [rate] [checksum] 00 00 00 00
```

| Taxa | Byte `[rate]` | Checksum (`0xff - rate`) |
|------|--------------|--------------------------|
| 125 Hz | `0x08` | `0xf7` |
| 250 Hz | `0x04` | `0xfb` |
| 500 Hz | `0x02` | `0xfd` |
| 1000 Hz | `0x01` | `0xfe` |

Checksum = complemento de um: `checksum = 0xff - rate`.

---

## 6. Eventos de Entrada (Interrupt 0x83)

O mouse envia pacotes espontâneos pelo endpoint `0x83`. Todos têm o prefixo `03 55`.

| Prefixo | Byte [2] | Significado | Dados |
|---------|----------|-------------|-------|
| `03 55` | `0x40` | Nível de bateria | byte[4] = 0–100 |
| `03 55` | `0x10` | Botão DPI pressionado | byte[3] = estágio 1–6 |

Exemplo de pacote de bateria: `03 55 40 01 64` → 100%.
Exemplo de mudança de DPI: `03 55 10 03 00` → estágio 3.

---

## 7. Fluxo Obrigatório

Para configurar DPI + iluminação contínua, a ordem é:

```
1. DpiBuilder      → report 0x04   (DPI + cores por estágio)
                                    ↓ aguardar 300ms
2. UserPrefsBuilder → report 0x05  (modo de animação + cor global + velocidade)
```

O delay de 300ms entre `0x04` e `0x05` é necessário — o firmware precisa processar o primeiro antes de aceitar o segundo.

Para polling rate: `PollingRateBuilder` → report `0x06` (pode ser enviado separadamente).

Para mapeamento de botões: `MacrosBuilder` → report `0x04` com payload de macro (via `setMacro()`).

---

## 8. Segurança

### Report IDs perigosos

| Report ID | Status | Motivo |
|-----------|--------|--------|
| `0x04` | ✅ Seguro | DPI, cores, confirmado extensivamente |
| `0x05` | ✅ Seguro | Animação contínua, após `0x04` |
| `0x06` | ✅ Seguro | Polling rate, confirmado |
| `0x0b` | ⛔ PERIGOSO | Causou despareamento do dongle 2.4 GHz |
| demais | ⚠️ Desconhecido | Nunca testados — não usar sem necessidade |

### Regras de ouro

1. **Nunca usar Report ID diferente de `0x04`, `0x05` ou `0x06`** sem aprovação explícita.
2. **Sempre recalcular o checksum** ao modificar qualquer byte.
3. **Variações mínimas**: ao testar uma hipótese, mudar o menor número de bytes possível a partir de um payload já confirmado.
4. **Nunca mudar `wIndex`** — apenas `wIndex=2` é válido.
5. **Testar via cabo** (`0xfa55`) quando possível: se algo der errado, não perde o pareamento RF.

### Procedimento de recuperação (despareamento)

Se o dongle 2.4 GHz perder o pareamento:

1. Desligue o mouse (chave física).
2. Religue.
3. Segure o **botão de DPI** (parte inferior do mouse) até o LED do dongle parar de piscar.

O hardware não sofre dano permanente — o firmware do mouse é resiliente.

---

## 9. Histórico da Investigação

Registro cronológico de como chegamos aos resultados acima.

### Estado inicial

O driver vendorizado (`src/main/driver/`, fork de HarukaYamamoto0) tinha um `UserPreferencesBuilder` (report `0x05`, 15 bytes) que não produzia efeito no LED — o mouse ficava sempre em "respiração azul" de fábrica. DPI, polling rate e macro funcionavam perfeitamente (mesma camada de transporte, builders diferentes).

### Fase 1 — Diagnóstico de `wIndex`

Testamos `wIndex=0,1,2` com o payload do `UserPreferencesBuilder`:
- `wIndex=0` e `1` → `LIBUSB_ERROR_IO`.
- `wIndex=2` → retorno OK, sem efeito no LED.

Confirmou que `wIndex=2` é a interface correta.

### Fase 2 — Varredura de Report IDs

Mantendo `wIndex=2`, variamos o Report ID de `0x01` a `0x0c`:
- `0x01`–`0x0a`, `0x0c`: sem efeito.
- **`0x0b`**: LED ficou verde por um momento e depois apagou completamente.

### Incidente de despareamento

Continuando a explorar `0x0b` e outros IDs (payload Static+Vermelho, IDs `0x01`–`0x0f`), o dongle 2.4 GHz perdeu o pareamento. Diagnóstico: dongle ainda visível via `lsusb` (hardware intacto), mouse respondia via cabo (firmware intacto). Recuperação bem-sucedida pelo procedimento do manual (segurar botão DPI).

**Conclusão**: Report ID `0x0b` parece ser um comando de sistema (ex: "reset RF channel" ou "factory pairing reset"), não de configuração persistente.

### Fase 3 — Pesquisa externa (libratbag)

Encontramos [libratbag#1807](https://github.com/libratbag/libratbag/issues/1807), reverse-engineering independente via Wireshark + software oficial Windows. Confirmou que:

- Report `0x04` (56 bytes) controla DPI **e** RGB por zonas (bytes 20–30 no issue, que correspondem aos offsets 25–42 no nosso builder).
- Report `0x06` (9 bytes) controla polling rate.

### Fase 4 — Confirmação do layout RGB (script diag-rgb-safe.js)

Variamos cores dos blocos no report `0x04`:
- Bloco 1 (offsets 25–27): alterado para roxo — sem efeito visível (estágio ativo era 2).
- **Bloco 2 (offsets 28–30): alterado para turquesa `5be3d2` → LED exibiu cor turquesa. CONFIRMADO.**

Prova definitiva: bloco N → cor do estágio N. Offset = `25 + (N-1)*3`.

### Fase 5 — Byte 49 e modos one-shot (script diag-rgb-mode.js)

Variação de byte 49 (`0x00`–`0x08` e valores altos):
- `0x00`: apaga.
- `0x01`: ~3 piscadas, depois apagado.
- `0x02`: sólido ~3s, depois apagado.
- demais: apagado.

Conclusão: byte 49 controla apenas a animação de confirmação — nenhum valor produz efeito contínuo.

Parâmetros adicionais testados (bytes 5, 14, 15, 22, 23, blocos 7–8): sem efeito perceptível.

### Fase 6 — Breakthrough: report `0x05` funciona (script diag-report03-05.js)

Teste decisivo: enviar `0x04` **primeiro**, depois `0x05` imediatamente.

Resultado: todos os modos (`0x10` Static, `0x20` Breathing, `0x30` Neon, `0x40` ColorBreathing, `0x50` StaticDpi, `0x60` BreathingDpi) funcionaram com animação contínua.

`ledSpeed` confirmado invertido: UI 1 (lento) → hardware 5, UI 5 (rápido) → hardware 1.

Causa raiz do problema original: `0x05` era enviado antes de `0x04`. O firmware exige a inicialização via `0x04` antes de aceitar comandos de animação.

---

## Referências

- Driver base: [HarukaYamamoto0/attack-shark-x11-driver](https://github.com/HarukaYamamoto0/attack-shark-x11-driver) (MIT)
- Fork com correções: [dressedinblack5/attack-shark-x11-electron](https://github.com/dressedinblack5/attack-shark-x11-electron) (MIT)
- Reverse engineering independente: [libratbag/libratbag#1807](https://github.com/libratbag/libratbag/issues/1807)
- Manual oficial (procedimento de pareamento): [manuals.plus](https://manuals.plus/m/b7d8ea1afd8e24ebb87e01493bba8a35c7ef27cd3551737ffe4a9a2e81f1818c)

---

## 10. Bluetooth BLE — Protocolo e Limitações

### Configuração do dispositivo BLE

O X11 é um mouse tri-mode: USB-C wired, 2.4GHz dongle e Bluetooth 5.0.
No Linux, a conexão BLE aparece como dispositivo HoG (HID over GATT) via BlueZ/uhid.

```
Endereço MAC: 78:87:11:3E:C5:A9
Nome: X11mouse1
```

### Hierarquia GATT relevante

```
Service: 0000fee0-0000-1000-8000-00805f9b34fb  (Vendor config)
  fee1  read                — estado atual (10 bytes zeros)
  fee2  write-without-response — (OAD/FW update, não usado)
  fee3  write               — CANAL DE COMANDO (host → mouse)
  fee4  notify              — CANAL DE RESPOSTA (mouse → host)
  fee5  indicate            — status

Service: f000ffc0-0451-4000-b000-000000000000  (TI BLE UART)
  ffc1  write + notify      — device info (retorna 24 00 bf 78 42 42 42 42 cc 6e)
  ffc2  write + notify      — trigger de bateria (escrever aqui → fee4 emite bateria)

Service: 0000180f-0000-1000-8000-00805f9b34fb  (Battery Service)
  2a19  read + notify       — nível de bateria BLE padrão (valor: 100%)

Service: 00001812-0000-1000-8000-00805f9b34fb  (HID over GATT)
  — Apenas input padrão de mouse (botões, movimento, scroll)
  — Feature Reports NÃO suportados via HoG no BLE deste device
```

### Protocolo fee3/fee4

**Formato de comando idêntico ao USB wireless** — mesmos builders, mesma serialização.

Envio (fee3, `WriteValue` com `type='request'` obrigatório):
```
write-without-response → org.bluez.Error.NotSupported
type='request'         → funciona
```

Payload: `DpiBuilder.build(ConnectionMode.Adapter)` (56 bytes) ou
         `UserPreferencesBuilder.build(ConnectionMode.Adapter)` (15 bytes).

**Respostas via fee4 (notify):**

| Padrão              | Significado                          |
|---------------------|--------------------------------------|
| `55 40 01 XX`       | Bateria: XX = percentual (0–100)     |
| `55 50 00 04`       | ACK DPI (report 0x04 aceito)         |
| `55 50 00 05`       | ACK Lighting (report 0x05 aceito)    |
| `55 10 XX`          | Mudança de estágio DPI (XX = 1–6)    |

**Trigger de bateria via ffc2:**
Escrever qualquer dado em `ffc2` com `type='request'` faz o mouse emitir
`55 40 01 XX` em fee4. Usado para leitura inicial de bateria.

### Limitações confirmadas

- **Polling rate**: USB-only. Sem efeito via BLE.
- **HID Feature Reports via hidraw**: `HIDIOCSFEATURE` retorna `EINVAL` — o descritor BLE do mouse não declara Feature Reports.
- **Write-without-response**: retorna `NotSupported`; apenas `request` (confirmed write) funciona.

### Remap de botões via BLE — CONFIRMADO

`MacrosBuilder` gera um payload de **59 bytes** com Report ID `0x08` (`wValue=0x0308`).
Esse payload é aceito via fee3 com `type='request'` e o remap de botões é aplicado normalmente.

| Payload              | Report ID | Tamanho | Funciona via BLE |
|----------------------|-----------|---------|-----------------|
| DpiBuilder           | `0x04`    | 56B     | ✅ confirmado    |
| UserPreferencesBuilder | `0x05`  | 15B     | ✅ confirmado    |
| MacrosBuilder        | `0x08`    | 59B     | ✅ confirmado    |
| CustomMacroBuilder   | `0x08`×4  | multi   | não testado      |
| PollingRateBuilder   | `0x06`    | 9B      | ⛔ sem efeito    |

### Limitação do modo USB-C com cabo

Quando conectado via USB-C (`0xfa55`), a taxa de polling máxima suportada é **125 Hz**. As opções de 250 / 500 / 1000 Hz são desabilitadas na UI quando o modo com cabo é detectado.

### Implementação no app

Driver: `src/main/driver/src/core/AttackSharkX11BLE.ts`
- Usa `dbus-next` para comunicação com BlueZ via D-Bus
- Descobre device dinamicamente (busca por `fee0` UUID nos objetos gerenciados)
- Mesma interface de eventos que `AttackSharkX11` (batteryChange, dpiStageChange, disconnect)
- `setPollingRate()` e `setMacro()` são no-ops silenciosos

Ao conectar via BLE, apenas `applyLightingOnly()` é chamada (DPI + iluminação).
Polling rate e macros são ignorados.
