import { chat } from "./api";
import { perplexitySearch as perplexitySearchProxy } from "./perplexityClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

async function perplexitySearch(
  query: string,
  projectContext?: { title?: string; descriptions?: string[] }
): Promise<ResourceCard[]> {
  // 构建带学习上下文的搜索查询
  let refinedQuery = query;

  if (projectContext?.title || projectContext?.descriptions?.length) {
    const contextParts = [];
    if (projectContext.title) {
      contextParts.push(`【学习主题】${projectContext.title}`);
    }
    if (projectContext.descriptions && projectContext.descriptions.length > 0) {
      contextParts.push(`【学习描述】${projectContext.descriptions.join('；')}`);
    }
    contextParts.push(`【当前练习】${query}`);

    const contextStr = contextParts.join('。');
    refinedQuery = `${contextStr}。请基于以上学习主题和练习背景，搜索相关的学习教程、实操指南、方法论、案例分析等教学资源。要求：
1. 优先选择知乎专栏、Medium、个人博客、技术社区（如掘金、简书、Dev.to）、教学平台等可读性高的网站
2. 排除营销网站、产品宣传页、广告页
3. 中文内容优先，但高质量英文资源也可以
4. 免费开放、无需登录
5. 排除：app下载、社交媒体产品功能（如抖音粉丝团）、付费课程`;
  } else {
    refinedQuery = `如何学习 ${query} 教程 OR 指南 OR 方法 OR 入门 OR 实操 OR 案例 OR 学习资源 优先：知乎 OR 掘金 OR 简书 OR Medium OR 个人博客 -抖音 -粉丝团 -app -下载 -登录 -注册 -付费 -pdf -ppt -doc -广告 -营销`;
  }

  try {
    // 使用代理服务器调用 Perplexity（国内可访问，无需 VPN）
    const results = await perplexitySearchProxy(refinedQuery, 8);
    const resources: ResourceCard[] = [];
    const highQuality: ResourceCard[] = [];  // 高质量网站
    const chineseFirst: ResourceCard[] = [];
    const other: ResourceCard[] = [];
    const domestic: ResourceCard[] = [];
    const international: ResourceCard[] = [];
    let nextId = 1;

    // 高质量、可读性好的网站域名列表
    const HIGH_QUALITY_DOMAINS = [
      'zhihu.com', 'zhuanlan.zhihu.com',  // 知乎
      'juejin.cn', 'juejin.im',  // 掘金
      'jianshu.com',  // 简书
      'segmentfault.com',  // SegmentFault
      'cnblogs.com',  // 博客园
      'sspai.com',  // 少数派
      'infoq.cn',  // InfoQ
      'oschina.net',  // 开源中国
      'medium.com',  // Medium
      'dev.to',  // Dev.to
      'hackernoon.com',  // HackerNoon
      'freecodecamp.org',  // freeCodeCamp
      'smashingmagazine.com',  // Smashing Magazine
    ];

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

        // 检查是否为高质量网站
        const isHighQuality = HIGH_QUALITY_DOMAINS.some(d => domain.includes(d));

        const isChinese =
          /[\u4E00-\u9FFF]/.test(title) ||
          /\.cn$/.test(domain) ||
          /\.edu\.cn$/.test(domain);
        const isDomestic =
          /\.cn$/.test(domain) ||
          /\.edu\.cn$/.test(domain) ||
          /\.gov\.cn$/.test(domain);

        // 优先级：高质量网站 > 国内网站 > 中文网站 > 国际网站
        if (isHighQuality) {
          highQuality.push(item);
        } else if (isDomestic) {
          domestic.push(item);
        } else if (isChinese) {
          chineseFirst.push(item);
        } else {
          international.push(item);
        }
      } catch {
        // ignore invalid urls
      }
      if (highQuality.length + domestic.length + chineseFirst.length + international.length >= 8) break;
    }
    return [...highQuality, ...domestic, ...chineseFirst, ...international].slice(0, 3);
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

  // 获取学习上下文
  let projectContext: { title?: string; descriptions?: string[] } | undefined;
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (raw) {
      const parsed = JSON.parse(raw);
      const projectTitle = parsed.projectTitle || "";
      const descriptions = (parsed.userDescriptions || [])
        .map((d: any) => (typeof d === "string" ? d : d.text || ""))
        .filter(Boolean);

      if (projectTitle || descriptions.length > 0) {
        projectContext = {
          title: projectTitle,
          descriptions: descriptions.slice(0, 3), // 最多取3条描述
        };
      }
    }
  } catch (e) {
    console.log("Failed to get project context:", e);
  }

  // Prefer real search results to avoid hallucinated URLs.
  const perplexityResults = await perplexitySearch(context, projectContext);
  if (perplexityResults.length > 0) {
    return { resources: perplexityResults };
  }

  const prompt = `你是一个学习资源搜索助手。请帮学生找到关于以下练习的学习资源：

练习：${context}

【搜索原则】
- 优先使用权威来源：维基百科（zh.wikipedia.org）、学科专业网站
- 确认页面具备良好可读性，广告干扰多或内容质量差的页面不要选
- 找到的URL要尽可能直接指向最相关的内容页面
- 确保链接有效且内容与练习高度相关
- 避免只按名词定义去找条目，更优先选择“如何做/最佳实践/方法步骤/案例”的资源
- 如果练习包含动作（如“优化/改进/写作/设计”），优先找教程、指南、方法论文章
- 只返回可直接打开的完整URL（必须以 http:// 或 https:// 开头），不要用 example.com 这类占位链接
- 必须确保链接真实存在且可访问，不要编造或猜测链接
- 避免需要登录/付费/机构权限的页面，优先选择可直接阅读的公开内容
- 内容要浅显易懂、面向普通读者，避免过于学术或晦涩的材料
- 优先中文资源（若练习为中文），必要时再选英文
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
  const prompt = `你是一个学习主题命名助手。根据用户想学习的内容生成一个清晰简短的中文标题（6-12字）。

学科：${subjects.join("、") || "未设定"}
学习描述：${question}

要求：
1. 标题必须具体、可理解
2. 不要使用“项目/计划/方案/作业”这类泛词，优先使用具体学习主题
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
  const prompt = `你是一位学习规划导师。你的风格是简洁、方向性、不过度指示。学生正在学习以下内容：${subjects.join("、")}。

学生的描述是：${question}

【判断标准】只要包含“想学的主题 + 当前水平/场景 + 期望目标”中的任意两项即可生成。
- 哪怕信息不完整，也先给一个可执行的概览
- 只有在完全无法理解主题时才请用户补充

【核心原则】生成一个简单的学习概览，只列出要涉及的几个大方向/主题，让用户一眼看懂整体范围。
- 这只是概览，详细练习在下一步生成
- 只列方向，不写具体怎么做
- 参考方向（不是必须）：基础理解、核心概念、示例练习、实操应用、复盘巩固等

请生成1个学习概览。不要使用 Markdown，用纯文本排版。

学习概览要包含：
1) 学习主题标题（简短，4-10个字）
2) 涉及方向（列出3-5个大方向，每行一个，只写方向名称，不写描述。例如："细胞结构知识"、"思维导图制作"）

请严格按照以下 JSON 格式返回，不要包含任何其他文字：

如果需要澄清：
{
  "needClarification": "友好的提示，说明缺少什么信息，建议学生如何补充"
}

如果可以生成方案：
{
  "plans": [
    { "title": "学习主题标题", "content": "学习说明" }
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
  const prompt = `你是一位学习规划导师。你的风格是具体、可执行、可评估。学生正在学习以下内容：${subjects.join("、")}。

学生的描述是：${question}

【核心原则】生成方向性的练习列表，每个练习是“学习方向”，不是步骤或做法。（用户已在上一步确认过学习方向，直接生成练习即可，不需要再判断是否清晰）
- 练习是方向名，不是具体动作
- 让用户自己决定内容与方式
- 练习名称用名词短语（3-6个字），避免动词
- 说明一句话点明关注点或价值，不给方法/步骤
- 参考方向（不是必须）：基础、概念、例题、实践、复盘等

请生成练习列表。要求：
1) 分为2-3个阶段
2) 每个阶段包含2-3个方向性练习
3) 每个练习有：标题（方向名）、预计时长（纯数字，单位分钟，15-60之间）、简短说明（10-14字，强调学习价值）
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
  const prompt = `你是一位学习规划导师。你的风格是具体、可执行、可评估。学生正在学习以下内容：${subjects.join("、")}。

学生的学习描述是：${question}

当前处于阶段：${phaseTitle}
需要修改的小练习是：
标题：${goal.title}
时长：${goal.duration}
说明：${goal.detail}

学生的修改建议是：${suggestion}

请只修改这个小练习本身，不要改其他阶段或练习。输出一个更新后的练习，包含标题（简短，3-8个字）、时长（15-60分钟）、简短说明（一句话描述要练什么）。

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
