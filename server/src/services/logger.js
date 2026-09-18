/**
 * Structured logging.
 *
 * One JSON object per line, so a log viewer (Render, Better Stack, Datadog, or plain
 * `grep`) can filter by field instead of guessing at prose: `level=error id=ab12 route=
 * /api/orders status=500`.
 *
 * Development stays readable — the same events printed in colour for humans — because a
 * bakery owner reading a terminal should not have to parse JSON to see that Paystack
 * failed. Set LOG_FORMAT=json to force JSON locally, or LOG_LEVEL to quieten it.
 *
 * Deliberately dependency-free: `console.log` costs nothing, never blocks the event
 * loop, and every host already collects it.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

const levelName = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase();
const threshold = LEVELS[levelName] ?? LEVELS.info;
const asJson = process.env.LOG_FORMAT === 'json' || (process.env.NODE_ENV === 'production' && process.env.LOG_FORMAT !== 'pretty');

const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m' };

/** Values a log line should never carry, whatever a caller passes in. */
const REDACT = /^(password|newPassword|currentPassword|token|authorization|cookie|secret|apiKey|cardNumber|cvv|pix|accountNumber)$/i;

function scrub(value, depth = 0) {
  if (value == null || typeof value !== 'object' || depth > 3) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (REDACT.test(k)) out[k] = '[redacted]';
    else if (k === 'email' && typeof v === 'string') out[k] = v.replace(/^(.).*(@.*)$/, '$1***$2');
    else out[k] = scrub(v, depth + 1);
  }
  return out;
}

function emit(level, message, fields = {}) {
  if (LEVELS[level] < threshold) return;
  const clean = scrub(fields);
  const time = new Date().toISOString();

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ time, level, msg: message, ...clean })}\n`);
    return;
  }

  const bits = Object.entries(clean)
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');
  console.log(`${COLORS[level]}[${level}]${COLORS.reset} ${message}${bits ? ` ${bits}` : ''}`);
}

export const logger = {
  debug: (msg, fields) => emit('debug', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
  /** Pre-bound to a request id, so every line from one request can be found together. */
  with: (base) => ({
    debug: (msg, fields) => emit('debug', msg, { ...base, ...fields }),
    info: (msg, fields) => emit('info', msg, { ...base, ...fields }),
    warn: (msg, fields) => emit('warn', msg, { ...base, ...fields }),
    error: (msg, fields) => emit('error', msg, { ...base, ...fields }),
  }),
  level: levelName,
  json: asJson,
};

/**
 * Turn an unknown thrown value into something loggable.
 * Express gives us Errors; fetch and Prisma give us objects; some give strings.
 */
export function errorFields(err) {
  if (!err) return { error: 'unknown error' };
  if (typeof err === 'string') return { error: err };
  return {
    error: err.message || String(err),
    code: err.code || err.statusCode || err.status || undefined,
    // The stack is what makes a 500 fixable; it never reaches a customer.
    stack: process.env.NODE_ENV === 'production' ? err.stack?.split('\n').slice(0, 6).join(' | ') : err.stack,
  };
}

/**
 * Route the existing `console.error` / `console.warn` calls through the structured
 * logger when running in JSON mode.
 *
 * The codebase already reports failures in a hundred places the honest way — with
 * `console.error(err)` — and rewriting all of them by hand would risk breaking
 * error reporting to gain nothing. Bridging the console instead means one line of
 * setup makes every one of them structured, searchable and (where configured) sent
 * to Sentry, while development keeps its readable output.
 */
export function bridgeConsole() {
  if (!asJson) return;

  const format = (args) => {
    const err = args.find((a) => a instanceof Error);
    const message = args
      .map((a) => {
        if (a instanceof Error) return a.message;
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(scrub(a));
        } catch {
          return String(a);
        }
      })
      .join(' ')
      .slice(0, 500);
    return { message, fields: err?.stack ? { stack: err.stack.split('\n').slice(0, 4).join(' | ') } : {} };
  };

  console.error = (...args) => {
    const { message, fields } = format(args);
    emit('error', message, fields);
  };
  console.warn = (...args) => {
    const { message, fields } = format(args);
    emit('warn', message, fields);
  };
}
