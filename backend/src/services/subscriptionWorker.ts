import { db } from '../db';
import { notify } from './notify';
import { sendUserEmail } from './email';

/** Subscription-only maintenance. Task and Trash maintenance lives in taskWorker. */
export async function subscriptionSweep() {
  const now = new Date();
  const subs = await db.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
    include: { company: { include: { users: { where: { status: { not: 'SUSPENDED' } } } } } }
  });

  for (const s of subs) {
    const ms = s.expiresAt.getTime() - now.getTime();
    const days = Math.ceil(ms / 86400000);

    if (days === 2 || days === 1) {
      const title = `Subscription: ${days} day${days === 1 ? '' : 's'} left`;
      const recent = await db.notification.count({ where: { companyId: s.companyId, title, createdAt: { gt: new Date(Date.now() - 36 * 3600000) } } });
      if (!recent) {
        for (const u of s.company.users) {
          await notify(u.id, title, `Your subscription expires in ${days} day${days === 1 ? '' : 's'}.`, s.companyId);
          await sendUserEmail(u.email, title, `<p>Your SecureFile subscription expires in ${days} day${days === 1 ? '' : 's'}.</p>`).catch(() => {});
        }
      }
    }

    if (ms <= 0 && s.status !== 'SUSPENDED') {
      await db.subscription.update({ where: { id: s.id }, data: { status: 'SUSPENDED' } });
      for (const u of s.company.users) {
        await notify(u.id, 'Subscription suspended', 'Payment is required to restore normal use.', s.companyId);
        await sendUserEmail(u.email, 'SecureFile subscription suspended', '<p>Your subscription has expired.</p>').catch(() => {});
      }
    }
  }
}
