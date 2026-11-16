import {
  db,
  exportDatabaseSnapshot,
  getAppSettings,
  importDatabaseSnapshot,
  resetLocalStudyData,
  type DatabaseSnapshot,
} from "@/lib/db";
import {
  readActiveAccountOwner,
  resolveAccountSyncStrategy,
  writeActiveAccountOwner,
} from "@/lib/accountIsolation";
import {
  getAuthenticatedUser,
  getSupabaseClient,
  getUserDisplayName,
} from "@/lib/supabase";
import type {
  JlptAttemptRecord,
  JlptLevel,
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

export interface CloudProfileRecord {
  id: string;
  display_name: string;
  learner_level: JlptLevel;
  updated_at: string;
}

function broadcastSyncStatus(state: SyncStatusState) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SyncStatusState>(SYNC_STATUS_EVENT, { detail: state }));
  }
}

/** Syncs user's public.profiles row (display_name & learner_level) safely to Supabase. */
export async function syncProfileToCloud(override?: {
  displayName?: string;
  learnerLevel?: JlptLevel;
}): Promise<CloudProfileRecord | null> {
  const client = getSupabaseClient();
  const user = await getAuthenticatedUser();
  if (!client || !user) return null;

  const settings = await getAppSettings();
  const displayName =
    override?.displayName?.trim() || getUserDisplayName(user);
  const learnerLevel = override?.learnerLevel ?? settings.learnerLevel ?? "N5";
  const updatedAt = new Date().toISOString();

  const { error } = await client.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      learner_level: learnerLevel,
      updated_at: updatedAt,
    },
    { onConflict: "id" }
  );

  if (error) {
    // Non-fatal if user hasn't re-run latest SQL schema yet
    return null;
  }

  return {
    id: user.id,
    display_name: displayName,
    learner_level: learnerLevel,
    updated_at: updatedAt,
  };
}

/** Reads the authenticated user's profile row from Supabase `public.profiles`. */
export async function fetchProfileFromCloud(): Promise<CloudProfileRecord | null> {
  const client = getSupabaseClient();
  const user = await getAuthenticatedUser();
  if (!client || !user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, learner_level, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as CloudProfileRecord;
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

    writeActiveAccountOwner(user.id);
    await syncProfileToCloud();

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

  const localSetting = local.settings[0];
  const cloudSetting = cloud.settings?.[0];
  let mergedSettings = local.settings.length > 0 ? local.settings : (cloud.settings ?? []);
  if (cloudSetting?.onboardingCompleted && !localSetting?.onboardingCompleted) {
    mergedSettings = [
      {
        ...cloudSetting,
        // Preserve any BYOK AI key entered locally while adopting cloud learning preferences
        aiProvider: localSetting?.apiKey ? localSetting.aiProvider : cloudSetting.aiProvider,
        apiKey: localSetting?.apiKey || cloudSetting.apiKey || "",
        aiModel: localSetting?.apiKey ? localSetting.aiModel : cloudSetting.aiModel,
      },
    ];
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 4,
    cards: Array.from(cardByFront.values()),
    reviewLogs: Array.from(logByKey.values()),
    settings: mergedSettings,
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
  switchedAccountReset: boolean;
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

    const previousOwnerId = readActiveAccountOwner();
    const hasCloudData = Boolean(data && data.payload);
    if (mode === "replace" && !hasCloudData) {
      broadcastSyncStatus({ syncing: false, lastSyncedAt: null, error: null });
      return {
        hasCloudData: false,
        switchedAccountReset: false,
        restored: null,
        updatedAt: null,
      };
    }

    const strategy =
      mode === "replace"
        ? "replace_with_cloud"
        : resolveAccountSyncStrategy(previousOwnerId, user.id, hasCloudData);

    const switchedAccountReset =
      strategy === "replace_with_cloud" || strategy === "reset_and_push_fresh";

    if (strategy === "reset_and_push_fresh") {
      // Clear previous user's local data before seeding fresh state for this account.
      await resetLocalStudyData({ preserveApiKey: true });
      writeActiveAccountOwner(user.id);
      const pushed = await pushProgressToCloud();
      return {
        hasCloudData: false,
        switchedAccountReset: mode === "merge" && Boolean(previousOwnerId && previousOwnerId !== user.id),
        restored: null,
        updatedAt: pushed.updatedAt,
      };
    }

    if (strategy === "push_local_to_cloud") {
      writeActiveAccountOwner(user.id);
      const pushed = await pushProgressToCloud();
      return {
        hasCloudData: false,
        switchedAccountReset: false,
        restored: null,
        updatedAt: pushed.updatedAt,
      };
    }

    const cloudPayload = data!.payload as Partial<DatabaseSnapshot>;
    let targetSnapshot = cloudPayload;
    if (strategy === "merge_local_and_cloud") {
      const localSnapshot = await exportDatabaseSnapshot();
      targetSnapshot = mergeSnapshots(localSnapshot, cloudPayload);
    } else {
      // Switching accounts cleanly: reset any leftover drafts/tables first
      await resetLocalStudyData({ preserveApiKey: true });
    }

    const restored = await importDatabaseSnapshot(targetSnapshot, {
      preserveLocalApiKey: true,
    });
    writeActiveAccountOwner(user.id);

    if (strategy === "merge_local_and_cloud") {
      await pushProgressToCloud();
    } else {
      await syncProfileToCloud();
    }

    const syncTime = (data?.updated_at as string) || new Date().toISOString();
    broadcastSyncStatus({ syncing: false, lastSyncedAt: syncTime, error: null });
    return {
      hasCloudData: true,
      switchedAccountReset: mode === "merge" && switchedAccountReset,
      restored,
      updatedAt: syncTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "ดึงข้อมูลไม่สำเร็จ";
    broadcastSyncStatus({ syncing: false, lastSyncedAt: null, error: message });
    throw err;
  }
}

/** Deletes this user's cloud study snapshot (`user_study_data`) under RLS. */
export async function deleteCloudStudyData(): Promise<void> {
  const client = getSupabaseClient();
  const user = await getAuthenticatedUser();
  if (!client || !user) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนลบข้อมูลบน Cloud");
  }

  const { error } = await client
    .from("user_study_data")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
  broadcastSyncStatus({ syncing: false, lastSyncedAt: null, error: null });
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
      // Ensure local seed ran before syncing
      await db.settings.get("user_settings");
      const previousOwnerId = readActiveAccountOwner();
      if (previousOwnerId && previousOwnerId !== user.id) {
        await pullProgressFromCloud("merge").catch(() => {
          // Wait until user resolves sync manually
        });
        return;
      }
      await pushProgressToCloud().catch(() => {
        // Silent background retry next mutation
      });
    })();
  }, delayMs);
}
