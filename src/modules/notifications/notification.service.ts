import { Notification } from './notification.model';
import { User } from '../users/user.model';
import AppError from '../../errorHelper/AppError';
import { sendPushNotification } from '../../config/firebase';

const createNotification = async (opts: {
  recipientId: string;
  recipientRole: 'BUYER' | 'SELLER';
  title: string;
  message: string;
  data?: Record<string, any>;
}) => {
  const n = await Notification.create({
    recipientId: opts.recipientId,
    recipientRole: opts.recipientRole,
    title: opts.title,
    message: opts.message,
    data: opts.data || {},
    isRead: false
  } as any);

  // fetch user's fcm tokens
  const user = await User.findById(opts.recipientId).lean();
  const tokens: string[] = (user && (user as any).fcmTokens) || [];

  if (tokens.length > 0) {
    try {
      const results = await sendPushNotification(tokens, {
        title: opts.title,
        body: opts.message,
        data: Object.fromEntries(Object.entries(opts.data || {}).map(([k, v]) => [k, String(v)]))
      });

      // prune invalid tokens based on FCM responses
      const invalidTokens = results
        .filter(r => !r.success)
        .map(r => ({ token: r.token, error: r.error }));

      if (invalidTokens.length > 0) {
        const invalidReasons = ['invalid-registration-token', 'registration-token-not-registered', 'invalid-argument'];
        for (const it of invalidTokens) {
          const err = it.error as any;
          const code = err && (err.code || (err.errorInfo && err.errorInfo.code) || '');
          const msg = err && (err.message || JSON.stringify(err));
          const shouldRemove = invalidReasons.some(r => String(code).includes(r) || String(msg).toLowerCase().includes('registration token') || String(msg).toLowerCase().includes('not a valid fcm'));
          if (shouldRemove) {
            try {
              await User.updateOne({ _id: opts.recipientId }, { $pull: { fcmTokens: it.token } });
              console.log('Pruned invalid fcm token for user', opts.recipientId, it.token);
            } catch (e) {
              console.warn('Failed to prune token', it.token, e);
            }
          } else {
            console.warn('Non-prunable FCM error for token', it.token, code || msg);
          }
        }
      }
    } catch (err) {
      console.error('push send failed', err);
    }
  }

  return n;
};

const listForUser = async (userId: string, limit = 20, page = 1) => {
  const skip = (page - 1) * limit;
  return Notification.find({ recipientId: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit);
};

const markRead = async (notificationId: string) => {
  const n = await Notification.findByIdAndUpdate(notificationId, { isRead: true }, { new: true });
  if (!n) throw new AppError(404, 'Notification not found');
  return n;
};

export const NotificationService = {
  createNotification,
  listForUser,
  markRead
};
