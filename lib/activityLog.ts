import AsyncStorage from "@react-native-async-storage/async-storage";

export type ActivityEntry = {
  id: string;
  type: "task_completed" | "task_exited";
  taskTitle: string;
  phaseTitle: string;
  duration: number; // actual elapsed seconds
  timestamp: string; // ISO string
};

const STORAGE_KEY = "activityLog";

export async function logActivity(
  entry: Omit<ActivityEntry, "id" | "timestamp">,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const log: ActivityEntry[] = raw ? JSON.parse(raw) : [];
    log.push({
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch (e) {
    console.log("Failed to log activity:", e);
  }
}

export async function getActivityLog(): Promise<ActivityEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const log: ActivityEntry[] = JSON.parse(raw);
    // newest first
    return log.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch (e) {
    console.log("Failed to read activity log:", e);
    return [];
  }
}

export function groupActivitiesByDate(
  entries: ActivityEntry[],
): { label: string; date: string; entries: ActivityEntry[] }[] {
  const groups: Record<string, ActivityEntry[]> = {};
  for (const entry of entries) {
    const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!groups[date]) groups[date] = [];
    groups[date].push(entry);
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({
      label:
        date === today
          ? "今天"
          : date === yesterday
            ? "昨天"
            : date.replace(/-/g, "/"),
      date,
      entries,
    }));
}
