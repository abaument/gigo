/** Sets an account's monthly token ceiling. 0 means unlimited.
 *
 *   bun scripts/set-user-quota.ts demo@gigo.dev 0
 */
import { db } from '../src/lib/db';

const [email, raw] = process.argv.slice(2);
if (!email || raw === undefined) throw new Error('usage: bun scripts/set-user-quota.ts <email> <tokens|0>');

const quota = Number(raw);
if (!Number.isFinite(quota) || quota < 0) throw new Error('quota invalide');

const user = await db.user.update({
  where: { email },
  data: { monthlyTokenQuota: quota },
  select: { email: true, monthlyTokenQuota: true },
});
console.log(`${user.email} : quota mensuel ${user.monthlyTokenQuota === 0 ? 'illimité' : user.monthlyTokenQuota + ' tokens'}`);
await db.$disconnect();
