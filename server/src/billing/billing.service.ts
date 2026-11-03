import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BillingInterval, NotificationType, Payment, PaymentStatus, SubscriptionPlan } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma.service';
import { PaymentProvider } from './payment-provider';
import {
  CURRENCY,
  PERIOD_DAYS,
  PLAN_LIMITS,
  PlanLimits,
  PRO_PRICES,
  daysLeft,
  effectivePlan,
  extendedEnd,
  limitsFor,
  priceOf,
  yearlySavingsPercent,
} from './plans';

/** A checkout nobody finished within this long can no longer be paid */
const CHECKOUT_TTL_MS = 60 * 60 * 1000;

export type SandboxOutcome = 'success' | 'fail' | 'cancel';

const INTERVALS: BillingInterval[] = ['MONTHLY', 'YEARLY'];
const isInterval = (v: unknown): v is BillingInterval => INTERVALS.includes(v as BillingInterval);

const money = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private provider: PaymentProvider,
    private notifications: NotificationsService,
  ) {}

  /** What can be bought, what each plan includes, and whether paying works at all right now */
  catalog() {
    return {
      currency: CURRENCY,
      sandbox: this.provider.isSandbox,
      paymentsAvailable: this.provider.isAvailable(),
      yearlySavingsPercent: yearlySavingsPercent(),
      plans: [
        { id: 'FREE', name: 'Free', limits: PLAN_LIMITS.FREE, prices: null },
        {
          id: 'PRO',
          name: 'Pro',
          limits: PLAN_LIMITS.PRO,
          prices: { MONTHLY: PRO_PRICES.MONTHLY, YEARLY: PRO_PRICES.YEARLY },
        },
      ],
    };
  }

  /** The plan someone has right now (a lapsed Pro counts as FREE) */
  async getPlan(userId: string): Promise<SubscriptionPlan> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    return effectivePlan(sub);
  }

  /** What the person's plan allows */
  async getLimits(userId: string): Promise<PlanLimits> {
    return limitsFor(await this.getPlan(userId));
  }

  /** Their subscription as the app shows it */
  async getMine(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    const plan = effectivePlan(sub);
    const lapsed = !!sub && sub.plan !== 'FREE' && plan === 'FREE';
    return {
      plan,
      /** ACTIVE, CANCELLED (still working until the end), EXPIRED (ran out) or FREE (never subscribed) */
      status: plan === 'FREE' ? (lapsed ? 'EXPIRED' : 'FREE') : sub!.cancelAtPeriodEnd ? 'CANCELLED' : 'ACTIVE',
      interval: plan === 'FREE' ? null : sub!.interval,
      endDate: sub?.endDate ?? null,
      daysLeft: plan === 'FREE' ? 0 : daysLeft(sub!.endDate),
      cancelAtPeriodEnd: plan === 'FREE' ? false : sub!.cancelAtPeriodEnd,
      limits: limitsFor(plan),
    };
  }

  async startCheckout(userId: string, planId: unknown, interval: unknown) {
    if (!this.provider.isAvailable()) {
      throw new ServiceUnavailableException('Payments are not available yet');
    }
    if (planId !== 'PRO') throw new BadRequestException('Choose the Pro plan');
    if (!isInterval(interval)) throw new BadRequestException('Choose monthly or yearly billing');

    // Only the latest checkout can be paid, so old tabs cannot charge twice
    await this.prisma.payment.updateMany({
      where: { userId, status: 'PENDING', plan: { not: null } },
      data: { status: PaymentStatus.CANCELLED },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: priceOf(interval),
        currency: CURRENCY,
        status: PaymentStatus.PENDING,
        method: this.provider.method,
        plan: 'PRO',
        interval,
      },
    });
    return { paymentId: payment.id, checkoutUrl: this.provider.checkoutUrl(payment.id) };
  }

  /** The checkout page's details, for the person who started it only */
  async getCheckout(userId: string, paymentId: string) {
    const payment = await this.ownPayment(userId, paymentId);
    return { ...this.paymentView(payment), sandbox: this.provider.isSandbox, expired: this.isExpired(payment) };
  }

  /** The test page's "pay", "fail" and "cancel" buttons. Only exists for the sandbox provider. */
  async settleSandbox(userId: string, paymentId: string, outcome: unknown) {
    if (!this.provider.isSandbox || !this.provider.isAvailable()) {
      throw new ForbiddenException('The test checkout is switched off');
    }
    if (outcome !== 'success' && outcome !== 'fail' && outcome !== 'cancel') {
      throw new BadRequestException('Unknown outcome');
    }
    const payment = await this.ownPayment(userId, paymentId);
    if (payment.status !== 'PENDING') throw new ConflictException('This payment is already settled');
    if (this.isExpired(payment)) {
      await this.prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      throw new ConflictException('This checkout expired. Start again.');
    }

    if (outcome !== 'success') {
      const status = outcome === 'fail' ? PaymentStatus.FAILED : PaymentStatus.CANCELLED;
      await this.prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status } });
      return { status, subscription: await this.getMine(userId) };
    }

    await this.activate(payment);
    await this.notifications.notify([userId], {
      type: NotificationType.PAYMENT,
      title: 'Welcome to Pro',
      message: 'Your payment went through. Enjoy more AI practice every day.',
      actionUrl: '/premium',
      dedupeKey: `payment:${payment.id}`,
    });
    return { status: PaymentStatus.SUCCEEDED, subscription: await this.getMine(userId) };
  }

  /** Stop renewing: Pro keeps working until the paid time runs out */
  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (effectivePlan(sub) === 'FREE') throw new BadRequestException('You do not have an active subscription');
    await this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true, status: 'CANCELLED', canceledAt: new Date() },
    });
    return this.getMine(userId);
  }

  /** Changed their mind before the paid time ran out */
  async resume(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (effectivePlan(sub) === 'FREE') throw new BadRequestException('Your subscription has already ended');
    await this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: false, status: 'ACTIVE', canceledAt: null },
    });
    return this.getMine(userId);
  }

  async payments(userId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { userId, plan: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((p) => this.paymentView(p));
  }

  // ---- internals ----

  private async ownPayment(userId: string, paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId, plan: { not: null } } });
    if (!payment) throw new NotFoundException('Checkout not found');
    return payment;
  }

  private isExpired(payment: Payment) {
    return payment.status === 'PENDING' && Date.now() - payment.createdAt.getTime() > CHECKOUT_TTL_MS;
  }

  /** Marks the payment paid and gives the access in one step, so one cannot happen without the other */
  private async activate(payment: Payment) {
    const interval = payment.interval ?? 'MONTHLY';
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: PaymentStatus.SUCCEEDED, transactionId: `${this.provider.name}_${payment.id}` },
      });
      if (claimed.count === 0) throw new ConflictException('This payment is already settled');

      const current = await tx.subscription.findUnique({ where: { userId: payment.userId } });
      const now = new Date();
      const endDate = extendedEnd(current, interval, now);
      const data = {
        plan: payment.plan ?? ('PRO' as SubscriptionPlan),
        status: 'ACTIVE' as const,
        interval,
        endDate,
        renewalDate: endDate,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        provider: this.provider.name,
      };
      if (current) {
        // Keep the original start while the subscription is unbroken
        const unbroken = effectivePlan(current, now) !== 'FREE';
        await tx.subscription.update({ where: { userId: payment.userId }, data: { ...data, ...(unbroken ? {} : { startDate: now }) } });
      } else {
        await tx.subscription.create({ data: { userId: payment.userId, startDate: now, ...data } });
      }
    });
  }

  private paymentView(p: Payment) {
    return {
      id: p.id,
      plan: p.plan,
      interval: p.interval,
      amount: money(p.amount),
      currency: p.currency,
      status: p.status,
      days: p.interval ? PERIOD_DAYS[p.interval] : null,
      createdAt: p.createdAt,
    };
  }
}
