#!/usr/bin/env node
// Aponta node_modules/electron para o binário do sistema (electron34 no Arch/CachyOS)
// Evita depender do electron-rebuild (incompatível com Node 26+ no momento).
import { existsSync, mkdirSync, writeFileSync, symlinkSync, unlinkSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const electronPkgDir = join(root, 'node_modules', 'electron')

if (!existsSync(electronPkgDir)) {
  console.log('[setup-electron] node_modules/electron não encontrado — pulando (rode npm install primeiro)')
  process.exit(0)
}

// candidatos conhecidos de instalação do Electron via pacman no Arch/CachyOS
const candidates = [
  process.env.SHARKCTL_ELECTRON_DIR,
  '/usr/lib/electron34',
  '/usr/lib/electron36',
  '/usr/lib/electron39',
  '/usr/lib/electron31',
  '/usr/lib/electron',
].filter(Boolean)

let distDir = null
for (const c of candidates) {
  if (c && existsSync(join(c, 'electron'))) { distDir = c; break }
}

if (!distDir) {
  console.warn('[setup-electron] Nenhuma instalação de Electron do sistema encontrada em:', candidates)
  console.warn('[setup-electron] Instale com: sudo pacman -S electron34')
  console.warn('[setup-electron] Ou defina SHARKCTL_ELECTRON_DIR=/caminho/para/electronXX')
  process.exit(0) // não falha o install
}

// 1. path.txt sem newline (Node escreve sem \n por padrão com writeFileSync)
const pathFile = join(electronPkgDir, 'path.txt')
writeFileSync(pathFile, 'electron')

// 2. symlink dist/electron -> binário do sistema
const distLink = join(electronPkgDir, 'dist', 'electron')
mkdirSync(join(electronPkgDir, 'dist'), { recursive: true })
if (existsSync(distLink) || (() => { try { readFileSync(distLink); return false } catch { return true } })() === false) {
  try { unlinkSync(distLink) } catch {}
}
try { unlinkSync(distLink) } catch {}
symlinkSync(join(distDir, 'electron'), distLink)

console.log(`[setup-electron] OK — usando Electron do sistema em ${distDir}/electron`)
