import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
const webpush = createRequire(import.meta.url)("web-push");

const baseURL = "http://127.0.0.1:4383";
const keys = webpush.generateVAPIDKeys();
const env = {
  ...process.env,
  VAPID_SUBJECT: "mailto:push-test@example.test",
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
};
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4383",
  ],
  { env, stdio: "ignore" },
);
const db = new PrismaClient();
let id;
let browser;
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await fetch(baseURL + "/api/config")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
  });
  const context = await browser.newContext({
    baseURL,
    permissions: ["notifications"],
  });
  const register = await context.request.post("/api/register", {
    data: { email: randomUUID() + "@example.test", password: randomUUID() },
  });
  const user = await register.json();
  id = user.id;
  if (!id) throw new Error("Test account registration failed");
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const status = await page.evaluate(
    async ({ publicKey, account }) => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const key = Uint8Array.from(
          atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
          (v) => v.charCodeAt(0),
        );
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
        const response = await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        if (!response.ok) return "Subscription API HTTP " + response.status;
        reg.active.postMessage({ type: "account", account });
        return "ok";
      } catch (e) {
        return "Push subscription: " + e.name + " " + e.message;
      }
    },
    { publicKey: keys.publicKey, account: id },
  );
  if (status !== "ok") throw new Error(status);
  await page.close();
  const row = await db.record.create({
    data: {
      userId: id,
      kind: "reminder",
      data: {
        title: "Closed app acceptance check",
        at: "2027-07-01T10:00",
        zone: "Asia/Hong_Kong",
      },
      due: new Date(Date.now() - 1000),
    },
  });
  const worker = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/reminders.ts"],
    { env, stdio: "ignore" },
  );
  const exit = await new Promise((resolve) => worker.once("exit", resolve));
  if (exit !== 0) throw new Error("Scheduler exited with " + exit);
  const sent = await db.record.findUnique({ where: { id: row.id } });
  if (!sent?.deliveredAt)
    throw new Error("No push service accepted the scheduled delivery");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const verify = await context.newPage();
  await verify.goto("/");
  const displayed = await verify.evaluate(async (tag) => {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.getNotifications({ tag })).length > 0;
  }, row.id);
  if (!displayed)
    throw new Error(
      "Push accepted but browser did not expose a delivered notification",
    );
  console.log("PASS: notification displayed after all app pages were closed");
} catch (e) {
  console.error("BLOCKED: " + e.message);
  process.exitCode = 1;
} finally {
  if (id) await db.user.deleteMany({ where: { id } });
  await db.$disconnect();
  await browser?.close();
  server.kill();
}
