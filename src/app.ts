import express from 'express';
import router from './routes';
// side-effect import: register event handlers
import './events/handlers/notification.handler';
import cors from 'cors';
import globalErrorHandler from './middlewares/error.middleware';
import { webhookRoutes } from './modules/payments/webhook.controller';
import connectWebhookRoutes from './modules/payments/connect.webhook.controller';

const app = express();

app.use(cors());
// Stripe needs the raw body for webhook signature verification on this path
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);
// Register connected-account webhook endpoint (expects raw body as well)
app.use('/api/v1/connect/webhook', express.raw({ type: 'application/json' }), connectWebhookRoutes);

// Parse JSON bodies (but not multipart/form-data - multer will handle those)
app.use(express.json());
// Parse urlencoded bodies (but not multipart/form-data)
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Clearance-Clan Server..........',
  });
});

app.use('/api/v1', router);

// global error handler (should be last middleware)
app.use(globalErrorHandler);


export default app;
