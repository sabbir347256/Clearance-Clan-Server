import { stripe } from '../../config/stripe.config';

const ROOT_URL = process.env.ROOT_URL || 'http://localhost:3002';

export const createAccount = async (payload: { country?: string; email?: string }) => {
  const { country = 'US', email } = payload || {};
  const account = await stripe.accounts.create({
    country,
    email,
    controller: {
      fees: { payer: 'application' as const },
      losses: { payments: 'application' as const },
      stripe_dashboard: { type: 'express' as const },
    },
  });
  return account;
};

export const createAccountLink = async (accountId: string) => {
  const account = await stripe.accounts.retrieve(accountId);
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    collect: 'eventually_due',
    refresh_url: `${ROOT_URL}/connect/accounts/${accountId}/onboard/refresh`,
    return_url: `${ROOT_URL}/connect/accounts/${accountId}/onboard/return`,
    type: 'account_onboarding',
  });
  return { accountLink, account };
};

export const getAccountStatus = async (accountId: string) => {
  const account = await stripe.accounts.retrieve(accountId);
  const summary = {
    id: account.id,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    requirements: account.requirements,
    details_submitted: account.details_submitted,
  };
  return summary;
};

export const createStripeProduct = async (payload: { name?: string; description?: string; price?: any; currency?: string; connectedAccountId?: string }) => {
  const { name, description, price, currency = 'usd', connectedAccountId } = payload || {};
  if (!name || price === null || !connectedAccountId) throw new Error('Missing required fields: name, price, connectedAccountId');
  const product = await stripe.products.create({
    name,
    description,
    metadata: { connected_account: connectedAccountId },
    default_price_data: {
      unit_amount: parseInt(String(price), 10),
      currency,
    },
  });
  return product;
};

export const listProducts = async () => {
  const products = await stripe.products.list({ limit: 100 });
  const detailed = await Promise.all(
    products.data.map(async (p) => {
      let price = null as any;
      if (p.default_price && typeof p.default_price === 'string') {
        try {
          price = await stripe.prices.retrieve(p.default_price);
        } catch (e) {}
      } else if (p.default_price && typeof p.default_price === 'object') {
        price = p.default_price;
      }
      return { product: p, price };
    })
  );
  return detailed;
};

export const buildStorefrontHtml = async () => {
  const productsRes = await stripe.products.list({ limit: 100 });
  const rows = await Promise.all(
    productsRes.data.map(async (p) => {
      let unit = '—';
      if (p.default_price && typeof p.default_price === 'string') {
        try {
          const price = await stripe.prices.retrieve(p.default_price);
          unit = `${(price.unit_amount || 0) / 100} ${price.currency?.toUpperCase()}`;
        } catch (e) {}
      }
      const connected_account = p.metadata?.connected_account || 'UNMAPPED';
      return `<tr>
            <td>${p.name}</td>
            <td>${p.description || ''}</td>
            <td>${unit}</td>
            <td>${connected_account}</td>
            <td>
              <form method="POST" action="/connect/checkout">
                <input type="hidden" name="productId" value="${p.id}" />
                <input type="number" name="quantity" value="1" min="1" style="width:60px" />
                <button type="submit">Buy</button>
              </form>
            </td>
          </tr>`;
    })
  );

  const html = `
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Marketplace Storefront</title>
          <style>
            body{font-family: Arial, Helvetica, sans-serif; padding:20px}
            table{width:100%; border-collapse:collapse}
            th,td{padding:8px; border-bottom:1px solid #eee}
            button{background:#111;color:#fff;border:none;padding:6px 10px;border-radius:4px}
            form{display:inline}
          </style>
        </head>
        <body>
          <h1>Marketplace Storefront</h1>
          <p>Products listed are created at the platform level. The connected account mapped to a product is shown in the table.</p>
          <table>
            <thead><tr><th>Name</th><th>Description</th><th>Price</th><th>Connected Account</th><th>Buy</th></tr></thead>
            <tbody>
              ${rows.join('\n')}
            </tbody>
          </table>
        </body>
        </html>
      `;

  return html;
};

export const createCheckoutSession = async (payload: { productId?: string; quantity?: any; items?: Array<{ productId: string; variantIndex?: number; priceId?: string; quantity?: number }>; rootUrl?: string; metadata?: Record<string,string> }) => {
  const { productId, quantity = 1, items, rootUrl = ROOT_URL, metadata } = payload as any;

  // Support legacy single-product flow by converting to items array
  const itemsList = items && items.length ? items : (productId ? [{ productId, quantity }] : []);
  if (!itemsList || itemsList.length === 0) throw new Error('Missing productId or items for checkout');

  // Load products and resolve price ids and connected account
  const resolvedItems: Array<{ priceId: string; quantity: number; connectedAccountId: string; unitAmount: number }> = [];

  for (const it of itemsList) {
    const prod = await stripe.products.retrieve(it.productId);
    const connectedAccountId = prod.metadata?.connected_account;
    if (!connectedAccountId) throw new Error(`Product ${it.productId} is not mapped to a connected account`);

    // Determine price id: prefer explicit priceId, then variant's stripePriceId in product metadata or default_price
    let priceId: string | null = null;
    if (it.priceId) priceId = it.priceId;
    else if (prod.default_price && typeof prod.default_price === 'string') priceId = prod.default_price as string;

    // If still no priceId, error (variants created by our service set default_price)
    if (!priceId) throw new Error(`Price id not found for product ${it.productId}`);

    // retrieve price to get unit_amount
    const priceObj = await stripe.prices.retrieve(priceId);
    const unit = priceObj.unit_amount || 0;
    resolvedItems.push({ priceId, quantity: parseInt(String(it.quantity || 1), 10), connectedAccountId, unitAmount: unit as number });
  }

  // Ensure all items map to same connected account (Stripe Checkout only supports single transfer destination)
  const distinctAccounts = Array.from(new Set(resolvedItems.map((r) => r.connectedAccountId)));
  if (distinctAccounts.length > 1) {
    throw new Error('Multiple connected accounts in cart are not supported by Checkout. Use separate checkout sessions or implement platform-level aggregation.');
  }

  const connectedAccountId = distinctAccounts[0];

  const commission = parseFloat(process.env.PLATFORM_COMMISSION || '0.10');

  const sessionParams: any = {
    mode: 'payment',
    success_url: `${rootUrl}/connect/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${rootUrl}/connect/cancel`,
    payment_method_types: ['card'],
    line_items: resolvedItems.map((r) => ({ price: r.priceId, quantity: r.quantity })),
    payment_intent_data: { application_fee_amount: 0, transfer_data: { destination: connectedAccountId }, metadata: metadata || {} },
  };

  // compute total and application fee
  const total = resolvedItems.reduce((s, r) => s + r.unitAmount * r.quantity, 0);
  sessionParams.payment_intent_data.application_fee_amount = Math.round(total * commission);

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
};

export default {
  createAccount,
  createAccountLink,
  getAccountStatus,
  createStripeProduct,
  listProducts,
  buildStorefrontHtml,
  createCheckoutSession,
};
