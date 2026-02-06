import AsyncStorage from "@react-native-async-storage/async-storage";
import { chat, type Message } from "./api";
import { getIndexHistory, getStatusLabelFromIndex, getTodayStats } from "./dailyStats";
import { getTodayFocusHabit } from "./focusHabit";

export type CompletionReview = {
  review: string; // 对整个项目的总结评价
};

export async function getProjectCompletionReview(): Promise<CompletionReview> {
  const stats = await getTodayStats();
  const history = await getIndexHistory();
  const focusHabit = await getTodayFocusHabit();
  const project = await getProjectContext();

  const statusLabelFor = (index: number) =>
    typeof getStatusLabelFromIndex === "function"
      ? getStatusLabelFromIndex(index)
      : index >= 8.5
        ? "状态佳"
        : index >= 7
          ? "挺投入"
          : index >= 5.5
            ? "稳步中"
            : index >= 4
              ? "有点散"
              : index >= 2.5
                ? "有点累"
                : "低迷";

  const historyLine =
    history.length > 0
      ? `\n- 近7日状态：${history
          .slice(-7)
          .map((h) => `${h.date.slice(5)}:${statusLabelFor(h.index)}`)
          .join("、")}`
      : "";

  const focusLine = focusHabit
    ? `\n- 今日重点习性："${focusHabit.text}"${
        focusHabit.addressed ? "（已突破）" : "（未突破）"
      }`
    : "";

  const descLine =
    project.descriptions.length > 0
      ? `\n- 已记录习性：${project.descriptions.join("、")}`
      : "";

  const phaseLine =
    project.phaseSummary.length > 0
      ? `\n- 阶段进度：${project.phaseSummary.join("；")}`
      : "";

  const systemPrompt = `你是一个学习教练。用户刚刚完成了整个项目的所有任务！请给出一段完整的总结评价。

【今日数据】
- 状态词：${stats.statusText ?? "未生成"}
- 状态值（内部参考）：${stats.index !== null ? Number(stats.index).toFixed(1) : "未生成"}
- 完成任务：${stats.completedTasks}
- 中途退出：${stats.earlyExits}
- 新增负面习性：${stats.newDescriptionsCount}
- 克服习性：${stats.removedDescriptionsCount}${historyLine}${focusLine}${descLine}${phaseLine}

【要求】
1. 写 3-5 句话的评价，包括：用户做得好的地方、过程中的挑战、成长点、以及接下来可以关注的方向
2. 语气温暖真诚，像一个好朋友在总结
3. 如果有习性数据，结合它评价用户的成长
4. 不要提及分数或数字评价，不要说"你完成了所有任务"这种废话，直接说实质

请严格返回 JSON：
{
  "review": "3-5句话的总结评价"
}`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "请评价本次表现" },
  ];

  const { content, error } = await chat(messages);
  if (error) {
    return { review: "这个项目你坚持到了最后，这本身就很了不起。继续保持这种节奏，下一个项目会更顺利。" };
  }

  try {
    const parsed = JSON.parse(content);
    return {
      review:
        typeof parsed.review === "string"
          ? parsed.review
          : "这个项目你坚持到了最后，这本身就很了不起。",
    };
  } catch {
    return { review: content.slice(0, 300) };
  }
}

async function getProjectContext(): Promise<{
  descriptions: string[];
  phaseSummary: string[];
}> {
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (!raw) return { descriptions: [], phaseSummary: [] };
    const parsed = JSON.parse(raw);

    const descriptions = (parsed.userDescriptions || []).map((d: any) =>
      typeof d === "string" ? d : d.text || "",
    );

    const phaseSummary = Array.isArray(parsed.phases)
      ? parsed.phases.map((p: any, i: number) => {
          const total = p?.goals?.length || 0;
          const done = (p?.goals || []).filter((g: any) => g.completed).length;
          return `阶段${i + 1} ${p?.title || ""} ${done}/${total}`;
        })
      : [];

    return { descriptions, phaseSummary };
  } catch {
    return { descriptions: [], phaseSummary: [] };
  }
}
