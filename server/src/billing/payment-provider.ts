import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';

/**
 * A way of taking money. The billing service only talks to this, so a real provider (SSLCommerz, bKash,
 * Stripe...) can replace the sandbox without touching plans, subscriptions or the web app.
 */
export abstract class PaymentProvider {
  /** Stored on the subscription and the payment */
  abstract readonly name: string;
  abstract readonly method: PaymentMethod;
  /** False when this provider must not take payments (the sandbox in production) */
  abstract isAvailable(): boolean;
  /** Where the learner goes to pay for `paymentId`; a path in the web app or a provider's URL */
  abstract checkoutUrl(paymentId: string): string;
  /** Whether the provider is a stand-in that moves no money */
  abstract readonly isSandbox: boolean;
}

/**
 * Fake checkout for building and testing the subscription flow. Nothing is charged; the learner picks
 * the outcome on a test page. It refuses to run in production unless BILLING_ALLOW_SANDBOX=true, so a
 * live deployment can never hand out Pro for free by accident.
 */
@Injectable()
export class SandboxPaymentProvider extends PaymentProvider {
  readonly name = 'sandbox';
  readonly method = PaymentMethod.SANDBOX;
  readonly isSandbox = true;

  constructor(private config: ConfigService) {
    super();
  }

  isAvailable(): boolean {
    if (this.config.get<string>('NODE_ENV') !== 'production') return true;
    return this.config.get<string>('BILLING_ALLOW_SANDBOX') === 'true';
  }

  checkoutUrl(paymentId: string): string {
    return `/billing/checkout/${paymentId}`;
  }
}
