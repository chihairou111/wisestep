import { chat } from "./api";
import { perplexitySearch as perplexitySearchProxy } from "./perplexityClient";

export type ResourceCard = {
  id: string;
  title: string;
  url: string;
  domain: string;
  category?: "方法" | "案例" | "模板";
};

export type SearchResourcesResponse = {
  resources: ResourceCard[];
  error?: string;
};

const BLOCKED_DOMAINS = new Set([
  "cnki.net",
  "www.cnki.net",
  "login.cnki.net",
  "csdn.net",
  "www.csdn.net",
  "blog.csdn.net",
  "wenku.baidu.com",
  "baidu.com",
  "www.baidu.com",
]);

const BLOCKED_URL_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/signup/i,
  /\/register/i,
  /\/auth/i,
  /\/paywall/i,
  /wenku\.baidu\.com/i,
];

const INVALID_PAGE_PATTERNS = [
  /404/i,
  /not\s*found/i,
  /no\s*such\s*key/i,
  /页面不存在/i,
  /页面未找到/i,
  /您访问的页面不存在/i,
  /访问的页面不存在/i,
  /暂时无法访问/i,
];

async function isLikelyAccessible(url: string): Promise<boolean> {
  // On web platform, skip validation to avoid CORS errors
  // Users can directly open links, so validation is not critical
  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    // Check if it's a blocked domain or pattern
    try {
      const hostname = new URL(url).hostname;
      if (BLOCKED_DOMAINS.has(hostname)) return false;
      if (BLOCKED_URL_PATTERNS.some((re) => re.test(url))) return false;
      // On web, assume URLs are accessible (user can click to verify)
      return true;
    } catch {
      return false;
    }
  }

  // On native platforms (iOS/Android), perform full validation
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res || res.status >= 400) return false;
    const finalUrl = res.url || url;
    const hostname = new URL(finalUrl).hostname;
    if (BLOCKED_DOMAINS.has(hostname)) return false;
    if (BLOCKED_URL_PATTERNS.some((re) => re.test(finalUrl))) return false;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const text = await res.text();
      const head = text.slice(0, 2000);
      if (INVALID_PAGE_PATTERNS.some((re) => re.test(head))) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

type PerplexityResult = {
  title?: string;
  url?: string;
};

async function perplexitySearch(query: string): Promise<ResourceCard[]> {
  const refinedQuery = `${query} 教程 OR 指南 OR 方法 OR 步骤 OR 实操 OR 案例 中文 国内 -pdf -ppt -doc -下载 -登录 -注册 -付费`;
  try {
    // 使用代理服务器调用 Perplexity（国内可访问，无需 VPN）
    const results = await perplexitySearchProxy(refinedQuery, 8);
    const resources: ResourceCard[] = [];
    const chineseFirst: ResourceCard[] = [];
    const other: ResourceCard[] = [];
    const domestic: ResourceCard[] = [];
    const international: ResourceCard[] = [];
    let nextId = 1;
    for (const r of results) {
      const title = typeof r?.title === "string" ? r.title.trim() : "";
      const url = typeof r?.url === "string" ? r.url.trim() : "";
      if (!url) continue;
      try {
        const u = new URL(url);
        const domain = u.hostname;
        if (
          !domain ||
          ["example.com", "www.example.com"].includes(u.hostname) ||
          BLOCKED_DOMAINS.has(u.hostname) ||
          BLOCKED_URL_PATTERNS.some((re) => re.test(u.toString()))
        ) {
          continue;
        }
        const ok = await isLikelyAccessible(u.toString());
        if (!ok) continue;
        const item = {
          id: `r${nextId++}`,
          title,
          url: u.toString(),
          domain,
        };
        const isChinese =
          /[\u4E00-\u9FFF]/.test(title) ||
          /\.cn$/.test(domain) ||
          /\.edu\.cn$/.test(domain);
        const isDomestic =
          /\.cn$/.test(domain) ||
          /\.edu\.cn$/.test(domain) ||
          /\.gov\.cn$/.test(domain);
        if (isDomestic) {
          domestic.push(item);
        } else if (isChinese) {
          chineseFirst.push(item);
        } else {
          international.push(item);
        }
      } catch {
        // ignore invalid urls
      }
      if (domestic.length + chineseFirst.length + international.length >= 8) break;
    }
    return [...domestic, ...chineseFirst, ...international].slice(0, 3);
  } catch {
    return [];
  }
}

// 搜索学习资源
export async function searchResources(
  taskTitle: string,
  taskDetail?: string,
): Promise<SearchResourcesResponse> {
  const context = taskDetail ? `${taskTitle}：${taskDetail}` : taskTitle;

  // Prefer real search results to avoid hallucinated URLs.
  const perplexityResults = await perplexitySearch(context);
  if (perplexityResults.length > 0) {
    return { resources: perplexityResults };
  }

  const prompt = `你是一个学习资源搜索助手。请帮学生找到关于以下任务的学习资源：

任务：${context}

【搜索原则】
- 优先使用权威来源：维基百科（zh.wikipedia.org）、学科专业网站
- 确认页面具备良好可读性，广告干扰多或内容质量差的页面不要选
- 找到的URL要尽可能直接指向最相关的内容页面
- 确保链接有效且内容与任务高度相关
- 避免只按名词定义去找条目，更优先选择“如何做/最佳实践/方法步骤/案例”的资源
- 如果任务包含动作（如“优化/改进/写作/设计”），优先找教程、指南、方法论文章
- 只返回可直接打开的完整URL（必须以 http:// 或 https:// 开头），不要用 example.com 这类占位链接
- 必须确保链接真实存在且可访问，不要编造或猜测链接
- 避免需要登录/付费/机构权限的页面，优先选择可直接阅读的公开内容
- 内容要浅显易懂、面向普通读者，避免过于学术或晦涩的材料
- 优先中文资源（若任务为中文），必要时再选英文
- 尽量避免 PDF/课件下载页，优先普通网页文章

请返回最多3个最有帮助的网页资源。严格按照以下JSON格式返回，不要包含任何其他文字：
{
  "resources": [
    { "title": "资源标题", "url": "完整URL", "domain": "域名" }
  ]
}`;

  const { content, error } = await chat([{ role: "user", content: prompt }]);
  if (__DEV__) {
    console.log("[searchResources] raw content:", content);
  }

  if (error) {
    return { resources: [], error };
  }

  try {
    const parsed = JSON.parse(content);
    const rawResources = Array.isArray(parsed.resources) ? parsed.resources : [];
    if (__DEV__) {
      console.log("[searchResources] parsed resources:", rawResources);
    }
    const resources: ResourceCard[] = [];
    const candidates: ResourceCard[] = [];
    for (const r of rawResources) {
      const title = typeof r?.title === "string" ? r.title.trim() : "";
      let url = typeof r?.url === "string" ? r.url.trim() : "";
      if (url && !/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      try {
        const u = new URL(url);
        const domain = typeof r?.domain === "string" && r.domain.trim()
          ? r.domain.trim()
          : u.hostname;
        if (
          !domain ||
          ["example.com", "www.example.com"].includes(u.hostname) ||
          BLOCKED_DOMAINS.has(u.hostname) ||
          BLOCKED_URL_PATTERNS.some((re) => re.test(u.toString()))
        ) {
          continue;
        }
        candidates.push({
          id: `r${candidates.length + 1}`,
          title,
          url: u.toString(),
          domain,
        });
        const ok = await isLikelyAccessible(u.toString());
        if (!ok) continue;
        resources.push({
          id: `r${resources.length + 1}`,
          title,
          url: u.toString(),
          domain,
        });
      } catch {
        // ignore invalid urls
      }
      if (resources.length >= 3) break;
    }
    if (__DEV__) {
      console.log("[searchResources] verified:", resources.length);
      console.log("[searchResources] candidates:", candidates.length);
    }
    if (resources.length > 0) return { resources };
    return { resources: [], error: "未找到可用链接" };
  } catch {
    return { resources: [], error: "解析资源失败" };
  }
}

export type PlanItem = {
  title: string;
  content: string;
};

export type StudyPlanResponse = {
  plans: PlanItem[];
  needClarification?: string;
  error?: string;
};

export type GoalItem = {
  title: string;
  duration: string;
  detail: string;
};

export type PhasePlan = {
  title: string;
  goals: GoalItem[];
};

export type DetailedPlanResponse = {
  phases: PhasePlan[];
  needClarification?: string;
  error?: string;
};

export type GoalEditResponse = {
  goal: GoalItem | null;
  error?: string;
};

export async function generateProjectTitle(
  subjects: string[],
  question: string,
): Promise<{ title: string; error?: string }> {
  const prompt = `你是一个项目命名助手。根据用户的项目描述生成一个清晰简短的中文标题（6-12字）。

学科：${subjects.join("、") || "未设定"}
描述：${question}

要求：
1. 标题必须具体、可理解
2. 不要使用“项目/计划/方案/作业”这类泛词
3. 只输出 JSON

返回格式：
{ "title": "..." }`;

  const { content, error } = await chat([{ role: "user", content: prompt }]);
  if (error) return { title: "", error };
  try {
    const parsed = JSON.parse(content);
    return { title: typeof parsed.title === "string" ? parsed.title.trim() : "" };
  } catch {
    return { title: "" };
  }
}

// 生成学习规划
export async function generateStudyPlan(
  subjects: string[],
  question: string,
): Promise<StudyPlanResponse> {
  const prompt = `你是一位PBL（项目式学习）导师。你的风格是简洁、方向性、不过度指示。学生正在学习以下科目：${subjects.join("、")}。

学生的描述是：${question}

【判断标准】只要包含“主题 + 对象/场景 + 预期成果”中的任意两项即可生成。
- 哪怕信息不完整，也先给一个可执行的概览
- 只有在完全无法理解主题时才请用户补充

【核心原则】生成一个简单的项目概览，只列出要涉及的几个大方向/主题，让用户一眼看懂整体范围。
- 这只是概览，详细任务在下一步生成
- 只列方向，不写具体怎么做
- 参考方向（不是必须）：知识查找、知识回顾、动手制作、成果产出等

请生成1个项目概览。不要使用 Markdown，用纯文本排版。

项目概览要包含：
1) 项目标题（简短，4-10个字）
2) 涉及方向（列出3-5个大方向，每行一个，只写方向名称，不写描述。例如："细胞结构知识"、"思维导图制作"）

请严格按照以下 JSON 格式返回，不要包含任何其他文字：

如果需要澄清：
{
  "needClarification": "友好的提示，说明缺少什么信息，建议学生如何补充"
}

如果可以生成方案：
{
  "plans": [
    { "title": "项目标题", "content": "项目说明" }
  ]
}`;

  const { content, error } = await chat([{ role: "user", content: prompt }]);

  if (error) {
    return { plans: [], error };
  }

  try {
    const parsed = JSON.parse(content);
    if (parsed.needClarification) {
      return { plans: [], needClarification: parsed.needClarification };
    }
    return { plans: parsed.plans || [] };
  } catch {
    return { plans: [], error: "解析响应失败" };
  }
}

// 生成分阶段的小目标计划
export async function generateDetailedPlan(
  subjects: string[],
  question: string,
): Promise<DetailedPlanResponse> {
  const prompt = `你是一位PBL（项目式学习）导师。你的风格是具体、可执行、可评估。学生正在学习以下科目：${subjects.join("、")}。

学生的描述是：${question}

【核心原则】生成方向性的任务列表，每个任务是“主题方向”，不是步骤或做法。（用户已在上一步确认过项目方向，直接生成任务即可，不需要再判断是否清晰）
- 任务是方向名，不是具体动作
- 让用户自己决定内容与方式
- 任务名称用名词短语（3-6个字），避免动词
- 说明一句话点明关注点或价值，不给方法/步骤
- 参考方向（不是必须）：资料、结构、表达、实践、复盘等

请生成任务列表。要求：
1) 分为2-3个阶段
2) 每个阶段包含2-3个方向性任务
3) 每个任务有：标题（方向名）、预计时长（纯数字，单位分钟，15-60之间）、简短说明（10-14字，强调方向价值）
4) 不要使用 Markdown

请严格按照以下 JSON 格式返回，不要包含任何其他文字：
{
  "phases": [
    {
      "title": "阶段标题",
      "goals": [
        { "title": "小目标1", "duration": "15", "detail": "简短说明" }
      ]
    }
  ]
}`;

  const { content, error } = await chat([{ role: "user", content: prompt }]);

  if (error) {
    return { phases: [], error };
  }

  try {
    const parsed = JSON.parse(content);
    if (parsed.needClarification) {
      return { phases: [], needClarification: parsed.needClarification };
    }
    return { phases: parsed.phases || [] };
  } catch {
    return { phases: [], error: "解析响应失败" };
  }
}

// 修改单个小目标
export async function reviseGoalItem(params: {
  subjects: string[];
  question: string;
  phaseTitle: string;
  goal: GoalItem;
  suggestion: string;
}): Promise<GoalEditResponse> {
  const { subjects, question, phaseTitle, goal, suggestion } = params;
  const prompt = `你是一位PBL（项目式学习）导师。你的风格是具体、可执行、可评估。学生正在学习以下科目：${subjects.join("、")}。

学生的项目描述是：${question}

当前处于阶段：${phaseTitle}
需要修改的小目标是：
标题：${goal.title}
时长：${goal.duration}
说明：${goal.detail}

学生的修改建议是：${suggestion}

请只修改这个小目标本身，不要改其他阶段或目标。输出一个更新后的目标，包含标题（简短，3-8个字）、时长（15-60分钟）、简短说明（一句话描述要做什么）。

请严格按照以下 JSON 格式返回，不要包含任何其他文字：
{
  "goal": { "title": "新标题", "duration": "新时长", "detail": "新说明" }
}`;

  const { content, error } = await chat([{ role: "user", content: prompt }]);

  if (error) {
    return { goal: null, error };
  }

  try {
    const parsed = JSON.parse(content);
    return { goal: parsed.goal || null };
  } catch {
    return { goal: null, error: "解析响应失败" };
  }
}
