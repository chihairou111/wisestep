import { chatWithTaskPanel } from "@/lib/chat";
import { incrementCompletedTasks, incrementEarlyExits } from "@/lib/dailyStats";
import {
  classifyExitReason,
  evaluateTodayIndex,
  suggestInterruptionPlan,
  type ExitReasonMeta,
} from "@/lib/indexEvaluator";
import { searchResources, type ResourceCard } from "@/lib/qwen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { ArrowLeft, MessageCircle, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { PortalProvider } from "tamagui";
import * as WebBrowser from "expo-web-browser";
import ChatOverlay from "./ChatOverlay";

/* ─── types ─── */

type TaskTimerOverlayProps = {
  visible: boolean;
  title: string;
  duration?: string;
  detail?: string;
  goalRef?: { phaseIndex: number; goalIndex: number };
  onClose: (completed?: boolean, elapsedSeconds?: number) => void;
};

/* ─── helpers ─── */

const formatElapsed = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/* ─── WebView for Web Platform ─── */

type WebViewForWebProps = {
  url: string;
  style?: any;
  scrollEnabled?: boolean;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
};

function WebViewForWeb({
  url,
  style,
  scrollEnabled = false,
  onLoadStart,
  onLoadEnd,
}: WebViewForWebProps) {
  const viewRef = useRef<any>(null);
  const onLoadStartRef = useRef(onLoadStart);
  const onLoadEndRef = useRef(onLoadEnd);

  // Update refs when callbacks change
  useEffect(() => {
    onLoadStartRef.current = onLoadStart;
    onLoadEndRef.current = onLoadEnd;
  }, [onLoadStart, onLoadEnd]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!viewRef.current || !url) return;

    // @ts-ignore - web only
    const element = viewRef.current;
    // @ts-ignore - web only
    const domNode = element?._node || element?.base || element;
    if (!domNode) return;

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.display = "block";
    iframe.style.pointerEvents = scrollEnabled ? "auto" : "none";
    iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-popups allow-forms");

    const handleLoad = () => {
      onLoadEndRef.current?.();
    };

    const handleError = () => {
      // Silently handle errors (CORS/X-Frame-Options)
      onLoadEndRef.current?.();
    };

    iframe.addEventListener("load", handleLoad);
    iframe.addEventListener("error", handleError);

    onLoadStartRef.current?.();

    domNode.innerHTML = "";
    domNode.appendChild(iframe);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      iframe.removeEventListener("error", handleError);
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  }, [url, scrollEnabled]);

  if (Platform.OS !== "web") {
    return null;
  }

  return <View ref={viewRef} style={[{ flex: 1 }, style]} />;
}

/* ─── enable LayoutAnimation on Android ─── */
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ─── component ─── */

export default function TaskTimerOverlay({
  visible,
  title,
  duration,
  detail,
  goalRef,
  onClose,
}: TaskTimerOverlayProps) {
  const insets = useSafeAreaInsets();

  /* elapsed timer (count UP) */
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  /* resources */
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [searchingResources, setSearchingResources] = useState(false);

  /* focus state */
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

  /* animated focus change */
  const handleFocusCard = (cardId: string | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFocusedCardId(cardId);
  };

  /* WebView loading */
  const [loadingCards, setLoadingCards] = useState<Set<string>>(new Set());

  const [chatOpen, setChatOpen] = useState(false);
  const [initialChatInput, setInitialChatInput] = useState("");
  const [assistantSummary, setAssistantSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  /* business logic */
  const hasCompletedRef = useRef(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [completeMenuOpen, setCompleteMenuOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [interceptOpen, setInterceptOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [interceptPlan, setInterceptPlan] = useState<{
    reason: string;
    continueMinutes: number;
    remainingMinutes: number;
    message: string;
  } | null>(null);
  const pendingExitMetaRef = useRef<ExitReasonMeta | null>(null);

  /* ── init ── */
  useEffect(() => {
    if (!visible) return;
    hasCompletedRef.current = false;
    setElapsedSeconds(0);
    setFocusedCardId(null);
    setExitModalOpen(false);
    setCompleteMenuOpen(false);
    setSelectedReason(null);
    setCustomReason("");
    setInterceptOpen(false);
    setInterceptPlan(null);
    pendingExitMetaRef.current = null;
    setResources([]);

    // AI 搜索资源
    refreshResources();
  }, [visible, title, detail]);

  const refreshResources = (query?: string) => {
    const q = query?.trim() || (detail ? `${title}：${detail}` : title);
    setSearchingResources(true);
    setFocusedCardId(null);
    searchResources(q)
      .then((result) => {
        if (result.resources.length > 0) {
          setResources(result.resources);
        } else {
          setResources([]);
        }
      })
      .catch((e) => {
        console.log("Failed to search resources:", e);
      })
      .finally(() => {
        setSearchingResources(false);
      });
  };

  /* ── elapsed timer ── */
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setElapsedSeconds((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [visible]);

  /* ── task end ── */
  const handleTaskEnd = async (
    exitType: "completed" | "early_exit",
    exitMeta?: ExitReasonMeta,
  ) => {
    try {
      if (exitType === "completed" && goalRef) {
        await markGoalCompleted(goalRef.phaseIndex, goalRef.goalIndex);
      }
      if (exitType === "completed") {
        await incrementCompletedTasks();
        import("@/lib/achievements")
          .then(({ checkAndUpdateAchievements }) =>
            checkAndUpdateAchievements(),
          )
          .catch((e) => console.log("Failed to check achievements:", e));
      } else {
        await incrementEarlyExits();
      }
    } catch (e) {
      console.log("Failed to save task data:", e);
    }
    evaluateTodayIndex(exitType, exitMeta).catch((e) =>
      console.log("Failed to evaluate index:", e),
    );
  };

  const maybeTriggerMoodPrompt = async (exitMeta?: ExitReasonMeta) => {
    try {
      if (exitMeta?.sentiment !== "negative") return;
      const today = new Date().toISOString().slice(0, 10);
      const lastMoodDate = await AsyncStorage.getItem("lastMoodDate");
      if (lastMoodDate === today) return;
      await AsyncStorage.setItem(
        "moodPromptPending",
        JSON.stringify({
          date: today,
          timestamp: new Date().toISOString(),
          reason: exitMeta.reason,
        }),
      );
    } catch (e) {
      console.log("Failed to set moodPromptPending:", e);
    }
  };

  /* ── complete ── */
  const handleComplete = async () => {
    if (hasCompletedRef.current) return;
    setCompleteMenuOpen(true);
  };

  const handleCompleteDirect = async () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setCompleteMenuOpen(false);
    await handleTaskEnd("completed");
    onClose(true, elapsedSeconds);
  };

  const openChat = (prefill?: string) => {
    setInitialChatInput(prefill ?? "");
    setChatOpen(true);
  };

  const handleCompleteWithAI = async () => {
    if (hasCompletedRef.current) return;
    setCompleteMenuOpen(false);
    setInitialChatInput(
      "请帮我点评一下这次任务的成果，指出亮点和可以改进的地方。",
    );
    setChatOpen(true);
  };

  const handleGenerateSummary = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    try {
      const res = await chatWithTaskPanel(
        [
          {
            role: "user",
            content:
              "请用2-3句话概述这个任务的核心目标和可执行下一步。语气简洁。",
          },
        ],
        { title, duration, detail },
      );
      if (res.reply) setAssistantSummary(res.reply);
    } finally {
      setIsSummarizing(false);
    }
  };

  /* ── exit flow ── */
  const handleRequestExit = () => setExitModalOpen(true);

  const handleConfirmExit = async () => {
    if (hasCompletedRef.current) return;
    const reason =
      selectedReason === "其他" ? customReason.trim() : selectedReason;
    if (!reason) return;

    setExitModalOpen(false);
    setSelectedReason(null);
    setCustomReason("");

    let exitMeta: ExitReasonMeta | undefined;
    if (selectedReason === "有事") {
      exitMeta = { reason, sentiment: "positive" };
    } else if (selectedReason && selectedReason !== "其他") {
      exitMeta = { reason, sentiment: "negative" };
    } else {
      setIsClassifying(true);
      exitMeta = await classifyExitReason(reason);
      setIsClassifying(false);
    }

    if (exitMeta?.sentiment === "negative") {
      pendingExitMetaRef.current = exitMeta;
      setIsSuggesting(true);
      try {
        const elapsedMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
        const plan = await suggestInterruptionPlan({
          reason,
          remainingMinutes: 0,
          originalMinutes: elapsedMinutes,
        });
        setInterceptPlan({
          reason,
          continueMinutes: plan.continueMinutes,
          remainingMinutes: 0,
          message: plan.message,
        });
        setInterceptOpen(true);
      } catch (e) {
        console.log("Failed to suggest interruption plan", e);
      } finally {
        setIsSuggesting(false);
      }
      return;
    }

    hasCompletedRef.current = true;
    await handleTaskEnd("early_exit", exitMeta);
    onClose(false, elapsedSeconds);
  };

  const handleContinueAfterIntercept = () => {
    setInterceptOpen(false);
    pendingExitMetaRef.current = null;
  };

  const handleExitAnyway = async () => {
    if (hasCompletedRef.current) return;
    const exitMeta = pendingExitMetaRef.current;
    hasCompletedRef.current = true;
    setInterceptOpen(false);
    pendingExitMetaRef.current = null;
    await maybeTriggerMoodPrompt(exitMeta ?? undefined);
    await handleTaskEnd("early_exit", exitMeta ?? undefined);
    onClose(false, elapsedSeconds);
  };

  /* ── focused resource ── */
  const focusedResource = focusedCardId
    ? resources.find((r) => r.id === focusedCardId)
    : null;

  const categorizeResource = (title: string): "方法" | "案例" | "模板" => {
    if (/模板|范文|样例|清单|框架/.test(title)) return "模板";
    if (/案例|示例|实例|对比/.test(title)) return "案例";
    return "方法";
  };

  const groupedResources = resources.reduce(
    (acc, r) => {
      const category = categorizeResource(r.title || "");
      acc[category].push(r);
      return acc;
    },
    {
      方法: [] as ResourceCard[],
      案例: [] as ResourceCard[],
      模板: [] as ResourceCard[],
    },
  );

  /* ── render ── */
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <PortalProvider>
        <SafeAreaView
          edges={[]}
          style={[
            styles.container,
            {
              paddingTop: insets.top,
              paddingBottom: chatOpen ? insets.bottom : 0,
            },
          ]}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            {/* ─── Header ─── */}
            <View style={styles.header}>
              <Pressable
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && { opacity: 0.5 },
                ]}
                onPress={handleRequestExit}
              >
                <ArrowLeft size={22} color="#171717" />
              </Pressable>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title || "寻找知识"}
                </Text>
                <Text style={styles.headerTime}>
                  {formatElapsed(elapsedSeconds)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.headerCompleteBtn,
                  pressed && { backgroundColor: "#F3F4F6" },
                ]}
                onPress={handleComplete}
              >
                <Text style={styles.headerCompleteText}>完成</Text>
              </Pressable>
            </View>

            {/* ─── Body ─── */}
            <View style={styles.body}>
              {searchingResources ? (
                /* ── Loading resources ── */
                <View style={styles.searchingContainer}>
                  <ActivityIndicator size="large" color="#171717" />
                  <Text style={styles.searchingText}>正在搜索学习资源...</Text>
                </View>
              ) : focusedCardId === null ? (
                /* ── Card List (normal mode) ── */
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.cardListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* ── Assistant Overview ── */}
                  <View style={styles.assistantCard}>
                    <Text style={styles.assistantTitle}>任务助手</Text>
                    <Text style={styles.assistantSub}>
                      我可以帮你拆解任务、补资源、给出下一步。
                    </Text>
                    <View style={styles.assistantTags}>
                      <Pressable
                        style={styles.assistantTagBtn}
                        onPress={() =>
                          openChat("我对这个任务有点疑问，可以帮我理清要点吗？")
                        }
                      >
                        <Text style={styles.assistantTagText}>问项目问题</Text>
                      </Pressable>
                      <Pressable
                        style={styles.assistantTagBtn}
                        onPress={() => refreshResources()}
                      >
                        <Text style={styles.assistantTagText}>刷新资源</Text>
                      </Pressable>
                      <Pressable
                        style={styles.assistantTagBtn}
                        onPress={handleGenerateSummary}
                      >
                        <Text style={styles.assistantTagText}>下一步建议</Text>
                      </Pressable>
                    </View>
                    {assistantSummary ? (
                      <Text style={styles.assistantSummary}>
                        {assistantSummary}
                      </Text>
                    ) : null}
                    <Pressable
                      style={({ pressed }) => [
                        styles.assistantBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => openChat()}
                    >
                      <Text style={styles.assistantBtnText}>
                        让 AI 给我下一步
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.assistantGhostBtn,
                        pressed && { backgroundColor: "#F5F5F5" },
                      ]}
                      onPress={handleGenerateSummary}
                    >
                      <Text style={styles.assistantGhostText}>
                        {isSummarizing ? "生成中..." : "生成任务概述"}
                      </Text>
                    </Pressable>
                  </View>

                  {/* ── Grouped Resources ── */}
                  {(["方法", "案例", "模板"] as const).map((group) =>
                    groupedResources[group].length > 0 ? (
                      <View key={group} style={styles.groupSection}>
                        <Text style={styles.groupTitle}>{group}</Text>
                        {groupedResources[group].map((res) => (
                          <Pressable
                            key={res.id}
                            style={({ pressed }) => [
                              styles.card,
                              pressed && { opacity: 0.9 },
                            ]}
                            onPress={() => handleFocusCard(res.id)}
                          >
                            <View style={styles.cardHeader}>
                              <View style={styles.domainPill}>
                                <Text style={styles.domainText}>
                                  {res.domain}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.cardWebViewBox}>
                              {Platform.OS === "web" ? (
                                <>
                                  <WebViewForWeb
                                    url={res.url}
                                    style={{ flex: 1 }}
                                    scrollEnabled={false}
                                    onLoadStart={() =>
                                      setLoadingCards((s) => new Set(s).add(res.id))
                                    }
                                    onLoadEnd={() =>
                                      setLoadingCards((s) => {
                                        const next = new Set(s);
                                        next.delete(res.id);
                                        return next;
                                      })
                                    }
                                  />
                                  {/* tap overlay — prevents iframe from capturing touch */}
                                  <Pressable
                                    style={StyleSheet.absoluteFill}
                                    onPress={() => handleFocusCard(res.id)}
                                  />
                                </>
                              ) : (
                                <>
                                  <WebView
                                    source={{ uri: res.url }}
                                    style={{ flex: 1 }}
                                    scrollEnabled={false}
                                    showsVerticalScrollIndicator={false}
                                    showsHorizontalScrollIndicator={false}
                                    onLoadStart={() =>
                                      setLoadingCards((s) => new Set(s).add(res.id))
                                    }
                                    onLoadEnd={() =>
                                      setLoadingCards((s) => {
                                        const next = new Set(s);
                                        next.delete(res.id);
                                        return next;
                                      })
                                    }
                                  />
                                  {/* tap overlay — prevents WebView from capturing touch */}
                                  <Pressable
                                    style={StyleSheet.absoluteFill}
                                    onPress={() => handleFocusCard(res.id)}
                                  />
                                </>
                              )}
                              {loadingCards.has(res.id) && (
                                <View style={styles.loadingOverlay}>
                                  <ActivityIndicator
                                    size="small"
                                    color="#A3A3A3"
                                  />
                                  <Text style={styles.loadingText}>
                                    正在加载 {res.domain}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    ) : null,
                  )}
                </ScrollView>
              ) : (
                /* ── Focused Card ── */
                <View style={styles.focusedCard}>
                  <View style={styles.focusedHeader}>
                    <View style={styles.domainPill}>
                      <Text style={styles.domainText}>
                        {focusedResource?.domain}
                      </Text>
                    </View>
                    {/* Frosted glass X button */}
                    <Pressable
                      onPress={() => handleFocusCard(null)}
                      style={styles.blurBtnPressable}
                    >
                      <BlurView
                        intensity={80}
                        tint="light"
                        style={styles.blurBtn}
                      >
                        <X size={16} color="#333" />
                      </BlurView>
                    </Pressable>
                  </View>
                  <View style={styles.focusedWebView}>
                    {Platform.OS === "web" ? (
                      <WebViewForWeb
                        url={focusedResource?.url || ""}
                        style={{ flex: 1 }}
                        scrollEnabled={true}
                      />
                    ) : (
                      <WebView
                        source={{ uri: focusedResource?.url || "" }}
                        style={{ flex: 1 }}
                        scrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                      />
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* ─── Floating AI Button ─── */}
            <Pressable
              style={({ pressed }) => [
                styles.fab,
                { bottom: insets.bottom + 16 },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => openChat()}
            >
              <MessageCircle size={16} color="#FFFFFF" />
              <Text style={styles.fabText}>与 AI 沟通</Text>
            </Pressable>
          </KeyboardAvoidingView>

          {/* ─── Exit Reason Modal ─── */}
          <Modal
            visible={exitModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setExitModalOpen(false)}
            statusBarTranslucent
          >
            <View style={[styles.modalOverlay, { zIndex: 9999 }]}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>为什么要退出？</Text>
                <View style={styles.reasonOptions}>
                  {["有事", "不想做了", "太难了", "其他"].map((option) => (
                    <Pressable
                      key={option}
                      style={({ pressed }) => [
                        styles.reasonBtn,
                        selectedReason === option && styles.reasonBtnSelected,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setSelectedReason(option)}
                    >
                      <Text
                        style={[
                          styles.reasonBtnText,
                          selectedReason === option &&
                            styles.reasonBtnTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {selectedReason === "其他" && (
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="请输入原因"
                    placeholderTextColor="#A3A3A3"
                    value={customReason}
                    onChangeText={setCustomReason}
                  />
                )}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalCancelBtn,
                      pressed && { backgroundColor: "#F5F5F5" },
                    ]}
                    onPress={() => {
                      setExitModalOpen(false);
                      setSelectedReason(null);
                      setCustomReason("");
                    }}
                  >
                    <Text style={styles.modalCancelText}>取消</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalConfirmBtn,
                      (!selectedReason ||
                        (selectedReason === "其他" && !customReason.trim()) ||
                        isClassifying) &&
                        styles.modalBtnDisabled,
                      pressed && { backgroundColor: "#262626" },
                    ]}
                    onPress={handleConfirmExit}
                    disabled={
                      !selectedReason ||
                      (selectedReason === "其他" && !customReason.trim()) ||
                      isClassifying
                    }
                  >
                    <Text style={styles.modalConfirmText}>
                      {isClassifying ? "判断中..." : "确认退出"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* ─── Intercept Modal ─── */}
          <Modal
            visible={interceptOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setInterceptOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>先别退出</Text>
                {isSuggesting || !interceptPlan ? (
                  <Text style={styles.interceptHint}>
                    正在生成更轻量的方案...
                  </Text>
                ) : (
                  <>
                    <Text style={styles.interceptMessage}>
                      {interceptPlan.message}
                    </Text>
                    <Text style={styles.interceptHint}>
                      建议再坚持 {interceptPlan.continueMinutes} 分钟
                    </Text>
                  </>
                )}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalCancelBtn,
                      pressed && { backgroundColor: "#F5F5F5" },
                    ]}
                    onPress={handleExitAnyway}
                    disabled={isSuggesting}
                  >
                    <Text style={styles.modalCancelText}>仍然退出</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalConfirmBtn,
                      pressed && { backgroundColor: "#262626" },
                      (isSuggesting || !interceptPlan) &&
                        styles.modalBtnDisabled,
                    ]}
                    onPress={handleContinueAfterIntercept}
                    disabled={isSuggesting || !interceptPlan}
                  >
                    <Text style={styles.modalConfirmText}>
                      {interceptPlan
                        ? `继续 ${interceptPlan.continueMinutes} 分钟`
                        : "继续"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* ─── Complete Menu ─── */}
          <Modal
            visible={completeMenuOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setCompleteMenuOpen(false)}
            statusBarTranslucent
          >
            <View style={[styles.modalOverlay, { zIndex: 9999 }]}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>完成方式</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.optionBtn,
                    pressed && { backgroundColor: "#F5F5F5" },
                  ]}
                  onPress={handleCompleteWithAI}
                >
                  <Text style={styles.optionTitle}>找 AI 助手拍一下成果</Text>
                  <Text style={styles.optionDesc}>
                    会打开对话框，你可以上传图片再发送
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.optionBtn,
                    pressed && { backgroundColor: "#F5F5F5" },
                  ]}
                  onPress={handleCompleteDirect}
                >
                  <Text style={styles.optionTitle}>直接通过</Text>
                  <Text style={styles.optionDesc}>直接结束任务并记为完成</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalCancelBtn,
                    { flex: undefined },
                    pressed && { backgroundColor: "#F5F5F5" },
                  ]}
                  onPress={() => setCompleteMenuOpen(false)}
                >
                  <Text style={styles.modalCancelText}>取消</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          {/* ─── Chat Overlay ─── */}
          <ChatOverlay
            open={chatOpen}
            onOpenChange={setChatOpen}
            taskContext={{ title, duration, detail }}
            onRefreshSearch={async (query) => {
              refreshResources(query);
              setChatOpen(false);
            }}
            initialInput={initialChatInput}
            onInitialInputConsumed={() => setInitialChatInput("")}
            onRequestComplete={async () => {
              if (hasCompletedRef.current) return;
              hasCompletedRef.current = true;
              await handleTaskEnd("completed");
              onClose(true, elapsedSeconds);
            }}
          />
        </SafeAreaView>
      </PortalProvider>
    </Modal>
  );
}

/* ─── goal completion helper ─── */

async function markGoalCompleted(phaseIndex: number, goalIndex: number) {
  const raw = await AsyncStorage.getItem("savedRoute");
  if (!raw) return;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.phases)) return;
  if (!parsed.phases[phaseIndex]?.goals?.[goalIndex]) return;
  parsed.phases[phaseIndex].goals[goalIndex].completed = true;
  await AsyncStorage.setItem("savedRoute", JSON.stringify(parsed));
}

/* ─── styles ─── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  /* header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#171717",
    letterSpacing: -0.3,
  },
  headerTime: {
    fontSize: 14,
    fontWeight: "500",
    color: "#A3A3A3",
    marginTop: 2,
  },

  /* body */
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  searchingText: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "500",
  },
  cardListContent: {
    paddingBottom: 24,
    gap: 16,
  },
  assistantCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    gap: 10,
  },
  assistantTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  assistantSub: {
    fontSize: 13,
    color: "#6B7280",
  },
  assistantTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  assistantTagBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  assistantTagText: {
    fontSize: 12,
    color: "#374151",
  },
  assistantBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  assistantBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  assistantGhostBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  assistantGhostText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  assistantSummary: {
    fontSize: 12,
    color: "#374151",
    lineHeight: 18,
  },
  groupSection: {
    gap: 20,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    paddingLeft: 4,
  },

  /* card (normal) */
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  domainPill: {
    flexDirection: "row",
    alignItems: "center",
  },
  domainText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#737373",
  },
  cardWebViewBox: {
    height: 220,
    overflow: "hidden",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(249,250,251,0.85)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#A3A3A3",
  },

  /* focused card */
  focusedCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  focusedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  focusedWebView: {
    flex: 1,
  },

  /* blur close button */
  blurBtnPressable: {
    borderRadius: 16,
    overflow: "hidden",
  },
  blurBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  /* header complete button */
  headerCompleteBtn: {
    minWidth: 52,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerCompleteText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  /* floating ai button */
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 100,
  },
  fabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  /* modal shared */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
    zIndex: 9999,
    elevation: 9999,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
    zIndex: 10000,
    elevation: 10000,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  optionDesc: {
    fontSize: 12,
    color: "#6B7280",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#171717",
    textAlign: "center",
  },
  reasonOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  reasonBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reasonBtnSelected: {
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  reasonBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#525252",
  },
  reasonBtnTextSelected: {
    color: "#FFFFFF",
  },
  reasonInput: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    fontSize: 14,
    color: "#171717",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#525252",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#171717",
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  interceptMessage: {
    fontSize: 14,
    fontWeight: "600",
    color: "#171717",
    textAlign: "center",
  },
  interceptHint: {
    fontSize: 13,
    color: "#737373",
    textAlign: "center",
    lineHeight: 18,
  },
});
