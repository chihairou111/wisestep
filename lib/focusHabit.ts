import AsyncStorage from "@react-native-async-storage/async-storage";
import { chat, type Message } from "./api";

// ─── 类型 ───

export type FocusHabit = {
  text: string; // 习性内容
  date: string; // 选定日期 YYYY-MM-DD
  addressed: boolean; // 今天是否已被克服
};

const FOCUS_HABIT_KEY = "focusHabit";

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ─── 获取今日重点习性 ───

export async function getTodayFocusHabit(): Promise<FocusHabit | null> {
  const today = getTodayDateString();

  // 检查存储中是否已有今天的
  const raw = await AsyncStorage.getItem(FOCUS_HABIT_KEY);
  if (raw) {
    const saved: FocusHabit = JSON.parse(raw);
    if (saved.date === today) {
      // 自动检测是否已克服（不再出现在描述列表中）
      if (!saved.addressed) {
        const texts = await getDescriptionTexts();
        if (!texts.includes(saved.text)) {
          saved.addressed = true;
          await AsyncStorage.setItem(FOCUS_HABIT_KEY, JSON.stringify(saved));
        }
      }
      return saved;
    }
  }

  // 今天还没有 → 从描述中选一条
  const descriptions = await getDescriptionsWithDate();
  if (descriptions.length === 0) return null;

  const selected = await selectFocusHabit(descriptions);
  if (!selected) return null;

  const focusHabit: FocusHabit = {
    text: selected,
    date: today,
    addressed: false,
  };

  await AsyncStorage.setItem(FOCUS_HABIT_KEY, JSON.stringify(focusHabit));
  return focusHabit;
}

// ─── 标记今日重点已克服 ───

export async function markFocusHabitAddressed(): Promise<void> {
  const raw = await AsyncStorage.getItem(FOCUS_HABIT_KEY);
  if (!raw) return;
  const habit: FocusHabit = JSON.parse(raw);
  const today = getTodayDateString();
  if (habit.date === today && !habit.addressed) {
    habit.addressed = true;
    await AsyncStorage.setItem(FOCUS_HABIT_KEY, JSON.stringify(habit));
  }
}

// ─── AI 选择今日重点 ───

async function selectFocusHabit(
  descriptions: { text: string; addedDate: string }[],
): Promise<string | null> {
  if (descriptions.length === 0) return null;
  if (descriptions.length === 1) return descriptions[0].text;

  const descList = descriptions
    .map((d, i) => `${i + 1}. "${d.text}"（记录于 ${d.addedDate}）`)
    .join("\n");

  const systemPrompt = `你是一个学习行为分析师。从以下习性列表中选出今天最应该重点关注的 1 条。

【用户习性】
${descList}

【选择原则】
1. 优先选择记录时间最久但还没改善的（最顽固）
2. 其次选择对学习效率影响最大的
3. 要选用户今天能实际采取行动的

请严格返回 JSON：
{ "index": 编号 }`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "请选择今日重点" },
  ];

  try {
    const { content, error } = await chat(messages);
    if (error) throw new Error(error);
    const parsed = JSON.parse(content);
    const idx = Number(parsed.index) - 1;
    if (idx >= 0 && idx < descriptions.length) {
      return descriptions[idx].text;
    }
  } catch {
    // fallback
  }

  // 规则兜底：选最早添加的（最顽固）
  const sorted = [...descriptions].sort((a, b) =>
    a.addedDate.localeCompare(b.addedDate),
  );
  return sorted[0].text;
}

// ─── 辅助函数 ───

async function getDescriptionTexts(): Promise<string[]> {
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

async function getDescriptionsWithDate(): Promise<
  { text: string; addedDate: string }[]
> {
  try {
    const raw = await AsyncStorage.getItem("savedRoute");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const descriptions = parsed.userDescriptions || [];
    return descriptions.map((d: any) => {
      if (typeof d === "string") return { text: d, addedDate: "未知" };
      return { text: d.text || "", addedDate: d.addedDate || "未知" };
    });
  } catch {
    return [];
  }
}
