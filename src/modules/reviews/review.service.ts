import { Types } from 'mongoose';
import { Review } from './review.model';
import { Order } from '../order/order.model';
import AppError from '../../errorHelper/AppError';
import eventBus, { Events } from '../../events/eventBus';

const createReview = async ({
  orderId,
  userId,
  rating,
  comment,
}: {
  orderId: string;
  userId: string;
  rating: number;
  comment?: string;
}) => {
  /* ----------------------------------
     1. Validate orderId
  ----------------------------------- */
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError(400, 'Invalid orderId');
  }

  /* ----------------------------------
     2. Fetch order & validate ownership
  ----------------------------------- */
  const order = await Order.findOne({
    _id: orderId,
    user: userId,
  });

  if (!order) {
    throw new AppError(404, 'Order not found or does not belong to user');
  }

  /* ----------------------------------
     3. Ensure order is delivered
  ----------------------------------- */
  if (order.status !== 'DELIVERED') {
    throw new AppError(400, 'You can review only delivered orders');
  }

  /* ----------------------------------
     4. Prevent duplicate review
  ----------------------------------- */
  const existingReview = await Review.findOne({ orderId });

  if (existingReview) {
    throw new AppError(400, 'Review already exists for this order');
  }

  /* ----------------------------------
     5. Validate rating
  ----------------------------------- */
  if (rating < 1 || rating > 5) {
    throw new AppError(400, 'Rating must be between 1 and 5');
  }

  /* ----------------------------------
     6. Create review
  ----------------------------------- */
  const review = await Review.create({
    orderId,
    userId,
    rating,
    comment,
  });

  /* ----------------------------------
     7. Notify seller(s) about new review (non-blocking)
  ----------------------------------- */
  try {
    const notifMod = await import('../notifications/notification.service');
    const NotificationService = notifMod.NotificationService;

    const ord = await Order.findById(orderId).populate('items.product');
    if (ord) {
      const shops = new Set<string>();
      for (const it of (ord.items as any[])) {
        const prod = it.product as any;
        if (!prod) continue;
        shops.add((prod.shop || '').toString());
      }

      for (const shopId of Array.from(shops)) {
        try {
          const shop = await (await import('../sellers/seller.model')).Shop.findById(shopId);
          if (!shop) continue;
          NotificationService.createNotification({
            recipientId: String(shop.userId),
            recipientRole: 'SELLER',
            title: 'New Review',
            message: `A buyer reviewed an order you sold in ${String(orderId)}`,
            data: { orderId: String(orderId), reviewId: String(review._id) }
          }).catch((e: any) => console.error('notify seller review failed', e));
        } catch (e) {
          console.error('lookup shop for review notification failed', e);
        }
      }
    }
  } catch (err) {
    console.error('prepare ORDER_REVIEWED notifications failed', err);
  }

  return review;
};

const deleteReview = async ({
  reviewId,
  userId,
  role,
}: {
  reviewId: string;
  userId: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
}) => {
  if (!Types.ObjectId.isValid(reviewId)) {
    throw new AppError(400, 'Invalid review id');
  }

  const review = await Review.findById(reviewId);

  if (!review) {
    throw new AppError(404, 'Review not found');
  }

  /* ----------------------------------
     BUYER: Can delete own review
  ----------------------------------- */
  if (role === 'BUYER') {
    if (String(review.userId) !== userId) {
      throw new AppError(403, 'You can delete only your own review');
    }
  }

  /* ----------------------------------
     SELLER: Can delete review on own product
  ----------------------------------- */
  if (role === 'SELLER') {
    // Find the related order
    const order = await Order.findById(review.orderId).populate('items.product');

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    // Check if any product in the order belongs to this seller
    const ownsProduct = order.items.some(
      (item: any) => String(item.product.seller) === userId
    );

    if (!ownsProduct) {
      throw new AppError(403, 'You can delete reviews only for your products');
    }
  }

  await review.deleteOne();

  return { success: true };
};

const getReviewsByProduct = async (
  productId: string,
  page = 1,
  limit = 10
) => {
  if (!Types.ObjectId.isValid(productId)) {
    throw new AppError(400, 'Invalid product id');
  }

  // Find orders that include the product
  const orders = await Order.find({ 'items.product': productId }, { _id: 1 });
  const orderIds = orders.map((o: any) => o._id);

  if (!orderIds.length) {
    return {
      data: [],
      meta: { total: 0, page, limit, totalPages: 0 },
    };
  }

  const query = { orderId: { $in: orderIds } };
  const total = await Review.countDocuments(query);
  const totalPages = Math.ceil(total / limit) || 0;
  const skip = (page - 1) * limit;

  const reviews = await Review.find(query)
    .populate('userId', 'fullName imgUrl')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    data: reviews,
    meta: { total, page, limit, totalPages },
  };
};

export const ReviewService = {
  createReview,
  deleteReview,
  getReviewsByProduct,
};
