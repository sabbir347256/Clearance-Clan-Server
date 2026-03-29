import { Types } from 'mongoose';
import AppError from '../../errorHelper/AppError';
import { Cart } from './cart.model';
import { AddCartItemPayload, UpdateCartPayload } from './cart.interface';
import { Product } from '../products/product.model';

  const getCartByUser = async (userId: string) => {
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    return cart;
  };

  const addItem = async (userId: string, payload: AddCartItemPayload) => {
    const { productId, variantSku, quantity = 1 } = payload;

    const product = await Product.findById(productId);
    if (!product) throw new AppError(404, 'Product not found');

    let unitPrice: number;

    if (variantSku) {
      const wanted = (variantSku || '').toString().trim().toLowerCase();
      const variant = product.variants?.find((v: any) => (v.sku || '').toString().trim().toLowerCase() === wanted);
      if (!variant) {
        const skus = (product.variants || []).map((v: any) => v.sku).filter(Boolean);
        throw new AppError(400, `Variant not found for product ${productId}. Available SKUs: ${skus.join(', ')}`);
      }
      unitPrice = variant.price;
    } else {
      unitPrice = product.pricing?.salePrice ?? product.pricing?.basePrice ?? 0;
    }

      // Stock validation is handled at checkout; skip here

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    const existingIndex = cart.items.findIndex(
      (it: any) => it.product.toString() === productId && (it.variantSku || '') === (variantSku || '')
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].price = unitPrice;
    } else {
      cart.items.push({ product: new Types.ObjectId(productId), variantSku, quantity, price: unitPrice });
    }

    await cart.save();
    return cart.populate('items.product');
  };

  const deleteCartItem = async (userId: string, itemId: string) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) throw new AppError(404, 'Cart not found');

    const idx = cart.items.findIndex((it: any) => String(it._id) === String(itemId));
    if (idx === -1) throw new AppError(404, 'Cart item not found');

    cart.items.splice(idx, 1);
    await cart.save();

    return cart.populate('items.product');
  };

  const updateCartItem = async (userId: string, itemId: string, quantity: number) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) throw new AppError(404, 'Cart not found');

    const idx = cart.items.findIndex((it: any) => String(it._id) === String(itemId));
    if (idx === -1) throw new AppError(404, 'Cart item not found');

    if (quantity <= 0) {
      // remove item when quantity is zero or less
      cart.items.splice(idx, 1);
      await cart.save();
      return cart.populate('items.product');
    }

    // update quantity and refresh price snapshot
    const item = cart.items[idx] as any;
    const product = await Product.findById(item.product);
    if (!product) throw new AppError(404, 'Product not found');

    let unitPrice = product.pricing?.salePrice ?? product.pricing?.basePrice ?? 0;
    if (item.variantSku) {
      const wanted = (item.variantSku || '').toString().trim().toLowerCase();
      const variant = product.variants?.find((v: any) => (v.sku || '').toString().trim().toLowerCase() === wanted);
      if (!variant) throw new AppError(400, 'Variant not found');
      unitPrice = variant.price;
    }

    item.quantity = quantity;
    item.price = unitPrice;

    await cart.save();
    return cart.populate('items.product');
  };

export const CartService = {
  getCartByUser,
  addItem,
  updateCartItem,
  deleteCartItem
};
