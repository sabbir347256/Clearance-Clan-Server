import { Router } from 'express';
import { ReviewController } from './review.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

router.post('/', authMiddleware, roleMiddleware("BUYER"), ReviewController.createReview);
router.delete('/:id', authMiddleware, roleMiddleware("ADMIN"), ReviewController.deleteReview);
router.get('/product/:productId', ReviewController.getReviewsByProduct);

export const reviewRoutes = router;
