import { db } from '../db';
import { notify } from './notify';
import { sendUserEmail } from './email';
import { purgeExpiredTrash } from './trash';

export async function taskAndTrashSweep() {
  const now = new Date();
  const tasks = await db.task.findMany({ where: { dueAt: { not: null } }, include: { assignee: { select: { id: true, email: true, uniqueName: true } } } });
  for (const task of tasks) {
    if (!task.dueAt) continue;
    if (task.dueAt <= now) {
      await db.task.delete({ where: { id: task.id } }).catch(() => undefined);
      continue;
    }
    if (task.status === 'COMPLETED') continue;
    const hours = (task.dueAt.getTime() - now.getTime()) / 3600000;
    const shouldRemind = !task.lastReminderAt || now.getTime() - task.lastReminderAt.getTime() >= 24 * 3600000;
    if (shouldRemind) {
      const remaining = hours < 24 ? `${Math.max(1, Math.ceil(hours))} hour(s)` : `${Math.ceil(hours / 24)} day(s)`;
      const title = `Task reminder: ${task.title}`;
      await notify(task.assigneeId, title, `You have ${remaining} remaining to complete this task.`, task.companyId);
      try { await sendUserEmail(task.assignee.email, title, `<p>You have <strong>${remaining}</strong> remaining to complete <strong>${task.title}</strong>.</p>`); } catch {}
      await db.task.update({ where: { id: task.id }, data: { lastReminderAt: now } }).catch(() => undefined);
    }
  }
  return await purgeExpiredTrash();
}
