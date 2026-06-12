# SharkCtl — instruções para o Claude Code

App Electron para configurar o mouse Attack Shark X11 no Linux (CachyOS/Arch).

## ⚠️ Antes de tocar em qualquer coisa relacionada a USB/protocolo

Leia **`docs/protocol/PROTOCOL.md`** por completo. Ele documenta:
- O que já funciona (DPI, polling, botões, macro) e é seguro de variar.
- O que NÃO funciona e pode ser ignorado (`UserPreferencesBuilder`, report `0x05`).
- O que é PERIGOSO (Report ID `0x0b` já causou despareamento do dongle 2.4GHz).
- O estado atual da investigação de iluminação e o plano de próximos passos.

**Regra inegociável**: qualquer novo payload USB enviado ao mouse deve ser
uma variação mínima de um payload já confirmado funcional (report `0x04` ou
`0x06`, `wIndex=2`), com checksum recalculado. Não inventar novos Report IDs
ou `wIndex` sem que o usuário aprove explicitamente, e sempre avisando do
risco antes de enviar.

Se algo der errado e o mouse parar de responder via 2.4GHz: não é dano
permanente. Procedimento de recuperação está documentado no PROTOCOL.md
(desligar/religar o mouse + segurar o botão de DPI embaixo do mouse).

## Ambiente

- CachyOS/Arch, Node 26, Electron 34 do sistema (`/usr/lib/electron34`)
- `npm install` roda `scripts/setup-electron.mjs` automaticamente (symlink
  do Electron do sistema — não precisa de `electron-rebuild`)
- `npm run dev` — app em modo desenvolvimento
- `npm run test-usb` — verifica se o módulo `usb` enxerga o mouse
- `npm run diag-rgb-safe` — script de diagnóstico seguro de iluminação
  (variação do payload DPI confirmado, ver PROTOCOL.md seção 7)
- Fechar o app SharkCtl antes de rodar qualquer script `diag-*` ou
  `test-usb` (concorrência no dispositivo USB)

## Estrutura

```
src/main/           — main process Electron (IPC, fila USB, persistência)
src/main/driver/    — driver USB vendorizado (fork de HarukaYamamoto0)
src/main/driver/src/protocols/  — builders de payload (DpiBuilder, etc)
src/preload/        — bridge contextBridge
src/renderer/       — UI (HTML/CSS/JS vanilla, sem framework)
scripts/            — utilitários de diagnóstico e setup
docs/protocol/      — investigação do protocolo USB
aur/                — empacotamento Arch (PKGBUILD)
```

## Fluxo de trabalho recomendado para a investigação de iluminação

1. Rodar o script de diagnóstico relevante, com o usuário observando o LED
   físico do mouse.
2. Documentar cada resultado (payload enviado + observação) direto no
   PROTOCOL.md, na seção de histórico — isso é o que permite continuar a
   investigação em sessões futuras sem perder contexto.
3. Só depois de um layout confirmado por pelo menos 2-3 testes consistentes,
   propor mudanças no `DpiBuilder`/novo `LightingBuilder` e no main process.
4. Mudanças na UI (`renderLight()`) só depois do protocolo estar validado —
   não vale a pena redesenhar a aba antes de saber o modelo real (cor
   por estágio de DPI vs cor global).
