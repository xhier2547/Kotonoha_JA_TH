export const ACTIVE_ACCOUNT_OWNER_KEY = "kotonoha_active_owner_v1";
export const JLPT_DRAFTS_STORAGE_KEY = "kotonoha_jlpt_drafts_v1";

export type AccountSyncStrategy =
  | "merge_local_and_cloud"
  | "push_local_to_cloud"
  | "replace_with_cloud"
  | "reset_and_push_fresh";

/**
 * Decides how local browser IndexedDB data should sync when a user signs in.
 * Prevents leaking a previous account's data into a different account on shared devices,
 * while preserving Guest progress when registering/signing in on an unclaimed browser.
 */
export function resolveAccountSyncStrategy(
  previousOwnerId: string | null,
  incomingUserId: string,
  hasCloudData: boolean
): AccountSyncStrategy {
  const isDifferentKnownOwner =
    Boolean(previousOwnerId) && previousOwnerId !== incomingUserId;

  if (isDifferentKnownOwner) {
    return hasCloudData ? "replace_with_cloud" : "reset_and_push_fresh";
  }

  return hasCloudData ? "merge_local_and_cloud" : "push_local_to_cloud";
}

export function readActiveAccountOwner(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(ACTIVE_ACCOUNT_OWNER_KEY);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

export function writeActiveAccountOwner(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      window.localStorage.setItem(ACTIVE_ACCOUNT_OWNER_KEY, userId);
    } else {
      window.localStorage.removeItem(ACTIVE_ACCOUNT_OWNER_KEY);
    }
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

export function clearJlptLocalDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(JLPT_DRAFTS_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
