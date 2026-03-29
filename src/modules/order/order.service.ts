import mongoose, { Types } from 'mongoose';
import AppError from '../../errorHelper/AppError';
import { Cart } from '../cart/cart.model';
import { Product } from '../products/product.model';
import { Order } from './order.model';
import { IOrderItem, OrderStatus } from './order.interface';

const placeOrder = async (buyerId: string, addressId?: string) => {
  // load cart
  const cart = await Cart.findOne({ user: buyerId }).populate('items.product');
  if (!cart || !cart.items || cart.items.length === 0) throw new AppError(400, 'Cart is empty');

  // if addressId provided, load user's address snapshot
  let shippingAddressSnapshot: any | undefined;
  if (addressId) {
    const User = (await import('../users/user.model')).User;
    const user = await User.findById(buyerId).lean();
    if (!user) throw new AppError(404, 'User not found');

    const addr = (user.addresses || []).find((a: any) => String(a._id) === String(addressId));
    if (!addr) throw new AppError(400, 'Address not found');

    shippingAddressSnapshot = {
      fullName: addr.fullName,
      phone: addr.phone,
      addressLine: addr.street,
      city: addr.city,
      country: user.country || undefined,
      postalCode: addr.postalCode,
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orderItems: IOrderItem[] = [];
    let subtotal = 0;
    let shippingFee = 0;

    // Re-validate stock and deduct inventory inside transaction
    for (const it of cart.items) {
      const productId = (it.product as any)?._id || it.product;
      const qty = it.quantity;

      const product = await Product.findById(productId).session(session);
      if (!product) throw new AppError(404, 'Product not found during order placement');

      let unitPrice = product.pricing?.salePrice ?? product.pricing?.basePrice ?? 0;

      if (it.variantSku) {
        const wanted = (it.variantSku || '').toString();
        const variant = (product.variants || []).find((v: any) => (v.sku || '').toString() === wanted);
        if (!variant) {
          throw new AppError(400, `Variant ${it.variantSku} not found for product ${productId}`);
        }
        if ((variant.stock ?? 0) < qty) throw new AppError(400, 'Insufficient stock for one of the items');

        // deduct
        variant.stock = variant.stock - qty;
        unitPrice = variant.price;
      } else {
        const available = product.inventory?.stock ?? 0;
        if (available < qty) throw new AppError(400, 'Insufficient stock for one of the items');

        product.inventory = product.inventory || { stock: 0, lowStockAlert: 10 } as any;
        product.inventory.stock = product.inventory.stock - qty;
      }

      // persist product changes
      await product.save({ session });

      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      const itemShipping = product.shipping?.freeShipping ? 0 : product.shipping?.shippingFee ?? 0;
      shippingFee += itemShipping;

      orderItems.push({ product: new Types.ObjectId(productId), title: product.name, variantSku: it.variantSku, price: unitPrice, quantity: qty });
    }

    const total = subtotal + shippingFee;

    const orderDoc: any = {
      user: new Types.ObjectId(buyerId),
      items: orderItems,
      subtotal,
      shippingFee,
      total,
      status: OrderStatus.PENDING
    };

    if (shippingAddressSnapshot) orderDoc.shippingAddress = shippingAddressSnapshot;

    const created = await Order.create([orderDoc], { session });

    // clear cart
    await Cart.updateOne({ user: buyerId }, { items: [] }).session(session);

    await session.commitTransaction();
    session.endSession();

    return created[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

const getOrdersForUser = async (userId: string) => {
  return Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate({ path: 'items.product', select: 'name pricing variants media shop' });
};

const getOrdersForSeller = async (sellerUserId: string, status?: string) => {
  // find shop for seller
  const shop = await (await import('../sellers/seller.model')).Shop.findOne({ userId: sellerUserId });
  if (!shop) throw new AppError(404, 'Seller shop not found');

  // find products belonging to this shop
  const products = await (await import('../products/product.model')).Product.find({ shop: shop._id }).select('_id');
  const productIds = products.map(p => p._id);

  const filter: any = { 'items.product': { $in: productIds } };

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  // find orders that contain any of these products
  return Order.find(filter).populate({
    path: 'user',
    select: 'fullName email'
  })
  .populate({
    path: 'items.product',
    select: 'name description pricing variants media',
})
  .sort({ createdAt: -1 });
}

const getAllOrders = async () => {
  return Order.find().sort({ createdAt: -1 });
};

const updateOrderStatus = async (orderId: string, status: string, actor: { role: string; userId: string }) => {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError(404, 'Order not found');

    // If seller, ensure the order contains at least one product from their shop
    if (actor.role === 'SELLER') {
      const shop = await (await import('../sellers/seller.model')).Shop.findOne({ userId: actor.userId });
      if (!shop) throw new AppError(404, 'Seller shop not found');

      const products = await (await import('../products/product.model')).Product.find({ shop: shop._id }).select('_id');
      const productIds = products.map(p => p._id.toString());

      const hasProduct = (order.items || []).some((it: any) => productIds.includes((it.product as any).toString()));
      if (!hasProduct) throw new AppError(403, 'Not authorized to update this order');
    }

    // Basic status validation
    const allowed = ['PENDING', 'ORDER_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) throw new AppError(400, 'Invalid order status');

    order.status = status as any;
    await order.save();
    return order;
  };

  const deleteOrder = async (orderId: string) => {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError(404, 'Order not found');
    await order.deleteOne();
    return { message: 'Order deleted successfully' };
  };

  /**
   * Trigger Stripe Checkout for an order after it has been created with PENDING status.
   * This should be called AFTER the order is persisted to the database.
   * 
   * @param orderId The ID of the order that was just created
   * @param rootUrl Optional root URL for redirect URLs
   * @returns Stripe Checkout session with URL for client redirect
   */
  const initiateCheckout = async (orderId: string, rootUrl?: string) => {
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) throw new AppError(404, 'Order not found');
    if (order.status !== 'PENDING') throw new AppError(400, 'Order must be in PENDING status to initiate checkout');
    // Build items array for ConnectService using Stripe product/price IDs stored on Product model
    const itemsForCheckout: Array<{ productId: string; priceId?: string; quantity: number }> = [];
    for (const item of (order.items || [])) {
      const prodDoc = await Product.findById(item.product);
      if (!prodDoc) throw new AppError(404, `Product ${item.product} not found`);

      let stripeProductId: string | undefined;
      let priceId: string | undefined;

      if (item.variantSku) {
        const variant = (prodDoc.variants || []).find((v: any) => (v.sku || '').toString() === (item.variantSku || '').toString());
        if (!variant) throw new AppError(400, `Variant ${item.variantSku} not found for product ${item.product}`);
        stripeProductId = variant.stripeProductId;
        priceId = variant.stripePriceId;
      } else {
        stripeProductId = prodDoc.stripeProductId;
        priceId = prodDoc.stripePriceId;
      }

      if (!stripeProductId) throw new AppError(400, `Product ${item.product} missing Stripe product ID`);
      if (!priceId) throw new AppError(400, `Price ID not found for product ${item.product}`);

      itemsForCheckout.push({ productId: stripeProductId, priceId, quantity: item.quantity });
    }

    // Delegate Checkout session creation to ConnectService so transfer_data and application_fee are handled consistently
    const ConnectService = await import('../payments/connect.service');
    const session = await ConnectService.createCheckoutSession({ items: itemsForCheckout, rootUrl: rootUrl || process.env.ROOT_URL, metadata: { orderId: String(orderId) } });

    return session;
  };

export default {
  placeOrder,
  getOrdersForUser,
  getOrdersForSeller,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  initiateCheckout,
};
