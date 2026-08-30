import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { attachWebSocket } from './services/realtime.js';
import { ensureUploadDir } from './services/storage.js';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);

// WebSockets for real-time order tracking
attachWebSocket(server);

app.use(cors());
// IMPORTANT: the Paystack webhook must receive the raw request body so it can
// verify Paystack's HMAC-SHA512 signature. This raw parser must run BEFORE the
// global JSON parser for that route.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

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

// Serve the built React app in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend not built. Run `npm run build:client` first.');
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`\n🎂 Homely Treats API running on http://localhost:${config.port}`);
  console.log(`   Paystack: ${config.paystack.enabled ? 'ENABLED (live keys)' : 'SIMULATION MODE (no keys set)'}`);
  console.log(`   Email (Resend): ${config.resend.enabled ? 'ENABLED' : 'SIMULATED (printed to console)'}`);
  console.log(`   WhatsApp: ${config.whatsapp.enabled ? 'ENABLED' : 'SIMULATED (printed to console)'}`);
  console.log(`   SMS: ${config.sms.provider} (${config.sms.provider === 'textbelt' ? (config.sms.apiKey === 'textbelt' ? 'free tier, 1/day' : 'paid key') : config.sms.arkeselKey ? 'key set' : 'no key'})`);
  console.log(`   Photo storage: ${config.storage.useCloudinary ? 'Cloudinary' : 'local disk (/uploads)'}`);
  console.log(`   WebSockets: /ws (real-time order updates)`);
  console.log('');
});
