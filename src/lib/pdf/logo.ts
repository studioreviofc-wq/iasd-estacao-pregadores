import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

import { siteConfig } from "@/config/site"

/**
 * Logotipo para o PDF (PNG ou JPG em /public). SVG não é suportado pelo
 * gerador de PDF — use `siteConfig.pdfLogoSrc` com uma versão PNG.
 */
export async function loadPdfLogo(): Promise<Buffer | null> {
  const src = siteConfig.pdfLogoSrc ?? siteConfig.logoSrc
  if (!src || !/\.(png|jpe?g)$/i.test(src)) return null
  try {
    return await readFile(path.join(process.cwd(), "public", src.replace(/^\//, "")))
  } catch {
    return null
  }
}
