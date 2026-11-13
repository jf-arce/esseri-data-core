#!/usr/bin/env node
/**
 * Exporta `esseri-vistas.html` a un PDF con una página por vista.
 *
 * Requiere Google Chrome y Playwright (ya instalado en frontend/node_modules).
 * Une las páginas con pypdf del venv del backend.
 *
 * Uso: node docs/exportar-vistas.mjs [salida.pdf]
 */
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const require = createRequire(path.join(root, 'frontend') + path.sep)
const { chromium } = require('playwright')

const outFile = process.argv[2] || path.join(root, 'docs/entrega/Mockups-GUI.pdf')
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vistas-'))

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('file://' + path.join(here, 'esseri-vistas.html'))
await page.waitForTimeout(500)
const views = await page.evaluate(() =>
  VIEWS.map((v) => ({ number: v.number, title: v.title, width: v.width, height: v.height, html: v.html })))
await ctx.close()
console.log(`vistas: ${views.length}`)

for (const v of views) {
  const c = await browser.newContext({ viewport: { width: v.width, height: v.height } })
  const p = await c.newPage()
  await p.emulateMedia({ media: 'screen' })
  await p.setContent(v.html, { waitUntil: 'load' })
  await p.waitForTimeout(60)
  const h = await p.evaluate(() =>
    Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)))
  await p.pdf({
    path: path.join(tmpDir, `${v.number}.pdf`),
    width: `${v.width}px`,
    height: `${Math.max(v.height, h)}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  })
  await c.close()
  process.stdout.write(v.number + ' ')
}
await browser.close()

const py = path.join(root, 'backend/venv/bin/python')
execFileSync(py, [path.join(here, 'unir-pdf.py'), tmpDir, outFile], { stdio: 'inherit' })
fs.rmSync(tmpDir, { recursive: true, force: true })
