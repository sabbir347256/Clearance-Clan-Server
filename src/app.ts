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
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);
app.use('/api/v1/connect/webhook', express.raw({ type: 'application/json' }), connectWebhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Clearance-Clan Server..........',
  });
});

app.use('/api/v1', router);

app.use(globalErrorHandler);


export default app;
