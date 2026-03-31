import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://d0b05e0486a8fa8f2b59b03bab7dc4e6@o4511138871836672.ingest.de.sentry.io/4511138873213008',
  tracesSampleRate: 0.1,
  debug: false,
})
