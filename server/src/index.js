import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { attachWebSocket } from './services/realtime.js';
import { ensureUploadDir } from './services/storage.js';
import { startStockAlerts } from './services/stockAlerts.js';
import { apiLimiter } from './middleware/security.js';
import { csrfGuard } from './middleware/session.js';
import { requestContext, errorHandler, notFound, installProcessHandlers } from './middleware/observability.js';
import { logger, bridgeConsole } from './services/logger.js';

import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/products.routes.js';
import orderRoutes from './routes/orders.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import promoRoutes from './routes/promos.routes.js';
import adminRoutes from './routes/admin.routes.js';
import uploadRoutes from './routes/uploads.routes.js';
import zoneRoutes from './routes/zones.routes.js';
import reviewRoutes from './routes/reviews.routes.js';
import riderRoutes from './routes/rider.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import pushRoutes from './routes/push.routes.js';

// Production logs become one JSON object per line, including everything the rest of
// the codebase reports through console.error.
bridgeConsole();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);

// WebSockets for real-time order tracking
attachWebSocket(server);

// Express sits behind Render's reverse proxy in production — trust the proxy
// so rate limiting sees the real client IP.
app.set('trust proxy', 1);

// Tracing first: every later log line, error and response carries the request id.
app.use(requestContext);

// ---------------------------------------------------------------------------
// Security hardening
// ---------------------------------------------------------------------------
// Secure HTTP headers (Content-Security-Policy, X-Frame-Options, nosniff, …).
// The CSP is tuned for this stack: self-hosted Vite bundle + Google Fonts +
// Cloudinary-hosted photos + same-origin API + WebSockets.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        // Ambient bakery footage is self-hosted under /media
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — only allow the configured frontend origin (or same-origin requests).
const allowedOrigins = new Set([config.clientUrl, 'http://localhost:5173', 'http://localhost:5000']);
app.use(
  cors({
    // Required for cookie-based sessions when the client is on another origin
    // (the Vite dev server). Safe here because the allowlist is explicit and
    // never `*` — the browser refuses to send credentials to a wildcard origin.
    credentials: true,
    origin(origin, cb) {
      // Requests without an Origin header (curl, same-origin, server-to-server) are allowed.
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);

// Parse cookies so the session/CSRF middleware can read them.
app.use(cookieParser());
// Reject cross-site state-changing requests that carry a session cookie.
app.use(csrfGuard);

// IMPORTANT: the Paystack webhook must receive the raw request body so it can
// verify Paystack's HMAC-SHA512 signature. This raw parser must run BEFORE the
// global JSON parser for that route.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
// Cap JSON body size to blunt payload-based abuse.
app.use(express.json({ limit: '100kb' }));

// General API rate limiting.
app.use('/api', apiLimiter);

// Serve uploaded design photos
ensureUploadDir();
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'Homely Treats API',
    release: config.monitoring.release,
    uptimeSeconds: Math.round(process.uptime()),
    sentryConfigured: Boolean(config.monitoring.sentryDsn),
    pushConfigured: config.push.enabled,
    turnstileConfigured: Boolean(config.turnstile.secretKey),
    paystackConfigured: config.paystack.enabled,
    resendConfigured: config.resend.enabled,
    whatsappConfigured: config.whatsapp.enabled,
    cloudinaryConfigured: config.storage.useCloudinary,
    smsProvider: `${config.sms.provider}${config.sms.provider === 'arkesel' && !config.sms.arkeselKey ? ' (no key — console fallback)' : ''}`,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/rider', riderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/push', pushRoutes);

// Serve the built React app in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend not built. Run `npm run build:client` first.');
  });
});

// Nothing matched an API route, and the SPA fallback didn't take it either.
app.use(notFound);

// The single place a thrown error becomes a response (see middleware/observability.js):
// the client gets a message and a request id, the owner gets a readable record.
app.use(errorHandler);

// Background crashes are logged, reported and survivable.
installProcessHandlers(server);

server.listen(config.port, '0.0.0.0', () => {
  logger.info('api started', {
    port: config.port,
    logLevel: logger.level,
    logFormat: logger.json ? 'json' : 'pretty',
    sentry: config.monitoring.sentryDsn ? 'configured' : 'off',
    release: config.monitoring.release,
  });
  console.log(`\nHomely Treats API running on http://localhost:${config.port}`);
  console.log(`   Paystack: ${config.paystack.enabled ? 'ENABLED (keys set)' : 'SIMULATION MODE (no keys set)'}`);
  console.log(`   Email (Resend): ${config.resend.enabled ? 'ENABLED' : 'SIMULATED (printed to console)'}`);
  console.log(`   WhatsApp: ${config.whatsapp.enabled ? 'ENABLED' : 'SIMULATED (printed to console)'}`);
  console.log(`   SMS: ${config.sms.provider} (${config.sms.provider === 'textbelt' ? (config.sms.apiKey === 'textbelt' ? 'free tier, 1/day' : 'paid key') : config.sms.arkeselKey ? 'key set' : 'no key'})`);
  console.log(`   Photo storage: ${config.storage.useCloudinary ? 'Cloudinary' : 'local disk (/uploads)'}`);
  console.log(`   WebSockets: /ws (real-time order updates)`);
  console.log(`   Web push: ${config.push.enabled ? 'ENABLED (VAPID keys set)' : 'SIMULATED (no VAPID keys)'}`);
  console.log('');

  // Background job: email the bakery when stock runs low (at most once a day).
  startStockAlerts();
});
