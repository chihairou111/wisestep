import HelpPopover from "@/components/HelpPopover";
import ProjectChatOverlay from "@/components/ProjectChatOverlay";
import TaskTimerOverlay from "@/components/TaskTimerOverlay";
import {
  checkAndUpdateAchievements,
  getAchievements,
  initializeAchievements,
  updateAchievements,
  type Achievement,
} from "@/lib/achievements";
import {
  getAIRecommendedTask,
  type RecommendedTask,
} from "@/lib/aiRecommendedTask";
import { getProjectCompletionReview } from "@/lib/completionReview";
import {
  calculateChangePercent,
  getStatusLabelFromIndex,
  getTodayStats,
  getYesterdayIndex,
} from "@/lib/dailyStats";
import { getEvaluationDetail } from "@/lib/evaluationDetail";
import { getTodayFocusHabit, type FocusHabit } from "@/lib/focusHabit";
import { chat, type Message } from "@/lib/api";
import { getInsightCards, type InsightCard } from "@/lib/insightCards";
import { generateProjectTitle } from "@/lib/qwen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { SymbolView } from "expo-symbols";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  MessageCircle,
  RotateCcw,
  Share,
  Sparkles,
  Target,
  Triangle,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import {
  getActivityLog,
  groupActivitiesByDate,
  logActivity,
  type ActivityEntry,
} from "@/lib/activityLog";
import Confetti from "react-native-confetti";

type CompletedProject = {
  question: string;
  subjects: string[];
  completedAt: string;
  totalGoals: number;
  phases?: { title: string; goals: { title: string }[] }[];
};

interface Step5Phase {
  title: string;
  goals: {
    title: string;
    duration?: string;
    detail?: string;
    completed: boolean;
  }[];
}

export default function Dashboard() {
  const router = useRouter();
  const [phases, setPhases] = useState<Step5Phase[]>([]);
  const [activePhaseIndex, setActivePhaseIndex] = useState<number | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<number>>(new Set());
  const [projectQuestion, setProjectQuestion] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [activeTimerGoal, setActiveTimerGoal] = useState<{
    title: string;
    duration?: string;
    detail?: string;
    phaseIndex?: number;
    goalIndex?: number;
  } | null>(null);

  // 今日状态（展示词 + 内部数值）
  const [todayIndex, setTodayIndex] = useState<number | null>(null);
  const [todayStatusText, setTodayStatusText] = useState<string>("未开始");
  const [indexChange, setIndexChange] = useState<{
    percent: number;
    direction: "up" | "down" | "same";
  }>({ percent: 0, direction: "same" });

  // 详情展开状态
  const [indexExpanded, setIndexExpanded] = useState(false);
  const [indexDetail, setIndexDetail] = useState<{
    reason: string;
    advice: string;
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  // 今日重点习性
  const [focusHabit, setFocusHabit] = useState<FocusHabit | null>(null);

  // 洞察卡片
  const [insightCards, setInsightCards] = useState<InsightCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  // 项目完成状态
  const [projectCompleted, setProjectCompleted] = useState(false);
  const [completionReview, setCompletionReview] = useState("");
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const confettiRef = useRef<any>(null);

  // 已完成的项目列表
  const [completedProjects, setCompletedProjects] = useState<
    CompletedProject[]
  >([]);

  // 项目聊天
  const [projectChatOpen, setProjectChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<
    string | undefined
  >(undefined);

  // 每日心情
  const [moodChecked, setMoodChecked] = useState(true); // 是否展示心情卡片（false=展示）

  // 用户画像
  const [userDescriptions, setUserDescriptions] = useState<string[]>([]);
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [descDetails, setDescDetails] = useState<
    { title: string; summary: string }[]
  >([]);
  const [isLoadingDescDetails, setIsLoadingDescDetails] = useState(false);

  // 已完成项目展开
  const [expandedProjectIndex, setExpandedProjectIndex] = useState<
    number | null
  >(null);

  // Mock 菜单
  const [mockMenuOpen, setMockMenuOpen] = useState(false);

  // 重置确认
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // 引导
  const [showGuide, setShowGuide] = useState(false);

  // 活动记录
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);

  // 成就视图
  const [showAchievements, setShowAchievements] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);
  const [unlockedToast, setUnlockedToast] = useState<Achievement | null>(null);
  const unlockedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownUnlockedIds = useRef<Set<string>>(new Set());
  const shareCardRef = useRef<View>(null);

  // AI 推荐任务
  const [recommendedTask, setRecommendedTask] =
    useState<RecommendedTask | null>(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const [recommendedTaskDone, setRecommendedTaskDone] = useState(false);

  // 每日意图（学规划）
  const [dailyIntention, setDailyIntention] = useState<string | null>(null);
  const [intentionAsked, setIntentionAsked] = useState(true); // 默认 true 不显示，加载后判断

  const formatDuration = (d?: string) => {
    if (!d) return "";
    const trimmed = d.trim();
    if (!trimmed) return "";
    if (trimmed.includes("分钟")) return trimmed;
    return `${trimmed} 分钟`;
  };

  const refreshMoodPrompt = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lastMoodDate = await AsyncStorage.getItem("lastMoodDate");
      const pendingRaw = await AsyncStorage.getItem("moodPromptPending");

      // 今天已经回答过，就不再打扰，同时清理 pending
      if (lastMoodDate === today) {
        setMoodChecked(true);
        if (pendingRaw) AsyncStorage.removeItem("moodPromptPending");
        return;
      }

      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          if (pending?.date === today) {
            setMoodChecked(false);
            return;
          }
          // 过期 pending 清理掉
          AsyncStorage.removeItem("moodPromptPending");
        } catch {
          AsyncStorage.removeItem("moodPromptPending");
        }
      }

      // 默认不主动问（等 AI 触发）
      setMoodChecked(true);
    } catch {}
  };

  // 任务完成 toast
  const [completionToast, setCompletionToast] = useState<string | null>(null);
  const completionToastOpacity = useRef(new Animated.Value(0)).current;
  const completionToastTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // 检测新解锁的成就（用 ref 而非 state 对比，避免闭包过期）
  const handleAchievementsUpdate = (
    newList: Achievement[],
    showToast: boolean = true,
  ) => {
    const newlyUnlocked = showToast
      ? newList.filter((a) => a.unlocked && !knownUnlockedIds.current.has(a.id))
      : [];
    // 更新已知集合
    knownUnlockedIds.current = new Set(
      newList.filter((a) => a.unlocked).map((a) => a.id),
    );
    setAchievements(newList);
    if (newlyUnlocked.length > 0) {
      setUnlockedToast(newlyUnlocked[0]);
      if (unlockedToastTimer.current) clearTimeout(unlockedToastTimer.current);
      unlockedToastTimer.current = setTimeout(
        () => setUnlockedToast(null),
        5000,
      );
    }
  };

  const toggleGoalExpanded = (goalIndex: number) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalIndex)) {
        next.delete(goalIndex);
      } else {
        next.add(goalIndex);
      }
      return next;
    });
  };

  useEffect(() => {
    loadData();
    loadCompletedProjects();
    // 初始化成就数据并检测（首次加载不触发 toast）
    initializeAchievements()
      .then(() => checkAndUpdateAchievements())
      .then((data) => handleAchievementsUpdate(data.achievements, false))
      .catch((e) => console.log("Failed to initialize achievements:", e));
    // 检查是否需要显示引导
    AsyncStorage.getItem("guideDone").then((val) => {
      if (!val) setShowGuide(true);
    });
    // 心情卡片：默认不打扰，只有 AI 判断需要时才提示
    refreshMoodPrompt();
    // 每日意图：检查今天是否已经问过
    const today = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem("dailyIntention").then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.date === today) {
            setDailyIntention(saved.text);
            setIntentionAsked(true);
            return;
          }
        } catch {}
      }
      setIntentionAsked(false);
    });
  }, []);

  // 每次页面获得焦点时刷新
  useFocusEffect(
    useCallback(() => {
      loadIndexData();
      loadFocusHabit();
      loadInsightCards();
      loadRecommendedTask();
      refreshMoodPrompt();
      // 检测成就
      checkAndUpdateAchievements()
        .then((data) => {
          if (data) handleAchievementsUpdate(data.achievements);
        })
        .catch((e) => console.log("Failed to check achievements:", e));
    }, []),
  );

  const loadData = async () => {
    const raw = await AsyncStorage.getItem("savedRoute");
    const parsed = raw ? JSON.parse(raw) : null;
    setPhases(parsed?.phases || []);
    setProjectQuestion(parsed?.question || "");
    setProjectTitle(parsed?.projectTitle || "");
    const descs = (parsed?.userDescriptions || [])
      .map((d: any) => (typeof d === "string" ? d : d.text || ""))
      .filter(Boolean);
    setUserDescriptions(descs);

    if (!parsed?.projectTitle && parsed?.question && !isGeneratingTitle) {
      setIsGeneratingTitle(true);
      try {
        const res = await generateProjectTitle(
          parsed?.subjects || [],
          parsed?.question || "",
        );
        if (res.title) {
          const next = { ...parsed, projectTitle: res.title };
          await AsyncStorage.setItem("savedRoute", JSON.stringify(next));
          setProjectTitle(res.title);
        }
      } finally {
        setIsGeneratingTitle(false);
      }
    }
  };

  const openDescriptionModal = async () => {
    if (userDescriptions.length === 0) return;
    setDescModalOpen(true);
    if (descDetails.length > 0 || isLoadingDescDetails) return;
    setIsLoadingDescDetails(true);
    try {
      const systemPrompt = `你是一个学习助手。下面是用户的学习习性/特点列表。请为每一条生成一个简短说明（1-2句），帮助用户理解该描述的含义和可能的影响。

请严格返回 JSON 数组：
[
  { "title": "原始描述", "summary": "简短说明" }
]`;

      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userDescriptions.join("｜") },
      ];
      const { content, error } = await chat(messages);
      if (error) throw new Error(error);
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((d: any) => ({
            title: typeof d?.title === "string" ? d.title : "",
            summary: typeof d?.summary === "string" ? d.summary : "",
          }))
          .filter((d: any) => d.title);
        setDescDetails(normalized);
      }
    } catch {
      // fallback: show titles only
      setDescDetails(userDescriptions.map((d) => ({ title: d, summary: "" })));
    } finally {
      setIsLoadingDescDetails(false);
    }
  };

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

  const loadIndexData = async () => {
    const stats = await getTodayStats();
    setTodayIndex(stats.index);
    setTodayStatusText(
      stats.statusText ??
        (stats.index !== null ? statusLabelFor(stats.index) : "未开始"),
    );
    // 重置详情，下次展开重新加载（保证数据最新）
    setIndexDetail(null);
    if (indexExpanded) {
      // 如果本来是展开的，需要自动刷新详情
      setIsLoadingDetail(true);
      getEvaluationDetail(stats)
        .then(setIndexDetail)
        .catch(() => {})
        .finally(() => setIsLoadingDetail(false));
    }

    if (stats.index !== null) {
      const yesterdayIdx = await getYesterdayIndex();
      const change = calculateChangePercent(stats.index, yesterdayIdx);
      setIndexChange(change);
    }

  };

  const handleToggleIndexDetail = async () => {
    if (indexExpanded) {
      setIndexExpanded(false);
      return;
    }

    setIndexExpanded(true);
    if (!indexDetail && !isLoadingDetail) {
      setIsLoadingDetail(true);
      try {
        const stats = await getTodayStats();
        const detail = await getEvaluationDetail(stats);
        setIndexDetail(detail);
      } catch (e) {
        console.log("Failed to load evaluation detail", e);
      } finally {
        setIsLoadingDetail(false);
      }
    }
  };

  const loadFocusHabit = async () => {
    try {
      const habit = await getTodayFocusHabit();
      setFocusHabit(habit);
    } catch (e) {
      console.log("Failed to load focus habit", e);
    }
  };

  const loadInsightCards = async () => {
    setIsLoadingCards(true);
    try {
      const cards = await getInsightCards();
      setInsightCards(cards);
    } catch (e) {
      console.log("Failed to load insight cards", e);
    } finally {
      setIsLoadingCards(false);
    }
  };

  const handleMoodSelect = async (mood: "bad" | "ok" | "good") => {
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem("lastMoodDate", today);
    await AsyncStorage.removeItem("moodPromptPending");
    setMoodChecked(true);

    if (mood === "bad") {
      setChatInitialMessage(
        "我今天状态不太好，能根据我的情况帮我调整一下今天的计划吗？",
      );
      setProjectChatOpen(true);
    } else if (mood === "ok") {
      setChatInitialMessage("我今天状态一般，有什么建议能让我更高效一点吗？");
      setProjectChatOpen(true);
    }
    // mood === "good" → 直接关闭，不触发聊天
  };

  const showCompletionToast = (taskTitle: string) => {
    if (completionToastTimer.current)
      clearTimeout(completionToastTimer.current);
    setCompletionToast(taskTitle);
    completionToastOpacity.setValue(0);
    Animated.timing(completionToastOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    completionToastTimer.current = setTimeout(() => {
      Animated.timing(completionToastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setCompletionToast(null));
    }, 3000);
  };

  const loadRecommendedTask = async (intention?: string) => {
    setIsLoadingRecommendation(true);
    try {
      const task = await getAIRecommendedTask(intention || dailyIntention || undefined);
      setRecommendedTask(task);
    } catch (e) {
      console.log("Failed to load recommended task", e);
    } finally {
      setIsLoadingRecommendation(false);
    }
  };

  const loadCompletedProjects = async () => {
    try {
      const raw = await AsyncStorage.getItem("completedProjects");
      if (raw) setCompletedProjects(JSON.parse(raw));
    } catch {}
  };

  // 检测整个项目是否全部完成
  useEffect(() => {
    if (phases.length === 0 || projectCompleted) return;
    const totalGoals = phases.reduce((sum, p) => sum + p.goals.length, 0);
    if (totalGoals === 0) return;
    const allDone = phases.every((p) => p.goals.every((g) => g.completed));
    if (allDone) {
      setProjectCompleted(true);
      setIsLoadingReview(true);
      getProjectCompletionReview()
        .then((r) => setCompletionReview(r.review))
        .catch(() =>
          setCompletionReview("这个项目你坚持到了最后，这本身就很了不起。"),
        )
        .finally(() => {
          setIsLoadingReview(false);
          requestAnimationFrame(() => {
            confettiRef.current?.startConfetti?.();
          });
        });
      // 检测成就（项目完成相关）
      checkAndUpdateAchievements()
        .then((data) => handleAchievementsUpdate(data.achievements))
        .catch((e) => console.log("Failed to check achievements:", e));
    }
  }, [phases, projectCompleted]);

  const handleStartNewProject = async () => {
    // 保存当前项目到已完成列表
    try {
      const raw = await AsyncStorage.getItem("savedRoute");
      if (raw) {
        const parsed = JSON.parse(raw);
        const project: CompletedProject = {
          question: parsed.question || "未命名项目",
          subjects: parsed.subjects || [],
          completedAt: new Date().toISOString().slice(0, 10),
          totalGoals: stats.total,
          phases: (parsed.phases || []).map((p: any) => ({
            title: p.title,
            goals: (p.goals || []).map((g: any) => ({ title: g.title })),
          })),
        };
        const existing = [...completedProjects, project];
        await AsyncStorage.setItem(
          "completedProjects",
          JSON.stringify(existing),
        );
        setCompletedProjects(existing);
      }
    } catch {}

    // 清除当前项目数据，但保留 completedProjects
    await AsyncStorage.multiRemove([
      "savedRoute",
      "dailyStats",
      "indexHistory",
      "focusHabit",
      "selectedSubjects",
      "userQuestion",
    ]);
    confettiRef.current?.stopConfetti?.();
    router.replace("/" as any);
  };

  const handleReset = () => {
    setResetConfirmOpen(true);
  };

  const confirmReset = async () => {
    setResetConfirmOpen(false);
    // 清除所有 storage
    await AsyncStorage.multiRemove([
      "savedRoute",
      "dailyStats",
      "indexHistory",
      "focusHabit",
      "selectedSubjects",
      "userQuestion",
      "achievements",
      "activityLog",
      "completedProjects",
      "guideDone",
      "lastMoodDate",
      "moodPromptPending",
    ]);
    router.replace("/" as any);
  };

  const handleMockHistory = async () => {
    setMockMenuOpen(false);
    const today = new Date();
    const mockHistory: { date: string; index: number }[] = [];
    for (let i = 7; i >= 1; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const index = Math.floor(Math.random() * 6) + 4; // 4-9
      mockHistory.push({ date, index });
    }
    await AsyncStorage.setItem("indexHistory", JSON.stringify(mockHistory));
    loadIndexData();
  };

  const handleMockAddDescription = async () => {
    setMockMenuOpen(false);
    try {
      const raw = await AsyncStorage.getItem("savedRoute");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const descriptions = parsed.userDescriptions || [];
      const today = new Date().toISOString().slice(0, 10);
      const nextDesc = {
        text: "容易分心",
        addedDate: today,
      };
      const exists = descriptions.some((d: any) =>
        typeof d === "string" ? d === nextDesc.text : d.text === nextDesc.text,
      );
      if (!exists) {
        descriptions.push(nextDesc);
        parsed.userDescriptions = descriptions;
        await AsyncStorage.setItem("savedRoute", JSON.stringify(parsed));
        setUserDescriptions(
          descriptions.map((d: any) =>
            typeof d === "string" ? d : d.text || "",
          ),
        );
      }
    } catch (e) {
      console.log("Failed to add mock description:", e);
    }
  };

  const handleCompleteAllTasks = async () => {
    setMockMenuOpen(false);
    try {
      const raw = await AsyncStorage.getItem("savedRoute");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.phases)) return;

      // 标记所有任务为已完成
      parsed.phases.forEach((phase: any) => {
        if (Array.isArray(phase.goals)) {
          phase.goals.forEach((goal: any) => {
            goal.completed = true;
          });
        }
      });

      await AsyncStorage.setItem("savedRoute", JSON.stringify(parsed));
      setPhases(parsed.phases);
      // 刷新相关数据
      loadIndexData();
      loadInsightCards();
    } catch (e) {
      console.log("Failed to complete all tasks:", e);
    }
  };

  const handleMockUnlockAchievement = async () => {
    setMockMenuOpen(false);
    try {
      const data = await getAchievements();
      if (!data) return;
      const locked = data.achievements.find((a) => !a.unlocked);
      if (!locked) return;
      locked.unlocked = true;
      locked.unlockedAt = new Date().toISOString().split("T")[0];
      if (locked.target) locked.progress = locked.target;
      await updateAchievements(data);
      handleAchievementsUpdate(data.achievements);
    } catch (e) {
      console.log("Failed to mock unlock achievement:", e);
    }
  };

  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    phases.forEach((p) => {
      p.goals.forEach((g) => {
        total++;
        if (g.completed) done++;
      });
    });
    return {
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }, [phases]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      {projectCompleted && <Confetti ref={confettiRef} duration={3000} />}

      {/* 1. Header: 极简标题栏 */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Pressable
            onPress={() => setShowAchievements(false)}
            style={styles.headerTab}
          >
            <Text
              style={[
                styles.headerTabText,
                !showAchievements && styles.headerTabTextActive,
              ]}
            >
              主页
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowAchievements(true)}
            style={styles.headerTab}
          >
            <Text
              style={[
                styles.headerTabText,
                showAchievements && styles.headerTabTextActive,
              ]}
            >
              成就
            </Text>
          </Pressable>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.mockMenuContainer}>
            <Pressable
              onPress={() => setMockMenuOpen(!mockMenuOpen)}
              style={styles.mockBtn}
            >
              <Text style={styles.mockBtnText}>调试</Text>
            </Pressable>
            {mockMenuOpen && (
              <View style={styles.mockMenu}>
                <Pressable
                  style={styles.mockMenuItem}
                  onPress={handleMockHistory}
                >
                  <Text style={styles.mockMenuItemText}>加数据</Text>
                </Pressable>
                <View style={styles.mockMenuDivider} />
                <Pressable
                  style={styles.mockMenuItem}
                  onPress={handleMockAddDescription}
                >
                  <Text style={styles.mockMenuItemText}>加描述</Text>
                </Pressable>
                <View style={styles.mockMenuDivider} />
                <Pressable
                  style={styles.mockMenuItem}
                  onPress={handleCompleteAllTasks}
                >
                  <Text style={styles.mockMenuItemText}>完成所有任务</Text>
                </Pressable>
                <View style={styles.mockMenuDivider} />
                <Pressable
                  style={styles.mockMenuItem}
                  onPress={handleMockUnlockAchievement}
                >
                  <Text style={styles.mockMenuItemText}>解锁成就</Text>
                </Pressable>
                <View style={styles.mockMenuDivider} />
                <Pressable
                  style={styles.mockMenuItem}
                  onPress={() => {
                    setMockMenuOpen(false);
                    AsyncStorage.removeItem("guideDone").then(() => {
                      setShowGuide(true);
                    });
                  }}
                >
                  <Text style={styles.mockMenuItemText}>重置引导</Text>
                </Pressable>
                <View style={styles.mockMenuDivider} />
                <Pressable
                  style={styles.mockMenuItem}
                  onPress={async () => {
                    setMockMenuOpen(false);
                    const today = new Date().toISOString().slice(0, 10);
                    await AsyncStorage.removeItem("lastMoodDate");
                    await AsyncStorage.setItem(
                      "moodPromptPending",
                      JSON.stringify({
                        date: today,
                        timestamp: new Date().toISOString(),
                        reason: "debug",
                      }),
                    );
                    setMoodChecked(false);
                  }}
                >
                  <Text style={styles.mockMenuItemText}>重置心情</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Pressable onPress={handleReset} style={styles.iconBtn}>
            <RotateCcw size={18} color="#525252" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showAchievements ? (
          <View style={styles.achievementsView}>
            {/* 已获得的成就 */}
            {achievements.filter((a) => a.unlocked).length > 0 && (
              <>
                <Text style={styles.achievementSectionTitle}>已获得</Text>
                <View style={styles.achievementGrid}>
                  {achievements
                    .filter((a) => a.unlocked)
                    .sort((a, b) =>
                      (b.unlockedAt || "").localeCompare(a.unlockedAt || ""),
                    )
                    .map((achievement) => (
                      <Pressable
                        key={achievement.id}
                        style={({ pressed }) => [
                          styles.achievementCard,
                          styles.achievementCardUnlocked,
                          achievement.rarity === "legendary" &&
                            styles.rarityBgLegendary,
                          achievement.rarity === "epic" && styles.rarityBgEpic,
                          achievement.rarity === "rare" && styles.rarityBgRare,
                          achievement.rarity === "common" &&
                            styles.rarityBgCommon,
                          pressed && styles.achievementCardPressed,
                        ]}
                        onPress={() => setSelectedAchievement(achievement)}
                      >
                        <Text style={styles.achievementEmoji}>
                          {achievement.icon}
                        </Text>
                        <Text style={styles.achievementTitle} numberOfLines={1}>
                          {achievement.title}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </>
            )}

            {/* 未获得的成就 */}
            {achievements.filter((a) => !a.unlocked).length > 0 && (
              <>
                <Text
                  style={[
                    styles.achievementSectionTitle,
                    {
                      marginTop:
                        achievements.filter((a) => a.unlocked).length > 0
                          ? 20
                          : 0,
                    },
                  ]}
                >
                  未获得
                </Text>
                <View style={styles.achievementGrid}>
                  {achievements
                    .filter((a) => !a.unlocked)
                    .sort((a, b) => {
                      const aProgress = a.target ? a.progress / a.target : 0;
                      const bProgress = b.target ? b.progress / b.target : 0;
                      if (bProgress !== aProgress) return bProgress - aProgress;
                      return 0;
                    })
                    .map((achievement) => {
                      const hasProgress = achievement.progress > 0;
                      const progressPercent = achievement.target
                        ? Math.min(
                            (achievement.progress / achievement.target) * 100,
                            100,
                          )
                        : 0;
                      return (
                        <Pressable
                          key={achievement.id}
                          style={({ pressed }) => [
                            styles.achievementCard,
                            styles.achievementCardLocked,
                            pressed && styles.achievementCardPressed,
                          ]}
                          onPress={() => setSelectedAchievement(achievement)}
                        >
                          <Text
                            style={[
                              styles.achievementEmoji,
                              !hasProgress && styles.achievementEmojiLocked,
                            ]}
                          >
                            {achievement.icon}
                          </Text>
                          <Text
                            style={[
                              styles.achievementTitle,
                              styles.achievementTitleLocked,
                            ]}
                            numberOfLines={1}
                          >
                            {achievement.title}
                          </Text>
                          {achievement.target && achievement.target > 0 && (
                            <View style={styles.achievementProgressContainer}>
                              <View style={styles.achievementProgressBar}>
                                <View
                                  style={[
                                    styles.achievementProgressFill,
                                    { width: `${progressPercent}%` },
                                    hasProgress &&
                                      styles.achievementProgressFillActive,
                                  ]}
                                />
                              </View>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                </View>
              </>
            )}

            {achievements.length === 0 && (
              <View style={styles.achievementEmpty}>
                <Text style={styles.achievementEmptyText}>暂无成就数据</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* 2. Stats Strip: 紧凑的数据条 */}
            <View style={styles.statsStrip}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>总任务</Text>
                <Text style={styles.statValue}>{stats.total}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>已完成</Text>
                <Text style={styles.statValue}>{stats.done}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>进度</Text>
                <Text style={styles.statValue}>{stats.percent}%</Text>
              </View>
            </View>

            {/* 每日心情检查 */}
            {!moodChecked && !projectCompleted && (
              <View style={styles.moodCard}>
                <Text style={styles.moodQuestion}>今天状态怎么样？</Text>
                <View style={styles.moodOptions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.moodButton,
                      styles.moodButtonBad,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleMoodSelect("bad")}
                  >
                    <Text style={styles.moodButtonTextBad}>不太好</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.moodButton,
                      styles.moodButtonOk,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleMoodSelect("ok")}
                  >
                    <Text style={styles.moodButtonTextOk}>还行</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.moodButton,
                      styles.moodButtonGood,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleMoodSelect("good")}
                  >
                    <Text style={styles.moodButtonTextGood}>状态很好</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* 首次使用提示 */}
            {showGuide && (
              <View style={styles.firstTimeHint}>
                <Text style={styles.firstTimeHintText}>
                  点击下方「
                  <Text style={styles.firstTimeHintBold}>学习阶段</Text>
                  」卡片，开始工作吧
                </Text>
              </View>
            )}

            {/* 当前项目概览 */}
            {(projectTitle || projectQuestion) ? (
              <View style={styles.projectOverviewCard}>
                <View style={styles.projectOverviewGradient}>
                  <Text style={styles.projectOverviewLabel}>当前项目</Text>
                  <Text style={styles.projectOverviewTitle}>
                    {projectTitle || projectQuestion}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* 每日意图 */}
            {!projectCompleted && !intentionAsked && phases.length > 0 && (
              <View style={styles.intentionCard}>
                <Text style={styles.intentionLabel}>今天想推进哪块？</Text>
                <View style={styles.intentionChips}>
                  {phases
                    .filter((p) => p.goals.some((g) => !g.completed))
                    .map((p, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [
                          styles.intentionChip,
                          pressed && { opacity: 0.7 },
                        ]}
                        onPress={() => {
                          const today = new Date().toISOString().slice(0, 10);
                          setDailyIntention(p.title);
                          setIntentionAsked(true);
                          AsyncStorage.setItem(
                            "dailyIntention",
                            JSON.stringify({ date: today, text: p.title }),
                          );
                          loadRecommendedTask(p.title);
                        }}
                      >
                        <Text style={styles.intentionChipText}>{p.title}</Text>
                      </Pressable>
                    ))}
                  <Pressable
                    style={({ pressed }) => [
                      styles.intentionChipSkip,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      setIntentionAsked(true);
                      AsyncStorage.setItem(
                        "dailyIntention",
                        JSON.stringify({ date: today, text: "" }),
                      );
                    }}
                  >
                    <Text style={styles.intentionChipSkipText}>随便</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* AI 推荐任务卡片 */}

            {/* 全部完成提示 */}
            {!projectCompleted &&
              !recommendedTask &&
              stats.total > 0 &&
              stats.done === stats.total && (
                <View style={styles.allDoneCard}>
                  <CheckCircle2 size={18} color="#15803D" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.allDoneTitle}>今日任务已全部完成</Text>
                    <Text style={styles.allDoneSubtitle}>
                      干得漂亮，可以开始新项目或休息一下。
                    </Text>
                  </View>
                </View>
              )}

            {!projectCompleted &&
              recommendedTask &&
              (recommendedTaskDone ? (
                <View style={styles.recommendationCard}>
                  <LinearGradient
                    colors={["#F0FDF4", "#DCFCE7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.recommendationGradient}
                  >
                    <View style={styles.recDoneRow}>
                      <CheckCircle2 size={20} color="#15803D" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recDoneTitle}>完成了推荐任务</Text>
                        <Text style={styles.recDoneSubtitle}>
                          正在为你生成下一个推荐...
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.recommendationCard,
                    pressed && styles.cardTapFeedback,
                  ]}
                  onPress={() => {
                    // 在 phases 中找到匹配的任务，直接开始计时
                    let found = false;
                    let fallbackPhase: number | null = null;
                    for (let pi = 0; pi < phases.length && !found; pi++) {
                      for (let gi = 0; gi < phases[pi].goals.length && !found; gi++) {
                        const goal = phases[pi].goals[gi];
                        if (!goal.completed && fallbackPhase === null) {
                          fallbackPhase = pi;
                        }
                        if (!goal.completed && goal.title === recommendedTask.task) {
                          found = true;
                          setActiveTimerGoal({
                            title: goal.title,
                            duration: goal.duration,
                            detail: goal.detail,
                            phaseIndex: pi,
                            goalIndex: gi,
                          });
                        }
                      }
                    }
                    // 如果没找到精确匹配，打开对应阶段
                    if (!found && typeof recommendedTask.phaseIndex === "number") {
                      setActivePhaseIndex(recommendedTask.phaseIndex);
                    } else if (!found && fallbackPhase !== null) {
                      setActivePhaseIndex(fallbackPhase);
                    }
                  }}
                >
                  <LinearGradient
                    colors={["#F0FDF4", "#ECFDF5", "#FFFFFF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.recommendationGradient}
                  >
                    {/* 顶部标签 */}
                    <View style={styles.recHeader}>
                      <View style={styles.recBadge}>
                        <Sparkles size={12} color="#15803D" />
                        <Text style={styles.recBadgeText}>AI 推荐</Text>
                      </View>
                      <HelpPopover text="AI 会根据你的进度、状态和成就，推荐当前最值得做的任务。点击即可开始。" />
                    </View>

                    {/* headline — 最醒目的激励句 */}
                    <Text style={styles.recHeadline} numberOfLines={2}>
                      {recommendedTask.headline}
                    </Text>

                    {/* task — 具体行动 */}
                    <Text style={styles.recTask} numberOfLines={1}>
                      {recommendedTask.task}
                    </Text>

                    {/* reason — 自然语言说明收益 */}
                    {recommendedTask.reason ? (
                      <Text style={styles.recReason} numberOfLines={2}>
                        {recommendedTask.reason}
                      </Text>
                    ) : null}
                  </LinearGradient>
                </Pressable>
              ))}

            {/* 项目完成祝贺卡片 */}
            {projectCompleted ? (
              <View style={styles.completionCard}>
                <View style={styles.completionHeader}>
                  <Text style={styles.completionEmoji}>🎉</Text>
                  <Text style={styles.completionTitle}>项目已完成</Text>
                  <Text style={styles.completionSubtitle}>
                    所有 {stats.total} 个任务已完成
                  </Text>
                </View>

                <View style={styles.completionReviewCard}>
                  {isLoadingReview ? (
                    <ActivityIndicator size="small" color="#737373" />
                  ) : (
                    <Text style={styles.completionReviewText}>
                      {completionReview}
                    </Text>
                  )}
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.newProjectButton,
                    pressed && styles.newProjectButtonPressed,
                  ]}
                  onPress={handleStartNewProject}
                >
                  <Text style={styles.newProjectButtonText}>开始新项目</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* 3. 今日状态卡片 */}
                <Pressable
                  style={({ pressed }) => [
                    styles.indexCard,
                    pressed && styles.cardTapFeedback,
                  ]}
                  onPress={
                    todayIndex !== null ? handleToggleIndexDetail : undefined
                  }
                  disabled={todayIndex === null}
                >
                  <View style={styles.indexHeaderRow}>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text style={styles.indexCardTitle}>今日状态</Text>
                      <HelpPopover text="今日状态是一个简短的状态词和状态条，反映你当天的学习节奏，不以分数驱动。" />
                    </View>
                    {todayIndex !== null && (
                      <View style={styles.expandIcon}>
                        {indexExpanded ? (
                          <ChevronUp size={16} color="#A3A3A3" />
                        ) : (
                          <ChevronDown size={16} color="#A3A3A3" />
                        )}
                      </View>
                    )}
                  </View>

                  {todayIndex !== null ? (
                    <>
                      <Text style={styles.indexValue}>{todayStatusText}</Text>
                      <View style={styles.indexBarContainer}>
                        <View style={styles.indexBarBg}>
                          <LinearGradient
                            colors={["#EF4444", "#F59E0B", "#22C55E"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.indexBarFill,
                              {
                                width: `${(todayIndex / 10) * 100}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={styles.indexChangeRow}>
                        <Triangle
                          size={14}
                          color={
                            indexChange.direction === "up"
                              ? "#22C55E"
                              : indexChange.direction === "down"
                                ? "#EF4444"
                                : "#A3A3A3"
                          }
                          fill={
                            indexChange.direction === "up"
                              ? "#22C55E"
                              : indexChange.direction === "down"
                                ? "#EF4444"
                                : "#A3A3A3"
                          }
                          style={
                            indexChange.direction === "down"
                              ? { transform: [{ rotate: "180deg" }] }
                              : undefined
                          }
                        />
                        <Text
                          style={[
                            styles.indexChangeText,
                            indexChange.direction === "up" && {
                              color: "#22C55E",
                            },
                            indexChange.direction === "down" && {
                              color: "#EF4444",
                            },
                          ]}
                        >
                          {indexChange.direction === "up"
                            ? "较昨日更顺"
                            : indexChange.direction === "down"
                              ? "较昨日偏弱"
                              : "与昨日相近"}
                        </Text>
                      </View>

                      {indexExpanded && (
                        <View style={styles.indexDetailContainer}>
                          {isLoadingDetail ? (
                            <ActivityIndicator size="small" color="#737373" />
                          ) : indexDetail ? (
                            <View style={styles.detailContent}>
                              <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>说明：</Text>
                                <Text style={styles.detailText}>
                                  {indexDetail.reason}
                                </Text>
                              </View>
                              <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>建议：</Text>
                                <Text style={styles.detailText}>
                                  {indexDetail.advice}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <Text style={styles.errorText}>加载失败</Text>
                          )}
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.indexEmpty}>
                      <Text style={styles.indexEmptyText}>
                        完成第一个任务后生成状态
                      </Text>
                    </View>
                  )}
                </Pressable>

                {/* 4. 今日重点习性 */}
                {focusHabit && (
                  <View
                    style={[
                      styles.focusBanner,
                      focusHabit.addressed
                        ? styles.focusBannerAddressed
                        : styles.focusBannerActive,
                    ]}
                  >
                    <View style={styles.focusHeader}>
                      <Target
                        size={16}
                        color={focusHabit.addressed ? "#15803D" : "#B45309"}
                      />
                      <Text
                        style={[
                          styles.focusLabel,
                          focusHabit.addressed
                            ? styles.focusLabelAddressed
                            : styles.focusLabelActive,
                        ]}
                      >
                        {focusHabit.addressed
                          ? "今日重点 · 已突破"
                          : "今日重点"}
                      </Text>
                      <HelpPopover text="AI 识别出的你最需要改进的习性。在做任务时刻意练习，完成后可标记为已突破。" />
                    </View>
                    <Text
                      style={[
                        styles.focusText,
                        focusHabit.addressed && styles.focusTextAddressed,
                      ]}
                    >
                      {focusHabit.text}
                    </Text>
                    {!focusHabit.addressed && (
                      <Text style={styles.focusHint}>
                        试着在下一个任务中刻意针对这条习性练习
                      </Text>
                    )}
                  </View>
                )}

                {/* 5. 洞察卡片 */}
                {insightCards.length > 0 && (
                  <View style={styles.insightSection}>
                    {insightCards.map((card) => (
                      <View
                        key={card.id}
                        style={[
                          styles.insightCard,
                          card.type === "motivation"
                            ? styles.insightCardMotivation
                            : styles.insightCardWarning,
                        ]}
                      >
                        <View style={styles.insightCardHeader}>
                          {card.type === "motivation" ? (
                            <Sparkles size={16} color="#15803D" />
                          ) : (
                            <AlertTriangle size={16} color="#EA580C" />
                          )}
                          <Text
                            style={[
                              styles.insightCardTitle,
                              card.type === "motivation"
                                ? styles.insightTitleMotivation
                                : styles.insightTitleWarning,
                            ]}
                          >
                            {card.title}
                          </Text>
                        </View>
                        <Text style={styles.insightCardFact}>{card.fact}</Text>
                        <Text
                          style={[
                            styles.insightCardAction,
                            card.type === "motivation"
                              ? styles.insightActionMotivation
                              : styles.insightActionWarning,
                          ]}
                        >
                          {card.action}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 6. Compact List: 紧凑列表 */}
                <View style={styles.listWrapper}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      style={[styles.listSectionTitle, { marginBottom: 0 }]}
                    >
                      学习阶段
                    </Text>
                    <HelpPopover text="你的学习计划被拆分成多个阶段，每个阶段包含若干任务。点击任一阶段即可查看并开始其中的任务。" />
                  </View>
                  <View style={styles.listContainer}>
                    {phases.map((item, index) => {
                      const phaseTotal = item.goals.length;
                      const phaseDone = item.goals.filter(
                        (g) => g.completed,
                      ).length;
                      const isFinished =
                        phaseTotal > 0 && phaseTotal === phaseDone;

                      return (
                        <Pressable
                          key={index}
                          style={({ pressed }) => [
                            styles.card,
                            pressed && styles.cardPressed,
                          ]}
                          onPress={() => {
                            setActivePhaseIndex(index);
                          }}
                        >
                          {/* 左侧：序号 + 标题 */}
                          <View style={styles.cardLeft}>
                            <Text style={styles.indexNum}>
                              {String(index + 1).padStart(2, "0")}
                            </Text>
                            <View>
                              <Text style={styles.cardTitle}>{item.title}</Text>
                              {/* 简单的进度条 */}
                              <View style={styles.miniBarBg}>
                                <View
                                  style={[
                                    styles.miniBarFill,
                                    {
                                      width: `${phaseTotal ? (phaseDone / phaseTotal) * 100 : 0}%`,
                                    },
                                    isFinished && {
                                      backgroundColor: "#171717",
                                    }, // 完成变黑
                                  ]}
                                />
                              </View>
                            </View>
                          </View>

                          {/* 右侧：状态 */}
                          <View style={styles.cardRight}>
                            <Text style={styles.fractionText}>
                              {phaseDone}/{phaseTotal}
                            </Text>
                            {isFinished ? (
                              <CheckCircle2 size={18} color="#171717" />
                            ) : (
                              <ChevronRight size={18} color="#D4D4D4" />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 成就进度 */}
                {achievements.filter((a) => !a.unlocked && a.progress > 0)
                  .length > 0 && (
                  <View style={styles.achievementProgressSection}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <Text
                        style={[
                          styles.achievementProgressSectionTitle,
                          { marginBottom: 0 },
                        ]}
                      >
                        成就进度
                      </Text>
                      <HelpPopover text="完成特定条件即可解锁成就。这里显示距离解锁最近的成就和当前进度。" />
                    </View>
                    {achievements
                      .filter((a) => !a.unlocked && a.progress > 0)
                      .sort((a, b) => {
                        const aP = a.target ? a.progress / a.target : 0;
                        const bP = b.target ? b.progress / b.target : 0;
                        return bP - aP;
                      })
                      .slice(0, 3)
                      .map((a) => {
                        const pct = a.target
                          ? Math.min((a.progress / a.target) * 100, 100)
                          : 0;
                        return (
                          <View
                            key={a.id}
                            style={styles.achievementProgressRow}
                          >
                            <Text style={styles.achievementProgressRowEmoji}>
                              {a.icon}
                            </Text>
                            <View style={styles.achievementProgressRowInfo}>
                              <View style={styles.achievementProgressRowHeader}>
                                <Text
                                  style={styles.achievementProgressRowTitle}
                                >
                                  {a.title}
                                </Text>
                                <Text style={styles.achievementProgressRowNum}>
                                  {a.progress}/{a.target}
                                </Text>
                              </View>
                              <View style={styles.achievementProgressRowBar}>
                                <View
                                  style={[
                                    styles.achievementProgressRowFill,
                                    { width: `${pct}%` },
                                  ]}
                                />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                  </View>
                )}
              </>
            )}
            {/* 7. 已完成的项目 */}
            {completedProjects.length > 0 && (
              <View style={styles.pastProjectsSection}>
                <Text style={styles.pastProjectsTitle}>已完成的项目</Text>
                {completedProjects.map((p, i) => {
                  const isExpanded = expandedProjectIndex === i;
                  return (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [
                        styles.pastProjectCard,
                        pressed && !isExpanded && { opacity: 0.7 },
                      ]}
                      onPress={() =>
                        setExpandedProjectIndex(isExpanded ? null : i)
                      }
                    >
                      <View style={styles.pastProjectHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pastProjectName}>
                            {p.question}
                          </Text>
                          <View style={styles.pastProjectMeta}>
                            <Text style={styles.pastProjectDate}>
                              {p.completedAt}
                            </Text>
                            <Text style={styles.pastProjectGoals}>
                              {p.totalGoals} 个任务
                            </Text>
                          </View>
                        </View>
                        {isExpanded ? (
                          <ChevronUp size={16} color="#A3A3A3" />
                        ) : (
                          <ChevronRight size={16} color="#A3A3A3" />
                        )}
                      </View>
                      {isExpanded && (
                        <View style={styles.pastProjectDetail}>
                          {p.phases && p.phases.length > 0 ? (
                            p.phases.map((phase, pi) => (
                              <View key={pi} style={styles.pastPhaseItem}>
                                <Text style={styles.pastPhaseTitle}>
                                  {String(pi + 1).padStart(2, "0")}  {phase.title}
                                </Text>
                                {phase.goals.map((g, gi) => (
                                  <View key={gi} style={styles.pastGoalRow}>
                                    <CheckCircle2 size={12} color="#A3A3A3" />
                                    <Text style={styles.pastGoalText}>
                                      {g.title}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ))
                          ) : (
                            <View style={styles.pastPhaseItem}>
                              <Text style={styles.pastGoalText}>
                                共 {p.totalGoals} 个任务 · {p.subjects?.join("、") || "无科目信息"}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* 你的描述卡片（入口） */}
        {userDescriptions.length > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.profileCard,
              pressed && { opacity: 0.9 },
            ]}
            onPress={openDescriptionModal}
          >
            <Text style={styles.profileCardTitle}>你的描述</Text>
            <Text style={styles.profileSummaryText}>
              已记录 {userDescriptions.length} 条描述，点开查看
            </Text>
          </Pressable>
        )}

        {/* 活动记录入口 */}
        <Pressable
          style={({ pressed }) => [
            styles.activityLogButton,
            pressed && styles.activityLogButtonPressed,
          ]}
          onPress={async () => {
            const entries = await getActivityLog();
            setActivityEntries(entries);
            setActivityLogOpen(true);
          }}
        >
          <Clock size={16} color="#737373" />
          <Text style={styles.activityLogButtonText}>活动记录</Text>
          <ChevronRight size={16} color="#A3A3A3" />
        </Pressable>
      </ScrollView>

      <Modal
        visible={activePhaseIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePhaseIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.modalTitle}>
                  {activePhaseIndex !== null
                    ? phases[activePhaseIndex]?.title
                    : ""}
                </Text>
                <HelpPopover text="这里是当前阶段的任务列表。点击“Start”开始计时并进入任务页；完成后会自动记录进度。已完成任务可展开查看详情。" />
              </View>
              <Pressable
                onPress={() => setActivePhaseIndex(null)}
                style={styles.modalCloseButton}
              >
                <X size={18} color="#525252" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalGoalList}
              showsVerticalScrollIndicator={false}
            >
              {activePhaseIndex !== null &&
                phases[activePhaseIndex]?.goals?.map((goal, goalIndex) => {
                  const isExpanded = expandedGoals.has(goalIndex);

                  if (goal.completed) {
                    return (
                      <Pressable
                        key={goalIndex}
                        style={styles.modalGoalItemCompleted}
                        onPress={() => toggleGoalExpanded(goalIndex)}
                      >
                        <View style={styles.modalGoalCompletedHeader}>
                          <CheckCircle2 size={16} color="#15803D" />
                          <Text style={styles.modalGoalTitleCompleted}>
                            {goal.title}
                          </Text>
                          {isExpanded ? (
                            <ChevronDown size={16} color="#A3A3A3" />
                          ) : (
                            <ChevronRight size={16} color="#A3A3A3" />
                          )}
                        </View>
                        {isExpanded && (
                          <View style={styles.modalGoalExpandedContent}>
                            {goal.duration ? (
                              <View style={styles.modalGoalMetaRow}>
                                <Clock size={12} color="#737373" />
                                <Text style={styles.modalGoalMetaText}>
                                  {formatDuration(goal.duration)}
                                </Text>
                              </View>
                            ) : null}
                            {goal.detail ? (
                              <Text style={styles.modalGoalDetail}>
                                {goal.detail}
                              </Text>
                            ) : null}
                          </View>
                        )}
                      </Pressable>
                    );
                  }

                  return (
                    <View key={goalIndex} style={styles.modalGoalItem}>
                      <View style={styles.modalGoalRow}>
                        <Text style={styles.modalGoalIndex}>
                          {String(goalIndex + 1).padStart(2, "0")}
                        </Text>
                        <View style={styles.modalGoalContent}>
                          <View style={styles.modalGoalHeader}>
                            <Text style={styles.modalGoalTitle}>
                              {goal.title}
                            </Text>
                            <Pressable
                              style={styles.startButton}
                              onPress={() => {
                                setActivePhaseIndex(null);
                                setActiveTimerGoal({
                                  title: goal.title,
                                  duration: goal.duration,
                                  detail: goal.detail,
                                  phaseIndex: activePhaseIndex,
                                  goalIndex,
                                });
                              }}
                            >
                              <Text style={styles.startButtonText}>Start</Text>
                            </Pressable>
                          </View>
                          {goal.duration ? (
                            <View style={styles.modalGoalMetaRow}>
                              <Clock size={12} color="#737373" />
                              <Text style={styles.modalGoalMetaText}>
                                {formatDuration(goal.duration)}
                              </Text>
                            </View>
                          ) : null}
                          {goal.detail ? (
                            <Text style={styles.modalGoalDetail}>
                              {goal.detail}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 描述详情 Modal */}
      <Modal
        visible={descModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDescModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>你的描述</Text>
              <Pressable
                onPress={() => setDescModalOpen(false)}
                style={styles.modalCloseButton}
              >
                <X size={18} color="#525252" />
              </Pressable>
            </View>
            {isLoadingDescDetails ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#737373" />
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.descList}
                showsVerticalScrollIndicator={false}
              >
                {descDetails.map((d, i) => (
                  <View key={`${d.title}-${i}`} style={styles.descItem}>
                    <Text style={styles.descTitle}>{d.title}</Text>
                    {d.summary ? (
                      <Text style={styles.descSummary}>{d.summary}</Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Achievement Detail Modal */}
      <Modal
        visible={selectedAchievement !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAchievement(null)}
      >
        <Pressable
          style={styles.achievementModalOverlay}
          onPress={() => setSelectedAchievement(null)}
        >
          <Pressable style={styles.achievementModalContent} onPress={() => {}}>
            {selectedAchievement && (
              <>
                {/* 右上角关闭 */}
                <Pressable
                  style={({ pressed }) => [
                    styles.achievementModalCloseX,
                    pressed && { opacity: 0.5 },
                  ]}
                  onPress={() => setSelectedAchievement(null)}
                  hitSlop={12}
                >
                  <X size={20} color="#A3A3A3" />
                </Pressable>

                <Text style={styles.achievementModalEmoji}>
                  {selectedAchievement.icon}
                </Text>
                <Text style={styles.achievementModalTitle}>
                  {selectedAchievement.title}
                </Text>
                <View
                  style={[
                    styles.achievementModalRarityBadge,
                    selectedAchievement.rarity === "legendary" &&
                      styles.rarityLegendary,
                    selectedAchievement.rarity === "epic" && styles.rarityEpic,
                    selectedAchievement.rarity === "rare" && styles.rarityRare,
                  ]}
                >
                  <Text style={styles.achievementModalRarityText}>
                    {selectedAchievement.rarity === "legendary"
                      ? "传说"
                      : selectedAchievement.rarity === "epic"
                        ? "史诗"
                        : selectedAchievement.rarity === "rare"
                          ? "稀有"
                          : "普通"}
                  </Text>
                </View>
                <Text style={styles.achievementModalDescription}>
                  {selectedAchievement.description}
                </Text>
                {selectedAchievement.unlocked &&
                selectedAchievement.unlockedAt ? (
                  <Text style={styles.achievementModalDate}>
                    完成于 {selectedAchievement.unlockedAt}
                  </Text>
                ) : selectedAchievement.target ? (
                  <View style={styles.achievementModalProgressSection}>
                    <View style={styles.achievementModalProgressBar}>
                      <View
                        style={[
                          styles.achievementModalProgressFill,
                          {
                            width: `${Math.min(
                              (selectedAchievement.progress /
                                selectedAchievement.target) *
                                100,
                              100,
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.achievementModalProgressText}>
                      {selectedAchievement.progress} /{" "}
                      {selectedAchievement.target}
                    </Text>
                  </View>
                ) : null}
                {selectedAchievement.unlocked && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.achievementShareBtn,
                      pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                    ]}
                    onPress={async () => {
                      try {
                        const uri = await captureRef(shareCardRef, {
                          format: "png",
                          quality: 1,
                        });
                        if (Platform.OS === "web") {
                          const link = document.createElement("a");
                          link.href = uri;
                          link.download = `achievement-${selectedAchievement.id}.png`;
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                        } else {
                          await Sharing.shareAsync(uri);
                        }
                      } catch (e) {
                        console.log("Share failed:", e);
                      }
                    }}
                  >
                    {Platform.OS === "ios" ? (
                      <SymbolView
                        name="square.and.arrow.up"
                        size={16}
                        tintColor="#111827"
                      />
                    ) : (
                      <Share size={16} color="#111827" />
                    )}
                    <Text style={styles.achievementShareBtnText}>分享</Text>
                  </Pressable>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 隐藏的分享卡片（用于截图） */}
      {selectedAchievement && selectedAchievement.unlocked && (
        <View style={styles.shareCardWrapper}>
          <View ref={shareCardRef} style={styles.shareCard} collapsable={false}>
            <LinearGradient
              colors={
                selectedAchievement.rarity === "legendary"
                  ? ["#FEF3C7", "#FDE68A"]
                  : selectedAchievement.rarity === "epic"
                    ? ["#EDE9FE", "#DDD6FE"]
                    : selectedAchievement.rarity === "rare"
                      ? ["#DBEAFE", "#BFDBFE"]
                      : ["#F3F4F6", "#E5E7EB"]
              }
              style={styles.shareCardGradient}
            >
              <Text style={styles.shareCardEmoji}>
                {selectedAchievement.icon}
              </Text>
              <Text style={styles.shareCardSlogan}>
                我在智步获得了
              </Text>
              <Text style={styles.shareCardTitle}>
                {selectedAchievement.title}！
              </Text>
              <View
                style={[
                  styles.shareCardRarityBadge,
                  selectedAchievement.rarity === "legendary" && {
                    backgroundColor: "#F59E0B",
                  },
                  selectedAchievement.rarity === "epic" && {
                    backgroundColor: "#171717",
                  },
                  selectedAchievement.rarity === "rare" && {
                    backgroundColor: "#3B82F6",
                  },
                ]}
              >
                <Text style={styles.shareCardRarityText}>
                  {selectedAchievement.rarity === "legendary"
                    ? "传说成就"
                    : selectedAchievement.rarity === "epic"
                      ? "史诗成就"
                      : selectedAchievement.rarity === "rare"
                        ? "稀有成就"
                        : "普通成就"}
                </Text>
              </View>
              <Text style={styles.shareCardDesc}>
                {selectedAchievement.description}
              </Text>
              <View style={styles.shareCardFooter}>
                <View style={styles.shareCardAppInfo}>
                  <View style={styles.shareCardAppIcon}>
                    <Text style={styles.shareCardAppIconText}>🎯</Text>
                  </View>
                  <Text style={styles.shareCardAppName}>My Prototype</Text>
                </View>
                <Text style={styles.shareCardFooterText}>
                  坚持的每一天都算数
                </Text>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}

      {/* Mock Menu Overlay */}
      {mockMenuOpen && (
        <Pressable
          style={styles.mockMenuOverlay}
          onPress={() => setMockMenuOpen(false)}
        />
      )}

      {/* 任务完成 Toast */}
      {completionToast && (
        <Animated.View
          style={[styles.completionToast, { opacity: completionToastOpacity }]}
        >
          <CheckCircle2 size={18} color="#16A34A" />
          <Text style={styles.completionToastText} numberOfLines={1}>
            完成了「{completionToast}」
          </Text>
        </Animated.View>
      )}

      {/* 成就解锁 Toast */}
      {unlockedToast && (
        <Pressable
          style={({ pressed }) => [
            styles.achievementToast,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => {
            const a = unlockedToast;
            setUnlockedToast(null);
            if (unlockedToastTimer.current)
              clearTimeout(unlockedToastTimer.current);
            setShowAchievements(true);
            setTimeout(() => setSelectedAchievement(a), 200);
          }}
        >
          <Text style={styles.achievementToastEmoji}>{unlockedToast.icon}</Text>
          <View style={styles.achievementToastInfo}>
            <Text style={styles.achievementToastLabel}>成就达成!</Text>
            <Text style={styles.achievementToastTitle}>
              {unlockedToast.title}
            </Text>
          </View>
          <Text style={styles.achievementToastArrow}>›</Text>
        </Pressable>
      )}

      {/* Floating Chat Button - 成就 tab 时隐藏 */}
      {!showAchievements && (
        <Pressable
          style={({ pressed }) => [
            styles.floatingChatBtn,
            pressed && styles.floatingChatBtnPressed,
          ]}
          onPress={() => setProjectChatOpen(true)}
        >
          <MessageCircle size={18} color="#FFFFFF" />
          <Text style={styles.floatingChatBtnText}>与 AI 沟通</Text>
        </Pressable>
      )}

      <TaskTimerOverlay
        visible={activeTimerGoal !== null}
        title={activeTimerGoal?.title || ""}
        duration={activeTimerGoal?.duration}
        detail={activeTimerGoal?.detail}
        goalRef={
          typeof activeTimerGoal?.phaseIndex === "number" &&
          typeof activeTimerGoal?.goalIndex === "number"
            ? {
                phaseIndex: activeTimerGoal.phaseIndex,
                goalIndex: activeTimerGoal.goalIndex,
              }
            : undefined
        }
        onClose={(completed?: boolean, elapsedSeconds?: number) => {
          const justFinishedRecommended =
            completed &&
            recommendedTask &&
            activeTimerGoal &&
            recommendedTask.task === activeTimerGoal.title;

          // Log activity
          if (activeTimerGoal) {
            const phaseTitle =
              typeof activeTimerGoal.phaseIndex === "number"
                ? phases[activeTimerGoal.phaseIndex]?.title || ""
                : "";
            logActivity({
              type: completed ? "task_completed" : "task_exited",
              taskTitle: activeTimerGoal.title,
              phaseTitle,
              duration: elapsedSeconds ?? 0,
            });
          }

          // 完成任务 toast
          if (completed && activeTimerGoal) {
            showCompletionToast(activeTimerGoal.title);
          }

          // 用户完成过任务后，不再显示首次提示
          if (showGuide) {
            setShowGuide(false);
            AsyncStorage.setItem("guideDone", "true");
          }

          setActiveTimerGoal(null);
          // 计时器关闭后页面不会重新 focus，这里主动刷新一次心情提示
          refreshMoodPrompt();
          loadIndexData();
          loadData();
          loadFocusHabit();
          loadInsightCards();

          if (justFinishedRecommended) {
            // 标记推荐任务已完成，短暂展示后刷新
            setRecommendedTaskDone(true);
            setTimeout(() => {
              setRecommendedTaskDone(false);
              loadRecommendedTask();
            }, 3000);
          } else {
            loadRecommendedTask();
          }
        }}
      />

      <ProjectChatOverlay
        open={projectChatOpen}
        onOpenChange={(open) => {
          setProjectChatOpen(open);
          if (!open) setChatInitialMessage(undefined);
        }}
        initialMessage={chatInitialMessage}
        onProjectChanged={() => {
          loadData();
          loadIndexData();
          loadInsightCards();
        }}
      />

      {/* 活动记录 Modal */}
      <Modal
        visible={activityLogOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setActivityLogOpen(false)}
      >
        <View style={styles.activityModalOverlay}>
          <View style={styles.activityModalContent}>
            <View style={styles.activityModalHeader}>
              <Text style={styles.activityModalTitle}>活动记录</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setActivityLogOpen(false)}
              >
                <X size={18} color="#525252" />
              </Pressable>
            </View>
            <ScrollView
              style={styles.activityModalScroll}
              showsVerticalScrollIndicator={false}
            >
              {activityEntries.length === 0 ? (
                <View style={styles.activityEmpty}>
                  <Clock size={32} color="#D4D4D4" />
                  <Text style={styles.activityEmptyText}>还没有活动记录</Text>
                  <Text style={styles.activityEmptyHint}>
                    完成任务后会自动记录在这里
                  </Text>
                </View>
              ) : (
                groupActivitiesByDate(activityEntries).map((group) => (
                  <View key={group.date} style={styles.activityDateGroup}>
                    <Text style={styles.activityDateLabel}>{group.label}</Text>
                    {group.entries.map((entry) => {
                      const time = new Date(entry.timestamp);
                      const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
                      const mins = Math.floor(entry.duration / 60);
                      const secs = entry.duration % 60;
                      const durationStr =
                        mins > 0
                          ? `${mins} 分 ${secs > 0 ? `${secs} 秒` : ""}`
                          : `${secs} 秒`;
                      const isCompleted = entry.type === "task_completed";
                      return (
                        <View key={entry.id} style={styles.activityEntry}>
                          <View style={styles.activityEntryLeft}>
                            <View
                              style={[
                                styles.activityDot,
                                isCompleted
                                  ? styles.activityDotCompleted
                                  : styles.activityDotExited,
                              ]}
                            />
                            <View style={styles.activityEntryInfo}>
                              <Text
                                style={styles.activityEntryTitle}
                                numberOfLines={1}
                              >
                                {entry.taskTitle}
                              </Text>
                              {entry.phaseTitle ? (
                                <Text
                                  style={styles.activityEntryPhase}
                                  numberOfLines={1}
                                >
                                  {entry.phaseTitle}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          <View style={styles.activityEntryRight}>
                            <Text style={styles.activityEntryDuration}>
                              {durationStr}
                            </Text>
                            <Text style={styles.activityEntryTime}>
                              {timeStr}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 重置确认对话框 */}
      <Modal
        visible={resetConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResetConfirmOpen(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <Text style={styles.confirmTitle}>重置所有数据</Text>
            <Text style={styles.confirmMessage}>
              确定要清空所有数据吗？包括成就、活动记录等。此操作无法撤销。
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  styles.confirmButtonCancel,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setResetConfirmOpen(false)}
              >
                <Text style={styles.confirmButtonTextCancel}>取消</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  styles.confirmButtonDestruct,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={confirmReset}
              >
                <Text style={styles.confirmButtonTextDestruct}>确定</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  headerTab: {
    paddingVertical: 4,
  },
  headerTabText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#A3A3A3",
    letterSpacing: -0.5,
  },
  headerTabTextActive: {
    color: "#171717",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#171717", // 纯黑灰
    letterSpacing: -0.5,
  },
  iconBtn: {
    padding: 8,
    backgroundColor: "#E5E5E5",
    borderRadius: 8,
  },
  mockMenuContainer: {
    position: "relative",
  },
  mockBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#171717",
    borderRadius: 8,
  },
  mockBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  mockMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 140,
    maxHeight: 300,
    overflowY: "scroll" as any,
    zIndex: 1001,
  },
  mockMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mockMenuItemText: {
    fontSize: 13,
    color: "#171717",
    fontWeight: "500",
  },
  mockMenuDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  mockMenuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  // Stats Strip
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    width: "30%",
  },
  statLabel: {
    fontSize: 11,
    color: "#737373",
    marginBottom: 2,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#171717",
  },
  divider: {
    width: 1,
    height: "60%",
    backgroundColor: "#E5E7EB",
  },
  // First-time hint
  moodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  moodQuestion: {
    fontSize: 15,
    fontWeight: "600",
    color: "#171717",
    marginBottom: 14,
    textAlign: "center",
  },
  moodOptions: {
    flexDirection: "row",
    gap: 10,
  },
  moodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  moodButtonBad: {
    backgroundColor: "#F3F4F6",
  },
  moodButtonOk: {
    backgroundColor: "#F3F4F6",
  },
  moodButtonGood: {
    backgroundColor: "#F3F4F6",
  },
  moodButtonTextBad: {
    fontSize: 13,
    fontWeight: "600",
    color: "#525252",
  },
  moodButtonTextOk: {
    fontSize: 13,
    fontWeight: "600",
    color: "#525252",
  },
  moodButtonTextGood: {
    fontSize: 13,
    fontWeight: "600",
    color: "#525252",
  },
  firstTimeHint: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  firstTimeHintText: {
    fontSize: 13,
    color: "#737373",
    lineHeight: 20,
  },
  firstTimeHintBold: {
    fontWeight: "700",
    color: "#171717",
  },
  // Index Card
  indexCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  indexHeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  indexCardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#737373",
  },
  expandIcon: {
    position: "absolute",
    right: 0,
  },
  indexValue: {
    fontSize: 48,
    fontWeight: "800",
    color: "#171717",
    letterSpacing: -2,
  },
  indexBarContainer: {
    width: "100%",
    marginTop: 12,
    marginBottom: 8,
  },
  indexBarBg: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  indexBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  indexChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  indexChangeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A3A3A3",
  },
  indexDetailContainer: {
    width: "100%",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    minHeight: 80,
    justifyContent: "center",
  },
  detailContent: {
    gap: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#525252",
    width: 45,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: "#525252",
    lineHeight: 18,
  },
  indexChartContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  indexChartLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#737373",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#EF4444",
    textAlign: "center",
  },
  indexEmpty: {
    paddingVertical: 20,
  },
  indexEmptyText: {
    fontSize: 13,
    color: "#A3A3A3",
    textAlign: "center",
  },
  // Focus Habit Banner
  focusBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    gap: 6,
  },
  focusBannerActive: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  focusBannerAddressed: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  focusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  focusLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  focusLabelActive: {
    color: "#B45309",
  },
  focusLabelAddressed: {
    color: "#15803D",
  },
  focusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#171717",
    marginLeft: 24,
  },
  focusTextAddressed: {
    textDecorationLine: "line-through",
    color: "#737373",
  },
  focusHint: {
    fontSize: 12,
    color: "#92400E",
    marginLeft: 24,
    lineHeight: 16,
  },
  // Insight Cards
  insightSection: {
    gap: 10,
    marginBottom: 20,
  },
  insightCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 6,
  },
  insightCardMotivation: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  insightCardWarning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  insightCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insightCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  insightTitleMotivation: {
    color: "#15803D",
  },
  insightTitleWarning: {
    color: "#EA580C",
  },
  insightCardFact: {
    fontSize: 13,
    color: "#525252",
    lineHeight: 18,
    marginLeft: 24,
  },
  insightCardAction: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginLeft: 24,
  },
  insightActionMotivation: {
    color: "#15803D",
  },
  insightActionWarning: {
    color: "#EA580C",
  },
  // List
  listWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 20,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#171717",
    marginBottom: 12,
  },
  listContainer: {
    gap: 0,
  },
  // Intention
  intentionCard: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  intentionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#525252",
    marginBottom: 10,
  },
  intentionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  intentionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  intentionChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#15803D",
  },
  intentionChipSkip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  intentionChipSkipText: {
    fontSize: 13,
    color: "#A3A3A3",
  },
  // All Done Card
  allDoneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  allDoneTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#15803D",
    marginBottom: 2,
  },
  allDoneSubtitle: {
    fontSize: 13,
    color: "#525252",
  },
  // Project Overview Card
  projectOverviewCard: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  projectOverviewGradient: {
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  projectOverviewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 6,
  },
  projectOverviewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F1300",
    lineHeight: 22,
  },
  // Recommendation Card
  recommendationCard: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  recommendationGradient: {
    padding: 16,
  },
  recHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  recBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
  },
  recHeadline: {
    fontSize: 18,
    fontWeight: "800",
    color: "#171717",
    lineHeight: 26,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  recTask: {
    fontSize: 13,
    fontWeight: "600",
    color: "#15803D",
    marginBottom: 4,
  },
  recReason: {
    fontSize: 13,
    color: "#525252",
    lineHeight: 20,
  },
  recDoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recDoneTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#15803D",
  },
  recDoneSubtitle: {
    fontSize: 12,
    color: "#16A34A",
    marginTop: 2,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },
  cardPressed: {
    opacity: 0.6,
  },
  cardTapFeedback: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 12,
  },
  indexNum: {
    fontSize: 13,
    fontFamily: "monospace", // 等宽字体更有极客感
    color: "#A3A3A3",
    fontWeight: "600",
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#171717",
    marginBottom: 4,
  },
  miniBarBg: {
    width: 60,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
  },
  miniBarFill: {
    height: "100%",
    backgroundColor: "#737373", // 中性灰进度条
    borderRadius: 2,
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fractionText: {
    fontSize: 12,
    color: "#737373",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#171717",
  },
  modalCloseButton: {
    padding: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  modalGoalList: {
    gap: 12,
  },
  modalGoalItem: {
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalGoalItemCompleted: {
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    padding: 12,
  },
  modalGoalCompletedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalGoalTitleCompleted: {
    flex: 1,
    fontSize: 14,
    color: "#737373",
    textDecorationLine: "line-through",
  },
  modalGoalExpandedContent: {
    marginTop: 10,
    marginLeft: 26,
    gap: 6,
  },
  modalGoalRow: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  modalGoalIndex: {
    fontSize: 13,
    fontFamily: "monospace",
    color: "#A3A3A3",
    fontWeight: "600",
    marginTop: 2,
  },
  modalGoalContent: {
    flex: 1,
    gap: 6,
  },
  modalGoalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  modalGoalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#171717",
    lineHeight: 20,
  },
  startButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  startButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#171717",
  },
  modalGoalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalGoalMetaText: {
    fontSize: 12,
    color: "#737373",
  },
  modalGoalDetail: {
    fontSize: 13,
    color: "#525252",
    lineHeight: 18,
    marginTop: 2,
  },
  // Completion Screen
  completionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  completionScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  completionHeader: {
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  completionEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#171717",
    letterSpacing: -0.5,
  },
  completionSubtitle: {
    fontSize: 14,
    color: "#737373",
  },
  completionReviewCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 20,
    minHeight: 100,
    justifyContent: "center",
    width: "100%",
  },
  completionReviewText: {
    fontSize: 14,
    color: "#525252",
    lineHeight: 22,
  },
  newProjectButton: {
    backgroundColor: "#171717",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
  },
  newProjectButtonPressed: {
    backgroundColor: "#262626",
  },
  newProjectButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Achievements View
  achievementsView: {
    paddingVertical: 8,
    minHeight: 400,
  },
  achievementSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#A3A3A3",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  achievementCard: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: 8,
    borderWidth: 1,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementCardUnlocked: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
  },
  achievementCardLocked: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F3F4F6",
    borderWidth: 2,
  },
  // 稀有度背景色（淡色）
  rarityBgCommon: {
    backgroundColor: "#E0F2F1", // Teal 50
  },
  rarityBgRare: {
    backgroundColor: "#E3F2FD", // Blue 50
  },
  rarityBgEpic: {
    backgroundColor: "#F3E5F5", // Purple 50
  },
  rarityBgLegendary: {
    backgroundColor: "#FFF8E1", // Amber 50
  },
  achievementCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  achievementEmoji: {
    fontSize: 32,
  },
  achievementEmojiLocked: {
    opacity: 0.3,
  },
  achievementTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#171717",
    textAlign: "center" as const,
  },
  achievementTitleLocked: {
    color: "#B0B0B0",
  },
  achievementProgressContainer: {
    width: "80%",
    marginTop: 2,
  },
  achievementProgressBar: {
    height: 3,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden" as const,
  },
  achievementProgressFill: {
    height: "100%",
    backgroundColor: "#D4D4D4",
    borderRadius: 2,
  },
  achievementProgressFillActive: {
    backgroundColor: "#525252",
  },
  achievementEmpty: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 60,
  },
  achievementEmptyText: {
    fontSize: 14,
    color: "#A3A3A3",
  },
  // 主页成就进度
  achievementProgressSection: {
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    gap: 12,
  },
  achievementProgressSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#171717",
    marginBottom: 2,
  },
  achievementProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  achievementProgressRowEmoji: {
    fontSize: 22,
  },
  achievementProgressRowInfo: {
    flex: 1,
    gap: 4,
  },
  achievementProgressRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  achievementProgressRowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#171717",
  },
  achievementProgressRowNum: {
    fontSize: 12,
    color: "#A3A3A3",
    fontWeight: "500",
  },
  achievementProgressRowBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden" as const,
  },
  achievementProgressRowFill: {
    height: "100%",
    backgroundColor: "#525252",
    borderRadius: 2,
  },
  // 成就解锁 Toast
  completionToast: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  completionToastText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#15803D",
    flex: 1,
  },
  achievementToast: {
    position: "absolute",
    bottom: 96,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171717",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  achievementToastEmoji: {
    fontSize: 28,
  },
  achievementToastInfo: {
    flex: 1,
    gap: 1,
  },
  achievementToastLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A3A3A3",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  achievementToastTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  achievementToastArrow: {
    fontSize: 22,
    color: "#737373",
    fontWeight: "600",
  },
  // Achievement Detail Modal
  achievementModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 24,
  },
  achievementModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 36,
    alignItems: "center" as const,
    width: "100%",
    maxWidth: 340,
    gap: 14,
  },
  achievementModalEmoji: {
    fontSize: 72,
    marginBottom: 4,
  },
  achievementModalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#171717",
    textAlign: "center" as const,
    letterSpacing: -0.3,
  },
  achievementModalRarityBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#A3A3A3",
  },
  rarityLegendary: {
    backgroundColor: "#F59E0B",
  },
  rarityEpic: {
    backgroundColor: "#171717",
  },
  rarityRare: {
    backgroundColor: "#3B82F6",
  },
  achievementModalRarityText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  achievementModalDescription: {
    fontSize: 15,
    color: "#525252",
    lineHeight: 24,
    textAlign: "center" as const,
    marginTop: 4,
  },
  achievementModalDate: {
    fontSize: 13,
    color: "#A3A3A3",
    marginTop: 4,
  },
  achievementModalProgressSection: {
    width: "100%",
    gap: 8,
    marginTop: 4,
  },
  achievementModalProgressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden" as const,
  },
  achievementModalProgressFill: {
    height: "100%",
    backgroundColor: "#525252",
    borderRadius: 4,
  },
  achievementModalProgressText: {
    fontSize: 13,
    color: "#A3A3A3",
    textAlign: "center" as const,
    fontWeight: "500",
  },
  achievementModalCloseX: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  achievementShareBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  achievementShareBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  // 分享卡片（隐藏，用于截图）
  shareCardWrapper: {
    position: "absolute",
    top: -9999,
    left: -9999,
  },
  shareCard: {
    width: 375,
    height: 667, // 9:16 比例
    backgroundColor: "#FFFFFF",
  },
  shareCardGradient: {
    flex: 1,
    padding: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 16,
  },
  shareCardEmoji: {
    fontSize: 100,
    marginBottom: 20,
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  shareCardSlogan: {
    fontSize: 18,
    color: "#525252",
    fontWeight: "600",
    textAlign: "center" as const,
    marginBottom: 4,
  },
  shareCardTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#171717",
    textAlign: "center" as const,
    letterSpacing: -1,
    lineHeight: 44,
  },
  shareCardRarityBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#A3A3A3",
    marginTop: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  shareCardRarityText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  shareCardDesc: {
    fontSize: 18,
    color: "#404040",
    lineHeight: 28,
    textAlign: "center" as const,
    maxWidth: "90%",
  },
  shareCardFooter: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingTop: 20,
  },
  shareCardAppInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shareCardAppIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#171717",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  shareCardAppIconText: {
    fontSize: 24,
  },
  shareCardAppName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#171717",
  },
  shareCardFooterText: {
    fontSize: 14,
    color: "#737373",
    fontWeight: "500",
    marginBottom: 4,
  },
  // Past Projects
  pastProjectsSection: {
    marginTop: 12,
    gap: 10,
  },
  pastProjectsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#737373",
    marginBottom: 4,
  },
  pastProjectCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  pastProjectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pastProjectName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#171717",
    marginBottom: 4,
  },
  pastProjectMeta: {
    flexDirection: "row",
    gap: 12,
  },
  pastProjectDate: {
    fontSize: 12,
    color: "#A3A3A3",
  },
  pastProjectGoals: {
    fontSize: 12,
    color: "#A3A3A3",
  },
  pastProjectDetail: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 12,
  },
  pastPhaseItem: {
    gap: 6,
  },
  pastPhaseTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#525252",
  },
  pastGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
  },
  pastGoalText: {
    fontSize: 12,
    color: "#737373",
    flex: 1,
  },
  // Floating Chat Button
  floatingChatBtn: {
    position: "absolute",
    bottom: 32,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#171717",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  floatingChatBtnPressed: {
    backgroundColor: "#262626",
    transform: [{ scale: 0.96 }],
  },
  floatingChatBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // AI Profile Card
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileCardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A3A3A3",
    marginBottom: 12,
  },
  profileSummaryText: {
    fontSize: 13,
    color: "#525252",
  },
  profileItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  profileDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D4D4D4",
    marginTop: 6,
  },
  profileItemText: {
    fontSize: 13,
    color: "#525252",
    lineHeight: 19,
    flex: 1,
  },
  descList: {
    gap: 12,
    paddingBottom: 8,
  },
  descItem: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  descTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  descSummary: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 19,
  },
  // Activity Log Button
  activityLogButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  activityLogButtonPressed: {
    opacity: 0.6,
  },
  activityLogButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#737373",
  },
  // Activity Log Modal
  activityModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  activityModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 32,
  },
  activityModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  activityModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#171717",
  },
  activityModalScroll: {
    paddingHorizontal: 20,
  },
  activityEmpty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  activityEmptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#A3A3A3",
    marginTop: 4,
  },
  activityEmptyHint: {
    fontSize: 13,
    color: "#D4D4D4",
  },
  activityDateGroup: {
    marginTop: 16,
  },
  activityDateLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#A3A3A3",
    marginBottom: 10,
  },
  activityEntry: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  activityEntryLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityDotCompleted: {
    backgroundColor: "#22C55E",
  },
  activityDotExited: {
    backgroundColor: "#D4D4D4",
  },
  activityEntryInfo: {
    flex: 1,
    gap: 2,
  },
  activityEntryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#171717",
  },
  activityEntryPhase: {
    fontSize: 12,
    color: "#A3A3A3",
  },
  activityEntryRight: {
    alignItems: "flex-end",
    gap: 2,
    marginLeft: 12,
  },
  activityEntryDuration: {
    fontSize: 13,
    fontWeight: "600",
    color: "#525252",
  },
  activityEntryTime: {
    fontSize: 11,
    color: "#A3A3A3",
  },
  // 确认对话框
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 24,
  },
  confirmContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    gap: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#171717",
    textAlign: "center" as const,
  },
  confirmMessage: {
    fontSize: 14,
    color: "#525252",
    lineHeight: 20,
    textAlign: "center" as const,
  },
  confirmButtons: {
    flexDirection: "row" as const,
    gap: 12,
    marginTop: 8,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  confirmButtonCancel: {
    backgroundColor: "#F3F4F6",
  },
  confirmButtonDestruct: {
    backgroundColor: "#EF4444",
  },
  confirmButtonTextCancel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#525252",
  },
  confirmButtonTextDestruct: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
