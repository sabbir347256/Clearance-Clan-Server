import { Request, Response } from 'express';
import OrderService from './order.service';
import asyncHandler from '../../utils/CatchAsync';
import AppError from '../../errorHelper/AppError';
import eventBus, { Events } from '../../events/eventBus';

/**
 * Order Lifecycle:
 * 1. Create order (PENDING status) → return order + checkout session
 * 2. User completes Stripe payment → webhook confirms and updates to ORDER_CONFIRMED
 */

const placeOrder = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { addressId } = req.body || {};

  // Step 1: Create order with PENDING status and persist to database
  const order = await OrderService.placeOrder(String(userId), addressId as string | undefined);
  // Emit event for order creation
  try {
    eventBus.emit(Events.ORDER_PLACED, { orderId: String(order._id) });
  } catch (e) {
    console.error('emit ORDER_PLACED failed', e);
  }

  // Populate product snapshots for response
  const populatedOrder = await (await import('./order.model')).Order.findById(order._id).populate({ path: 'items.product', select: 'name pricing variants media shop stripeProductId stripePriceId' });

  // Step 2: Initiate Stripe Checkout for the created order
  let checkoutSession: any;
  try {
    checkoutSession = await OrderService.initiateCheckout(String(order._id), process.env.ROOT_URL);
  } catch (err: any) {
    console.error('Checkout initiation failed', err);
    // Don't fail the entire request; order was created, inform client to retry checkout
    return res.status(201).json({
      success: true,
      data: populatedOrder || order,
      checkoutError: err.message || 'Failed to initiate checkout',
    });
  }

  // Step 3: Return order with checkout session URL to client
  return res.status(201).json({
    success: true,
    data: {
      order: populatedOrder || order,
      checkout: {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
      },
    },
  });
};

const getMyOrders = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const orders = await OrderService.getOrdersForUser(String(userId));
  return res.status(200).json({ success: true, data: orders });
};

const getOrdersForSeller = async (req: Request, res: Response) => {
  const sellerId = req.user?._id;
  const status = req.query.status as string | undefined;
  const orders = await OrderService.getOrdersForSeller(String(sellerId), status);
  return res.status(200).json({ success: true, data: orders });
};

const getAllOrders = async (req: Request, res: Response) => {
  const orders = await OrderService.getAllOrders();
  return res.status(200).json({ success: true, data: orders });
};

const updateOrderStatus = async (req: Request, res: Response) => {
  const orderId = req.params.orderId;
  const { status } = req.body || {};

  if (!status) throw new AppError(400, 'Status is required');

  const actor = { role: (req.user as any)?.role, userId: String((req.user as any)?._id) };
  const updated = await OrderService.updateOrderStatus(orderId, status, actor);
  try {
    eventBus.emit(Events.ORDER_STATUS_UPDATED, { orderId: String(updated._id), status });
  } catch (e) {
    console.error('emit ORDER_STATUS_UPDATED failed', e);
  }
  return res.status(200).json({ success: true, data: updated });
};

const deleteOrder = async (req: Request, res: Response) => {
  const orderId = req.params.orderId;
  const deleted = await OrderService.deleteOrder(orderId);
  return res.status(200).json({ success: true, data: deleted });
};



export default {
  placeOrder: asyncHandler(placeOrder),
  getMyOrders: asyncHandler(getMyOrders),
  getOrdersForSeller: asyncHandler(getOrdersForSeller),
  getAllOrders: asyncHandler(getAllOrders),
  updateOrderStatus: asyncHandler(updateOrderStatus),
  deleteOrder: asyncHandler(deleteOrder),
};