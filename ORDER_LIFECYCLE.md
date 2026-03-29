# Order Lifecycle Implementation

## Overview
The order lifecycle follows a strict 3-step sequence to ensure orders are only confirmed after Stripe payment succeeds.

## The Correct Flow

### Step 1: Order Creation & Checkout Initiation
**Endpoint:** `POST /orders` (BUYER role required)

**What happens:**
1. Create order with `status: PENDING` in database
2. Clear buyer's cart
3. Immediately call Stripe Checkout API with `stripeProductId` and quantity
4. Return to client with:
   - Order object with `status: PENDING`
   - Stripe Checkout session URL
   - Client redirects to Stripe to complete payment

**Files:**
- [src/modules/order/order.controller.ts](src/modules/order/order.controller.ts) - Orchestrates the flow
- [src/modules/order/order.service.ts](src/modules/order/order.service.ts#L169) - `placeOrder()` creates order, `initiateCheckout()` triggers Stripe

**Response Example:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "507f1f77bcf86cd799439011",
      "user": "507f1f77bcf86cd799439012",
      "items": [...],
      "total": 9999,
      "status": "PENDING",
      "createdAt": "2026-01-20T10:00:00Z"
    },
    "checkout": {
      "sessionId": "cs_test_123456789",
      "url": "https://checkout.stripe.com/pay/cs_test_123456789"
    }
  }
}
```

---

### Step 2: Stripe Payment (Asynchronous)
**No API call needed** - This happens between buyer and Stripe

**What happens:**
1. Buyer visits checkout URL
2. Buyer enters payment details
3. Stripe processes payment
4. Stripe emits `payment_intent.succeeded` webhook event

**Key Detail:**
- `orderId` is stored in `payment_intent.metadata.orderId`
- This links the payment back to the order

---

### Step 3: Payment Confirmation (Webhook)
**Endpoint:** Webhook handler (platform listens, no client call)

**Handler:** `POST /webhooks/stripe` (webhook.controller.ts)

**What happens:**
1. Stripe sends `payment_intent.succeeded` webhook
2. Handler validates webhook signature
3. Extracts `orderId` from `payment_intent.metadata`
4. Finds the order in database
5. **Only if order is PENDING:** Updates status to `ORDER_CONFIRMED`
6. Sets `paidAt` timestamp
7. Computes seller earnings (for bookkeeping)
8. Stripe Connect automatically handles seller payouts

**Files:**
- [src/modules/payments/webhook.controller.ts](src/modules/payments/webhook.controller.ts#L46) - `handlePaymentSucceeded()`

**Safety Checks:**
- ✅ Duplicate prevention: Only confirms if status is `PENDING`
- ✅ Idempotent: If webhook fires twice, second call is ignored
- ✅ Signature verification: Validates request comes from Stripe
- ✅ Metadata validation: Checks orderId exists before processing

---

## Database Schema Verification

**Order Status Values:**
```
PENDING → ORDER_CONFIRMED → SHIPPED → DELIVERED
         ↓ (alternative)
         CANCELLED
```

**Key Fields:**
- `status` (enum): Current order state
- `paidAt` (Date): Set only after payment confirmation
- `createdAt` (timestamp): Auto-set at order creation
- `items[].product`: Reference to Product collection

---

## Critical Separation of Concerns

| Phase | Responsibility | When | Who |
|-------|-----------------|------|-----|
| **1. Create** | Persist order, validate stock | Immediate | `POST /orders` endpoint |
| **2. Checkout** | Generate Stripe session | After order created | `initiateCheckout()` service |
| **3. Confirm** | Update status to CONFIRMED | After payment succeeds | Stripe webhook handler |

---

## Error Handling

### If Checkout Initiation Fails (Step 2)
Order is already created and persisted (PENDING). 
Response includes `checkoutError` but order exists.
Client can retry checkout via separate endpoint if needed.

### If Webhook Fails (Step 3)
Stripe retries webhook automatically for 3 days.
Order remains PENDING until webhook succeeds.
Manual intervention available via admin API.

---

## Testing Checklist

- [ ] Create order → Verify status is `PENDING`
- [ ] Create order → Verify checkout session URL returned
- [ ] Simulate Stripe webhook → Verify order status becomes `ORDER_CONFIRMED`
- [ ] Simulate duplicate webhook → Verify status unchanged (idempotent)
- [ ] Verify `paidAt` timestamp set on confirmation
- [ ] Verify seller earnings logged correctly
- [ ] Test with invalid/missing `orderId` in metadata → Should be skipped gracefully

---

## Environment Variables Required

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET_PLATFORM=whsec_...
ROOT_URL=http://localhost:3000
PLATFORM_COMMISSION=0.10  # 10% platform fee
```

---

## API Contracts (No Changes)

✅ **POST /orders** - Still returns order object (now with checkout session)
✅ **GET /orders** - Unchanged
✅ **PATCH /orders/:orderId/status** - Unchanged (for manual status updates)
✅ **Webhook signature** - Stripe handles, no changes needed

