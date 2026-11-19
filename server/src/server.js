import app from './app.js'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'
import { startOverdueSweepTimer } from './utils/notificationSweep.js'
import { startMonthEndSweepTimer } from './utils/monthEndSweep.js'

async function start() {
  try {
    await connectDB()
  } catch (err) {
    console.error('[mongo] initial connection failed:', err.message)
    console.error('        Check MONGO_URI in your .env file and that MongoDB is running.')
    process.exit(1)
  }

  const overdueSweepInterval = startOverdueSweepTimer()
  const monthEndSweepInterval = startMonthEndSweepTimer()

  const server = app.listen(env.port, () => {
    console.log(`[server] ICMCP API listening on http://localhost:${env.port}`)
    console.log(`[server] Environment: ${env.nodeEnv}`)
  })

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received, shutting down gracefully...`)
    clearInterval(overdueSweepInterval)
    clearInterval(monthEndSweepInterval)
    server.close(() => {
      console.log('[server] closed')
      process.exit(0)
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start()
