import AsyncStorage from "@react-native-async-storage/async-storage";
import { chat, type Message } from "./api";
import {
  getIndexHistory,
  getStatusLabelFromIndex,
  getTodayStats,
  getYesterdayIndex,
} from "./dailyStats";
import { getTodayFocusHabit } from "./focusHabit";
import { getAchievements } from "./achievements";

export type RecommendedTask = {
  headline: string;       // 抓人的个性化激励句
  task: string;           // 具体行动
  reason: string;         // 为什么值得做，融合状态与成就
  actionType: "task" | "habit" | "general";
  phaseIndex?: number;
  goalIndex?: number;
};

export async function getAIRecommendedTask(): Promise<RecommendedTask | null> {
  try {
    // 1. Gather Context
    const raw = await AsyncStorage.getItem("savedRoute");
    const parsed = raw ? JSON.parse(raw) : {};
    
    // Project info
    const phases = Array.isArray(parsed.phases) ? parsed.phases : [];
    let pendingTasks = "";
    let totalTasks = 0;
    let doneTasks = 0;
    phases.forEach((p: any, pi: number) => {
      if (Array.isArray(p.goals)) {
        p.goals.forEach((g: any, gi: number) => {
          totalTasks++;
          if (g.completed) {
            doneTasks++;
          } else {
            pendingTasks += `- 阶段${pi + 1}｜${g.title}｜${g.duration || "未设时长"}\n`;
          }
        });
      }
    });

    const userDescriptions = (parsed.userDescriptions || [])
      .map((d: any) => (typeof d === "string" ? d : d.text || ""))
      .join("｜");

    // Stats & Habits
    const stats = await getTodayStats();
    const history = await getIndexHistory();
    const focusHabit = await getTodayFocusHabit();
    const achievements = await getAchievements();
    const yesterdayIndex = await getYesterdayIndex();

    // 计算连续活跃天数（从最近往回数连续有记录的天数）
    let streakDays = 0;
    if (history.length > 0) {
      const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
      const today = new Date();
      for (let i = 0; i < sorted.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`;
        if (sorted[i]?.date === expectedStr) {
          streakDays++;
        } else {
          break;
        }
      }
    }

    // Achievement context — 发送全部成就
    const achievementInfo = achievements?.achievements
      .map((a) => {
        if (a.unlocked) return `✅ ${a.title} — 已解锁`;
        return `⏳ ${a.title} — ${a.progress}/${a.target} — ${a.condition}`;
      })
      .join("\n") || "暂无";

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

    const statusText =
      stats.statusText ||
      (stats.index !== null ? statusLabelFor(stats.index) : "待开始");

    // 判断是否是新用户（没有历史记录，没完成过任何任务）
    const isFirstTime = history.length === 0 && doneTasks === 0;

    const toneGuide = isFirstTime
      ? `这是用户第一次使用。语气温和、简洁、不过度解释。headline 让人觉得"不难，愿意试试"。reason 只说一句为什么从这个任务开始。
   好的 headline 例子：
   - "先从最简单的开始。"
   - "从第一个任务进入状态。"
   - "5 分钟就够，先试一下。"
   禁止：
   - 提及状态、成就、连续天数 — 新用户还没有这些数据
   - 假装很熟 — 不要用"保持势头""继续"这类词`
      : `你说话简洁、有分量、克制但坚定。像一个沉稳的人写给自己的备忘录。
   headline 必须引用具体数据。语气克制但有分量，不用网络用语和语气词。
   好的例子：
   - "今天状态：${statusText}。"
   - "连续第 ${streakDays} 天。"
   - "再完成一个，「一周坚持」就解锁了。"
   - "就差一步，收尾更轻松。"
   禁止：
   - "冲啊""搞定它""干就完了" — 太随意
   - "加油""你可以的""坚持就是胜利" — 空洞
   - "今天也要努力哦" — 敷衍`;

    const systemPrompt = `你是用户信任的伙伴。你了解他所有的数据。使用正确的标点符号。不用网络用语，不用感叹号，不用"冲""搞定"这类词。

【用户状态】
${isFirstTime ? "⚡ 这是用户第一次使用，还没完成过任何任务。\n" : ""}
今日状态词：${statusText}  昨日状态：${yesterdayIndex !== null ? statusLabelFor(yesterdayIndex) : "无记录"}
连续活跃：${streakDays} 天
今日完成：${stats.completedTasks} 个任务
重点习性：${focusHabit ? focusHabit.text + (focusHabit.addressed ? "（已突破）" : "（未突破）") : "无"}
待办任务：
${pendingTasks || "无"}
成就：
${achievementInfo}
用户特点：${userDescriptions || "无"}

【你需要输出三个字段】

1. headline — 卡片上最大的文字。极简（8 字以内）。
${toneGuide}

2. task — 推荐做什么。直接用待办任务名（12 字以内）。

3. reason — 为什么现在做这个最值（8-12 字，可省略）。${isFirstTime ? "一句话解释为什么从这个开始，能省则省。" : "一句话融合状态或成就，能省则省。"}
   ${isFirstTime ? "" : `好的例子：
   - "今天就差这一步，做完会更踏实。"
   - "今天最后一个，全清就解锁「精准执行」。"`}
   绝对禁止的：
   - "这个任务很重要" — 没有信息量
   - "有助于提升状态" — 谁不知道

严格输出 JSON。禁止方括号和圆括号：
{"headline":"...","task":"...","reason":"...","actionType":"task|habit|general"}`;

    const response = await chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: "推我一把。" },
    ]);

    if (response.error) return null;

    try {
      const result = JSON.parse(response.content);
      return {
        headline: result.headline || "",
        task: result.task || "",
        reason: result.reason || "",
        actionType: result.actionType || "general",
      };
    } catch (e) {
      console.log("Failed to parse AI recommendation", e);
      return null;
    }
  } catch (e) {
    console.log("Error getting AI recommendation", e);
    return null;
  }
}
