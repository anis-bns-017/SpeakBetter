import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PaymentProvider } from './payment-provider';
import { PERIOD_DAYS, PLAN_LIMITS, PRO_PRICES } from './plans';

const DAY = 24 * 60 * 60 * 1000;

class FakeProvider extends PaymentProvider {
  readonly name = 'sandbox';
  readonly method = 'SANDBOX' as any;
  readonly isSandbox = true;
  available = true;
  isAvailable() {
    return this.available;
  }
  checkoutUrl(id: string) {
    return `/billing/checkout/${id}`;
  }
}

function setup() {
  const payments: any[] = [];
  let subscription: any = null;
  let seq = 0;

  const matches = (row: any, where: any) =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (v && typeof v === 'object' && 'not' in v) return row[k] !== v.not;
      return row[k] === v;
    });

  const paymentApi = {
    create: jest.fn(async ({ data }) => {
      const row = { id: `p${++seq}`, createdAt: new Date(), transactionId: null, ...data };
      payments.push(row);
      return row;
    }),
    findFirst: jest.fn(async ({ where }) => payments.find((p) => matches(p, where)) ?? null),
    findMany: jest.fn(async ({ where }) => payments.filter((p) => matches(p, where))),
    updateMany: jest.fn(async ({ where, data }) => {
      const rows = payments.filter((p) => matches(p, where));
      rows.forEach((p) => Object.assign(p, data));
      return { count: rows.length };
    }),
  };
  const subscriptionApi = {
    findUnique: jest.fn(async () => subscription),
    create: jest.fn(async ({ data }) => (subscription = { id: 's1', ...data })),
    update: jest.fn(async ({ data }) => Object.assign(subscription, data)),
  };
  const prisma: any = {
    payment: paymentApi,
    subscription: subscriptionApi,
    $transaction: jest.fn(async (fn: any) => fn({ payment: paymentApi, subscription: subscriptionApi })),
  };
  const provider = new FakeProvider();
  const notifications: any = { notify: jest.fn(async () => 1) };
  const service = new BillingService(prisma, provider, notifications);
  return { service, prisma, provider, notifications, payments, getSub: () => subscription, setSub: (s: any) => (subscription = s) };
}

const pay = async (ctx: ReturnType<typeof setup>, interval: 'MONTHLY' | 'YEARLY' = 'MONTHLY', outcome = 'success') => {
  const { paymentId } = await ctx.service.startCheckout('u1', 'PRO', interval);
  return ctx.service.settleSandbox('u1', paymentId, outcome);
};

describe('BillingService', () => {
  describe('checkout', () => {
    it('creates a pending payment priced from the catalog, not from the request', async () => {
      const ctx = setup();
      const res = await ctx.service.startCheckout('u1', 'PRO', 'YEARLY');
      expect(res.checkoutUrl).toBe(`/billing/checkout/${res.paymentId}`);
      expect(ctx.payments[0]).toMatchObject({ userId: 'u1', plan: 'PRO', interval: 'YEARLY', amount: PRO_PRICES.YEARLY, status: 'PENDING' });
    });

    it('rejects unknown plans and intervals', async () => {
      const { service } = setup();
      await expect(service.startCheckout('u1', 'ENTERPRISE', 'MONTHLY')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.startCheckout('u1', 'PRO', 'WEEKLY')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses when payments are switched off', async () => {
      const ctx = setup();
      ctx.provider.available = false;
      await expect(ctx.service.startCheckout('u1', 'PRO', 'MONTHLY')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('lets only the newest checkout be paid', async () => {
      const ctx = setup();
      const first = await ctx.service.startCheckout('u1', 'PRO', 'MONTHLY');
      await ctx.service.startCheckout('u1', 'PRO', 'MONTHLY');
      await expect(ctx.service.settleSandbox('u1', first.paymentId, 'success')).rejects.toBeInstanceOf(ConflictException);
    });

    it("hides other people's checkouts", async () => {
      const ctx = setup();
      const { paymentId } = await ctx.service.startCheckout('u1', 'PRO', 'MONTHLY');
      await expect(ctx.service.getCheckout('u2', paymentId)).rejects.toBeInstanceOf(NotFoundException);
      await expect(ctx.service.settleSandbox('u2', paymentId, 'success')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('paying', () => {
    it('turns a successful payment into Pro for the period and tells the learner', async () => {
      const ctx = setup();
      const res = await pay(ctx);
      expect(res.status).toBe('SUCCEEDED');
      expect(res.subscription).toMatchObject({ plan: 'PRO', status: 'ACTIVE', interval: 'MONTHLY', limits: PLAN_LIMITS.PRO });
      expect(res.subscription.daysLeft).toBe(PERIOD_DAYS.MONTHLY);
      expect(ctx.payments[0]).toMatchObject({ status: 'SUCCEEDED', transactionId: `sandbox_${ctx.payments[0].id}` });
      expect(ctx.notifications.notify).toHaveBeenCalledWith(['u1'], expect.objectContaining({ type: 'PAYMENT' }));
    });

    it('gives nothing for a failed or cancelled payment', async () => {
      const ctx = setup();
      expect((await pay(ctx, 'MONTHLY', 'fail')).status).toBe('FAILED');
      expect((await pay(ctx, 'MONTHLY', 'cancel')).status).toBe('CANCELLED');
      expect(ctx.getSub()).toBeNull();
      expect((await ctx.service.getMine('u1')).plan).toBe('FREE');
      expect(ctx.notifications.notify).not.toHaveBeenCalled();
    });

    it('cannot settle the same payment twice', async () => {
      const ctx = setup();
      const { paymentId } = await ctx.service.startCheckout('u1', 'PRO', 'MONTHLY');
      await ctx.service.settleSandbox('u1', paymentId, 'success');
      await expect(ctx.service.settleSandbox('u1', paymentId, 'success')).rejects.toBeInstanceOf(ConflictException);
      expect(ctx.prisma.subscription.create).toHaveBeenCalledTimes(1);
    });

    it('adds to the time left when paying again while subscribed', async () => {
      const ctx = setup();
      await pay(ctx, 'MONTHLY');
      const first = ctx.getSub().endDate.getTime();
      await pay(ctx, 'YEARLY');
      expect(ctx.getSub().endDate.getTime()).toBe(first + PERIOD_DAYS.YEARLY * DAY);
      expect(ctx.prisma.subscription.create).toHaveBeenCalledTimes(1);
    });

    it('starts afresh when the old plan had run out, and undoes an earlier cancel', async () => {
      const ctx = setup();
      ctx.setSub({
        userId: 'u1', plan: 'PRO', status: 'CANCELLED', endDate: new Date(Date.now() - 5 * DAY),
        interval: 'MONTHLY', cancelAtPeriodEnd: true, startDate: new Date(Date.now() - 40 * DAY),
      });
      const res = await pay(ctx, 'MONTHLY');
      expect(res.subscription).toMatchObject({ plan: 'PRO', status: 'ACTIVE', cancelAtPeriodEnd: false });
      expect(res.subscription.daysLeft).toBe(PERIOD_DAYS.MONTHLY);
    });

    it('refuses an expired checkout', async () => {
      const ctx = setup();
      const { paymentId } = await ctx.service.startCheckout('u1', 'PRO', 'MONTHLY');
      ctx.payments[0].createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await expect(ctx.service.settleSandbox('u1', paymentId, 'success')).rejects.toBeInstanceOf(ConflictException);
      expect(ctx.getSub()).toBeNull();
    });

    it('never settles through a provider that is off (the sandbox in production)', async () => {
      const ctx = setup();
      const { paymentId } = await ctx.service.startCheckout('u1', 'PRO', 'MONTHLY');
      ctx.provider.available = false;
      await expect(ctx.service.settleSandbox('u1', paymentId, 'success')).rejects.toBeInstanceOf(ForbiddenException);
      expect(ctx.getSub()).toBeNull();
    });

    it('rejects an unknown outcome', async () => {
      const ctx = setup();
      const { paymentId } = await ctx.service.startCheckout('u1', 'PRO', 'MONTHLY');
      await expect(ctx.service.settleSandbox('u1', paymentId, 'refund')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel and resume', () => {
    it('keeps Pro working after cancelling, and resume turns renewal back on', async () => {
      const ctx = setup();
      await pay(ctx);
      const cancelled = await ctx.service.cancel('u1');
      expect(cancelled).toMatchObject({ plan: 'PRO', status: 'CANCELLED', cancelAtPeriodEnd: true });
      const resumed = await ctx.service.resume('u1');
      expect(resumed).toMatchObject({ plan: 'PRO', status: 'ACTIVE', cancelAtPeriodEnd: false });
    });

    it('has nothing to cancel or resume on the free plan', async () => {
      const ctx = setup();
      await expect(ctx.service.cancel('u1')).rejects.toBeInstanceOf(BadRequestException);
      await expect(ctx.service.resume('u1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reports a plan that ran out as EXPIRED with free limits', async () => {
      const ctx = setup();
      ctx.setSub({ userId: 'u1', plan: 'PRO', status: 'ACTIVE', endDate: new Date(Date.now() - DAY), interval: 'MONTHLY', cancelAtPeriodEnd: false });
      expect(await ctx.service.getMine('u1')).toMatchObject({ plan: 'FREE', status: 'EXPIRED', limits: PLAN_LIMITS.FREE });
      expect(await ctx.service.getLimits('u1')).toEqual(PLAN_LIMITS.FREE);
    });
  });
});
