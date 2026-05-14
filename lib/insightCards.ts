import AsyncStorage from "@react-native-async-storage/async-storage";
import { chat, type Message } from "./api";
import { getTodayStats, getYesterdayIndex } from "./dailyStats";
import { getTodayFocusHabit } from "./focusHabit";

// ─── 卡片类型 ───

export type InsightCardType = "motivation" | "warning";

export type InsightCard = {
  id: string;
  type: InsightCardType;
  title: string;
  fact: string; // 具体发生了什么（数据事实）
  action: string; // 建议/鼓励（可执行的下一步）
  priority: number; // 0-100，越高越靠前
};

// ─── 辅助：获取最短的未完成练习 ───

async function getShortestPendingTask(): Promise<{ title: string; duration: string } | null> {
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.phases)) return null;

    let shortest: { title: string; duration: string; minutes: number } | null = null;
    for (const phase of parsed.phases) {
      for (const goal of phase.goals || []) {
        if (goal.completed) continue;
        const mins = parseFloat(goal.duration) || 30;
        if (!shortest || mins < shortest.minutes) {
          shortest = { title: goal.title, duration: goal.duration || String(mins), minutes: mins };
        }
      }
    }
    return shortest ? { title: shortest.title, duration: shortest.duration } : null;
  } catch {
    return null;
  }
}

// ─── 规则打底：根据今日数据生成候选卡片 ───

async function generateCandidateCards(): Promise<InsightCard[]> {
  const stats = await getTodayStats();
  const yesterdayIndex = await getYesterdayIndex();
  const descriptions = await getCurrentDescriptions();
  const cards: InsightCard[] = [];

  // ── 激励类 ──

  // 今天完成了至少 1 个练习
  if (stats.completedTasks > 0) {
    cards.push({
      id: "mot_completed",
      type: "motivation",
      title: "做得不错",
      fact: `今天已完成 ${stats.completedTasks} 个练习。`,
      action: "要不要顺手补一个最短练习？",
      priority: 40 + stats.completedTasks * 10,
    });
  }

  // 状态回升
  if (
    stats.index !== null &&
    yesterdayIndex !== null &&
    stats.index > yesterdayIndex
  ) {
    cards.push({
      id: "mot_index_up",
      type: "motivation",
      title: "状态回升",
      fact: "今天的状态比昨天更顺了。",
      action: "趁顺手，把一个小练习收掉。",
      priority: 70,
    });
  }

  // 克服了习性
  if (stats.removedDescriptionsCount > 0) {
    cards.push({
      id: "mot_overcome",
      type: "motivation",
      title: "突破旧习",
      fact: `今天克服了 ${stats.removedDescriptionsCount} 个学习习性。`,
      action: "记一下触发点，方便下次更顺。",
      priority: 80,
    });
  }

  // 没有退出过
  if (stats.completedTasks > 0 && stats.earlyExits === 0) {
    cards.push({
      id: "mot_no_exit",
      type: "motivation",
      title: "零退出",
      fact: `完成 ${stats.completedTasks} 个练习，0 次中途退出。`,
      action: "把这个节奏记下来，明天复用。",
      priority: 55,
    });
  }

  // 完成数 >= 3
  if (stats.completedTasks >= 3) {
    cards.push({
      id: "mot_streak",
      type: "motivation",
      title: "高产出",
      fact: `今天已完成 ${stats.completedTasks} 个练习，超过大多数时候。`,
      action: "缓一缓，下一步更稳。",
      priority: 65,
    });
  }

  // ── 警醒类 ──

  // 退出次数 >= 1
  if (stats.earlyExits > 0) {
    cards.push({
      id: "warn_exits",
      type: "warning",
      title: "中途退出",
      fact: `今天中途退出了 ${stats.earlyExits} 次。`,
      action: "先做最短的 5-10 分钟。",
      priority: 50 + stats.earlyExits * 15,
    });
  }

  // 状态走低
  if (
    stats.index !== null &&
    yesterdayIndex !== null &&
    stats.index < yesterdayIndex
  ) {
    // 找到最短的未完成练习作为具体建议
    const shortestPending = await getShortestPendingTask();
    const actionText = shortestPending
      ? `先做「${shortestPending.title}」，${shortestPending.duration} 分钟就够。`
      : "先完成 1 个小练习。";
    const reasonText = stats.earlyExits > 0
      ? `今天的状态有点被打断，可能和 ${stats.earlyExits} 次中途退出有关。`
      : stats.completedTasks === 0
        ? "今天还没完成任何练习，状态还没被拉起来。"
        : "今天的状态比昨天弱一些。";
    cards.push({
      id: "warn_index_down",
      type: "warning",
      title: "状态走低",
      fact: reasonText,
      action: actionText,
      priority: 65,
    });
  }

  // 新增负面习性
  if (stats.newDescriptionsCount > 0) {
    cards.push({
      id: "warn_new_habit",
      type: "warning",
      title: "新发现的问题",
      fact: `AI 今天记录了 ${stats.newDescriptionsCount} 条新习性。`,
      action: "挑一条先处理，别全都压着。",
      priority: 60,
    });
  }

  // 有习性但今天还没完成任何练习
  if (descriptions.length > 0 && stats.completedTasks === 0) {
    const topHabit = descriptions[descriptions.length - 1];
    const easiest = await getShortestPendingTask();
    const actionText = easiest
      ? `先做「${easiest.title}」，${easiest.duration} 分钟。`
      : "先做 5 分钟，找回手感。";
    cards.push({
      id: "warn_no_start",
      type: "warning",
      title: "还没开始",
      fact: `今天还没完成任何练习${topHabit ? `，而你有"${topHabit}"的记录` : ""}。`,
      action: actionText,
      priority: 75,
    });
  }

  // 退出次数 > 完成次数
  if (stats.earlyExits > stats.completedTasks && stats.earlyExits >= 2) {
    cards.push({
      id: "warn_exit_ratio",
      type: "warning",
      title: "退出比完成多",
      fact: `退出 ${stats.earlyExits} 次 vs 完成 ${stats.completedTasks} 次，完成率偏低。`,
      action: "换成更短的练习试试。",
      priority: 85,
    });
  }

  // 有多条习性未改善
  if (descriptions.length >= 3 && stats.removedDescriptionsCount === 0) {
    cards.push({
      id: "warn_habits_pile",
      type: "warning",
      title: "习性积累",
      fact: `目前有 ${descriptions.length} 条习性记录，今天还没克服任何一条。`,
      action: "先选一条最影响你的。",
      priority: 58,
    });
  }

  // ── 今日重点习性相关 ──

  const focusHabit = await getTodayFocusHabit();

  if (focusHabit) {
    if (focusHabit.addressed) {
      // 已突破 → 高优先激励
      cards.push({
        id: "mot_focus_done",
        type: "motivation",
        title: "重点突破",
        fact: `今日重点"${focusHabit.text}"已被克服。`,
        action: "有针对性的改变最有效，明天继续。",
        priority: 90,
      });
    } else if (stats.completedTasks > 0) {
      // 做了练习但还没突破重点 → 提醒
      cards.push({
        id: "warn_focus_pending",
        type: "warning",
        title: "重点未突破",
        fact: `今天的重点"${focusHabit.text}"还没被解决。`,
        action: "下个练习试着刻意针对它练一次。",
        priority: 72,
      });
    } else {
      // 还没开始任何练习 → 鼓励围绕重点开始
      cards.push({
        id: "warn_focus_not_started",
        type: "warning",
        title: "重点等你行动",
        fact: `今日重点"${focusHabit.text}"还没开始。`,
        action: "先做 1 个练习，刻意带着这条习性去练。",
        priority: 68,
      });
    }
  }

  return cards;
}

// ─── AI 微调排序 + 文案优化（最终返回最多 2 张） ───

export async function getInsightCards(): Promise<InsightCard[]> {
  const candidates = await generateCandidateCards();

  if (candidates.length === 0) return [];

  // 如果只有 1-2 张，直接按规则排序返回
  if (candidates.length <= 2) {
    const sorted = candidates.sort((a, b) => b.priority - a.priority);
    // 如果两张卡片都是同一种类型，只返回一张
    if (sorted.length === 2 && sorted[0].type === sorted[1].type) {
      return [sorted[0]];
    }
    return sorted;
  }

  // 先按规则取前 4 张给 AI 选
  const topCandidates = candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4);

  const stats = await getTodayStats();
  const descriptions = await getCurrentDescriptions();
  const focusHabit = await getTodayFocusHabit();

  const cardList = topCandidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.type}] ${c.title}\n   事实：${c.fact}\n   建议：${c.action}\n   优先级：${c.priority}`,
    )
    .join("\n");

  const descInfo =
    descriptions.length > 0 ? `\n用户当前习性：${descriptions.join("、")}` : "";

  const focusInfo = focusHabit
    ? `\n今日重点习性："${focusHabit.text}"${focusHabit.addressed ? "（已突破）" : "（未突破）"}`
    : "";

  const systemPrompt = `你是一个以自主 PBL 为核心的学习助手排序引擎。下面有几张候选卡片，每张包含"事实"和"建议"两行。请选出最应该展示的 2 张，并根据用户当天的具体情况微调文案，让内容更有针对性。

【今日数据】
- 完成：${stats.completedTasks}  退出：${stats.earlyExits}  状态词：${stats.statusText ?? "未生成"}  状态值：${stats.index !== null ? Number(stats.index).toFixed(1) : "未生成"}${descInfo}${focusInfo}

【候选卡片】
${cardList}

【要求】
1. 选 2 张最有价值的（优先级高 + 对用户最有帮助）
2. 语气像同伴提醒：克制、不鸡汤。避免“打分/评判/设指标”的表达，强调自主性、探索和下一步行动
3. 可呈现客观事实，但不要突出“分数/评分”本身
4. 微调 fact（简明的数据事实，不超过 30 字）和 action（可执行的下一步，不超过 30 字），少鼓励、多行动
5. 不要改 type 和 title
6. 可以结合用户习性来个性化建议

请严格返回 JSON 数组：
[
  { "index": 原始编号, "fact": "微调后的事实", "action": "微调后的建议" },
  { "index": 原始编号, "fact": "微调后的事实", "action": "微调后的建议" }
]`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "请选择并优化" },
  ];

  try {
    const { content, error } = await chat(messages);
    if (error) throw new Error(error);

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("bad");

    const result: InsightCard[] = [];
    for (const item of parsed.slice(0, 2)) {
      const idx = Number(item.index) - 1;
      if (idx >= 0 && idx < topCandidates.length) {
        const card = { ...topCandidates[idx] };
        if (typeof item.fact === "string" && item.fact.trim()) {
          card.fact = item.fact.trim().slice(0, 60);
        }
        if (typeof item.action === "string" && item.action.trim()) {
          card.action = item.action.trim().slice(0, 60);
        }
        // 兼容旧格式
        if (typeof item.message === "string" && item.message.trim()) {
          card.fact = item.message.trim().slice(0, 60);
        }
        result.push(card);
      }
    }

    // 如果两张卡片都是同一种类型，只返回一张（优先级最高的）
    if (result.length === 2 && result[0].type === result[1].type) {
      return [result[0]];
    }

    if (result.length > 0) return result;
  } catch {
    // AI 失败，回退到规则排序
  }

  // fallback：规则排序取前 2
  const fallback = topCandidates.slice(0, 2);
  // 如果两张卡片都是同一种类型，只返回一张
  if (fallback.length === 2 && fallback[0].type === fallback[1].type) {
    return [fallback[0]];
  }
  return fallback;
}

// ─── 辅助：读取当前习性描述 ───

async function getCurrentDescriptions(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const descriptions = parsed.userDescriptions || [];
    return descriptions.map((d: any) =>
      typeof d === "string" ? d : d.text || "",
    );
  } catch {
    return [];
  }
}
