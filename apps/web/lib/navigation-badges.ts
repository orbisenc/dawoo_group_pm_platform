export type NavigationBadgeSection = "issues" | "approvals";

export const navigationBadgeEvent = "project-hub-navigation-badge-change";
const issueFeedStorageKey = "project-hub-issue-feed-v2";

type IssueRecord = { createdAt: string; deletedAt?: string | null };
type IssueFeedStore = { projects?: Record<string, IssueRecord[]> };

function markerKey(section: NavigationBadgeSection, userId: string, projectId: string) {
  return `project-hub-seen:${section}:${userId}:${projectId}`;
}

export function readSeenAt(section: NavigationBadgeSection, userId: string, projectId: string) {
  try {
    return window.localStorage.getItem(markerKey(section, userId, projectId)) ?? "";
  } catch {
    return "";
  }
}

export function markNavigationSectionSeen(section: NavigationBadgeSection, userId: string, projectId: string) {
  try {
    window.localStorage.setItem(markerKey(section, userId, projectId), new Date().toISOString());
  } catch {
    // 저장소를 사용할 수 없는 환경에서도 현재 화면 확인은 계속 동작한다.
  }
}

export function notifyNavigationBadgeChange(section: NavigationBadgeSection) {
  window.dispatchEvent(new CustomEvent(navigationBadgeEvent, { detail: { section } }));
}

function openIssueDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open("project-hub-content", 1);
    request.onerror = () => reject(request.error ?? new Error("이슈 데이터베이스를 열지 못했습니다."));
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("stores")) request.result.createObjectStore("stores");
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readIssueStore(): Promise<IssueFeedStore> {
  try {
    if (window.indexedDB) {
      const database = await openIssueDatabase();
      const result = await new Promise<IssueFeedStore | undefined>((resolve, reject) => {
        const request = database.transaction("stores", "readonly").objectStore("stores").get(issueFeedStorageKey);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as IssueFeedStore | undefined);
      });
      database.close();
      if (result) return result;
    }
    const raw = window.localStorage.getItem(issueFeedStorageKey);
    return raw ? JSON.parse(raw) as IssueFeedStore : {};
  } catch {
    return {};
  }
}

export async function countUnreadIssues(projectId: string, seenAt: string) {
  const store = await readIssueStore();
  return (store.projects?.[projectId] ?? []).filter(
    (post) => !post.deletedAt && (!seenAt || post.createdAt > seenAt),
  ).length;
}
