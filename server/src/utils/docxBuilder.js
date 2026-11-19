import fs from 'fs'
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun
} from 'docx'

const INSTITUTION_NAME = process.env.INSTITUTION_NAME || 'Institution Name'
const INSTITUTION_TAGLINE =
  process.env.INSTITUTION_TAGLINE || 'Institutional Committee Management & Compliance Portal'

/**
 * @param {string} subtitle - the document title shown under the college name
 * @param {string|null} logoAbsolutePath - absolute filesystem path to the
 *   college logo (from Settings.collegeLogoStorageKey), or null/undefined
 *   if no logo has been uploaded yet.
 * @param {string} [institutionName] - Admin-editable institution name from
 *   Settings (may contain multiple lines); falls back to the env-configured
 *   INSTITUTION_NAME when not set.
 */
export function letterhead(subtitle, logoAbsolutePath, institutionName) {
  const logoBlock = []
  if (logoAbsolutePath) {
    try {
      const buffer = fs.readFileSync(logoAbsolutePath)
      const ext = logoAbsolutePath.toLowerCase()
      const type = ext.endsWith('.jpg') || ext.endsWith('.jpeg') ? 'jpg' : 'png'
      logoBlock.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new ImageRun({
              data: buffer,
              transformation: { width: 72, height: 72 },
              type
            })
          ]
        })
      )
    } catch {
      // Logo file missing/unreadable — fall back to a text-only letterhead.
    }
  }

  // Institution name may span multiple lines (e.g. a long formal name) —
  // docx needs one Paragraph per line rather than embedded newlines.
  const nameLines = (institutionName || INSTITUTION_NAME)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const nameBlock = nameLines.map(
    (line) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [new TextRun({ text: line, bold: true, size: 32 })]
      })
  )

  return [
    ...logoBlock,
    ...nameBlock,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: INSTITUTION_TAGLINE, size: 20, color: '64748B' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E344F' } },
      children: [new TextRun({ text: ' ', size: 4 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 300 },
      children: [new TextRun({ text: subtitle, bold: true, size: 26, color: '1E344F' })]
    })
  ]
}

export function fieldLine(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value || '—' })
    ]
  })
}

export function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, color: '1E344F' })]
  })
}

export function bulletList(items) {
  if (!items || items.length === 0) {
    return [new Paragraph({ children: [new TextRun({ text: 'None recorded.', italics: true })] })]
  }
  return items.map(
    (text, idx) =>
      new Paragraph({
        numbering: { reference: 'default-numbering', level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: String(text) })]
      })
  )
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.header ? { fill: '1E344F' } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: String(text ?? '—'), bold: !!opts.header, color: opts.header ? 'FFFFFF' : undefined })
        ]
      })
    ]
  })
}

export function simpleTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h, i) => cell(h, { header: true, width: widths?.[i] })) }),
      ...rows.map((r) => new TableRow({ children: r.map((v, i) => cell(v, { width: widths?.[i] })) }))
    ]
  })
}

/** Embeds an uploaded photo (by absolute filesystem path) as an inline image, sized to fit a page. */
export function imageParagraph(absolutePath, caption, mimeType = 'image/png') {
  try {
    const buffer = fs.readFileSync(absolutePath)
    const type = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 150, after: 60 },
        children: [
          new ImageRun({
            data: buffer,
            transformation: { width: 380, height: 260 },
            type
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: caption || '', italics: true, size: 18, color: '64748B' })]
      })
    ]
  } catch {
    return [
      new Paragraph({
        children: [new TextRun({ text: `[Image unavailable: ${caption || absolutePath}]`, italics: true })]
      })
    ]
  }
}

/** Wraps a body (array of Paragraph/Table blocks) into a downloadable Document buffer. */
export async function buildDocxBuffer(bodyChildren) {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }]
        }
      ]
    },
    sections: [{ properties: {}, children: bodyChildren }]
  })
  const { Packer } = await import('docx')
  return Packer.toBuffer(doc)
}

export function sendDocx(res, filename, buffer) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`)
  res.send(buffer)
}

export function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}
