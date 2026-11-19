import ExcelJS from 'exceljs'

/**
 * SHEET FORMAT (matches the institute's real "Institute Level
 * Committees/Portfolios/Cells/Clubs" sheet, with Mail columns added):
 *
 *   Sr. | Committee/Cell | Dept | Member | Member Mail | Coordinator | Coordinator Mail
 *
 * One row per (committee × member) — a committee with 8 members spans 8
 * rows. Sr., Committee/Cell, Coordinator and Coordinator Mail are only
 * filled on the committee's first row and left blank (merged, in the
 * original institute file) on the rest — this module forward-fills those
 * blanks rather than requiring them repeated on every row, and the export
 * side re-merges those same cells so a downloaded file looks like the
 * source file it was modeled on.
 *
 * To the right of that (leaving one blank column), a second "workload"
 * table lists every distinct person once with their department, name,
 * mail, and how many committees they're a Member of / a Coordinator of —
 * this is the per-person table the institute's own file already has; this
 * module just adds Mail to it and computes the counts instead of expecting
 * them typed in.
 */

const COLUMN_ALIASES = {
  srNo: ['sr', 'srno', 'sno', 'sr.', 'no', '#', 'serialno', 'slno'],
  committeeName: [
    'committeecell',
    'committee',
    'cell',
    'committeename',
    'portfoliocommittee',
    'portfolio',
    'cellsclubs',
    'cellclub',
    'institutelevelcommitteesportfolioscellsclubs',
    'nameofthecommittee',
    'nameoftheportfolio',
    'committeesportfolios'
  ],
  department: ['dept', 'department', 'branch'],
  memberName: [
    'member',
    'membername',
    'name',
    'nameofmember',
    'facultymember',
    'nameoffaculty',
    'faculty',
    'committeemember'
  ],
  memberMail: ['membermail', 'memberemail', 'membermailid', 'email', 'emailid', 'mail'],
  coordinatorName: [
    'coordinator',
    'co-ordinator',
    'coordinatorname',
    'portfoliocoordinator',
    'coordinators'
  ],
  coordinatorMail: ['coordinatormail', 'co-ordinatormail', 'coordinatoremail', 'coordinatormailid']
}

const EMAIL_RE = /^\S+@\S+\.\S+$/

export function extractCellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((r) => r?.text || '').join('').trim()
    }
    if (value.text !== undefined) return String(value.text).trim()
    if (value.hyperlink !== undefined) return String(value.text || value.hyperlink).trim()
  }
  return String(value).trim()
}

function normalizeHeader(text) {
  const str = extractCellText(text)
  return str
    .toLowerCase()
    .replace(/[\s._\-\/\\#]+/g, '')
    .trim()
}

/** Strips academic/honorific titles (Dr., Mr., Prof., etc.) for clean email generation. */
export function cleanPersonName(raw = '') {
  return String(raw)
    .replace(/^(dr|mr|mrs|ms|prof|er)[\.\s]+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Generates a standard institutional email from a person's name (e.g. shwetkranti.taware@indiraicem.ac.in). */
export function emailFromName(name = '', domain = 'indiraicem.ac.in') {
  const cleaned = cleanPersonName(name)
  const parts = cleaned
    .split(' ')
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
  if (parts.length === 0) return ''
  const cleanDomain = String(domain).replace(/^@/, '').trim() || 'indiraicem.ac.in'
  if (parts.length === 1) return `${parts[0]}@${cleanDomain}`
  return `${parts[0]}.${parts[parts.length - 1]}@${cleanDomain}`
}

/** Scans the first several rows for the one that looks like the header (title rows above it are skipped). */
function findHeaderRow(sheet) {
  const maxScan = Math.min(sheet.rowCount, 20)
  for (let r = 1; r <= maxScan; r += 1) {
    const row = sheet.getRow(r)
    const texts = []
    row.eachCell({ includeEmpty: false }, (cell) => texts.push(normalizeHeader(cell.value)))
    const hasCommittee = texts.some((t) => COLUMN_ALIASES.committeeName.includes(t))
    const hasMember = texts.some((t) => COLUMN_ALIASES.memberName.includes(t))
    if (hasCommittee && hasMember) return r
  }
  return null
}

function findColumnIndexes(headerRow) {
  const found = {}
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const normalized = normalizeHeader(cell.value)
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (found[key]) continue // first (leftmost) match wins
      if (aliases.includes(normalized)) found[key] = colNumber
    }
  })
  return found
}

function cellText(row, colNumber) {
  if (!colNumber) return ''
  return extractCellText(row.getCell(colNumber).value)
}

/**
 * Parses an uploaded workbook buffer into one entry per committee, each
 * carrying its member list. Supports sheets with or without explicit email columns
 * (auto-generates institutional emails when missing), handles richText formatting,
 * and handles both merged rows and repeated committee name rows.
 */
export async function parseImportWorkbook(buffer, options = {}) {
  const defaultDomain = options.defaultDomain || 'indiraicem.ac.in'
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('The uploaded file has no worksheets')

  const headerRowNumber = findHeaderRow(sheet)
  if (!headerRowNumber) {
    throw new Error(
      'Could not find the header row. Expected columns matching "Committee / Portfolio" and "Member".'
    )
  }
  const columns = findColumnIndexes(sheet.getRow(headerRowNumber))
  const requiredMissing = ['committeeName', 'memberName'].filter((k) => !columns[k])
  if (requiredMissing.length) {
    throw new Error('Could not find required column(s): Committee/Cell/Portfolio and Member')
  }

  const committees = []
  let current = null // the committee currently being accumulated
  let lastCoordinatorName = ''
  let lastCoordinatorMail = ''
  let excelRowCursor = 0

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r)
    const srNoText = cellText(row, columns.srNo)
    const committeeNameText = cellText(row, columns.committeeName)
    const deptText = cellText(row, columns.department)
    const memberNameText = cellText(row, columns.memberName)
    let memberMailText = cellText(row, columns.memberMail).toLowerCase()
    const coordinatorNameText = cellText(row, columns.coordinatorName)
    let coordinatorMailText = cellText(row, columns.coordinatorMail).toLowerCase()

    const rowIsCompletelyBlank =
      !srNoText && !committeeNameText && !deptText && !memberNameText && !coordinatorNameText
    if (rowIsCompletelyBlank) continue

    // Determine if this row starts a new committee:
    // 1) committeeName is given AND it's different from the current accumulating committee
    // 2) or Sr. No is given AND it's different from current Sr. No
    // 3) or current is null
    const isNewCommittee =
      committeeNameText &&
      (!current ||
        current.committeeName.toLowerCase() !== committeeNameText.toLowerCase() ||
        (srNoText && srNoText !== current.srNo))

    if (isNewCommittee) {
      const coordName = (coordinatorNameText || lastCoordinatorName).trim()
      let coordMail = (coordinatorMailText || lastCoordinatorMail).trim()
      if (!coordMail && coordName) {
        coordMail = emailFromName(coordName, defaultDomain)
      }

      current = {
        excelRow: r,
        srNo: srNoText || String(committees.length + 1),
        committeeName: committeeNameText.trim(),
        coordinatorName: coordName,
        coordinatorMail: coordMail,
        members: []
      }
      committees.push(current)
      lastCoordinatorName = coordName
      lastCoordinatorMail = coordMail
    } else if (coordinatorNameText) {
      lastCoordinatorName = coordinatorNameText.trim()
      let coordMail = coordinatorMailText.trim()
      if (!coordMail && lastCoordinatorName) {
        coordMail = emailFromName(lastCoordinatorName, defaultDomain)
      }
      lastCoordinatorMail = coordMail
      if (current) {
        current.coordinatorName = lastCoordinatorName
        current.coordinatorMail = lastCoordinatorMail
      }
    }

    if (!current) continue // stray row before any committee has started

    if (memberNameText) {
      if (!memberMailText && memberNameText) {
        memberMailText = emailFromName(memberNameText, defaultDomain)
      }

      current.members.push({
        excelRow: r,
        name: memberNameText.trim(),
        mail: memberMailText.trim(),
        department: deptText.trim()
      })
    }
    excelRowCursor = r
  }

  if (committees.length === 0) {
    throw new Error('No committee rows found under the header row')
  }
  void excelRowCursor

  return committees
}

const MAIN_HEADERS = ['Sr.', 'Committee/Cell', 'Dept', 'Member', 'Member Mail', 'Coordinator', 'Coordinator Mail']
const SIDE_HEADERS = ['Dept', 'Name', 'Mail', 'No of Member', 'No of Coordinator']
const SIDE_TABLE_START_COL = 9 // column I — leaves H blank as a separator, matching the source file

/**
 * Builds the export workbook: the same multi-row-per-committee layout as
 * the import sheet (with Sr./Committee/Coordinator/Coordinator Mail cells
 * merged down each committee's row-span, same as the source file), plus
 * the per-person workload table to the right.
 *
 * @param {Array<{srNo, committeeName, coordinatorName, coordinatorMail, members: Array<{name, mail, department}>}>} committeeRows
 * @param {Array<{department, name, mail, memberCount, coordinatorCount}>} workloadRows
 */
export function buildExportWorkbook(committeeRows, workloadRows) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ICMCP'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Committees')

  MAIN_HEADERS.forEach((h, i) => {
    sheet.getCell(1, i + 1).value = h
  })
  SIDE_HEADERS.forEach((h, i) => {
    sheet.getCell(1, SIDE_TABLE_START_COL + i).value = h
  })
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

  sheet.columns = [
    { key: 'srNo', width: 6 },
    { key: 'committeeName', width: 34 },
    { key: 'department', width: 12 },
    { key: 'memberName', width: 30 },
    { key: 'memberMail', width: 30 },
    { key: 'coordinatorName', width: 28 },
    { key: 'coordinatorMail', width: 30 },
    { key: 'spacer', width: 3 },
    { key: 'wDept', width: 12 },
    { key: 'wName', width: 28 },
    { key: 'wMail', width: 28 },
    { key: 'wMemberCount', width: 12 },
    { key: 'wCoordinatorCount', width: 14 }
  ]

  let r = 2
  for (const committee of committeeRows) {
    const members = committee.members.length ? committee.members : [{ name: '', mail: '', department: '' }]
    const startRow = r
    members.forEach((member) => {
      sheet.getCell(r, 3).value = member.department || ''
      sheet.getCell(r, 4).value = member.name || ''
      sheet.getCell(r, 5).value = member.mail || ''
      r += 1
    })
    const endRow = r - 1
    sheet.getCell(startRow, 1).value = committee.srNo
    sheet.getCell(startRow, 2).value = committee.committeeName
    sheet.getCell(startRow, 6).value = committee.coordinatorName || ''
    sheet.getCell(startRow, 7).value = committee.coordinatorMail || ''
    if (endRow > startRow) {
      sheet.mergeCells(startRow, 1, endRow, 1)
      sheet.mergeCells(startRow, 2, endRow, 2)
      sheet.mergeCells(startRow, 6, endRow, 6)
      sheet.mergeCells(startRow, 7, endRow, 7)
    }
    sheet.getCell(startRow, 1).alignment = { vertical: 'top' }
    sheet.getCell(startRow, 2).alignment = { vertical: 'top', wrapText: true }
    sheet.getCell(startRow, 6).alignment = { vertical: 'top' }
    sheet.getCell(startRow, 7).alignment = { vertical: 'top' }
  }

  workloadRows.forEach((person, idx) => {
    const row = idx + 2
    sheet.getCell(row, SIDE_TABLE_START_COL).value = person.department || ''
    sheet.getCell(row, SIDE_TABLE_START_COL + 1).value = person.name
    sheet.getCell(row, SIDE_TABLE_START_COL + 2).value = person.mail
    sheet.getCell(row, SIDE_TABLE_START_COL + 3).value = person.memberCount
    sheet.getCell(row, SIDE_TABLE_START_COL + 4).value = person.coordinatorCount
  })

  return workbook
}

export async function workbookToBuffer(workbook) {
  return workbook.xlsx.writeBuffer()
}

/** Default academic year (India: June–May) if the admin doesn't pick one explicitly. */
export function currentAcademicYear() {
  const now = new Date()
  const y = now.getFullYear()
  const startYear = now.getMonth() >= 5 ? y : y - 1 // getMonth() 5 === June
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

export { EMAIL_RE }
