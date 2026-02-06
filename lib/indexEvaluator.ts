import AsyncStorage from "@react-native-async-storage/async-storage";
import { chat, type Message } from "./api";
import {
  getTodayStats,
  getYesterdayIndex,
  getStatusLabelFromIndex,
  updateTodayIndex,
  type DailyStats,
} from "./dailyStats";
import { getTodayFocusHabit } from "./focusHabit";

export type ExitReasonMeta = {
  reason: string;
  sentiment: "positive" | "negative";
};

export type InterruptionPlan = {
  continueMinutes: number; // 建议继续的分钟数
  message: string; // 一句话鼓励/引导
};

export type EvaluationResult = {
  newIndex: number;
  statusText: string;
  reason: string;
  changed: boolean;
  error?: string;
};

// AI 评估今日状态值（内部使用）+ 状态词（展示用）
export async function evaluateTodayIndex(
  exitType: "completed" | "early_exit",
  exitMeta?: ExitReasonMeta,
): Promise<EvaluationResult> {
  const todayStats = await getTodayStats();
  const yesterdayIndex = await getYesterdayIndex();
  const focusHabit = await getTodayFocusHabit();
  const focusHabitInfo = focusHabit
    ? `"${focusHabit.text}"${focusHabit.addressed ? "（已突破）" : "（未突破）"}`
    : undefined;

  // 获取用户特点描述
  const raw = await AsyncStorage.getItem("savedRoute");
  const parsed = raw ? JSON.parse(raw) : {};
  const userDescriptions = (parsed.userDescriptions || [])
    .map((d: any) => (typeof d === "string" ? d : d.text || ""))
    .filter(Boolean)
    .join("｜");

  const contextInfo = buildContextInfo(
    todayStats,
    yesterdayIndex,
    exitType,
    exitMeta,
    focusHabitInfo,
    userDescriptions,
  );

  const systemPrompt = `你是一个学习状态评估助手。根据用户今天的学习数据，评估并给出今日状态值（0-10，内部使用）和一个2-4字的状态词（面向用户展示）。

${contextInfo}

【评估标准】
- 基础分：5.0（什么都没做的状态）
- 完成任务：每完成 1 个任务 +1.0~1.5（大方给分，用户完成了就该被肯定）
- 中途退出：每次中途退出 -0.3（小惩即可，不要打击积极性）
- 新增负面习性：每新增 1 条 -0.3
- 克服习性：每删除 1 条 +1.0（用户在改善，值得鼓励）
- 今日重点习性已突破：额外 +1.0（针对性改善是最有价值的）
- 多个任务完成有叠加效应：完成越多，每个任务的加分可以递增（体现势头）

【注意事项】
1. 状态值范围 0-10，保留一位小数（如 6.5、8.0）
2. 如果今日已有状态值，根据新的任务完成/退出情况调整，每次完成任务后状态值必须有明显上升
3. 偏向鼓励：宁可多给 0.5 也不要吝啬。用户付出了时间就应该看到回报
4. 扣分要谨慎，加分要大方
5. 如果本次中途退出被判断为 positive（例如有事），不要因为退出扣分
6. 完成全部任务的日子，状态值应该接近 9.0-10.0

请严格按照以下 JSON 格式返回：
{
  "newIndex": 数字（0-10，保留一位小数，如 6.5）,
  "statusText": "2-4字状态词（易懂、非评判）",
  "reason": "简短说明评估理由（20字以内，不要出现数字）",
  "changed": true或false（是否改变了状态值）
}`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `请根据以上数据评估今日状态值。刚刚的任务${exitType === "completed" ? "正常完成" : "中途退出"}了。`,
    },
  ];

  const { content, error } = await chat(messages);

  if (error) {
    return {
      newIndex: todayStats.index ?? 5,
      statusText:
        todayStats.statusText ||
        getStatusLabelFromIndex(todayStats.index ?? 5),
      reason: "评估失败",
      changed: false,
      error,
    };
  }

  try {
    const parsed = JSON.parse(content);
    const newIndex = Math.max(0, Math.min(10, Math.round(parsed.newIndex * 10) / 10));
    const statusText =
      typeof parsed.statusText === "string" && parsed.statusText.trim()
        ? parsed.statusText.trim().slice(0, 4)
        : getStatusLabelFromIndex(newIndex);

    // 如果状态值或状态词有变化，保存到存储
    if (
      parsed.changed ||
      todayStats.index === null ||
      statusText !== todayStats.statusText
    ) {
      await updateTodayIndex(newIndex, statusText);
    }

    return {
      newIndex,
      statusText,
      reason: parsed.reason || "",
      changed: parsed.changed ?? todayStats.index !== newIndex,
    };
  } catch {
    // 解析失败，使用默认值
    const defaultIndex = todayStats.index ?? 5;
    const fallbackStatus =
      todayStats.statusText || getStatusLabelFromIndex(defaultIndex);
    if (todayStats.index === null) {
      await updateTodayIndex(defaultIndex, fallbackStatus);
    }
    return {
      newIndex: defaultIndex,
      statusText: fallbackStatus,
      reason: "数据解析失败，使用默认值",
      changed: todayStats.index === null,
    };
  }
}

function buildContextInfo(
  stats: DailyStats,
  yesterdayIndex: number | null,
  exitType: "completed" | "early_exit",
  exitMeta?: ExitReasonMeta,
  focusHabitInfo?: string,
  userDescriptions?: string,
): string {
  let info = `【今日数据】
- 日期：${stats.date}
- 当前状态值：${stats.index !== null ? Number(stats.index).toFixed(1) : "尚未生成"}
- 已完成任务数：${stats.completedTasks}${exitType === "completed" ? " (+1 刚刚完成)" : ""}
- 中途退出次数：${stats.earlyExits}${exitType === "early_exit" ? " (+1 刚刚退出)" : ""}
- 今日新增习性描述：${stats.newDescriptionsCount} 条
- 今日克服习性描述：${stats.removedDescriptionsCount} 条`;

  if (focusHabitInfo) {
    info += `\n- 今日重点习性：${focusHabitInfo}`;
  }

  if (exitType === "early_exit" && exitMeta) {
    info += `\n- 本次退出原因：${exitMeta.reason}\n- 退出原因判断：${exitMeta.sentiment}`;
  }

  if (userDescriptions) {
    info += `\n- 用户特点：${userDescriptions}`;
  }

  if (yesterdayIndex !== null) {
    info += `\n\n【昨日状态值】${yesterdayIndex}`;
  } else {
    info += `\n\n【昨日状态值】无记录（可能是第一天使用）`;
  }

  return info;
}

// 退出原因情绪判断（positive / negative）
export async function classifyExitReason(
  reason: string,
): Promise<ExitReasonMeta> {
  const systemPrompt = `你是一个学习助手，需要判断用户中途退出任务的原因是正面还是负面。

【判断标准】
- positive：客观原因或合理原因（如有事、临时被打断、身体不适）
- negative：主观放弃或缺乏动力（如不想做了、拖延、不想继续）

请严格返回 JSON：
{ "sentiment": "positive" 或 "negative" }`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: reason },
  ];

  const { content, error } = await chat(messages);
  if (error) {
    return { reason, sentiment: "negative" };
  }

  try {
    const parsed = JSON.parse(content);
    const sentiment =
      parsed.sentiment === "positive" ? "positive" : "negative";
    return { reason, sentiment };
  } catch {
    return { reason, sentiment: "negative" };
  }
}

// negative 中断拦截：让 AI 建议"减免多少时间 / 再坚持几分钟"
export async function suggestInterruptionPlan(params: {
  reason: string;
  remainingMinutes: number;
  originalMinutes: number;
}): Promise<InterruptionPlan> {
  const remaining = Math.max(1, Math.floor(params.remainingMinutes));
  const original = Math.max(1, Math.floor(params.originalMinutes));

  // 获取今日重点习性用于个性化鼓励
  const focusHabit = await getTodayFocusHabit();
  const focusLine =
    focusHabit && !focusHabit.addressed
      ? `\n- 今日重点习性："${focusHabit.text}"（还未突破，可以用来激励用户）`
      : "";

  const systemPrompt = `你是一个学习行动力教练。用户准备中途退出任务（原因偏负面），你需要给出一个"把任务缩短到更容易完成"的建议时长。

【输入】
- 原因：${params.reason}
- 原任务时长：${original} 分钟
- 当前剩余：${remaining} 分钟${focusLine}

【目标】
- 用更小的承诺把用户拉回任务：建议继续 N 分钟即可（N 必须是整数）
- N 不得超过当前剩余分钟数
- N 建议在 3~10 分钟之间（除非剩余更少）
- 给一句不说教的短句鼓励（不超过 20 字）
- 如果有今日重点习性，可以融入鼓励中（比如"这正是突破 XX 的好机会"）

请严格返回 JSON：
{
  "continueMinutes": 数字,
  "message": "..."
}`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "请给出建议" },
  ];

  const { content, error } = await chat(messages);
  if (error) {
    const fallback = Math.min(5, remaining);
    return { continueMinutes: fallback, message: "先做几分钟就好" };
  }

  try {
    const parsed = JSON.parse(content);
    const rawN = Number(parsed.continueMinutes);
    const n = Number.isFinite(rawN) ? Math.round(rawN) : 5;
    const clamped = Math.max(1, Math.min(remaining, n));
    const message =
      typeof parsed.message === "string" ? parsed.message : "先做几分钟就好";
    return { continueMinutes: clamped, message: message.slice(0, 40) };
  } catch {
    const fallback = Math.min(5, remaining);
    return { continueMinutes: fallback, message: "先做几分钟就好" };
  }
}
