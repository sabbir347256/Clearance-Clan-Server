import { Request, Response } from 'express';
import ConnectService from './connect.service';
import dot from 'dotenv';
dot.config();

/*
  ConnectController
  - Demonstrates a simple Stripe Connect marketplace flow using Destination Charges
  - Creates connected accounts (with controller properties only)
  - Creates Account Links (onboarding)
  - Creates platform-level products and maps them to connected accounts via metadata
  - Lists products and serves a simple storefront HTML
  - Creates Checkout Sessions that use destination transfer_data + application_fee_amount

  Notes/Placeholders:
  - `process.env.STRIPE_SECRET_KEY` must be set (see src/config/stripe.config.ts)
  - `process.env.ROOT_URL` should point to your application root for redirect URLs
  - `process.env.PLATFORM_COMMISSION` sets a default application fee percentage (e.g. "0.10" for 10%)
*/

const ROOT_URL = process.env.ROOT_URL || 'https://clearanceclan-backend.onrender.com/api/v1/';

class ConnectController {
  // Create a connected account with controller properties only.
  // The platform is responsible for pricing and fee collection and for losses.
  static async createAccount(req: Request, res: Response) {
    try {
      const account = await ConnectService.createAccount(req.body || {});
      res.json({ id: account.id, account });
    } catch (err: any) {
      console.error('createAccount error', err);
      res.status(500).json({ error: err.message || 'Account creation failed' });
    }
  }

  // Create an Account Link for onboarding. Uses Account Links API.
  // This returns a URL that the connected account owner can visit to complete onboarding.
  static async createAccountLink(req: Request, res: Response) {
    try {
      const accountId = req.params.id;
      if (!accountId) return res.status(400).json({ error: 'Missing account id' });
      const { accountLink, account } = await ConnectService.createAccountLink(accountId);
      res.json({ url: accountLink.url, account });
    } catch (err: any) {
      console.error('createAccountLink error', err);
      res.status(500).json({ error: err.message || 'Account link creation failed' });
    }
  }

  // Retrieve account status directly from Stripe
  static async getAccountStatus(req: Request, res: Response) {
    try {
      const accountId = req.params.id;
      if (!accountId) return res.status(400).json({ error: 'Missing account id' });
      const summary = await ConnectService.getAccountStatus(accountId);
      res.json({ account: summary });
    } catch (err: any) {
      console.error('getAccountStatus error', err);
      res.status(500).json({ error: err.message || 'Account retrieve failed' });
    }
  }

  // Create a platform-level product and attach mapping to a connected account in metadata.
  // Request body should include: name, description, price (in cents), currency, connectedAccountId
  static async createProduct(req: Request, res: Response) {
    try {
      const product = await ConnectService.createStripeProduct(req.body || {});
      res.json({ product });
    } catch (err: any) {
      console.error('createProduct error', err);
      res.status(500).json({ error: err.message || 'Product creation failed' });
    }
  }

  // List platform products (with metadata mapping)
  static async listProducts(req: Request, res: Response) {
    try {
      const detailed = await ConnectService.listProducts();
      res.json({ products: detailed });
    } catch (err: any) {
      console.error('listProducts error', err);
      res.status(500).json({ error: err.message || 'List products failed' });
    }
  }

  // Serve a simple storefront HTML that lists products and allows purchases.
  // For demo simplicity, this returns an HTML page built on the fly.
  static async storefrontPage(req: Request, res: Response) {
    try {
      const html = await ConnectService.buildStorefrontHtml();
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err: any) {
      console.error('storefrontPage error', err);
      res.status(500).send('Failed to load storefront');
    }
  }

  // Create a Stripe Checkout session using destination charge with application fee.
  // Expects `productId` and `quantity` in the POST body (form-encoded allowed).
  static async createCheckoutSession(req: Request, res: Response) {
    try {
      // Support either legacy { productId, quantity } or new { items: [{ productId, priceId?, quantity }] }
      const payload = req.body || {};
      const session = await ConnectService.createCheckoutSession({
        productId: payload.productId,
        quantity: payload.quantity,
        items: payload.items,
        rootUrl: process.env.ROOT_URL
      });
      if (session.url) {
        res.status(200).json({ url: session.url });
      } else {
        res.json({ session });
      }
    } catch (err: any) {
      console.error('createCheckoutSession error', err);
      res.status(500).json({ error: err.message || 'Checkout session creation failed' });
    }
  }

  // Simple success page
  static async checkoutSuccess(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <html><body style="font-family:Arial;padding:24px">
        <h1>Payment Successful</h1>
        <p>Thank you for your purchase. You may close this window.</p>
      </body></html>
    `);
  }

  // Simple cancel page
  static async checkoutCancel(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <html><body style="font-family:Arial;padding:24px">
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled. You can return to the storefront and try again.</p>
      </body></html>
    `);
  }
}

export default ConnectController;
