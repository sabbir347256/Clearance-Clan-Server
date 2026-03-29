import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.get(
  '/',
  authMiddleware,
  NotificationController.listNotifications
);

export const NotificationRoutes = router;
