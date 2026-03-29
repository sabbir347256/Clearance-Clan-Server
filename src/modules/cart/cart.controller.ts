import { Request, Response, NextFunction } from 'express';
import asyncHandler from '../../utils/CatchAsync';
import { CartService } from './cart.service';

const addItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const payload = req.body;
    const cart = await CartService.addItem(userId, payload);
    return res.status(200).json({ success: true, data: cart });
  } catch (err) {
    throw err;
  }
};

const getCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const cart = await CartService.getCartByUser(userId);
    return res.status(200).json({ success: true, data: cart });
  } catch (err) {
    throw err;
  }
};

const updateCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const { itemId } = req.params;
    const { quantity } = req.body;
    const cart = await CartService.updateCartItem(userId, itemId, Number(quantity));
    return res.status(200).json({ success: true, data: cart });
  } catch (err) {
    throw err;
  }
};

const deleteCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const { itemId } = req.params;
    const result = await CartService.deleteCartItem(userId, itemId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    throw err;
  }
};

export const CartController = {
  addItem: asyncHandler(addItem),
  getCart: asyncHandler(getCart),
  updateCart: asyncHandler(updateCart),
  deleteCart: asyncHandler(deleteCart),
};
