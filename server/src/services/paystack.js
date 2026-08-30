import crypto from 'crypto';
import { config, MOMO_PROVIDERS } from '../config.js';

/**
 * Paystack integration for Ghana payments.
 * Supports: MTN Mobile Money, AirtelTigo Money, Vodafone Cash and Visa/Mastercard.
 *
 * Amounts are in GHS on our side; Paystack expects the amount in pesewas
 * (1 GHS = 100 pesewas) for GHS transactions.
 */

export function toPesewas(ghs) {
  return Math.round(Number(ghs) * 100);
}

export function toGhs(pesewas) {
  return Number(pesewas) / 100;
}

/**
 * Initialise a Paystack transaction. Returns the hosted checkout URL the
 * customer should be redirected to.
 */
export async function initializeTransaction({ email, amountGhs, orderId, paymentMethod, phone, callbackUrl }) {
  if (!config.paystack.enabled) {
    // Simulation mode — return a relative URL the frontend routes to directly.
    return {
      simulated: true,
      authorizationUrl: `/pay/simulate?order=${orderId}`,
      reference: `SIM-${orderId}`,
    };
  }

  const body = {
    email: email || 'guest@homelytreats.gh',
    amount: toPesewas(amountGhs),
    currency: 'GHS',
    reference: `HT-${orderId}-${Date.now().toString(36)}`,
    callback_url: callbackUrl,
    metadata: { orderId, paymentMethod },
    channels: ['card', 'mobile_money'],
  };

  // For mobile money, tell Paystack the network & phone to skip a step.
  if (paymentMethod && MOMO_PROVIDERS[paymentMethod]) {
    body.mobile_money = { provider: MOMO_PROVIDERS[paymentMethod], phone };
  }

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.paystack.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message || 'Paystack init failed');
  return { simulated: false, authorizationUrl: data.data.authorization_url, reference: data.data.reference };
}

/** Verify a transaction by reference. Returns { status, paid, amountGhs, ... } */
export async function verifyTransaction(reference) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${config.paystack.secretKey}` },
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message || 'Verify failed');
  const tx = data.data;
  return {
    paid: tx.status === 'success',
    amountGhs: toGhs(tx.amount),
    status: tx.status,
    channel: tx.channel,
    reference,
  };
}

/** Validate the Paystack webhook signature (HMAC SHA512 of the raw body). */
export function verifyWebhook(rawBody, signature) {
  if (!config.paystack.secretKey) return false;
  const expected = crypto.createHmac('sha512', config.paystack.secretKey).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
