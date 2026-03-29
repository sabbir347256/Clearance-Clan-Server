import { Types } from 'mongoose';
import { Order } from '../order/order.model';
import { Product } from '../products/product.model';
import { Shop } from '../sellers/seller.model';


type Period = 'weekly' | 'monthly';

// Build aggregation pipeline. For weekly we group by day; for monthly by month.
const buildPipeline = (period: Period, dateFrom: Date, shopId?: string) => {
	const groupDateTrunc = {
		$dateTrunc: {
			date: '$createdAt',
			unit: period === 'monthly' ? 'month' : 'day'
		}
	};

	const pipeline: any[] = [
		{ $match: { createdAt: { $gte: dateFrom }, status: { $ne: 'CANCELLED' } } },
		{ $unwind: '$items' },
		{
			$lookup: {
				from: 'products',
				localField: 'items.product',
				foreignField: '_id',
				as: 'product'
			}
		},
		{ $unwind: '$product' }
	];

	if (shopId) pipeline.push({ $match: { 'product.shop': new Types.ObjectId(shopId) } });

	pipeline.push(
		{
			$project: {
				orderId: '$_id',
				amount: { $multiply: ['$items.price', '$items.quantity'] },
				quantity: '$items.quantity',
				createdAt: '$createdAt'
			}
		},
		{
			$group: {
				_id: groupDateTrunc,
				ordersSet: { $addToSet: '$orderId' },
				revenue: { $sum: '$amount' },
				units: { $sum: '$quantity' }
			}
		},
		{
			$project: {
				periodStart: '$_id',
				orders: { $size: '$ordersSet' },
				revenue: 1,
				units: 1
			}
		},
		{ $sort: { periodStart: 1 } }
	);

	return pipeline;
};

const getDateFromForPeriod = (period: Period, limit = 12) => {
	const now = new Date();
	if (period === 'monthly') {
		return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (limit - 1), 1));
	}
	// weekly: return UTC start of day (limit - 1) days ago
	const days = limit - 1;
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	return new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
};

const generatePeriods = (period: Period, limit: number) => {
	const periods: Date[] = [];
	const now = new Date();
	if (period === 'monthly') {
		const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (limit - 1), 1));
		for (let i = 0; i < limit; i++) {
			periods.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)));
		}
	} else {
		// daily periods (last `limit` days) starting at UTC midnight
		const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
		for (let i = limit - 1; i >= 0; i--) {
			periods.push(new Date(start.getTime() - i * 24 * 60 * 60 * 1000));
		}
	}
	return periods;
};

const getSellerStats = async (userId: string, period: Period, limit = 12) => {
	const shop = await Shop.findOne({ userId });
	if (!shop) throw new Error('Seller shop not found');

	// sensible defaults
	if (!limit || limit <= 0) limit = period === 'weekly' ? 7 : 12;

	const dateFrom = getDateFromForPeriod(period, limit);
	const pipeline = buildPipeline(period, dateFrom, shop._id.toString());
	const raw = await Order.aggregate(pipeline as any);

	// map raw results by ISO periodStart
	const map = new Map<string, any>();
	raw.forEach((r: any) => map.set(new Date(r.periodStart).toISOString(), r));

	const periods = generatePeriods(period, limit);
	return periods.map((p) => {
		const key = p.toISOString();
		const item = map.get(key);
		return {
			periodStart: key,
			orders: item ? item.orders : 0,
			revenue: item ? item.revenue : 0,
			units: item ? item.units : 0
		};
	});
};

const getProductStats = async (productId: string, period: Period, limit = 12) => {
	if (!limit || limit <= 0) limit = period === 'weekly' ? 7 : 12;

	const dateFrom = getDateFromForPeriod(period, limit);

	const pipeline: any[] = [
		{ $match: { createdAt: { $gte: dateFrom }, status: { $ne: 'CANCELLED' } } },
		{ $unwind: '$items' },
		{ $match: { 'items.product': new Types.ObjectId(productId) } },
		{
			$project: {
				orderId: '$_id',
				amount: { $multiply: ['$items.price', '$items.quantity'] },
				quantity: '$items.quantity',
				createdAt: '$createdAt'
			}
		},
		{
			$group: {
				_id: {
					$dateTrunc: {
						date: '$createdAt',
						unit: period === 'monthly' ? 'month' : 'day'
					}
				},
				ordersSet: { $addToSet: '$orderId' },
				revenue: { $sum: '$amount' },
				units: { $sum: '$quantity' }
			}
		},
		{
			$project: {
				periodStart: '$_id',
				orders: { $size: '$ordersSet' },
				revenue: 1,
				units: 1
			}
		},
		{ $sort: { periodStart: 1 } }
	];

	const raw = await Order.aggregate(pipeline as any);

	const map = new Map<string, any>();
	raw.forEach((r: any) => map.set(new Date(r.periodStart).toISOString(), r));

	const periods = generatePeriods(period, limit);
	return periods.map((p) => {
		const key = p.toISOString();
		const item = map.get(key);
		return {
			periodStart: key,
			orders: item ? item.orders : 0,
			revenue: item ? item.revenue : 0,
			units: item ? item.units : 0
		};
	});
};

const getShopStats = async (period: Period, limit = 12) => {
	if (!limit || limit <= 0) limit = period === 'weekly' ? 7 : 12;

	const dateFrom = getDateFromForPeriod(period, limit);
	const pipeline = buildPipeline(period, dateFrom);
	const raw = await Order.aggregate(pipeline as any);

	const map = new Map<string, any>();
	raw.forEach((r: any) => map.set(new Date(r.periodStart).toISOString(), r));

	const periods = generatePeriods(period, limit);
	return periods.map((p) => {
		const key = p.toISOString();
		const item = map.get(key);
		return {
			periodStart: key,
			orders: item ? item.orders : 0,
			revenue: item ? item.revenue : 0,
			units: item ? item.units : 0
		};
	});
};

export const GraphService = {
	getSellerStats,
	getShopStats,
    getProductStats
};

