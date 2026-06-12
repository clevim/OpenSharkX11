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
- **Report que NÃO FAZ NADA** (sempre retorna OK mas firmware ignora):
  `UserPreferencesBuilder`, `wValue=0x0305`, Report ID `0x05`. Pode ser
  removido/ignorado com segurança — não causa erro, só não tem efeito.
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

### 7. Script seguro criado, ainda não executado
`scripts/diag-rgb-safe.js`: usa o payload base acima (idêntico ao já
confirmado funcional), e só sobrescreve:
1. Offsets 25-27 (bloco 1) → roxo `a259ff`
2. Offsets 28-30 (bloco 2, = estágio ativo no default) → turquesa `5be3d2`
3. Restaura a paleta original

Recalcula o checksum (offsets 50-51) a cada variação. **Não toca em**
`wValue`, `wIndex`, ou Report ID — usa exatamente `0x0304`/`wIndex=2`/
Report ID `0x04`, que é o mesmo já usado pelo DPI.

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

1. Rodar `npm run diag-rgb-safe` e documentar o resultado (a cor da luz do
   mouse mudou? para qual cor? em qual estágio de DPI?).
2. Se confirmado que offsets 25-47 controlam cor por estágio de DPI:
   - Mapear qual dos 8 blocos corresponde a qual estágio (1-6) e o que são
     os 2 blocos extras.
   - Testar se byte 49 (atualmente `0x02`) controla modo/efeito (Static vs
     Breathing vs Off) — variar com cautela, sempre a partir do payload
     base, um valor por vez (`0x00`, `0x01`, `0x03`...).
   - Testar se velocidade do efeito (LED speed) está em algum outro byte
     ainda não mapeado (candidatos: 14-15, 22-23, ou parte do 48-49).
3. Uma vez mapeado, estender `DpiBuilder` (ou criar `LightingBuilder` que
   compartilha o mesmo report `0x04`) com setters para cor por estágio e
   modo/efeito.
4. Atualizar `applyAll()` no main process para enviar a config de
   iluminação dentro do mesmo `setDpi()` (não em report separado).
5. Atualizar a UI (`renderLight()`) para refletir o modelo real: cor **por
   estágio de DPI**, não uma cor global única — provavelmente precisa de
   redesign da aba de Iluminação.
6. Remover/depreciar `UserPreferencesBuilder` (report `0x05`) do código,
   ou mantê-lo apenas para os campos que talvez funcionem de fato
   (sleepTime/deepSleepTime/keyResponse — não testados ainda, podem estar
   noutro report também).

---

## Referências

- Driver base: https://github.com/HarukaYamamoto0/attack-shark-x11-driver (MIT)
- Fork com correções de luz (não resolveu): https://github.com/dressedinblack5/attack-shark-x11-electron (MIT)
- Reverse engineering independente: https://github.com/libratbag/libratbag/issues/1807
- Manual oficial (procedimento de pareamento): https://manuals.plus/m/b7d8ea1afd8e24ebb87e01493bba8a35c7ef27cd3551737ffe4a9a2e81f1818c
