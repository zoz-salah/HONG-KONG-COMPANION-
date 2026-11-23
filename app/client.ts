import type { Kind } from "../lib/model";
export type Row = {
  id: string;
  kind: Kind;
  data: Record<string, any>;
  due?: string;
  deliveredAt?: string;
};
export type Account = { id: string; email: string };
export type Doc = { id: string; name: string; mime: string; created: string };
export type Snapshot = { account: Account; rows: Row[]; at: string };
export type Config = {
  ocr: boolean;
  translation: boolean;
  push: string | null;
};
const snapshotKey = "hk-account-snapshot";
const consentKey = "hk-offline-consent";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!navigator.onLine) throw new Error("offline");
  let response: Response;
  try {
    response = await fetch("/api/" + path, {
      method,
      cache: "no-store",
      ...(body instanceof FormData
        ? { body }
        : body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
    });
  } catch {
    throw new Error("network");
  }
  const value = await response.json().catch(() => ({ error: "serverError" }));
  if (!response.ok) throw new Error(value.error || "serverError");
  return value;
}
export function savedSnapshot(): Snapshot | null {
  try {
    return JSON.parse(localStorage.getItem(snapshotKey) ?? "null");
  } catch {
    return null;
  }
}
export function consent(id: string) {
  return localStorage.getItem(consentKey) === id;
}
export function changeConsent(id: string, enabled: boolean) {
  if (enabled) localStorage.setItem(consentKey, id);
  else localStorage.removeItem(consentKey);
}
export function storeSnapshot(account: Account, rows: Row[]) {
  const basics = [
    "place",
    "home",
    "program",
    "event",
    "checklist",
    "phrase",
    "resource",
    "station",
    "reminder",
  ];
  const data: Snapshot = {
    account: { id: account.id, email: "" },
    rows: rows.filter(
      (row) =>
        basics.includes(row.kind) ||
        (row.kind === "expense" && consent(account.id)),
    ),
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(snapshotKey, JSON.stringify(data));
  } catch {
    localStorage.removeItem(snapshotKey);
    localStorage.setItem(
      snapshotKey,
      JSON.stringify({
        ...data,
        rows: data.rows
          .filter((row) => row.kind !== "expense")
          .concat(
            data.rows
              .filter((row) => row.kind === "expense")
              .map((row) => ({
                ...row,
                data: { ...row.data, receipt: undefined },
              })),
          ),
      }),
    );
    return false;
  }
  return true;
}
export async function purge() {
  const reg = await navigator.serviceWorker
    ?.getRegistration()
    .catch(() => undefined);
  if (reg) {
    const sub = await reg.pushManager?.getSubscription().catch(() => null);
    if (sub) await sub.unsubscribe().catch(() => false);
    const worker = reg.active;
    if (worker)
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        worker.postMessage({ type: "purge" }, [channel.port2]);
        setTimeout(resolve, 1000);
      });
  }
  for (const key of Object.keys(localStorage))
    if (key.startsWith("hk-") && !["hk-locale", "hk-theme"].includes(key))
      localStorage.removeItem(key);
  if ("caches" in window)
    for (const name of await caches.keys())
      if (name.startsWith("hk-account")) await caches.delete(name);
  if ("indexedDB" in window && indexedDB.databases)
    for (const database of await indexedDB.databases())
      if (database.name?.startsWith("hk-")) {
        const deletion = indexedDB.deleteDatabase(database.name);
        await new Promise<void>((resolve, reject) => {
          deletion.onsuccess = () => resolve();
          deletion.onerror = () => reject(new Error("storageFailure"));
          deletion.onblocked = () => reject(new Error("storageFailure"));
        });
      }
}
export function fileBody(file: File) {
  const data = new FormData();
  data.set("file", file);
  return data;
}
export const errorCode = (error: unknown) =>
  error instanceof Error ? error.message : "serverError";
