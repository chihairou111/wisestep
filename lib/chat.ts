import { chat, type Message, type MessageContentPart } from "./api";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageDataUrl?: string;
  imageUri?: string;
  completeSuggestion?: boolean;
};

export type TaskContext = {
  title: string;
  duration?: string;
  detail?: string;
};

// 用户习性描述（带日期）
export type UserDescription = {
  text: string;
  addedDate: string; // YYYY-MM-DD
};

export type ProjectContext = {
  subjects: string[];
  question: string;
  phases: {
    title: string;
    goals: {
      title: string;
      duration?: string;
      detail?: string;
      completed?: boolean;
    }[];
  }[];
};

export type ChatResponse = {
  reply: string;
  addDescription?: string;
  removeDescription?: string;
  suggestions?: string[];
  error?: string;
};

export type TaskPanelResponse = {
  reply: string;
  refreshSearch: boolean;
  completeSuggestion?: boolean;
  searchQuery?: string;
  suggestions?: string[];
  error?: string;
};

// 练习助手聊天（带完整上下文）
export async function chatWithAssistant(
  messages: ChatMessage[],
  taskContext: TaskContext,
  projectContext?: ProjectContext,
  existingUserDescriptions?: UserDescription[],
): Promise<ChatResponse> {
  let contextInfo = `当前练习：
- 标题：${taskContext.title}
- 预计时长：${taskContext.duration || "未设定"}
- 详情：${taskContext.detail || "无"}`;

  if (projectContext) {
    const phaseSummary = projectContext.phases
      .map((p, i) => {
        const completed = p.goals.filter((g) => g.completed).length;
        return `阶段${i + 1}: ${p.title} (${completed}/${p.goals.length}个练习已完成)`;
      })
      .join("\n");

    contextInfo = `学习计划信息：
- 学科：${projectContext.subjects.join("、")}
- 学习描述：${projectContext.question}
- 阶段进度：
${phaseSummary}

${contextInfo}`;
  }

  if (existingUserDescriptions && existingUserDescriptions.length > 0) {
    contextInfo += `

已记录的用户习性：
${existingUserDescriptions.map((d, i) => `${i + 1}. ${d.text} (记录于 ${d.addedDate})`).join("\n")}`;
  }

  const systemPrompt = `你是一位友好且善于引导的学习助手，正在帮助学生完成一个自主学习计划。

${contextInfo}

【你的对话风格】
1. 简洁自然：回复控制在2-3句话，一般情况不要长篇大论
2. 善于提问：通过提问引导用户说出遇到的具体问题
3. 先问后答：不要一上来就给大段建议，先了解清楚情况
4. 不偏话题：如果用户想要聊其它话题，请把话题转移回当前学习内容，拒绝时不要太过强硬
5. 主动提及习性：如果当前练习与用户的某个习性相关，可以自然地提及并给出针对性建议。例如："注意到你有'容易拖延开始'的习性，这个练习建议先做5分钟试试"或"考虑到你'容易分心'，建议把手机放远一点"

【关于习性的主动应用】
- 如果用户有已记录的习性，且与当前练习相关，可以主动提及并给出针对性建议
- 不要每次都提，只在真正有帮助时才提及
- 提及时要自然、不突兀，重点是帮助而非说教

【关于用户习性记录】
- 添加习性：只有当用户的回复中明确体现了某种学习习性或问题模式时，才记录。例如："总是拖延开始"、"容易忽略检查步骤"、"喜欢跳过基础直接做难的"，情况比如如果用户一致找你聊无关的事情
- 删除习性：极为谨慎！只有当你观察到用户在本次对话中表现出与某条已记录习性完全相反的行为，且根据上下文判断用户已经克服了这个问题时，才建议删除。如果不确定，不要删除。

请严格按照以下 JSON 格式返回，不要包含任何其他文字：
{
  "reply": "你的回复，2-3句话",
  "suggestions": ["用户可能想问的问题1", "问题2"],
  "addDescription": "可选，发现新习性时填写，20字以内",
  "removeDescription": "可选，确信用户已克服某习性时，填写要删除的习性原文"
}

suggestions 必须包含 2-3 个用户可能想继续问的简短问题，根据当前对话内容生成。`;

  const apiMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const { content, error } = await chat(apiMessages);

  if (error) {
    return { reply: "", error };
  }

  try {
    const parsed = JSON.parse(content);
    return {
      reply: parsed.reply || "",
      addDescription: parsed.addDescription,
      removeDescription: parsed.removeDescription,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 3)
        : undefined,
    };
  } catch {
    // 如果解析失败，把原始内容作为回复
    return { reply: content };
  }
}

// 通用聊天（无预设 prompt）
export async function chatRaw(
  messages: Message[],
): Promise<{ reply: string; error?: string }> {
  const { content, error } = await chat(messages);
  return { reply: content, error };
}

// 练习页 AI 面板（支持触发资源刷新）
export async function chatWithTaskPanel(
  messages: ChatMessage[],
  taskContext: TaskContext,
  projectContext?: ProjectContext,
): Promise<TaskPanelResponse> {
  let contextInfo = `当前练习：
- 标题：${taskContext.title}
- 预计时长：${taskContext.duration || "未设定"}
- 详情：${taskContext.detail || "无"}`;

  if (projectContext) {
    const phaseSummary = projectContext.phases
      .map((p, i) => {
        const completed = p.goals.filter((g) => g.completed).length;
        return `阶段${i + 1}: ${p.title} (${completed}/${p.goals.length}个练习已完成)`;
      })
      .join("\n");

    contextInfo = `学习计划信息：
- 学科：${projectContext.subjects.join("、")}
- 学习描述：${projectContext.question}
- 阶段进度：
${phaseSummary}

${contextInfo}`;
  }

  const systemPrompt = `你是一个支持型的学习助手，帮助用户推进自主学习计划。

${contextInfo}

【你能做的事】
1. 回答用户关于学习主题/练习的问题（简洁、具体、可执行）
2. 用户提出“重新找资料/再搜/换资源”等需求时，触发资源刷新
3. 用户可能会发送图片，请结合图片内容给出简短、具体的回复
4. 当你认真看过成果且判断“已经完成得不错”时，可以建议完成练习，并附带一个完成按钮

【回复要求】
- 回复简短克制，1-2 句话优先
- 如果用户要你刷新资源，请设置 refreshSearch=true，并可提供一个更好的 searchQuery
- 除非用户明确要求，不要主动要求刷新资源
- 只有在成果看起来确实完成度较高时，才设置 completeSuggestion=true

请严格输出 JSON：
{
  "reply": "给用户的回复",
  "refreshSearch": true/false,
  "completeSuggestion": true/false,
  "searchQuery": "可选，优化后的检索关键词",
  "suggestions": ["可选问题1", "可选问题2"]
}`;

  const apiMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => {
      if (m.imageDataUrl) {
        const parts: MessageContentPart[] = [];
        if (m.content?.trim()) {
          parts.push({ type: "text", text: m.content.trim() });
        }
        parts.push({ type: "image_url", image_url: { url: m.imageDataUrl } });
        return {
          role: m.role as "user" | "assistant",
          content: parts,
        };
      }
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      };
    }),
  ];

  const { content, error } = await chat(apiMessages);

  if (error) {
    return { reply: "", refreshSearch: false, error };
  }

  try {
    const parsed = JSON.parse(content);
    return {
      reply: parsed.reply || "",
      refreshSearch: Boolean(parsed.refreshSearch),
      completeSuggestion: Boolean(parsed.completeSuggestion),
      searchQuery:
        typeof parsed.searchQuery === "string" ? parsed.searchQuery.trim() : undefined,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 3)
        : undefined,
    };
  } catch {
    return { reply: content, refreshSearch: false };
  }
}
