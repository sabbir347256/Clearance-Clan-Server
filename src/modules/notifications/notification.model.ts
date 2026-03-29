import { Schema, model } from 'mongoose';

const notificationSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientRole: { type: String, enum: ['BUYER', 'SELLER'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' , required: false },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: false },

  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export const Notification = model('Notification', notificationSchema);
