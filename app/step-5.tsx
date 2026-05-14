import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Clock, Edit3, RotateCcw, Sparkles, X } from "lucide-react-native"; // 需安装图标库
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  generateDetailedPlan,
  GoalItem,
  PhasePlan,
  reviseGoalItem,
} from "../lib/qwen";

const { width } = Dimensions.get("window");

// 进度条组件优化
function ProgressBar({ current, total }: { current: number; total: number }) {
  const progress = (current / total) * 100;
  return (
    <View style={styles.progressWrapper}>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

export default function Step5() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<PhasePlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needClarification, setNeedClarification] = useState<string | null>(null);
  const [baseQuestion, setBaseQuestion] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);

  // Modal State
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number | null>(
    null,
  );
  const [selectedGoalIndex, setSelectedGoalIndex] = useState<number | null>(
    null,
  );
  const [suggestion, setSuggestion] = useState("");
  const [durationInput, setDurationInput] = useState("");
  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const durationPresets = ["15", "25", "40", "60"];

  const fetchAndGenerate = async () => {
    setLoading(true);
    setError(null);
    setNeedClarification(null);
    try {
      const subjectsJson = await AsyncStorage.getItem("selectedSubjects");
      const question = await AsyncStorage.getItem("userQuestion");

      const parsedSubjects = subjectsJson ? JSON.parse(subjectsJson) : [];
      const userQuestion = question || "";
      setSubjects(parsedSubjects);
      setBaseQuestion(userQuestion);

      if (parsedSubjects.length === 0 && !userQuestion) {
        setError("请先选择科目并输入问题");
        setLoading(false);
        return;
      }

      const result = await generateDetailedPlan(parsedSubjects, userQuestion);

      if (result.error) {
        setError(result.error);
      } else if (result.needClarification) {
        setNeedClarification(result.needClarification);
      } else {
        setPhases(result.phases);
      }
    } catch (e) {
      setError("生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndGenerate();
  }, []);

  const openEditGoal = (phaseIndex: number, goalIndex: number) => {
    setSelectedPhaseIndex(phaseIndex);
    setSelectedGoalIndex(goalIndex);
    setSuggestion("");
    const goal = phases[phaseIndex]?.goals?.[goalIndex];
    setDurationInput(
      goal?.duration ? String(goal.duration).replace("分钟", "") : "",
    );
    setEditVisible(true);
  };

  const handleReviseGoal = async () => {
    if (selectedPhaseIndex === null || selectedGoalIndex === null || editing)
      return;

    const phase = phases[selectedPhaseIndex];
    const goal = phase?.goals?.[selectedGoalIndex];
    if (!phase || !goal) return;

    const trimmedDuration = durationInput.trim();
    const nextDuration =
      trimmedDuration.length > 0 ? `${trimmedDuration} 分钟` : goal.duration;

    // 只有改时长，不需要 AI
    if (!suggestion.trim()) {
      const updated = phases.map((p, pIndex) => {
        if (pIndex !== selectedPhaseIndex) return p;
        const updatedGoals = p.goals.map((g, gIndex) =>
          gIndex === selectedGoalIndex ? { ...g, duration: nextDuration } : g,
        );
        return { ...p, goals: updatedGoals };
      });
      setPhases(updated);
      setEditVisible(false);
      return;
    }

    setEditing(true);
    setError(null);
    try {
      const result = await reviseGoalItem({
        subjects,
        question: baseQuestion,
        phaseTitle: phase.title,
        goal: { ...goal, duration: nextDuration },
        suggestion: suggestion.trim(),
      });

      if (result.error || !result.goal) {
        setError(result.error || "修改失败"); // 简单处理，实际可加Toast
        return;
      }

      const updated = phases.map((p, pIndex) => {
        if (pIndex !== selectedPhaseIndex) return p;
        const updatedGoals = p.goals.map((g, gIndex) => {
          if (gIndex !== selectedGoalIndex) return g;
          const nextGoal = result.goal!;
          return {
            ...nextGoal,
            duration: nextDuration || nextGoal.duration,
          };
        });
        return { ...p, goals: updatedGoals };
      });

      setPhases(updated);
      setEditVisible(false);
    } catch (e) {
      // Handle error
    } finally {
      setEditing(false);
    }
  };

  const selectedGoal: GoalItem | null =
    selectedPhaseIndex !== null && selectedGoalIndex !== null
      ? phases[selectedPhaseIndex]?.goals?.[selectedGoalIndex] || null
      : null;

  const handleSaveRoute = async () => {
    if (loading || error || phases.length === 0) return;
    const phasesWithStatus = phases.map((phase) => ({
      ...phase,
      goals: phase.goals.map((goal) => ({
        ...goal,
        completed: false,
      })),
    }));
    const payload = {
      subjects,
      question: baseQuestion,
      phases: phasesWithStatus,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem("savedRoute", JSON.stringify(payload));
    router.replace("/dashboard" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <ProgressBar current={5} total={5} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>定制学习路线</Text>
          <Sparkles size={24} color="#171717" style={{ marginLeft: 8 }} />
        </View>
        <Text style={styles.subtitle}>基于你的目标生成的详细执行方案</Text>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#171717" />
          <Text style={styles.loadingText}>AI 正在规划最佳路径...</Text>
        </View>
      ) : needClarification ? (
        <View style={styles.centerContainer}>
          <Text style={styles.clarificationTitle}>需要更多信息</Text>
          <Text style={styles.clarificationText}>{needClarification}</Text>
          <Pressable onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>返回修改描述</Text>
          </Pressable>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={fetchAndGenerate} style={styles.retryButton}>
            <RotateCcw size={16} color="#FFF" />
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {phases.map((phase, phaseIndex) => (
              <View key={phaseIndex} style={styles.phaseContainer}>
                {/* Timeline Line */}
                {phaseIndex !== phases.length - 1 && (
                  <View style={styles.timelineLine} />
                )}

                {/* Phase Header */}
                <View style={styles.phaseHeader}>
                  <View style={styles.phaseDot} />
                  <Text style={styles.phaseTitle}>{phase.title}</Text>
                </View>

                {/* Goals List */}
                <View style={styles.goalsList}>
                  {phase.goals.map((goal, goalIndex) => (
                    <Pressable
                      key={goalIndex}
                      onPress={() => openEditGoal(phaseIndex, goalIndex)}
                      style={({ pressed }) => [
                        styles.goalCard,
                        pressed && styles.goalCardPressed,
                      ]}
                    >
                      <View style={styles.goalHeader}>
                        <View style={styles.durationBadge}>
                          <Clock size={12} color="#171717" />
                          <Text style={styles.durationText}>
                            {String(goal.duration).includes("分钟")
                              ? goal.duration
                              : `${goal.duration}分钟`}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.goalTitle}>{goal.title}</Text>
                      {goal.detail && (
                        <Text style={styles.goalDetail} numberOfLines={2}>
                          {goal.detail}
                        </Text>
                      )}

                      <View style={styles.goalFooter}>
                        <View style={styles.editHint}>
                          <Edit3 size={12} color="#9CA3AF" />
                          <Text style={styles.editHintText}>点击修改</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.bottomBar}>
            <Pressable onPress={handleSaveRoute} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>
                保存并开始学习
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Edit Modal */}
      <Modal transparent visible={editVisible} animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setEditVisible(false)}
          />

          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>调整目标</Text>
              <Pressable
                onPress={() => setEditVisible(false)}
                style={styles.closeButton}
              >
                <X size={20} color="#6B7280" />
              </Pressable>
            </View>

            <View style={styles.modalCurrentGoal}>
              <View style={styles.modalBadge}>
                <Text style={styles.modalBadgeText}>
                  {durationInput
                    ? `${durationInput} 分钟`
                    : selectedGoal?.duration}
                </Text>
              </View>
              <Text style={styles.modalGoalTitle}>{selectedGoal?.title}</Text>
              <Text style={styles.modalGoalDetail}>{selectedGoal?.detail}</Text>
            </View>

            <View style={styles.durationInputContainer}>
              <Text style={styles.inputLabel}>预计时长（分钟）</Text>
              <View style={styles.durationPresetRow}>
                {durationPresets.map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setDurationInput(preset)}
                    style={({ pressed }) => [
                      styles.durationPresetButton,
                      durationInput === preset &&
                        styles.durationPresetButtonActive,
                      pressed && styles.durationPresetButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationPresetText,
                        durationInput === preset &&
                          styles.durationPresetTextActive,
                      ]}
                    >
                      {preset} 分钟
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>你想如何调整？</Text>
              <TextInput
                value={suggestion}
                onChangeText={setSuggestion}
                placeholder="例如：减少一点阅读量，或者增加实战练习..."
                placeholderTextColor="#9CA3AF"
                multiline
                style={styles.textInput}
              />
            </View>

            <Pressable
              onPress={handleReviseGoal}
              disabled={editing}
              style={[
                styles.confirmButton,
                editing && styles.confirmButtonDisabled,
              ]}
            >
              {editing ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Sparkles size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmButtonText}>AI 智能优化</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC", // 更干净的浅灰背景
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: "#F8FAFC",
    zIndex: 1,
  },
  progressContainer: {
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressWrapper: {
    marginBottom: 20,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#171717", // Indigo
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },
  clarificationTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  clarificationText: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 15,
    color: "#EF4444",
    marginBottom: 8,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    gap: 8,
  },
  retryText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  // Phase Styles
  phaseContainer: {
    position: "relative",
    paddingLeft: 16,
    marginBottom: 24,
    borderColor: "#E2E8F0",
    borderLeftWidth: 2, // Timeline Line base
  },
  timelineLine: {
    position: "absolute",
    left: -2,
    top: 0,
    bottom: -24,
    width: 2,
    backgroundColor: "#E2E8F0",
    zIndex: -1,
  },
  phaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginLeft: -21, // Align dot with line
  },
  phaseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#171717",
    borderWidth: 2,
    borderColor: "#F8FAFC",
    marginRight: 12,
  },
  phaseTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  goalsList: {
    gap: 12,
  },
  // Goal Card Styles
  goalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    // Shadow style
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(241, 245, 249, 1)",
  },
  goalCardPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: "#F1F5F9",
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#171717",
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 6,
    lineHeight: 22,
  },
  goalDetail: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 12,
  },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  editHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editHintText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  closeButton: {
    padding: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
  },
  modalCurrentGoal: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalBadge: {
    backgroundColor: "#E0E7FF",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  modalBadgeText: {
    fontSize: 11,
    color: "#4338CA",
    fontWeight: "700",
  },
  modalGoalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  modalGoalDetail: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 24,
  },
  durationInputContainer: {
    marginBottom: 16,
  },
  durationPresetRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  durationPresetButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  durationPresetButtonActive: {
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  durationPresetButtonPressed: {
    opacity: 0.85,
  },
  durationPresetText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  durationPresetTextActive: {
    color: "#FFFFFF",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#0F172A",
    height: 100,
    textAlignVertical: "top",
  },
  confirmButton: {
    flexDirection: "row",
    height: 52,
    backgroundColor: "#0F172A",
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  saveButton: {
    height: 52,
    borderRadius: 100,
    backgroundColor: "#171717",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#171717",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
