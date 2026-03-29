import { Request, Response } from 'express';
import { GraphService } from './graph.service';
import AppError from '../../errorHelper/AppError';

const getSellerGraph = async (req: Request, res: Response) => {
	try {
		const period = (req.query.period as string) === 'weekly' ? 'weekly' : 'monthly';
		const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
		const limit = rawLimit && rawLimit > 0 ? rawLimit : (period === 'weekly' ? 7 : 12);

		if (!req.user) {
			return res.status(401).json({ success: false, message: 'Unauthorized' });
		}

		const data = await GraphService.getSellerStats(req.user._id.toString(), period as any, limit);

		return res.status(200).json({ success: true, data });
	} catch (error: any) {
		throw new AppError(500, error.message || 'Server error');
	}
};

const getShopGraph = async (req: Request, res: Response) => {
	try {
		const period = (req.query.period as string) === 'weekly' ? 'weekly' : 'monthly';
		const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
		const limit = rawLimit && rawLimit > 0 ? rawLimit : (period === 'weekly' ? 7 : 12);

		const data = await GraphService.getShopStats(period as any, limit);

		return res.status(200).json({ success: true, data });
	} catch (error: any) {
		throw new AppError(500, error.message || 'Server error');
	}
};

const getProductGraph = async (req: Request, res: Response) => {
	try {
		const period = (req.query.period as string) === 'weekly' ? 'weekly' : 'monthly';
		const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
		const limit = rawLimit && rawLimit > 0 ? rawLimit : (period === 'weekly' ? 7 : 12);

		const productId = req.params.productId;
		if (!productId) {
			return res.status(400).json({ success: false, message: 'productId required' });
		}

		if (!req.user) {
			return res.status(401).json({ success: false, message: 'Unauthorized' });
		}

		// ensure product belongs to seller's shop
		const shop = await (await import('../sellers/seller.model')).Shop.findOne({ userId: req.user._id });
		if (!shop) {
			return res.status(400).json({ success: false, message: 'Seller shop not found' });
		}

		const product = await (await import('../products/product.model')).Product.findById(productId);
		if (!product || product.shop.toString() !== shop._id.toString()) {
			return res.status(403).json({ success: false, message: 'Access denied to this product' });
		}

		const data = await GraphService.getProductStats(productId, period as any, limit);

		return res.status(200).json({ success: true, data });
	} catch (error: any) {
		throw new AppError(500, error.message || 'Server error');
	}
};

export const GraphController = {
	getSellerGraph,
	getProductGraph
};
