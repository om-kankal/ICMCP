import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import mongoSanitize from 'express-mongo-sanitize'
import routes from './routes/index.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { env } from './config/env.js'

const app = express()

// SECURITY: only trust X-Forwarded-* headers when explicitly configured
// (TRUST_PROXY env var) for a real reverse-proxy deployment — see
// config/env.js for why this must not simply default to "on".
if (env.trustProxy !== false) {
  app.set('trust proxy', env.trustProxy)
}

app.use(
  helmet({
    // Uploaded photo previews are rendered by the SPA on a different origin
    // in dev; relax CORP just enough to allow that without opening CORS wide.
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
)

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true
  })
)

app.use(cookieParser())
app.use(morgan(env.isProd ? 'combined' : 'dev'))

// Skip JSON body parsing for the raw binary "mock S3 PUT" route — it needs
// the untouched request stream. Every other route gets normal JSON parsing.
app.use((req, res, next) => {
  if (req.method === 'PUT' && req.path.startsWith('/api/uploads/mock/')) return next()
  express.json({ limit: '1mb' })(req, res, next)
})

app.use(mongoSanitize()) // strips keys starting with $ or containing . to block NoSQL injection

app.use('/api', apiLimiter, routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
