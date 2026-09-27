import crypto from 'crypto';
import { logger } from '../services/logger.js';
import { captureError } from '../services/monitoring.js';

/**
 * Request tracing.
 *
 * Every request gets an id: taken from an upstream proxy's `X-Request-Id` when there is
 * one, otherwise generated. The id goes into every log line for that request, back to
 * the client in the response header, and into the body of any 500 — so when a customer
 * sends a screenshot saying "Error reference: 7f3a…", the exact request can be pulled
 * out of the logs. That one detail is the difference between "the site broke" and a
 * fixable bug report.
 *
 * Request logging is deliberately quiet for the noise: successful static assets and
 * health checks are skipped so a busy day doesn't bury real errors.
 */

const SKIP_LOGGING = [/^\/assets\//, /^\/icons\//, /^\/media\//, /^\/uploads\//, /^\/api\/health$/, /^\/sw\.js$/, /^\/manifest\.webmanifest$/];

export function requestContext(req, res, next) {
  const incoming = String(req.get('x-request-id') || '').trim();
  // Only trust an incoming id if it looks like an id — never echo arbitrary input back.
  req.id = /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : crypto.randomBytes(6).toString('hex');
  req.log = logger.with({ id: req.id });
  res.setHeader('X-Request-Id', req.id);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (SKIP_LOGGING.some((re) => re.test(req.path))) return;

    const fields = {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(ms),
      ip: req.ip,
      userId: req.user?.id || null,
    };
    if (res.statusCode >= 500) logger.error('request failed', fields);
    else if (res.statusCode >= 400) logger.warn('request rejected', fields);
    else logger.info('request', fields);
  });

  next();
}

/**
 * The single place a thrown error becomes a response.
 *
 * The client gets a short message and the request id — never a stack, never an internal
 * path. The log gets everything. The admin portal gets a copy through the error buffer.
 */
export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', requestId: req.id });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Body-parser failures are the client's fault, not the server's.
  const status = err.status || err.statusCode || (err.type === 'entity.parse.failed' ? 400 : 500);
  const isServerError = status >= 500;

  if (isServerError) {
    captureError(err, {
      route: req.originalUrl.split('?')[0],
      method: req.method,
      userId: req.user?.id || null,
      requestId: req.id,
      status,
    });
  } else {
    req.log?.warn('request rejected', { error: err.message, status });
  }

  const message = isServerError
    ? process.env.NODE_ENV === 'production'
      ? 'Something went wrong on our side. Please try again, and quote this reference if it keeps happening.'
      : err.message || 'Something went wrong'
    : err.message || 'Request could not be processed';

  res.status(status).json({
    error: message,
    ...(isServerError && { requestId: req.id }),
  });
}

/**
 * Process-level safety nets. A crash in a background job must not take a working shop
 * offline silently — it is logged, reported, and the process keeps serving.
 */
export function installProcessHandlers(server) {
  process.on('unhandledRejection', (reason) => {
    captureError(reason instanceof Error ? reason : new Error(String(reason)), { route: 'unhandledRejection' });
  });

  process.on('uncaughtException', (err) => {
    captureError(err, { route: 'uncaughtException' });
    // An uncaught exception leaves the process in an undefined state: stop accepting new
    // work, finish the requests in flight, then exit so the host restarts a clean one.
    logger.error('uncaught exception — shutting down after in-flight requests', { error: err.message });
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 10_000).unref();
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — shutting down gracefully');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
