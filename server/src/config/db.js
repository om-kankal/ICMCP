import mongoose from 'mongoose'
import { env } from './env.js'

mongoose.set('strictQuery', true)

export async function connectDB() {
  mongoose.connection.on('connected', () => {
    console.log(`[mongo] connected → ${mongoose.connection.name}`)
  })
  mongoose.connection.on('error', (err) => {
    console.error('[mongo] connection error:', err.message)
  })
  mongoose.connection.on('disconnected', () => {
    console.warn('[mongo] disconnected')
  })

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 8000,
    // SCALE (item 3 — 50+ committees running concurrently): explicit pool
    // bounds instead of relying on the driver default, so this is a
    // deliberate, documented knob (env.mongoMaxPoolSize/mongoMinPoolSize)
    // rather than an implicit ceiling nobody remembers exists.
    maxPoolSize: env.mongoMaxPoolSize,
    minPoolSize: env.mongoMinPoolSize
  })
}

export async function disconnectDB() {
  await mongoose.disconnect()
}
