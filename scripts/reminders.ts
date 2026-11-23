import { loadEnvConfig } from "@next/env";
import {
  setVapidDetails,
  sendNotification,
  type PushSubscription,
} from "web-push";
import { db } from "../lib/db";
import { models } from "../lib/model";
import { pushConfigured } from "../lib/integrations";

loadEnvConfig(process.cwd());
async function run() {
  if (!pushConfigured()) {
    console.error(
      "Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT before running the scheduler.",
    );
    process.exitCode = 1;
    return;
  }
  setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const now = new Date();
  const available = {
    OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }],
  };
  const rows = await db.record.findMany({
    where: {
      kind: "reminder",
      due: { lte: now },
      deliveredAt: null,
      ...available,
    },
    take: 100,
    orderBy: { due: "asc" },
  });
  for (const row of rows) {
    const claim = await db.record.updateMany({
      where: { id: row.id, deliveredAt: null, ...available },
      data: { claimedUntil: new Date(Date.now() + 300000) },
    });
    if (!claim.count) continue;
    const { title } = models.reminder.parse(row.data);
    const subscriptions = await db.subscription.findMany({
      where: { userId: row.userId },
    });
    let sent = false;
    for (const sub of subscriptions) {
      try {
        await sendNotification(
          sub.data as unknown as PushSubscription,
          JSON.stringify({ title, tag: row.id, account: row.userId }),
          { TTL: 3600, timeout: 10000 },
        );
        sent = true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410)
          await db.subscription.deleteMany({
            where: { endpoint: sub.endpoint, userId: row.userId },
          });
      }
    }
    if (sent)
      await db.record.updateMany({
        where: { id: row.id, due: row.due, deliveredAt: null },
        data: { deliveredAt: new Date(), claimedUntil: null },
      });
  }
}
run()
  .catch(() => {
    console.error(
      "Reminder worker failed. Check the database and VAPID configuration.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
