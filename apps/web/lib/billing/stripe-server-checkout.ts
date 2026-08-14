import Stripe from "stripe";

import type {
  ServerCheckoutGateway,
  ServerPaymentLink,
  ServerPaymentLinkLineItem,
} from "./server-checkout";

function paymentLinkLineItem(
  lineItem: Stripe.LineItem,
): ServerPaymentLinkLineItem {
  const price = lineItem.price;
  return {
    quantity: lineItem.quantity,
    price:
      typeof price === "string" || price === null
        ? price
        : {
            id: price.id,
            type: price.type,
            recurring: price.recurring
              ? {
                  interval: price.recurring.interval,
                  interval_count: price.recurring.interval_count,
                }
              : null,
          },
  };
}

function paymentLink(link: Stripe.PaymentLink): ServerPaymentLink {
  return {
    id: link.id,
    active: link.active,
    url: link.url,
    line_items: link.line_items
      ? {
          data: link.line_items.data.map(paymentLinkLineItem),
          has_more: link.line_items.has_more,
        }
      : null,
  };
}

export function createStripeServerCheckoutGateway(
  stripe: Stripe,
): ServerCheckoutGateway {
  return {
    paymentLinks: {
      list: async (params) => {
        const page = await stripe.paymentLinks.list(params);
        return {
          data: page.data.map(paymentLink),
          has_more: page.has_more,
        };
      },
    },
    checkout: {
      sessions: {
        create: async (params, requestOptions) => {
          const session = await stripe.checkout.sessions.create(
            params,
            requestOptions,
          );
          return { id: session.id, url: session.url };
        },
      },
    },
  };
}
