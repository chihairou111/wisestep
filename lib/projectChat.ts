import AsyncStorage from "@react-native-async-storage/async-storage";
import { chat, type Message } from "./api";
import {
  getIndexHistory,
  getStatusLabelFromIndex,
  getTodayStats,
} from "./dailyStats";
import { getTodayFocusHabit } from "./focusHabit";
import { getAchievements } from "./achievements";

// ─── 类型 ───

export type ProjectChange = {
  type: "modify_goal" | "add_goal";
  phaseIndex: number;
  goalIndex?: number; // modify 时需要
  title?: string;
  duration?: string;
  detail?: string;
  reason: string;
};

export type ProjectChatResponse = {
  message: string;
  changes?: ProjectChange[];
  suggestions?: string[];
  error?: string;
};

export type ProjectChatMessage = {
  role: "user" | "assistant";
  content: string;
  changes?: ProjectChange[];
  changesApplied?: boolean;
  changesExpired?: boolean;
  suggestions?: string[];
};

// ─── 构建上下文 ───

async function buildProjectContext(): Promise<string> {
  const raw = await AsyncStorage.getItem("savedRoute");
  if (!raw) return "【项目数据】暂无项目数据";
  const parsed = JSON.parse(raw);

  const subjects = parsed.subjects?.join("、") || "未设定";
  const question = parsed.question || "未设定";

  const phasesInfo = Array.isArray(parsed.phases)
    ? parsed.phases
        .map((p: any, pi: number) => {
          const goals = (p.goals || [])
            .map((g: any, gi: number) => {
              const status = g.completed ? "✅ 已完成" : "⬜ 未完成";
              return `    ${gi + 1}. [${status}] ${g.title}（${g.duration || "未设时长"}）${g.detail ? `\n       详情：${g.detail}` : ""}`;
            })
            .join("\n");
          return `  阶段 ${pi + 1}：${p.title}\n${goals}`;
        })
        .join("\n\n")
    : "暂无阶段";

  const descriptions = (parsed.userDescriptions || [])
    .map((d: any) => (typeof d === "string" ? d : d.text || ""))
    .filter(Boolean);

  const stats = await getTodayStats();
  const history = await getIndexHistory();
  const focusHabit = await getTodayFocusHabit();
  const achievements = await getAchievements();

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
    ? `\n- 今日重点习性："${focusHabit.text}"${focusHabit.addressed ? "（已突破）" : "（未突破）"}`
    : "";

  const descLine =
    descriptions.length > 0
      ? `\n- 用户习性：${descriptions.join("、")}`
      : "";

  const achievementInfo = achievements?.achievements
    .filter((a) => a.unlocked || (a.progress > 0 && a.target))
    .map((a) => {
      if (a.unlocked) {
        return `✅ ${a.title}${a.unlockedAt ? ` (${a.unlockedAt})` : ""}`;
      } else {
        return `⏳ ${a.title} (${a.progress}/${a.target})`;
      }
    })
    .join("\n");

  return `【项目信息】
    - 学科：${subjects}
    - 项目描述：${question}

【阶段与任务】
${phasesInfo}

【用户表现】
- 今日状态词：${stats.statusText ?? "未生成"}
- 状态值（内部参考）：${stats.index !== null ? Number(stats.index).toFixed(1) : "未生成"}
- 完成任务：${stats.completedTasks}
- 中途退出：${stats.earlyExits}${historyLine}${focusLine}${descLine}

【成就状态】
${achievementInfo || "暂无成就数据"}`;
}

// ─── 系统提示词 ───

function buildSystemPrompt(context: string): string {
  return `你是用户的学习项目顾问，可以和用户讨论项目进展、给出反馈、提建议。

${context}

【你的职责】
1. 对用户的学习表现给予真诚反馈（基于状态、完成率、退出情况、习性等），不要提数字或分数
2. 回答关于项目的问题
3. 用户明确要求时，帮助修改项目内容
4. 建议修改时，主动考虑用户的习性，让修改更贴合用户的学习模式
5. **绝对具体**：在生成规划或建议时，不要模棱两可。必须给出明确的步骤、时间或内容。不要说"你可以多学一点"，而要说"建议增加一个 20 分钟的复习任务"。

【关于改动的触发条件——极其重要】
- 默认不发送任何 changes，绝大多数回复只需要 message 和 suggestions
- 只有在以下情况才可以附带 changes：
  1. 用户明确要求修改（如"帮我改一下"、"调整时长"、"加个任务"等）
  2. 用户描述了明确的困难，且你判断必须调整计划才能解决，此时先用 message 提出建议，等用户同意后再在下一轮附带 changes
- 绝对不要在用户只是随便聊天、问问题时就附带改动

【更改规则】
1. 更改必须温和：不要一次性大改，每次最多改动 1-2 个地方
2. 绝对不能删除已完成的任务
3. 已完成任务的内容也不要修改
4. 更改只针对未完成的任务（新增、微调标题/详情/时长）
5. 新增任务必须指定 phaseIndex（0 开始）和合理的 duration
6. 修改任务必须指定 phaseIndex 和 goalIndex（0 开始）
7. 建议修改时，必须考虑用户的习性。如果某个修改与用户的习性相关（如"容易拖延"→建议缩短时长、"容易分心"→建议拆分任务），必须在 reason 中明确说明："考虑到你的习性'XXX'，建议..."

【回复格式】
请严格返回 JSON：
{
  "message": "你的回复内容",
  "suggestions": ["用户可能想问的问题1", "问题2", "问题3"],
  "changes": [
    {
      "type": "modify_goal" 或 "add_goal",
      "phaseIndex": 数字,
      "goalIndex": 数字（modify 时必填）,
      "title": "可选，新标题",
      "duration": "可选，如 '25 分钟'",
      "detail": "可选，新详情",
      "reason": "为什么做这个改动"
    }
  ]
}

suggestions 必须包含 2-3 个用户可能想继续问的简短问题（如"我该怎么改进？"、"帮我调整一下时长"等），根据当前对话和项目状态生成。
如果不需要改动，changes 可以省略或设为空数组：
{ "message": "你的回复", "suggestions": ["问题1", "问题2"] }`;
}

// ─── 主函数 ───

export async function chatWithProjectAdvisor(
  messages: ProjectChatMessage[],
): Promise<ProjectChatResponse> {
  const context = await buildProjectContext();
  const systemPrompt = buildSystemPrompt(context);

  const apiMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const { content, error } = await chat(apiMessages);

  if (error) {
    return { message: "", error };
  }

  try {
    const parsed = JSON.parse(content);
    const response: ProjectChatResponse = {
      message: parsed.message || "",
    };

    if (Array.isArray(parsed.changes) && parsed.changes.length > 0) {
      response.changes = parsed.changes.filter(
        (c: any) =>
          (c.type === "modify_goal" || c.type === "add_goal") &&
          typeof c.phaseIndex === "number" &&
          typeof c.reason === "string",
      );
    }

    if (Array.isArray(parsed.suggestions)) {
      response.suggestions = parsed.suggestions
        .filter((s: any) => typeof s === "string" && s.trim())
        .slice(0, 3);
    }

    return response;
  } catch {
    return { message: content };
  }
}

// ─── 应用更改 ───

export async function applyProjectChanges(
  changes: ProjectChange[],
): Promise<{ success: boolean; appliedCount: number }> {
  const raw = await AsyncStorage.getItem("savedRoute");
  if (!raw) return { success: false, appliedCount: 0 };

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.phases)) return { success: false, appliedCount: 0 };

  let appliedCount = 0;

  for (const change of changes) {
    const phase = parsed.phases[change.phaseIndex];
    if (!phase) continue;

    if (change.type === "modify_goal") {
      const goal = phase.goals?.[change.goalIndex ?? -1];
      if (!goal) continue;
      // 不修改已完成的任务
      if (goal.completed) continue;

      if (change.title) goal.title = change.title;
      if (change.duration) goal.duration = change.duration;
      if (change.detail !== undefined) goal.detail = change.detail;
      appliedCount++;
    } else if (change.type === "add_goal") {
      if (!Array.isArray(phase.goals)) phase.goals = [];
      phase.goals.push({
        title: change.title || "新任务",
        duration: change.duration || "25 分钟",
        detail: change.detail || "",
        completed: false,
      });
      appliedCount++;
    }
  }

  await AsyncStorage.setItem("savedRoute", JSON.stringify(parsed));
  return { success: true, appliedCount };
}
