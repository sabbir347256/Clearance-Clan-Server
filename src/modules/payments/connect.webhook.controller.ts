import { Router } from 'express';
import { stripe, getStripeWebhookSecret } from '../../config/stripe.config';

const router = Router();

// expects raw body (app.ts must register express.raw for this route)
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = getStripeWebhookSecret('connected');

  // Diagnostic logging to help debug signature verification issues for connected account webhooks.
  try {
    const contentType = req.headers['stripe-signature'];
    const isBuffer = Buffer.isBuffer(req.body);
    const bodyLength = isBuffer ? (req.body as Buffer).length : typeof req.body === 'string' ? (req.body as string).length : undefined;
    console.log('Stripe connect webhook incoming:', { contentType, isBuffer, bodyLength, sigPresent: !!sig });
  } catch (logErr) {
    console.warn('Failed to log connect webhook diagnostics', logErr);
  }
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe connect webhook signature validation failed', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    // Handle a small set of connected-account events. Extend as needed.
    switch (event.type) {
      case 'account.application.authorized':
      case 'account.application.deauthorized':
      case 'account.updated':
        console.log('Received connected account event:', event.type, event.data.object.id);
        break;
      case 'payout.paid':
      case 'payout.failed':
      case 'transfer.created':
        console.log('Received transfer/payout event for connected account:', event.type);
        break;
      default:
        console.log('Received unhandled connected event:', event.type);
        break;
    }
  } catch (err) {
    console.error('Connect webhook handler error', err);
    return res.status(500).send('Handler error');
  }

  // ✅ Safe to use event
  switch (event.type) {
    case 'application_fee.created':
      console.log('Fee created:', event.data.object);
      break;
  }
  
  res.json({ received: true });
});

export const connectWebhookRoutes = router;

export default connectWebhookRoutes;
