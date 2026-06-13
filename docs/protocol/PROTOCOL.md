# Protocolo do Attack Shark X11 — Investigação de Iluminação RGB

> **Leia isto inteiro antes de enviar qualquer comando novo ao mouse.**
> Já tivemos um incidente de despareamento durante esta investigação (ver
> seção "Incidente"). O hardware está saudável, mas comandos não verificados
> têm efeitos colaterais reais e às vezes irreversíveis sem o procedimento
> de repareamento manual.

## TL;DR para o Claude Code

- Hardware: Attack Shark X11, vendor `0x1d57`, 2.4GHz `idProduct=0xfa60`,
  wired `idProduct=0xfa55`. Conexão via `usb` (node), controlTransfer
  `bmRequestType=0x21, bRequest=0x09`.
- **Reports que JÁ FUNCIONAM e são SEGUROS de variar**: `0x04` (DPI, 56 bytes,
  `wValue=0x0304`), `0x06` (polling rate, `wValue=0x0306`), MacrosBuilder,
  CustomMacroBuilder. Todos com `wIndex=2`.
- **Report `0x05` (UserPreferencesBuilder) FUNCIONA** — controla animações
  contínuas (Static, Breathing, Neon, ColorBreathing, StaticDpi, BreathingDpi).
  **Pré-requisito obrigatório**: enviar `0x04` antes; `0x05` sozinho não tem
  efeito. Ordem: `0x04` (DPI + cores) → `0x05` (modo de animação + velocidade).
- **Report PERIGOSO, NÃO REUTILIZAR sem motivo muito forte**: Report ID
  `0x0b` (`wValue=0x030b`) — causa efeito visual (LED verde → apaga) e
  aparenta interferir no estado do rádio/pareamento 2.4GHz.
- **A iluminação real provavelmente está dentro do report `0x04`** (mesmo
  do DPI), nos bytes 25-47 — ver seção "Descoberta do layout RGB".
- **REGRA DE OURO**: toda nova hipótese de payload deve ser uma variação
  mínima (idealmente só os bytes de cor) de um payload **já confirmado
  funcional**, com checksum recalculado. Nunca testar Report IDs novos
  ou `wIndex` diferentes de 2 sem necessidade comprovada.

---

## Histórico da investigação

### 1. Estado inicial
O driver vendorizado (`src/main/driver/`, fork de
[HarukaYamamoto0/attack-shark-x11-driver](https://github.com/HarukaYamamoto0/attack-shark-x11-driver))
tinha um `UserPreferencesBuilder` (report `0x05`, 15 bytes) supostamente
responsável por modo de luz, RGB, velocidade do LED, sleep timers e key
response. Copiamos uma versão "corrigida" desse builder do fork
[dressedinblack5/attack-shark-x11-electron](https://github.com/dressedinblack5/attack-shark-x11-electron).

**Resultado**: `setUserPreferences()` sempre retorna sucesso (sem erro USB),
mas o LED do mouse nunca muda — fica sempre em "respiração azul" (padrão de
fábrica). DPI, polling rate, botões e macro funcionam perfeitamente (mesma
camada de transporte, builders diferentes).

### 2. Diagnóstico fase 1 (`wIndex`)
Testamos o payload do `UserPreferencesBuilder` com `wIndex=0,1,2`.
- `wIndex=0` e `wIndex=1` → `LIBUSB_ERROR_IO` (interfaces não aceitam).
- `wIndex=2` → sempre `OK`, mas sem efeito. Confirma que `wIndex=2` é a
  interface correta (mesma usada por DPI/polling que funcionam).

### 3. Diagnóstico fase 2 (Report ID)
Mantendo `wIndex=2`, variamos o **Report ID** (byte 0 do payload) de
`0x01` a `0x0c`, com `wValue = 0x03XX` (high byte `0x03` = HID Feature
Report, low byte = Report ID — convenção HID padrão).

- `0x01`–`0x0a`, `0x0c`: sem efeito visível.
- **`0x0b` (`wValue=0x030b`)**: LED reagiu — ficou **verde e depois apagou
  completamente**.

### 4. Incidente de despareamento
Continuando a explorar `0x0b` e outros IDs na fase 4 (payload Static+Vermelho
completo, todos os IDs 0x01-0x0f), o dongle 2.4GHz **perdeu o pareamento**
com o mouse — LED do dongle ficou piscando, mouse não respondia.

- **Diagnóstico**: dongle continuou visível via `lsusb`/`usb.getDeviceList()`
  (`idProduct=0xfa60` presente) — hardware do dongle intacto.
- **Teste via cabo**: mouse respondeu normalmente via `idProduct=0xfa55`
  (wired) — firmware do mouse intacto, sem dano.
- **Recuperação**: procedimento oficial do manual — *"Mouse not connecting
  (2.4G): Ensure the receiver is properly plugged in... Try re-pairing by
  holding the DPI button."* Usuário desligou/religou o mouse e **segurou o
  botão de DPI** (parte inferior do mouse) → repareou com sucesso.

**Conclusão**: Report ID `0x0b` (e possivelmente outros não testados)
parecem ser comandos de **ação/sistema** (ex: "identify", "reset RF
channel", "factory pairing reset") em vez de configuração persistente.
Enviar payloads arbitrários para Report IDs desconhecidos pode interferir
no estado do rádio 2.4GHz.

### 5. Pesquisa: issue do libratbag
Encontramos [libratbag/libratbag#1807](https://github.com/libratbag/libratbag/issues/1807),
que documenta reverse-engineering independente do X11 via Wireshark +
software oficial Windows. Achados relevantes:

> The X11 uses two distinct report types for configuration: a 56-byte Bulk
> Profile for persistent settings and a 9-byte Short Report for real-time
> hardware changes.
>
> **A. Configuration Profile (Report ID 04)** — 56-byte ($0x38$) Feature
> Report.
> - Bytes 05-10: DPI Stage Indices (6 slots)
> - **Bytes 20-30: RGB Zone Data (24-bit RGB hex codes)**
>
> **B. Polling Rate (Report ID 06)** — 9-byte command with checksum.
> Format: `06 09 01 [Value] [Checksum] 00 00 00 00`. Checksum = one's
> complement (`0xFF - Value`).

Isso é uma **pista forte**: a iluminação não é um report separado — está
embutida no mesmo report `0x04` do DPI, que já confirmamos funcionar no
nosso hardware.

> Nota: os offsets exatos do issue (20-30) não coincidem 1:1 com os offsets
> do nosso `DpiBuilder` local (25-47) — o issue pode estar usando indexação
> ligeiramente diferente (ex: sem contar os 3 bytes de header, ou um Report
> ID de tamanho/versão diferente). Tratar como pista, não como verdade
> absoluta — validar empiricamente.

### 6. Descoberta do layout RGB (análise local)
Reconstruímos o payload exato que o `DpiBuilder` gera (e que já foi enviado
com sucesso) e analisamos os bytes "fixos" que o builder atual hardcoda:

```
offset  3: 0x00  (angleSnap)
offset  4: 0x01  (rippleControl)
offset  5: 0x3f  (fixo)
offset 6-7: stage mask (0x20 0x20 no default — stage 6=22000 > 12000)
offset 8-13: DPI stages encoded (tabela DPI_STEP_MAP)
offset 14-15: 0x00 (fixo)
offset 16-21: high-stage flags (0x01 se DPI em [10100,12000] ou [20100,22000])
offset 22-23: 0x00 (fixo)
offset 24: estágio ativo (1-6)
offset 25-47: 8 blocos de 3 bytes (RGB!) — ver tabela abaixo
offset 48: 0xff (fixo, não confirmado)
offset 49: 0x02 (fixo, possível seletor de modo/efeito)
offset 50-51: checksum (uint16BE, soma dos bytes 3-49)
offset 52-55: padding (modo wireless)
```

**Paleta de 8 cores encontrada nos offsets fixos do `DpiBuilder`:**

| Offset | Cor (hex) | Nome aproximado |
|--------|-----------|-----------------|
| 25-27  | `ff0000`  | Vermelho |
| 28-30  | `00ff00`  | Verde |
| 31-33  | `0000ff`  | Azul |
| 34-36  | `ffff00`  | Amarelo |
| 37-39  | `00ffff`  | Ciano |
| 40-42  | `ff00ff`  | Magenta |
| 43-45  | `ff4000`  | Laranja |
| 46-48  | `ffffff`  | Branco |

Hipótese: 6 destes blocos correspondem aos 6 estágios de DPI (cada estágio
tem uma cor própria — confirmado pelo manual oficial: *"Each DPI setting is
indicated by a different color light inside the mouse"*), e os 2 extras são
para outro propósito (talvez modo "todos"/idle/desligado).

**Payload base verificado** (idêntico ao `DpiBuilder` default, byte a byte):
```
04380100013f20201225384b75810000000000000001000002ff000000ff000000ffffff0000ffffff00ffff4000ffffff020f6800000000
```

### 7. Primeiro teste do script — CONFIRMAÇÃO DO LAYOUT RGB (2026-06-12)

`scripts/diag-rgb-safe.js` executado. Payload base: estágio ativo = 2,
blocos de cor padrão (bloco1=`ff0000`, bloco2=`00ff00`, etc).

**Teste 1** — bloco 1 (offsets 25-27) `ff0000` → roxo `a259ff`:
- Payload enviado: `04380100013f20201225384b75810000000000000001000002a259ff00ff000000ffffff0000ffffff00ffff4000ffffff02106300000000`
- Resultado observado: **piscou verde e desligou**
- Análise: mudar bloco 1 não teve efeito visível — o estágio ativo era 2,
  então o LED continuou exibindo a cor do bloco 2 (`00ff00` = verde).
  "Desligou" = fase off do modo breathing (byte 49 = `0x02`).

**Teste 2** — bloco 2 (offsets 28-30) `00ff00` → turquesa `5be3d2`:
- Payload enviado: `04380100013f20201225384b75810000000000000001000002ff00005be3d20000ffffff0000ffffff00ffff4000ffffff02107900000000`
- Resultado observado: **piscou meio ciano e desligou**
- Análise: turquesa (`5be3d2`) ≈ ciano — mudança de cor **confirmada**.
  **PROVA DEFINITIVA**: bloco 2 (offsets 28-30) = cor do estágio 2.

**Teste 3** — paleta original restaurada:
- Payload enviado: `04380100013f20201225384b75810000000000000001000002ff000000ff000000ffffff0000ffffff00ffff4000ffffff020f6800000000`

---

### 8. Mapeamento do byte 49 — modos/efeitos (2026-06-12)

`scripts/diag-rgb-mode.js` — fase 1 (`0x00`-`0x03`) e fase 2 (`0x04`-`0x08`).

| byte 49 | Comportamento observado |
|---------|------------------------|
| `0x00`  | LED apagado |
| `0x01`  | Pisca verde ~3-4x e para (blink finito) |
| `0x02`  | Breathing (acende verde, fica alguns segundos, apaga) |
| `0x03`  | LED apagado |
| `0x04`–`0x08` | LED apagado (firmware ignora valores desconhecidos) |

**Fase 3 — valores altos + bytes 14-15 (2026-06-12):**

| Teste | Observado |
|-------|-----------|
| `byte49=0x0a` | apagado |
| `byte49=0x10` | apagado |
| `byte49=0xff` | apagado |
| `byte49=0x02 + byte14=0x01` | "acendeu verde por um tempo e desligou" (sem diferença perceptível) |
| `byte49=0x02 + byte14=0xff` | "acendeu verde e desligou" (sem diferença) |
| `byte49=0x02 + byte15=0x01` | "acendeu verde e desligou" (sem diferença) |

**Conclusão final sobre byte 49 — animações one-shot (2026-06-12):**

Nenhum dos valores produz efeito **contínuo**. Byte 49 controla a animação
de confirmação disparada no momento em que o payload é recebido. Após a
animação, o LED apaga e permanece apagado.

| byte 49 | Animação one-shot |
|---------|-------------------|
| `0x00` | Nenhuma — apaga imediatamente |
| `0x01` | ~2 piscadas rápidas, depois apagado |
| `0x02` | Sólido ~3s (sem fade/gradiente), depois apagado |
| outros | Apagado (firmware ignora) |

**Respiração azul de fábrica** = estado padrão do firmware *antes* de qualquer
configuração USB. Uma vez enviado o report `0x04`, o mouse entra em
"modo configurado": LED apagado, só acende brevemente ao trocar de estágio
pelo botão físico de DPI.

**Investigação de parâmetros adicionais (2026-06-12) — fases 4-5:**

Testados com scripts `diag-anim-params.js` e `diag-anim-params2.js`:

| Bytes testados | Efeito sobre LED |
|---------------|-----------------|
| Byte 5 (`0x3f`) — variado de `0x00` a `0xff` | Sem efeito na duração ou comportamento |
| Bytes 14-15 | Sem efeito |
| Bytes 22-23 | Sem efeito na contagem de blinks |
| Bloco 7 (43-45) zerado ou variado | Sem efeito |
| Bloco 8 (46-48) zerado | Sem efeito |
| Bloco7[0] como contador de blinks (`0x01`, `0x05`) | Sempre 3 blinks — ignorado |
| Estágio ativo como contador de blinks (1, 3, 5) | Sempre 3 blinks — não relacionado |
| RGB `0x08` vs `0xff` | **Brilho percebido muda** — `0x08` visivelmente mais fraco ✓ |

**Mapa final do que controlamos via USB (atualizado 2026-06-12):**

Via report `0x04`:
- ✅ Cor por estágio (blocos 1-6, offsets 25-42)
- ✅ Brilho (via magnitude dos valores RGB)
- ✅ Animação one-shot ao receber config (byte 49: 0x00=off, 0x01=blink, 0x02=flash 3s)
- ❌ Contagem de blinks — hardcoded = 3 no firmware
- ❌ Duração do flash — hardcoded ~3s no firmware

Via report `0x05` (depois de `0x04`):
- ✅ Modo de animação contínua (Static/Breathing/Neon/ColorBreathing/StaticDpi/BreathingDpi)
- ✅ Cor global para modos não-DPI (Static, Breathing, Neon, ColorBreathing)
- ✅ Velocidade da animação (ledSpeed 1=lento … 5=rápido)
- ✅ Para modos DPI (StaticDpi/BreathingDpi): cor vem dos blocos de `0x04`

---

### 9. BREAKTHROUGH — report `0x05` funciona! (2026-06-12)

`scripts/diag-report03-05.js` — teste de `0x05` APÓS inicialização com `0x04`.

**Contexto**: todos os testes anteriores de `0x05` foram feitos antes de enviar
`0x04` (mouse em estado de fábrica). O firmware exige que `0x04` seja recebido
primeiro para aceitar comandos `0x05`.

**Modo base 0x04**: todos os blocos = azul (`0x00 0x00 0xff`), byte49=`0x02` (flash).
Após o flash azul (3s), `0x05` enviado imediatamente para cada modo:

| Modo | Byte 3 | Comportamento observado |
|------|--------|------------------------|
| Static | `0x10` | LED verde **sólido e contínuo** ✓ |
| Breathing | `0x20` | **Breathing verde contínuo** — não para ✓ |
| Neon | `0x30` | **Troca de cores com fade rápido, contínuo** ✓ |
| ColorBreathing | `0x40` | **Breathing com mudança de cor, contínuo** ✓ |
| StaticDpi | `0x50` | LED **azul sólido** (cor do `0x04`), DPI button não mudava cor* ✓ |
| BreathingDpi | `0x60` | Breathing azul; botão DPI **reseta** a animação mas mantém azul* ✓ |

*Azul em todos os estágios porque o `0x04` de inicialização tinha todos os
blocos iguais. Com paleta diversa por estágio, DPI button deve mudar a cor.

**ledSpeed** (`0x05` byte 4 = `6 - userSpeed`):
- `ledSpeed=1` (hardware=5) → **visivelmente mais lento** ✓
- `ledSpeed=5` (hardware=1) → **visivelmente mais rápido** ✓

**Report `0x03`** (mesmo formato 56-byte que `0x04`, ID=`0x03`):
- Mouse ficou em breathing azul (estado do BreathingDpi anterior mantido)
- `0x03` não produz efeito visual distinto — pode ser ignorado ou alias de `0x04`

**Relatórios de entrada (interrupt endpoint 0x83) — confirmados 2026-06-13:**

| Pacote (hex) | Significado |
|---|---|
| `03 55 40 01 <nivel>` | Nível de bateria (0-100) |
| `03 55 10 <stage> 00` | Botão físico DPI pressionado — stage 1-6 (1-indexed) |

Todos os pacotes compartilham o prefixo `03 55`. Byte 2 discrimina o tipo:
- `0x40` = bateria (byte 4 = nível)
- `0x10` = mudança de estágio DPI (byte 3 = estágio 1-6)

---

**Estrutura confirmada do payload `0x05` (15 bytes):**
```
[0]  = 0x05  (Report ID)
[1]  = 0x0f  (len=15)
[2]  = 0x01  (fixo)
[3]  = lightMode  (0x00/0x10/0x20/0x30/0x40/0x50/0x60)
[4]  = (6 - ledSpeed) & 0x0f  (hardware speed invertida)
[5]  = 0xa8  (deepSleep = 10min)
[6]  = R
[7]  = G
[8]  = B
[9]  = 0x01  (sleep = 0.5min)
[10] = 0x04  (keyResponse = 8ms)
[11] = count(ch ≥ 0x64) + (1 se BreathingDpi)
[12] = checksum (sum bytes 3-10, & 0xff)
[13] = 0x00  (padding wireless)
[14] = 0x00  (padding wireless)
```

**Fluxo obrigatório para animação contínua:**
```
1. setDpi(DpiBuilder)      → report 0x04 (DPI + cores por estágio, byte49=0x00)
2. setUserPrefs(UserPrefs) → report 0x05 (modo animação + cor global + speed)
```

---

### Conclusões confirmadas (2026-06-12)

1. **Report `0x04` controla o LED** — confirmado empiricamente. ✓
2. **`buf[24]` (estágio ativo) determina qual bloco de cor é exibido.**
   Mapeamento: estágio N → bloco N → offsets `25 + (N-1)*3` a `27 + (N-1)*3`.
3. **Byte 49 do `0x04`** = animação one-shot (confirmação): `0x00`=off, `0x01`=blink, `0x02`=flash sólido 3s.
4. **Report `0x05` (UserPreferencesBuilder) FUNCIONA** para animações contínuas,
   mas precisa ser enviado APÓS `0x04`. ✓
5. Modos DPI (`0x50`/`0x60`) usam as cores por estágio do `0x04`; modos globais
   (`0x10`–`0x40`) usam o RGB do próprio `0x05`.
6. `ledSpeed` é real e funcional (usuário 1-5 → hardware 5-1 invertido).

**Comando**: `npm run diag-rgb-safe` (fechar o app antes).

---

## Regras de segurança para próximos testes

1. **Nunca enviar um Report ID que não seja `0x04` ou `0x06`** sem motivo
   muito bem justificado — esses dois são os únicos confirmados seguros.
2. **Sempre recalcular o checksum** (offsets 50-51, uint16BE, soma de
   bytes 3-49) ao modificar qualquer byte do payload `0x04`.
3. **Variações mínimas**: ao testar uma hipótese, mude o menor número de
   bytes possível a partir de um payload conhecido-bom.
4. **Tenha o procedimento de repareamento sempre à mão**: desligar o mouse,
   religar, segurar o botão de DPI (embaixo do mouse) até repareear.
5. **Teste via cabo quando possível**: `idProduct=0xfa55` (wired) é mais
   resiliente — se algo der errado, não perde pareamento RF (mas pode
   persistir configuração ruim na EEPROM; use com cautela também).
6. Se algo causar o mouse a desconectar/parar de responder: **não pânico**.
   Hardware é resiliente (já provamos). Documentar o payload exato enviado
   antes de tentar recuperar.

---

## Plano de próximos passos

### Fase atual: mapear os blocos de cor por estágio

1. **[FEITO ✓]** Confirmar que report `0x04` controla o LED — confirmado 2026-06-12.
2. **[FEITO ✓]** Mapear byte 49 (modos): Off=`0x00`, Blink=`0x01`, Breathing=`0x02` — confirmado 2026-06-12.

3. **[FEITO ✓]** Mapear os blocos de cor por estágio — confirmado 2026-06-12.
   Mapeamento definitivo: **bloco N (offset 25+(N-1)×3) = cor do estágio N**.
   Blocos 7-8 (offsets 43-48) ainda não mapeados (idle/global/desconhecido).

4. **[FEITO ✓]** `DpiBuilder` estendido com `setStageColor()` e `setLedMode()` — 2026-06-12.

5. **[EM ANDAMENTO]** Atualizar `applyAll()` no main process:
   - Enviar `0x04` (DPI + cores por estágio, byte49=`0x00`)
   - Enviar `0x05` (modo de animação + cor global + ledSpeed)
   - `AppState.lighting` deve incluir: `mode` (LightMode enum), `stageColors` [6×RgbColor],
     `globalColor` (RgbColor para modos não-DPI), `ledSpeed` (1-5).

6. **[PENDENTE]** Validar StaticDpi/BreathingDpi com paleta diversa por estágio:
   enviar `0x04` com 6 cores diferentes, depois `0x05` com `0x50`/`0x60`,
   pressionar botão DPI físico para confirmar que a cor do LED muda.

7. **[PENDENTE]** Atualizar a UI (`renderLight()`) com 6 modos de animação
   + seletor de velocidade + cor por estágio + cor global para modos não-DPI.

8. **[PENDENTE]** Animações condicionais via código JS (sirene, bateria, notificação,
   beat-sync de música) — possível via loop no main process alternando payloads
   `0x04` + `0x05` rapidamente (ex: trocar cor global a cada 500ms para sirene).
   Não requer novos report IDs — tudo via `0x04`/`0x05` alternados.

---

## Referências

- Driver base: https://github.com/HarukaYamamoto0/attack-shark-x11-driver (MIT)
- Fork com correções de luz (não resolveu): https://github.com/dressedinblack5/attack-shark-x11-electron (MIT)
- Reverse engineering independente: https://github.com/libratbag/libratbag/issues/1807
- Manual oficial (procedimento de pareamento): https://manuals.plus/m/b7d8ea1afd8e24ebb87e01493bba8a35c7ef27cd3551737ffe4a9a2e81f1818c
