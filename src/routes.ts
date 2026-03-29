import { Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes';
import { sellerRoutes } from './modules/sellers/seller.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { categoryRoutes } from './modules/categories/category.routes';
import { productRoutes } from './modules/products/products.routes';
import { userRoutes } from './modules/users/user.routes';
import { cartRoutes } from './modules/cart/cart.routes';
import orderRoutes from './modules/order/order.routes';
import { reviewRoutes } from './modules/reviews/review.routes';
import webhookRoutes from './modules/payments/webhook.controller';
import connectRoutes from './modules/payments/connect.routes';
import { graphRoutes } from './modules/graphs/graph.routes';
import { NotificationRoutes } from './modules/notifications/notification.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/seller', sellerRoutes);
router.use('/admin', adminRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/users', userRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/webhooks/stripe', webhookRoutes);
router.use('/connect', connectRoutes);
router.use('/graphs', graphRoutes);
router.use('/notifications', NotificationRoutes);


export default router;