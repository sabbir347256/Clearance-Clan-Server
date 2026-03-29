import eventBus, { Events } from '../eventBus';
import { NotificationService } from '../../modules/notifications/notification.service';
import { Order } from '../../modules/order/order.model';
import AppError from '../../errorHelper/AppError';

// Handle ORDER_PLACED -> notify seller(s)
eventBus.on(Events.ORDER_PLACED, async (payload: { orderId: string }) => {
  try {
    const order = await Order.findById(payload.orderId).populate('items.product');
    if (!order) throw new AppError(404, 'Order not found');

    // group products by shop
    const shopToProducts: Record<string, any[]> = {};
    for (const it of (order.items as any[])) {
      const prod = it.product as any;
      if (!prod) continue;
      const shopId = (prod.shop || '').toString();
      shopToProducts[shopId] = shopToProducts[shopId] || [];
      shopToProducts[shopId].push(prod._id.toString());
    }

    for (const shopId of Object.keys(shopToProducts)) {
      // find seller user id by shop
      const shop = await (await import('../../modules/sellers/seller.model')).Shop.findById(shopId);
      if (!shop) continue;
      const sellerUserId = shop.userId;

      await NotificationService.createNotification({
        recipientId: String(sellerUserId),
        recipientRole: 'SELLER',
        title: 'New Order',
        message: `You have a new order containing ${shopToProducts[shopId].length} items`,
        data: { orderId: payload.orderId }
      });
    }
  } catch (err) {
    console.error('ORDER_PLACED handler error', err);
  }
});

// Handle ORDER_STATUS_UPDATED -> notify buyer
eventBus.on(Events.ORDER_STATUS_UPDATED, async (payload: { orderId: string; status: string }) => {
  try {
    const order = await Order.findById(payload.orderId);
    if (!order) throw new AppError(404, 'Order not found');

    const buyerId = order.user;
    await NotificationService.createNotification({
      recipientId: String(buyerId),
      recipientRole: 'BUYER',
      title: 'Order Update',
      message: `Your order is now ${payload.status}. You can check the details in your order history.`,
      data: { orderId: payload.orderId }
    });
  } catch (err) {
    console.error('ORDER_STATUS_UPDATED handler error', err);
  }
});

// Handle ORDER_REVIEWED -> notify seller(s)
eventBus.on(Events.ORDER_REVIEWED, async (payload: { orderId: string; reviewId: string }) => {
  try {
    const order = await Order.findById(payload.orderId).populate('items.product');
    if (!order) throw new AppError(404, 'Order not found');

    const shops = new Set<string>();
    for (const it of (order.items as any[])) {
      const prod = it.product as any;
      if (!prod) continue;
      shops.add((prod.shop || '').toString());
    }

    for (const shopId of Array.from(shops)) {
      const shop = await (await import('../../modules/sellers/seller.model')).Shop.findById(shopId);
      if (!shop) continue;
      await NotificationService.createNotification({
        recipientId: String(shop.userId),
        recipientRole: 'SELLER',
        title: 'New Customer Review',
        message: 'You received a new customer review on one of your orders.',
        data: { orderId: payload.orderId, reviewId: payload.reviewId }
      });
    }
  } catch (err) {
    console.error('ORDER_REVIEWED handler error', err);
  }
});
