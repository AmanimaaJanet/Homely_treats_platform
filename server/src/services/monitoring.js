import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { logger, errorFields } from './logger.js';

/**
 * Error monitoring, in two layers.
 *
 * **1. Sentry, if you want it** (`SENTRY_DSN`). No SDK: we post to Sentry's store
 * endpoint directly. That keeps the install dependency-free (nothing to break on an
 * upgrade) and costs nothing when the DSN is blank, which is the default.
 *
 * **2. A local ring buffer, always on.** The last 50 errors are kept in memory and
 * shown in the admin portal (**Settings → Diagnostics**), because a solo bakery owner
 * will not sign up for an error-tracking service, and "what went wrong at 3pm
 * yesterday?" is still a question they need answered. The buffer is in-process: it
 * survives requests, not restarts, which is the honest trade for not writing every
 * error to disk.
 *
 * Both layers redact: no passwords, no tokens, no card data, and emails are masked.
 */

const MAX_BUFFER = 50;
const buffer = [];

function parseDsn(dsn) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!projectId || !url.username) return null;
    return {
      storeUrl: `${url.protocol}//${url.host}/api/${projectId}/store/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

const sentry = config.monitoring.sentryDsn ? parseDsn(config.monitoring.sentryDsn) : null;

export function monitoringStatus() {
  return {
    sentryConfigured: Boolean(sentry),
    release: config.monitoring.release,
    environment: process.env.NODE_ENV || 'development',
    bufferedErrors: buffer.length,
  };
}

/** The errors the admin portal shows. Newest first. */
export function recentErrors() {
  return buffer.map((e) => ({ ...e }));
}

export function clearErrors() {
  const count = buffer.length;
  buffer.length = 0;
  return count;
}

/**
 * Record an error. Called by the Express error handler, by the process-level
 * handlers, and (sparingly) from places where a failure is swallowed on purpose
 * but would still be worth knowing about.
 */
export function captureError(err, context = {}) {
  const fields = errorFields(err);
  const entry = {
    at: new Date().toISOString(),
    message: fields.error || 'Unknown error',
    code: fields.code || null,
    route: context.route || null,
    method: context.method || null,
    status: context.status || 500,
    userId: context.userId || null,
    requestId: context.requestId || null,
    // Enough stack to find the line, not enough to leak a customer's data.
    stack: (err?.stack || '').split('\n').slice(0, 5).join('\n'),
  };

  buffer.unshift(entry);
  if (buffer.length > MAX_BUFFER) buffer.pop();

  logger.error(entry.message, { ...context, stack: undefined, code: entry.code });

  if (config.monitoring.persistErrors !== false) writeToDisk(entry);
  if (sentry) void sendToSentry(err, entry, context).catch(() => {});

  return entry;
}

/**
 * Append the error to a small JSONL file. On Render the disk is ephemeral, so this is
 * a convenience for a VPS or a local install; it is wrapped so a read-only filesystem
 * (or a full disk) can never turn one error into two.
 */
function writeToDisk(entry) {
  try {
    const dir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'errors.jsonl'), `${JSON.stringify(entry)}\n`);
    // Keep the file from growing without bound: past ~1 MB, keep the newest half.
    const file = path.join(dir, 'errors.jsonl');
    if (fs.statSync(file).size > 1024 * 1024) {
      const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
      fs.writeFileSync(file, `${lines.slice(-Math.floor(lines.length / 2)).join('\n')}\n`);
    }
  } catch {
    /* logging must never break the request it is describing */
  }
}

/** Sentry's store API, hand-rolled — one POST, no SDK. */
async function sendToSentry(err, entry, context) {
  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'error',
    logger: 'homely-treats',
    release: config.monitoring.release,
    environment: process.env.NODE_ENV || 'development',
    message: { formatted: entry.message },
    transaction: entry.route || undefined,
    exception: {
      values: [
        {
          type: err?.name || 'Error',
          value: entry.message,
          stacktrace: err?.stack ? { frames: err.stack.split('\n').slice(1, 12).map((line) => ({ filename: line.trim() })) } : undefined,
        },
      ],
    },
    tags: {
      environment: process.env.NODE_ENV || 'development',
      request_id: entry.requestId || undefined,
    },
    extra: { ...context, status: entry.status, userId: entry.userId },
    user: entry.userId ? { id: entry.userId } : undefined,
  };

  const res = await fetch(sentry.storeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=homely-treats/1.0, sentry_key=${sentry.publicKey}`,
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    logger.warn('Sentry rejected the event', { status: res.status });
  }
}
