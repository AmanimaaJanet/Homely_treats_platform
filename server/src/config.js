import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

export const config = {
  port: PORT,
  clientUrl: CLIENT_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://homely:homely@localhost:5432/homely?schema=public',
  paystack: {
    // Ghana payments: MTN MoMo, AirtelTigo, Vodafone Cash & cards all go through Paystack
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    enabled: Boolean(process.env.PAYSTACK_SECRET_KEY),
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'Homely Treats <onboarding@resend.dev>',
    enabled: Boolean(process.env.RESEND_API_KEY),
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'textbelt', // 'textbelt' | 'arkesel'
    apiKey: process.env.TEXTBELT_API_KEY || 'textbelt',
    arkeselKey: process.env.ARKESEL_API_KEY || '',
    sender: process.env.SMS_SENDER || 'HomelyTreats',
  },
  whatsapp: {
    // Meta WhatsApp Cloud API — https://developers.facebook.com/apps
    // Free tier: test phone number with 1,000 conversations/month (no business docs needed).
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    enabled: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  },
  storage: {
    // 'local' stores uploads in server/uploads (fine for dev; Render's disk is ephemeral).
    // Set CLOUDINARY_* to store design photos on Cloudinary (free tier) in production.
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    useCloudinary: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    ),
  },
  // Loyalty programme: earn 1 point per GH₵ 1 spent; 20 points = GH₵ 1 off;
  // max 50% of an order's value can be paid with points.
  loyalty: {
    pointsPerGhs: 1,
    pointsToGhs: 20,
    maxRedeemRatio: 0.5,
  },
};

// Ghana mobile money network mapping -> Paystack provider codes
export const MOMO_PROVIDERS = {
  MOMO: 'MTN',
  ATL: 'ATL',
  VOD: 'VOD',
};

export const STATUS_RANK = {
  PENDING: 0,
  CONFIRMED: 1,
  IN_PROGRESS: 2,
  READY: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
  CANCELLED: -1,
};

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];
