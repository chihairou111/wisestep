import AsyncStorage from "@react-native-async-storage/async-storage";

// 成就稀有度
export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

// 成就数据结构
export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji 或 icon 名称
  rarity: AchievementRarity;
  unlocked: boolean;
  unlockedAt?: string; // YYYY-MM-DD
  progress: number; // 0-100 或当前值
  target?: number; // 目标值（可选）
  condition: string; // 解锁条件描述
};

// 成就列表类型
export type AchievementsData = {
  achievements: Achievement[];
  lastUpdated: string; // YYYY-MM-DD
};

const ACHIEVEMENTS_KEY = "achievements";

// 获取今天的日期字符串
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 初始化成就数据
export function getInitialAchievements(): Achievement[] {
  return [
    // 里程碑类
    {
      id: "first_task",
      title: "初出茅庐",
      description: "完成第一个任务，开启学习之旅",
      icon: "🎯",
      rarity: "common",
      unlocked: false,
      progress: 0,
      target: 1,
      condition: "完成 1 个任务",
    },
    {
      id: "three_tasks",
      title: "小有进展",
      description: "完成 3 个任务，节奏开始建立",
      icon: "✅",
      rarity: "common",
      unlocked: false,
      progress: 0,
      target: 3,
      condition: "完成 3 个任务",
    },
    {
      id: "first_project",
      title: "项目启动",
      description: "完成项目创建，迈出第一步",
      icon: "🚀",
      rarity: "common",
      unlocked: false,
      progress: 0,
      target: 1,
      condition: "创建 1 个项目",
    },
    {
      id: "first_project_complete",
      title: "项目完成",
      description: "完成第一个项目，见证从想法到实现的转变",
      icon: "🏁",
      rarity: "rare",
      unlocked: false,
      progress: 0,
      target: 1,
      condition: "完成 1 个项目",
    },
    // 连续坚持类
    {
      id: "three_days_streak",
      title: "三日连胜",
      description: "连续 3 天完成任务，习惯正在形成",
      icon: "📌",
      rarity: "common",
      unlocked: false,
      progress: 0,
      target: 3,
      condition: "连续 3 天完成任务",
    },
    {
      id: "week_streak",
      title: "一周坚持",
      description: "连续 7 天完成任务，习惯正在养成",
      icon: "🔥",
      rarity: "rare",
      unlocked: false,
      progress: 0,
      target: 7,
      condition: "连续 7 天完成任务",
    },
    {
      id: "month_streak",
      title: "月度坚持",
      description: "连续 30 天完成任务，你已经超越了大多数人",
      icon: "🌟",
      rarity: "epic",
      unlocked: false,
      progress: 0,
      target: 30,
      condition: "连续 30 天完成任务",
    },
    // 状态成就类
    {
      id: "perfect_day",
      title: "状态满格",
      description: "单日状态达到最佳，这是你很好的表现",
      icon: "💎",
      rarity: "epic",
      unlocked: false,
      progress: 0,
      target: 10,
      condition: "单日状态达到最佳",
    },
    // 习性突破类
    {
      id: "first_habit_breakthrough",
      title: "突破自我",
      description: "第一次克服一个习性，这是改变的开始",
      icon: "🎯",
      rarity: "common",
      unlocked: false,
      progress: 0,
      target: 1,
      condition: "克服 1 个习性",
    },
    {
      id: "perfect_transformation",
      title: "完美蜕变",
      description: "克服 10 个不同习性，你已经完成了真正的蜕变",
      icon: "🦋",
      rarity: "epic",
      unlocked: false,
      progress: 0,
      target: 10,
      condition: "克服 10 个不同习性",
    },
    // 特殊行为类
    {
      id: "strong_will",
      title: "意志坚定",
      description: "在中途退出拦截中选择了继续，你战胜了内心的退缩",
      icon: "🛡️",
      rarity: "rare",
      unlocked: false,
      progress: 0,
      target: 1,
      condition: "在中途退出拦截中选择继续",
    },
    {
      id: "perfect_completion_rate",
      title: "精准执行",
      description: "单日完成率 100%，这是完美的执行力",
      icon: "🎯",
      rarity: "epic",
      unlocked: false,
      progress: 0,
      target: 1,
      condition: "单日完成率 100%",
    },
  ];
}

// 初始化或获取成就数据
export async function initializeAchievements(): Promise<AchievementsData> {
  try {
    const existing = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      // 如果已有数据，返回现有数据（保留解锁状态）
      return parsed;
    }

    // 如果没有数据，初始化
    const initialAchievements = getInitialAchievements();
    const data: AchievementsData = {
      achievements: initialAchievements,
      lastUpdated: getTodayDateString(),
    };

    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    console.log("Failed to initialize achievements:", error);
    // 返回默认数据
    return {
      achievements: getInitialAchievements(),
      lastUpdated: getTodayDateString(),
    };
  }
}

// 获取成就数据
export async function getAchievements(): Promise<AchievementsData | null> {
  try {
    const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.log("Failed to get achievements:", error);
    return null;
  }
}

// 更新成就数据
export async function updateAchievements(
  data: AchievementsData,
): Promise<void> {
  try {
    data.lastUpdated = getTodayDateString();
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
  } catch (error) {
    console.log("Failed to update achievements:", error);
  }
}

// ─── 成就检测逻辑 ───

// 统计已完成的任务总数
async function getTotalCompletedTasks(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.phases)) return 0;

    let count = 0;
    parsed.phases.forEach((phase: any) => {
      if (Array.isArray(phase.goals)) {
        phase.goals.forEach((goal: any) => {
          if (goal.completed) count++;
        });
      }
    });
    return count;
  } catch {
    return 0;
  }
}

// 统计连续完成任务的天数
async function getConsecutiveDays(): Promise<number> {
  try {
    const { getIndexHistory } = await import("./dailyStats");
    const history = await getIndexHistory();
    if (history.length === 0) return 0;

    // 按日期倒序排序
    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    const today = getTodayDateString();

    // 检查今天是否有记录
    let checkDate = today;
    for (const record of sorted) {
      // 如果日期匹配，继续
      if (record.date === checkDate) {
        streak++;
        // 计算前一天
        const date = new Date(checkDate);
        date.setDate(date.getDate() - 1);
        checkDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      } else {
        break;
      }
    }

    return streak;
  } catch {
    return 0;
  }
}

// 获取最高单日状态值
async function getMaxDailyIndex(): Promise<number> {
  try {
    const { getIndexHistory } = await import("./dailyStats");
    const history = await getIndexHistory();
    if (history.length === 0) return 0;
    return Math.max(...history.map((h) => h.index));
  } catch {
    return 0;
  }
}

// 统计连续高状态天数（≥8）
async function getConsecutiveHighIndexDays(threshold: number = 8): Promise<number> {
  try {
    const { getIndexHistory } = await import("./dailyStats");
    const history = await getIndexHistory();
    if (history.length === 0) return 0;

    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    const today = getTodayDateString();
    let checkDate = today;

    for (const record of sorted) {
      if (record.date === checkDate && record.index >= threshold) {
        streak++;
        const date = new Date(checkDate);
        date.setDate(date.getDate() - 1);
        checkDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      } else {
        break;
      }
    }

    return streak;
  } catch {
    return 0;
  }
}

// 统计已克服的习性数量
async function getRemovedDescriptionsCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const removed = parsed.removedDescriptions || [];
    // 去重（同一个习性可能被多次记录）
    const uniqueTexts = new Set(removed.map((d: any) => d.text || d));
    return uniqueTexts.size;
  } catch {
    return 0;
  }
}

// 检查今日重点习性是否已突破
async function isTodayFocusHabitAddressed(): Promise<boolean> {
  try {
    const { getTodayFocusHabit } = await import("./focusHabit");
    const habit = await getTodayFocusHabit();
    return habit?.addressed || false;
  } catch {
    return false;
  }
}

// 统计累计专注时长（小时）- 需要从任务时长累加
async function getTotalFocusHours(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.phases)) return 0;

    let totalMinutes = 0;
    parsed.phases.forEach((phase: any) => {
      if (Array.isArray(phase.goals)) {
        phase.goals.forEach((goal: any) => {
          if (goal.completed && goal.duration) {
            // 解析时长字符串，如 "25 分钟" -> 25
            const match = goal.duration.match(/(\d+)/);
            if (match) {
              totalMinutes += parseInt(match[1], 10);
            }
          }
        });
      }
    });

    return Math.floor(totalMinutes / 60);
  } catch {
    return 0;
  }
}

// 统计已完成的项目数
async function getCompletedProjectsCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem("completedProjects");
    if (!raw) return 0;
    const projects = JSON.parse(raw);
    return Array.isArray(projects) ? projects.length : 0;
  } catch {
    return 0;
  }
}

// 检查是否有项目（创建过项目）
async function hasCreatedProject(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed.question;
  } catch {
    return false;
  }
}

// 获取状态历史记录天数
async function getIndexHistoryDays(): Promise<number> {
  try {
    const { getIndexHistory } = await import("./dailyStats");
    const history = await getIndexHistory();
    return history.length;
  } catch {
    return 0;
  }
}

// 检测并更新所有成就
export async function checkAndUpdateAchievements(): Promise<AchievementsData> {
  try {
    const data = await getAchievements();
    if (!data) {
      return await initializeAchievements();
    }

    // 收集统计数据
    const totalTasks = await getTotalCompletedTasks();
    const consecutiveDays = await getConsecutiveDays();
    const maxIndex = await getMaxDailyIndex();
    const consecutiveHighIndex = await getConsecutiveHighIndexDays(8);
    const removedDescriptions = await getRemovedDescriptionsCount();
    const focusHabitAddressed = await isTodayFocusHabitAddressed();
    const totalFocusHours = await getTotalFocusHours();
    const completedProjects = await getCompletedProjectsCount();
    const hasProject = await hasCreatedProject();
    const historyDays = await getIndexHistoryDays();

    const today = getTodayDateString();
    let hasChanges = false;

    // 更新每个成就
    data.achievements.forEach((achievement) => {
      if (achievement.unlocked) return; // 已解锁的不再更新

      let newProgress = achievement.progress;
      let shouldUnlock = false;

      switch (achievement.id) {
        // 任务完成类
        case "first_task":
        case "three_tasks":
        case "ten_tasks":
        case "fifty_tasks":
        case "hundred_tasks":
        case "five_hundred_tasks":
          newProgress = totalTasks;
          if (achievement.target && totalTasks >= achievement.target) {
            shouldUnlock = true;
          }
          break;

        // 连续坚持类
        case "three_days_streak":
        case "week_streak":
        case "half_month_streak":
        case "month_streak":
        case "hundred_days_streak":
          newProgress = consecutiveDays;
          if (achievement.target && consecutiveDays >= achievement.target) {
            shouldUnlock = true;
          }
          break;

        // 状态成就类
        case "excellent_day":
        case "outstanding_day":
        case "perfect_day":
          newProgress = maxIndex;
          if (achievement.target && maxIndex >= achievement.target) {
            shouldUnlock = true;
          }
          break;

        case "three_days_excellent":
        case "week_excellent":
          newProgress = consecutiveHighIndex;
          if (achievement.target && consecutiveHighIndex >= achievement.target) {
            shouldUnlock = true;
          }
          break;

        // 习性突破类
        case "first_habit_breakthrough":
        case "habit_terminator":
        case "habit_transformation":
        case "perfect_transformation":
          newProgress = removedDescriptions;
          if (achievement.target && removedDescriptions >= achievement.target) {
            shouldUnlock = true;
          }
          break;

        case "focus_habit_breakthrough":
          newProgress = focusHabitAddressed ? 1 : 0;
          if (focusHabitAddressed) {
            shouldUnlock = true;
          }
          break;

        // 专注时长类
        case "ten_hours_focus":
        case "fifty_hours_focus":
        case "hundred_hours_focus":
        case "five_hundred_hours_focus":
          newProgress = totalFocusHours;
          if (achievement.target && totalFocusHours >= achievement.target) {
            shouldUnlock = true;
          }
          break;

        // 项目里程碑类
        case "first_project":
          newProgress = hasProject ? 1 : 0;
          if (hasProject) {
            shouldUnlock = true;
          }
          break;

        case "first_project_complete":
        case "three_projects_complete":
        case "ten_projects_complete":
        case "fifty_projects_complete":
          newProgress = completedProjects;
          if (achievement.target && completedProjects >= achievement.target) {
            shouldUnlock = true;
          }
          break;

        // 数据里程碑类
        case "seven_days_history":
        case "month_history":
          newProgress = historyDays;
          if (achievement.target && historyDays >= achievement.target) {
            shouldUnlock = true;
          }
          break;

        // 其他成就暂时保持原样（需要额外追踪）
        default:
          break;
      }

      // 更新进度
      if (newProgress !== achievement.progress) {
        achievement.progress = newProgress;
        hasChanges = true;
      }

      // 解锁成就
      if (shouldUnlock && !achievement.unlocked) {
        achievement.unlocked = true;
        achievement.unlockedAt = today;
        hasChanges = true;
      }
    });

    // 如果有变化，保存
    if (hasChanges) {
      await updateAchievements(data);
    }

    return data;
  } catch (error) {
    console.log("Failed to check achievements:", error);
    const data = await getAchievements();
    return data || (await initializeAchievements());
  }
}
