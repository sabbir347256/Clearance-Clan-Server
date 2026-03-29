import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// The Stripe secret key used to authenticate requests. Replace the placeholder
// by setting `STRIPE_SECRET_KEY` in your environment (for example in .env).
// Example .env entry: STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXX
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';

// The webhook secrets are used to validate incoming webhook requests.
// We support two secrets so platform-level webhooks and connected-account
// webhooks can each use their own signing secret.
// Example .env entries:
// STRIPE_WEBHOOK_SECRET_PLATFORM=whsec_...
// STRIPE_WEBHOOK_SECRET_CONNECTED=whsec_...
const stripeWebhookSecretPlatform = process.env.STRIPE_WEBHOOK_SECRET_PLATFORM || '';
const stripeWebhookSecretConnected = process.env.STRIPE_WEBHOOK_SECRET_CONNECTED || '';

if (!stripeSecret) {
  // Fail fast: many parts of the integration will not work without a secret key.
  throw new Error(
    'Environment variable STRIPE_SECRET_KEY is not set. Please set STRIPE_SECRET_KEY to your Stripe secret key.'
  );
}

/*
  Initialize the Stripe client with the requested API version.
  We explicitly set `apiVersion` so that requests use the `2025-12-15.clover` API.
*/
export const stripe = new Stripe(stripeSecret, {
  apiVersion: '2025-12-15.clover',
});

export const getStripeWebhookSecret = (type: 'platform' | 'connected' = 'platform') =>
  type === 'connected' ? stripeWebhookSecretConnected : stripeWebhookSecretPlatform;

export default stripe;
