import AsyncStorage from "@react-native-async-storage/async-storage";

// 每日统计数据结构
export type DailyStats = {
  date: string; // YYYY-MM-DD
  index: number | null; // 0-10 的状态值（内部用），null 表示还未生成
  statusText: string | null; // 2-4 字的状态词
  completedTasks: number; // 完成的任务数（倒计时结束）
  earlyExits: number; // 中途退出次数（提前 Stop）
  newDescriptionsCount: number; // 当天新增的习性描述数量
  removedDescriptionsCount: number; // 当天删除的习性描述数量
};

// 历史指数记录
export type IndexHistory = {
  date: string;
  index: number;
}[];

const DAILY_STATS_KEY = "dailyStats";
const INDEX_HISTORY_KEY = "indexHistory";

// 获取今天的日期字符串
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 获取今日统计数据
export async function getTodayStats(): Promise<DailyStats> {
  const today = getTodayDateString();
  const raw = await AsyncStorage.getItem(DAILY_STATS_KEY);

  if (raw) {
    const parsed = JSON.parse(raw) as Partial<DailyStats>;
    const stats: DailyStats = {
      date: parsed.date || today,
      index: typeof parsed.index === "number" ? parsed.index : null,
      statusText: typeof parsed.statusText === "string" ? parsed.statusText : null,
      completedTasks: parsed.completedTasks ?? 0,
      earlyExits: parsed.earlyExits ?? 0,
      newDescriptionsCount: parsed.newDescriptionsCount ?? 0,
      removedDescriptionsCount: parsed.removedDescriptionsCount ?? 0,
    };
    // 如果是今天的数据，返回
    if (stats.date === today) {
      return stats;
    }
  }

  // 返回新的今日数据
  return {
    date: today,
    index: null,
    statusText: null,
    completedTasks: 0,
    earlyExits: 0,
    newDescriptionsCount: 0,
    removedDescriptionsCount: 0,
  };
}

// 保存今日统计数据
export async function saveTodayStats(stats: DailyStats): Promise<void> {
  await AsyncStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
}

// 增加完成任务数
export async function incrementCompletedTasks(): Promise<DailyStats> {
  const stats = await getTodayStats();
  stats.completedTasks += 1;
  await saveTodayStats(stats);
  return stats;
}

// 增加中途退出次数
export async function incrementEarlyExits(): Promise<DailyStats> {
  const stats = await getTodayStats();
  stats.earlyExits += 1;
  await saveTodayStats(stats);
  return stats;
}

// 增加新增描述计数
export async function incrementNewDescriptions(): Promise<DailyStats> {
  const stats = await getTodayStats();
  stats.newDescriptionsCount += 1;
  await saveTodayStats(stats);
  return stats;
}

// 增加删除描述计数
export async function incrementRemovedDescriptions(): Promise<DailyStats> {
  const stats = await getTodayStats();
  stats.removedDescriptionsCount += 1;
  await saveTodayStats(stats);
  return stats;
}

// 更新今日指数
export async function updateTodayIndex(
  index: number,
  statusText?: string | null,
): Promise<void> {
  const stats = await getTodayStats();
  stats.index = Math.max(0, Math.min(10, index)); // 确保在 0-10 范围内
  if (typeof statusText === "string") {
    const normalized = statusText.trim().slice(0, 4);
    stats.statusText = normalized ? normalized : null;
  }
  await saveTodayStats(stats);

  // 同时保存到历史记录
  await saveIndexToHistory(stats.date, stats.index);
}

export function getStatusLabelFromIndex(index: number): string {
  if (index >= 8.5) return "状态佳";
  if (index >= 7) return "挺投入";
  if (index >= 5.5) return "稳步中";
  if (index >= 4) return "有点散";
  if (index >= 2.5) return "有点累";
  return "低迷";
}

// 获取指数历史
export async function getIndexHistory(): Promise<IndexHistory> {
  const raw = await AsyncStorage.getItem(INDEX_HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

// 保存指数到历史
async function saveIndexToHistory(date: string, index: number): Promise<void> {
  const history = await getIndexHistory();

  // 查找是否已有当天记录
  const existingIndex = history.findIndex((h) => h.date === date);
  if (existingIndex !== -1) {
    history[existingIndex].index = index;
  } else {
    history.push({ date, index });
  }

  // 按日期排序
  history.sort((a, b) => a.date.localeCompare(b.date));

  await AsyncStorage.setItem(INDEX_HISTORY_KEY, JSON.stringify(history));
}

// 获取昨天的指数
export async function getYesterdayIndex(): Promise<number | null> {
  const history = await getIndexHistory();
  const today = getTodayDateString();

  // 获取昨天的日期
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const record = history.find((h) => h.date === yesterdayStr);
  return record?.index ?? null;
}

// 计算相比昨天的变化百分比
export function calculateChangePercent(
  todayIndex: number,
  yesterdayIndex: number | null,
): { percent: number; direction: "up" | "down" | "same" } {
  if (yesterdayIndex === null || yesterdayIndex === 0) {
    return { percent: 0, direction: "same" };
  }

  const change = todayIndex - yesterdayIndex;
  const percent = Math.round((Math.abs(change) / yesterdayIndex) * 100);

  if (change > 0) {
    return { percent, direction: "up" };
  } else if (change < 0) {
    return { percent, direction: "down" };
  }
  return { percent: 0, direction: "same" };
}
