import { connectDB, disconnectDB } from '../config/db.js'
import User from '../models/User.js'

/**
 * Unlike the old seed script, this creates NOTHING except a single Admin
 * account — no demo committees, coordinators, or meetings. Everything else
 * (users, committees, meetings) is meant to be created through the app
 * itself, by the Admin, once logged in. This is idempotent: running it
 * again when an Admin already exists just confirms one exists rather than
 * creating a duplicate or wiping data.
 */

const DEFAULT_ADMIN = {
  name: process.env.BOOTSTRAP_ADMIN_NAME || 'System Administrator',
  email: process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@icmcp.edu',
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@12345',
  designation: 'IQAC Coordinator / System Administrator'
}

async function run() {
  // Security hardening (OWASP A07 - Identification & Authentication
  // Failures): the fallback credentials above exist only for local dev
  // convenience. Refuse to bootstrap a well-known default admin password
  // on a production deployment — the operator must set one explicitly.
  if (process.env.NODE_ENV === 'production' && !process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    console.error(
      '[bootstrap] Refusing to create an Admin account with the default password in production.'
    )
    console.error('[bootstrap] Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in your environment and re-run.')
    process.exit(1)
  }

  await connectDB()

  const existingAdmin = await User.findOne({ role: 'Admin' })
  if (existingAdmin) {
    console.log(`[bootstrap] An Admin account already exists (${existingAdmin.email}). Nothing to do.`)
    console.log('[bootstrap] Database left untouched — this script never deletes data.')
    await disconnectDB()
    process.exit(0)
  }

  const user = new User({
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    role: 'Admin',
    designation: DEFAULT_ADMIN.designation
  })
  user.password = DEFAULT_ADMIN.password
  await user.save()

  console.log('[bootstrap] Created the first Admin account:')
  console.log(`  email:    ${DEFAULT_ADMIN.email}`)
  // SECURITY (OWASP A09 - Security Logging & Monitoring Failures /
  // A07 - Identification & Authentication Failures): the plaintext
  // password used to be printed here unconditionally. Anything written to
  // stdout can land in terminal scrollback, a shipped log aggregator, CI
  // logs, etc. — all of which may be far less trusted than "the person who
  // ran this script". In production the operator supplied
  // BOOTSTRAP_ADMIN_PASSWORD themselves (it's required, see the guard
  // above), so they already know it and it doesn't need to be echoed back.
  // Only local/dev runs — where the value is either the well-known dev
  // default or something the developer just typed into their own shell —
  // echo it, purely as a convenience.
  if (process.env.NODE_ENV === 'production') {
    console.log('  password: (set from BOOTSTRAP_ADMIN_PASSWORD — not re-printed here)')
  } else {
    console.log(`  password: ${DEFAULT_ADMIN.password}`)
  }
  console.log('')
  console.log('[bootstrap] ⚠ Treat the Admin credentials as sensitive — sign in and change the')
  console.log('[bootstrap] password immediately, before doing anything else, especially if this')
  console.log('[bootstrap] ran in production.')
  console.log('[bootstrap] Then create Coordinator/Member accounts from the User Management page.')
  console.log('[bootstrap] No committees, meetings, or other users were created — the database is otherwise empty.')

  await disconnectDB()
  process.exit(0)
}

run().catch((err) => {
  console.error('[bootstrap] failed:', err)
  process.exit(1)
})
