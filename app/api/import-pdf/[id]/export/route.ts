import { type NextRequest, NextResponse } from "next/server"
import { PDFDocument, rgb } from "pdf-lib"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { ImportedPdfInfo, PdfLayoutBlock, PdfLayoutEditState } from "@/lib/project-schema"

interface RouteContext {
  params: { id: string }
}

interface ImportedPdfContent {
  projectType?: unknown
  importedPdf?: unknown
  layoutEditState?: Partial<PdfLayoutEditState>
}

function getImportedPdf(content: unknown): ImportedPdfInfo | null {
  if (
    typeof content !== "object" ||
    content === null ||
    (content as ImportedPdfContent).projectType !== "imported_pdf"
  ) {
    return null
  }

  const importedPdf = (content as ImportedPdfContent).importedPdf
  if (
    typeof importedPdf !== "object" ||
    importedPdf === null ||
    typeof (importedPdf as { storageBucket?: unknown }).storageBucket !== "string" ||
    typeof (importedPdf as { storagePath?: unknown }).storagePath !== "string"
  ) {
    return null
  }

  return importedPdf as ImportedPdfInfo
}

function getLayout(content: unknown): PdfLayoutEditState {
  const raw =
    typeof content === "object" && content !== null
      ? (content as ImportedPdfContent).layoutEditState
      : undefined

  return {
    version: 1,
    deletedPages: raw?.deletedPages ?? [],
    pageOrder: raw?.pageOrder ?? [],
    visualBlocks: raw?.visualBlocks ?? [],
    textOverlays: raw?.textOverlays ?? {},
    patchFills: raw?.patchFills ?? {},
  }
}

function safeFilename(name: string) {
  return name.replace(/\.pdf$/i, "").replace(/[^a-z0-9\-_. ]/gi, "_").trim() || "corrected-pdf"
}

function toPdfRect(block: PdfLayoutBlock, pageWidth: number, pageHeight: number) {
  const x = block.x * pageWidth
  const y = pageHeight - (block.y + block.height) * pageHeight
  const width = block.width * pageWidth
  const height = block.height * pageHeight
  return { x, y, width, height }
}

function getSource(block: PdfLayoutBlock): PdfLayoutBlock {
  return {
    ...block,
    pageIndex: block.sourcePageIndex ?? block.pageIndex,
    x: block.sourceX ?? block.x,
    y: block.sourceY ?? block.y,
    width: block.sourceWidth ?? block.width,
    height: block.sourceHeight ?? block.height,
  }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("title, content")
    .eq("id", params.id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const importedPdf = getImportedPdf(project.content)
  if (!importedPdf) {
    return NextResponse.json({ error: "Project is not an imported PDF" }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: originalBlob, error: downloadError } = await service.storage
    .from(importedPdf.storageBucket)
    .download(importedPdf.storagePath)

  if (downloadError || !originalBlob) {
    return NextResponse.json(
      { error: downloadError?.message ?? "Could not load original PDF" },
      { status: 500 }
    )
  }

  const originalBytes = await originalBlob.arrayBuffer()
  const sourceDoc = await PDFDocument.load(originalBytes)
  const outputDoc = await PDFDocument.create()
  const layout = getLayout(project.content)
  const deleted = new Set(layout.deletedPages)
  const pageMap = new Map<number, number>()

  const sourcePageCount = sourceDoc.getPageCount()
  for (let sourceIndex = 0; sourceIndex < sourcePageCount; sourceIndex += 1) {
    if (deleted.has(sourceIndex)) continue
    const [copiedPage] = await outputDoc.copyPages(sourceDoc, [sourceIndex])
    pageMap.set(sourceIndex, outputDoc.getPageCount())
    outputDoc.addPage(copiedPage)
  }

  for (const block of layout.visualBlocks) {
    if (block.type !== "visual_region") continue
    if (deleted.has(block.pageIndex)) continue

    const source = getSource(block)
    const destPageIndex = pageMap.get(block.pageIndex)
    if (destPageIndex === undefined) continue
    if (source.pageIndex < 0 || source.pageIndex >= sourcePageCount) continue

    const sourcePage = sourceDoc.getPage(source.pageIndex)
    const { width: sourcePageWidth, height: sourcePageHeight } = sourcePage.getSize()
    const crop = toPdfRect(source, sourcePageWidth, sourcePageHeight)
    if (crop.width <= 0 || crop.height <= 0) continue

    const embeddedRegion = await outputDoc.embedPage(sourcePage, {
      left: crop.x,
      bottom: crop.y,
      right: crop.x + crop.width,
      top: crop.y + crop.height,
    })

    const destPage = outputDoc.getPage(destPageIndex)
    const { width: destPageWidth, height: destPageHeight } = destPage.getSize()

    const originalOutputIndex = pageMap.get(source.pageIndex)
    if (originalOutputIndex !== undefined) {
      const originalPage = outputDoc.getPage(originalOutputIndex)
      const { width, height } = originalPage.getSize()
      const originalRect = toPdfRect(source, width, height)
      originalPage.drawRectangle({
        x: originalRect.x,
        y: originalRect.y,
        width: originalRect.width,
        height: originalRect.height,
        color: rgb(1, 1, 1),
      })
    }

    const destRect = toPdfRect(block, destPageWidth, destPageHeight)
    destPage.drawPage(embeddedRegion, {
      x: destRect.x,
      y: destRect.y,
      width: destRect.width,
      height: destRect.height,
    })
  }

  const correctedBytes = await outputDoc.save()
  const filename = `${safeFilename(project.title)}-corrected.pdf`

  return new NextResponse(Buffer.from(correctedBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(correctedBytes.byteLength),
    },
  })
}
