import { Schema, model, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  imageUrl?: string;
  imagePublicId?: string;
  type?: 'SHOP' | 'PRODUCT';
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    imageUrl: { type: String },
    imagePublicId: { type: String }
    ,
    type: { type: String, enum: ['SHOP', 'PRODUCT'], default: 'SHOP' }
  },
  { timestamps: true }
);

export const Category = model<ICategory>('Category', categorySchema);
