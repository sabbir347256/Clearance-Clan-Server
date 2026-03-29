import { Router } from 'express';
import { stripe, getStripeWebhookSecret } from '../../config/stripe.config';
import { Order } from '../order/order.model';
import { Product } from '../products/product.model';
import mongoose from 'mongoose';

const router = Router();

// expects raw body (configured in app.ts)
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = getStripeWebhookSecret('platform');

  // Diagnostic logging to help debug signature verification issues.
  // Stripe requires the raw request body; ensure this arrives as a Buffer.
  try {
    const contentType = req.headers['stripe-signature'];
    const isBuffer = Buffer.isBuffer(req.body);
    const bodyLength = isBuffer ? (req.body as Buffer).length : typeof req.body === 'string' ? (req.body as string).length : undefined;
    console.log('Stripe webhook incoming:', { contentType, isBuffer, bodyLength, sigPresent: !!sig });
  } catch (logErr) {
    console.warn('Failed to log webhook diagnostics', logErr);
  }
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature validation failed', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'transfer.created':
        // store transfer info if needed
        break;
      case 'payout.paid':
        // when connected account payout succeeds, mark withdrawal PAID
        await handlePayoutPaid(event.data.object);
        break;
      case 'payout.failed':
        await handlePayoutFailed(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error', err);
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

async function handlePaymentSucceeded(pi: any) {
  // Extract orderId from payment intent metadata
  const metadata = pi.metadata || {};
  const orderId = metadata.orderId;
  if (!orderId) {
    console.log('Payment succeeded but no orderId in metadata, skipping order confirmation');
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Find the order
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      console.error(`Order ${orderId} not found for payment confirmation`);
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // Prevent duplicate confirmation: only confirm if currently PENDING
    if (order.status !== 'PENDING') {
      console.log(`Order ${orderId} already confirmed or in status ${order.status}, skipping duplicate confirmation`);
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // Step 1: Update order status to ORDER_CONFIRMED only after payment success
    order.status = 'ORDER_CONFIRMED';
    order.paidAt = new Date();
    await order.save({ session });

    // Step 2: Compute earnings for sellers (informational - Stripe Connect handles actual payouts)
    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) continue;
      const shopId = product.shop;
      const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION || '0.10');
      const earning = (item.price * item.quantity) * (1 - commissionRate);
      console.log(`Computed earning for shop ${shopId}: ${earning}`);
    }

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// Withdrawal/payout tracking was removed from the project. Keep payout handlers
// minimal: log the payout event so operators can reconcile via Stripe Dashboard.
async function handlePayoutPaid(payout: any) {
  console.log('Received payout.paid event for payout:', payout.id);
}

async function handlePayoutFailed(payout: any) {
  console.log('Received payout.failed event for payout:', payout.id);
}

export const webhookRoutes = router;


export default webhookRoutes;
