import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', env.uploadDir)

/**
 * Drops every collection in the database — users, committees, meetings,
 * notices, news/events, notifications, settings, everything. This is a
 * deliberately manual, standalone script: it is never imported or called
 * by the running application, and requires either an interactive typed
 * confirmation or an explicit --yes flag / CONFIRM=RESET env var so it
 * can't be triggered by accident.
 *
 * Usage:
 *   npm run db:reset            (interactive — asks you to type RESET)
 *   npm run db:reset -- --yes   (non-interactive, e.g. in a script)
 *   CONFIRM=RESET npm run db:reset
 */

function askForConfirmation(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function run() {
  const skipPrompt = process.argv.includes('--yes') || process.env.CONFIRM === 'RESET'

  console.log(`[db:reset] Target database: ${env.mongoUri}`)
  console.log('[db:reset] This permanently deletes EVERYTHING — all users (including Admin),')
  console.log('[db:reset] committees, meetings, notices, news/events, and settings. This cannot be undone.')

  if (!skipPrompt) {
    const answer = await askForConfirmation('[db:reset] Type RESET to confirm, anything else to abort: ')
    if (answer.trim() !== 'RESET') {
      console.log('[db:reset] Aborted — nothing was deleted.')
      process.exit(0)
    }
  }

  await connectDB()

  const collections = await mongoose.connection.db.collections()
  for (const collection of collections) {
    await collection.deleteMany({})
    console.log(`[db:reset] Cleared collection: ${collection.collectionName}`)
  }

  // Also clear uploaded files (avatars, logos, agenda/MoM PDFs) so the
  // reset is complete — database records and their files stay in sync.
  if (fs.existsSync(UPLOAD_ROOT)) {
    const entries = fs.readdirSync(UPLOAD_ROOT)
    for (const entry of entries) {
      if (entry === '.gitkeep') continue
      fs.rmSync(path.join(UPLOAD_ROOT, entry), { recursive: true, force: true })
    }
    console.log(`[db:reset] Cleared uploaded files in ${UPLOAD_ROOT}`)
  }

  console.log('[db:reset] Done. The database is now empty.')
  console.log('[db:reset] Run `npm run seed` to create a fresh Admin account.')

  await disconnectDB()
  process.exit(0)
}

run().catch((err) => {
  console.error('[db:reset] failed:', err)
  process.exit(1)
})
