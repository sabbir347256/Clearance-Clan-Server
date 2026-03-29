import { Schema, model } from 'mongoose';

const reviewSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true },
    comment: { type: String }
  },
  { timestamps: true }
);

export const Review = model('Review', reviewSchema);
