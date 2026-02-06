import AsyncStorage from "@react-native-async-storage/async-storage";
import { chat, type Message } from "./api";
import type { DailyStats } from "./dailyStats";
import { getTodayFocusHabit } from "./focusHabit";

// 评估详情
export type EvaluationDetail = {
  reason: string;
  advice: string;
};

// 获取详细评估报告（理由+改进建议）
export async function getEvaluationDetail(
  stats: DailyStats,
): Promise<EvaluationDetail> {
  const focusHabit = await getTodayFocusHabit();
  const focusLine = focusHabit
    ? `\n- 今日重点习性："${focusHabit.text}"${focusHabit.addressed ? "（已突破 ✓）" : "（未突破）"}`
    : "";

  // 获取用户特点描述
  const raw = await AsyncStorage.getItem("savedRoute");
  const parsed = raw ? JSON.parse(raw) : {};
  const userDescriptions = (parsed.userDescriptions || [])
    .map((d: any) => (typeof d === "string" ? d : d.text || ""))
    .filter(Boolean)
    .join("｜");
  const descLine = userDescriptions ? `\n- 用户特点：${userDescriptions}` : "";

  const systemPrompt = `你是一个精准的学习顾问。根据用户的今日学习数据和当前状态，简要说明判断理由，并给出改进建议。

【数据】
- 日期：${stats.date}
- 状态值（内部参考）：${stats.index !== null ? Number(stats.index).toFixed(1) : "未生成"}
- 状态词：${stats.statusText ?? "未生成"}
- 完成任务：${stats.completedTasks}
- 中途退出：${stats.earlyExits}
- 新增负面习性：${stats.newDescriptionsCount}
- 克服习性：${stats.removedDescriptionsCount}${focusLine}${descLine}

【要求】
1. reason: 1句话解释今天的状态（不要出现数字或分数）
2. advice: 1句话给出如何保持或调整（可以结合今日重点习性给出针对性建议）
3. 语气：客观、鼓励，不要说废话

请严格按照以下 JSON 格式返回：
{
  "reason": "状态说明...",
  "advice": "改进建议..."
}`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "请分析今日状态" },
  ];

  const { content, error } = await chat(messages);

  if (error) {
    return {
      reason: "无法获取评估详情",
      advice: "请稍后再试",
    };
  }

  try {
    return JSON.parse(content);
  } catch {
    return {
      reason: "评估解析失败",
      advice: "",
    };
  }
}
