import { rateLimit } from 'express-rate-limit'

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests. Please try again later.' } },
})

export const processingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  skip: (request) => request.method !== 'POST',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Hourly processing limit reached. Please try again later.' } },
})
