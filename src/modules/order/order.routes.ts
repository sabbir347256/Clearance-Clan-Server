import { Router } from 'express';
import OrderController from './order.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';


const router = Router();

/**
 * ORDER LIFECYCLE
 * ===============
 * 
 * Step 1: POST /orders (Buyer places order)
 *   - Creates order with status: PENDING
 *   - Immediately calls Stripe Checkout API
 *   - Returns order + checkout session URL to client
 *   - Client redirects to Stripe to complete payment
 * 
 * Step 2: Stripe Payment (Asynchronous)
 *   - Buyer completes payment on Stripe
 *   - Stripe emits payment_intent.succeeded webhook
 * 
 * Step 3: Webhook Handler (Payment Confirmation)
 *   - Webhook received with orderId in payment_intent metadata
 *   - Updates order status to ORDER_CONFIRMED
 *   - Marks paidAt timestamp
 *   - Computes seller earnings (Stripe Connect handles payouts)
 */

// Place an order - creates PENDING order and initiates checkout (only BUYER)
router.post('/', authMiddleware, roleMiddleware('BUYER'), OrderController.placeOrder);

// Get current user's orders (only BUYER)
router.get('/', authMiddleware, roleMiddleware('BUYER'), OrderController.getMyOrders);

// Get all orders (only ADMIN)
router.get('/all', authMiddleware, roleMiddleware('ADMIN'), OrderController.getAllOrders);

// Get orders for Seller's products (only SELLER)
router.get('/seller', authMiddleware, roleMiddleware('SELLER'), OrderController.getOrdersForSeller);

// Update order status (only ADMIN or SELLER) - manually update order stages after confirmation
router.patch('/:orderId/status', authMiddleware, roleMiddleware('SELLER'), OrderController.updateOrderStatus);

// Delete an order (only ADMIN)
router.delete('/:orderId', authMiddleware, roleMiddleware('ADMIN'), OrderController.deleteOrder);

router.put('/orderId/status-update', authMiddleware, roleMiddleware('ADMIN'), OrderController.updateOrderStatus);

export default router;
