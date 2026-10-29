export const QUOTA_COST = { search: 100, videos: 1, comments: 1 } as const;
export type QuotaAction = keyof typeof QUOTA_COST;
export type Quota = {
  day: string;
  units: number;
  adjustment: number;
  checkedAt: string;
  limit: number;
  attempts: Record<QuotaAction, number>;
};
export function quotaDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function estimatedUsed(quota: Quota) {
  return Math.max(0, quota.units + quota.adjustment);
}
export async function quotaIdentity(key: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key.trim()),
  );
  return Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export function addAttempt(q: Quota, action: QuotaAction): Quota {
  return {
    ...q,
    units: q.units + QUOTA_COST[action],
    attempts: { ...q.attempts, [action]: q.attempts[action] + 1 },
  };
}
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("lowwave-quota", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("usage");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error("O contador de cota não pôde acessar o armazenamento local."),
      );
  });
}
// Atomic across tabs; credential values are never stored.
export async function quotaUpdate(
  identity: string,
  change?: { action?: QuotaAction; limit?: number; observed?: number },
  now = new Date(),
): Promise<Quota> {
  const day = quotaDay(now),
    database = await db();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(
          "usage",
          change ? "readwrite" : "readonly",
        ),
        store = tx.objectStore("usage");
      const profile = store.get(identity + ":settings"),
        usage = store.get(identity + ":" + day);
      let result: Quota;
      usage.onsuccess = () => {
        result = usage.result ?? {
          day,
          units: 0,
          adjustment: 0,
          checkedAt: "",
          attempts: { search: 0, videos: 0, comments: 0 },
        };
        result = { ...result, limit: profile.result?.limit ?? 10000 };
        if (change?.action) result = addAttempt(result, change.action);
        if (change?.limit !== undefined) {
          if (!Number.isSafeInteger(change.limit) || change.limit < 1) {
            tx.abort();
            return;
          }
          result.limit = change.limit;
          store.put({ limit: change.limit }, identity + ":settings");
        }
        if (change?.observed !== undefined) {
          if (!Number.isSafeInteger(change.observed) || change.observed < 0) {
            tx.abort();
            return;
          }
          result.adjustment = change.observed - result.units;
          result.checkedAt = now.toISOString();
        }
        if (change) store.put(result, identity + ":" + day);
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            "O contador de cota não foi atualizado. O saldo não está confirmado.",
          ),
        );
    });
  } finally {
    database.close();
  }
}
