import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { multerUpload } from '../../config/multer.config';
import { UserController } from './user.controller';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { AdminController } from '../admin/admin.controller';

const router = Router();

router.get('/me', authMiddleware, UserController.getProfile);
router.patch('/update-me', authMiddleware, multerUpload.any(), UserController.updateProfile);
router.post('/addresses', authMiddleware, roleMiddleware("BUYER"), UserController.addAddress);
router.get('/addresses', authMiddleware, roleMiddleware("BUYER"), UserController.getAddresses);
router.patch('/addresses/:id', authMiddleware, roleMiddleware("BUYER"), UserController.updateAddress);
router.delete('/addresses/:id', authMiddleware, roleMiddleware("BUYER"), UserController.deleteAddress);

// FCM token management
router.post('/fcm-tokens', authMiddleware, UserController.addFcmToken);
router.delete('/fcm-tokens', authMiddleware, UserController.removeFcmToken);

router.get('/get-banners',authMiddleware, AdminController.getHomepageBanners);

// Public: Get shop details by id
router.get('/shops/:shopId', UserController.getShopById);

// Public: Get active products for a shop
router.get('/shops/:shopId/products', UserController.getShopProducts);

// Favorites (authenticated)
router.post('/favorites/:productId', authMiddleware, UserController.addFavorite);
router.delete('/favorites/:productId', authMiddleware, UserController.removeFavourite);
router.get('/favorites', authMiddleware, UserController.getFavourites);

// Individual order history( Buyers only )
router.get('/orders', authMiddleware, roleMiddleware("BUYER"), UserController.getOrderHistory);
router.get('/orders/:orderId', authMiddleware, roleMiddleware("BUYER"), UserController.getOrderDetails);

// router.post('/cards', authMiddleware, UserController.addCard);
// router.get('/cards', authMiddleware, UserController.getCards);
// router.patch('/cards/:id', authMiddleware, UserController.updateCard);
// router.delete('/cards/:id', authMiddleware, UserController.deleteCard);

export const userRoutes = router;
