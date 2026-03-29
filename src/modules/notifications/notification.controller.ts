import { Request, Response } from 'express';
import { NotificationService } from './notification.service';
import catchAsync from '../../utils/CatchAsync';

const listNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { limit = '20', page = '1' } = req.query;
  const notifications = await NotificationService.listForUser(userId, parseInt(limit as string), parseInt(page as string));
  res.status(200).json({
    status: 'success',
    data: notifications,
  });
});

export const NotificationController = {
  listNotifications,
};
