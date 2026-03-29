import express from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { shopApprovedOnly } from '../../middlewares/sellerapproved.middleware';
import { GraphController } from './graph.controller';

const router = express.Router();

// Seller graphs (their shop only)
router.get(
	'/seller',
	authMiddleware,
	roleMiddleware('SELLER'),
	shopApprovedOnly,
	GraphController.getSellerGraph
);

// Product-level graphs (seller only)
router.get(
	'/product/:productId',
	authMiddleware,
	roleMiddleware('SELLER'),
	shopApprovedOnly,
	GraphController.getProductGraph
);


export const graphRoutes = router;