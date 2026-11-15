import {
  db,
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  type DatabaseSnapshot,
} from "@/lib/db";
import { getAuthenticatedUser, getSupabaseClient } from "@/lib/supabase";
import type {
  JlptAttemptRecord,
  KanaMasteryRecord,
  MinnaProgressRecord,
  ReviewLogRecord,
  SrsCardRecord,
} from "@/types/learning";

export const SYNC_STATUS_EVENT = "kotonoha-sync-status";

export interface SyncStatusState {
  syncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

function broadcastSyncStatus(state: SyncStatusState) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SyncStatusState>(SYNC_STATUS_EVENT, { detail: state }));
  }
}

export async function pushProgressToCloud(): Promise<{ updatedAt: string }> {
  const client = getSupabaseClient();
  const user = await getAuthenticatedUser();
  if (!client || !user) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนซิงค์ข้อมูลขึ้น Cloud");
  }

  broadcastSyncStatus({ syncing: true, lastSyncedAt: null, error: null });
  try {
    const snapshot = await exportDatabaseSnapshot({ stripSecrets: true });
    const updatedAt = new Date().toISOString();

    const { error } = await client.from("user_study_data").upsert(
      {
        user_id: user.id,
        payload: snapshot,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw new Error(error.message);
    }

    broadcastSyncStatus({ syncing: false, lastSyncedAt: updatedAt, error: null });
    return { updatedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "ซิงค์ไม่สำเร็จ";
    broadcastSyncStatus({ syncing: false, lastSyncedAt: null, error: message });
    throw err;
  }
}

function mergeSnapshots(
  local: DatabaseSnapshot,
  cloud: Partial<DatabaseSnapshot>
): DatabaseSnapshot {
  const cardByFront = new Map<string, SrsCardRecord>();
  for (const c of local.cards) {
    cardByFront.set(c.front, c);
  }
  for (const c of cloud.cards ?? []) {
    const prev = cardByFront.get(c.front);
    if (!prev || c.fsrs.reps > prev.fsrs.reps) {
      cardByFront.set(c.front, c);
    }
  }

  const logByKey = new Map<string, ReviewLogRecord>();
  for (const l of local.reviewLogs) {
    logByKey.set(`${l.cardId}::${l.reviewedAt}`, l);
  }
  for (const l of cloud.reviewLogs ?? []) {
    logByKey.set(`${l.cardId}::${l.reviewedAt}`, l);
  }

  const attemptById = new Map<string, JlptAttemptRecord>();
  for (const a of local.jlptAttempts) attemptById.set(a.id, a);
  for (const a of cloud.jlptAttempts ?? []) attemptById.set(a.id, a);

  const kanaMap = new Map<string, KanaMasteryRecord>();
  for (const k of local.kanaMastery) kanaMap.set(k.char, k);
  for (const k of cloud.kanaMastery ?? []) {
    const prev = kanaMap.get(k.char);
    if (!prev || k.attempts > prev.attempts) kanaMap.set(k.char, k);
  }

  const minnaMap = new Map<number, MinnaProgressRecord>();
  for (const m of local.minnaProgress) minnaMap.set(m.lesson, m);
  for (const m of cloud.minnaProgress ?? []) {
    const prev = minnaMap.get(m.lesson);
    if (!prev || m.updatedAt > prev.updatedAt) {
      minnaMap.set(m.lesson, m);
    }
  }

  const passageById = new Map(local.passages.map((p) => [p.id, p]));
  for (const p of cloud.passages ?? []) passageById.set(p.id, p);

  const scenarioById = new Map(local.customScenarios.map((s) => [s.id, s]));
  for (const s of cloud.customScenarios ?? []) scenarioById.set(s.id, s);

  const queueById = new Map(local.shadowingQueue.map((q) => [q.id, q]));
  for (const q of cloud.shadowingQueue ?? []) queueById.set(q.id, q);

  const kaiwaById = new Map(local.kaiwaHistory.map((h) => [h.id, h]));
  for (const h of cloud.kaiwaHistory ?? []) {
    const prev = kaiwaById.get(h.id);
    if (!prev || h.updatedAt > prev.updatedAt) kaiwaById.set(h.id, h);
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 4,
    cards: Array.from(cardByFront.values()),
    reviewLogs: Array.from(logByKey.values()),
    settings: local.settings.length > 0 ? local.settings : (cloud.settings ?? []),
    kanaMastery: Array.from(kanaMap.values()),
    passages: Array.from(passageById.values()),
    kaiwaHistory: Array.from(kaiwaById.values()),
    customScenarios: Array.from(scenarioById.values()),
    shadowingQueue: Array.from(queueById.values()),
    minnaProgress: Array.from(minnaMap.values()),
    jlptAttempts: Array.from(attemptById.values()),
  };
}

export async function pullProgressFromCloud(
  mode: "replace" | "merge" = "merge"
): Promise<{
  hasCloudData: boolean;
  restored: { cards: number; reviewLogs: number; minnaLessons: number; jlptAttempts: number } | null;
  updatedAt: string | null;
}> {
  const client = getSupabaseClient();
  const user = await getAuthenticatedUser();
  if (!client || !user) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดึงข้อมูลจาก Cloud");
  }

  broadcastSyncStatus({ syncing: true, lastSyncedAt: null, error: null });
  try {
    const { data, error } = await client
      .from("user_study_data")
      .select("payload, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data || !data.payload) {
      // First time user logs in on this account: upload current local progress cleanly
      if (mode === "merge") {
        const pushed = await pushProgressToCloud();
        return { hasCloudData: false, restored: null, updatedAt: pushed.updatedAt };
      }
      broadcastSyncStatus({ syncing: false, lastSyncedAt: null, error: null });
      return { hasCloudData: false, restored: null, updatedAt: null };
    }

    const cloudPayload = data.payload as Partial<DatabaseSnapshot>;
    let targetSnapshot = cloudPayload;
    if (mode === "merge") {
      const localSnapshot = await exportDatabaseSnapshot();
      targetSnapshot = mergeSnapshots(localSnapshot, cloudPayload);
    }

    const restored = await importDatabaseSnapshot(targetSnapshot, {
      preserveLocalApiKey: true,
    });

    if (mode === "merge") {
      await pushProgressToCloud();
    }

    const syncTime = (data.updated_at as string) || new Date().toISOString();
    broadcastSyncStatus({ syncing: false, lastSyncedAt: syncTime, error: null });
    return { hasCloudData: true, restored, updatedAt: syncTime };
  } catch (err) {
    const message = err instanceof Error ? err.message : "ดึงข้อมูลไม่สำเร็จ";
    broadcastSyncStatus({ syncing: false, lastSyncedAt: null, error: message });
    throw err;
  }
}

let pendingSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleBackgroundCloudSync(delayMs = 2500): void {
  if (typeof window === "undefined") return;
  if (pendingSyncTimer) {
    clearTimeout(pendingSyncTimer);
  }
  pendingSyncTimer = setTimeout(() => {
    void (async () => {
      const user = await getAuthenticatedUser();
      if (!user) return;
      // Ensure local seed ran before pushing
      await db.settings.get("user_settings");
      await pushProgressToCloud().catch(() => {
        // Silent background retry next mutation
      });
    })();
  }, delayMs);
}
