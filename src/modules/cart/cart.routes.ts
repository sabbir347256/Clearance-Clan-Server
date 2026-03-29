import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { CartController } from './cart.controller';

const router = Router();

// All cart routes require authentication and BUYER role
router.use(authMiddleware, roleMiddleware('BUYER'));

router.post('/add', CartController.addItem);
router.get('/', CartController.getCart);
router.patch('/:itemId', CartController.updateCart);
router.delete('/:itemId', CartController.deleteCart);

export const cartRoutes = router;