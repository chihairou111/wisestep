import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { generateStudyPlan, PlanItem } from "../lib/qwen";

function ProgressBar({ current, total }: { current: number; total: number }) {
  const progress = (current / total) * 100;
  return (
    <View>
      <View
        style={{
          height: 4,
          backgroundColor: "#E2E8F0",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${progress}%`,
            backgroundColor: "#171717",
          }}
        />
      </View>
    </View>
  );
}

export default function Step4() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needClarification, setNeedClarification] = useState<string | null>(null);
  const [baseQuestion, setBaseQuestion] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState("");
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);

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

      const result = await generateStudyPlan(parsedSubjects, userQuestion);

      if (result.error) {
        setError(result.error);
      } else if (result.needClarification) {
        setNeedClarification(result.needClarification);
      } else {
        setPlans(result.plans);
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

  const handleRegenerateWithSuggestion = async () => {
    setLoading(true);
    setError(null);
    setSuggestionModalVisible(false);
    try {
      const mergedQuestion = suggestion.trim()
        ? `${baseQuestion}\n修改建议：${suggestion.trim()}`
        : baseQuestion;
      const result = await generateStudyPlan(subjects, mergedQuestion);

      if (result.error) {
        setError(result.error);
      } else {
        setPlans(result.plans);
      }
    } catch (e) {
      setError("生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#F5F7FB",
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 10,
      }}
    >
      <ProgressBar current={4} total={5} />

      <Text
        style={{
          marginTop: 20,
          fontSize: 25,
          fontWeight: "700",
          color: "#1A1A1A",
        }}
      >
        学习规划
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 13,
          color: "#6B7280",
        }}
      >
        基于你想学的内容生成，可继续对话调整
      </Text>

      {loading ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
          }}
        >
          <ActivityIndicator size="large" color="#171717" />
          <Text style={{ fontSize: 16, color: "#6B7280" }}>
            正在为你生成学习规划...
          </Text>
        </View>
      ) : needClarification ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#1A1A1A", textAlign: "center" }}>
            需要更多信息
          </Text>
          <Text style={{ fontSize: 15, color: "#4B5563", textAlign: "center", lineHeight: 22 }}>
            {needClarification}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 100,
              backgroundColor: "#171717",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
              返回修改描述
            </Text>
          </Pressable>
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Text style={{ fontSize: 16, color: "#EF4444" }}>{error}</Text>
          <Pressable
            onPress={fetchAndGenerate}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 100,
              backgroundColor: "#171717",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
              重试
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1, marginTop: 16 }}
            contentContainerStyle={{ alignItems: "center", paddingBottom: 6 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                width: "100%",
                maxWidth: 520,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 6,
                }}
              >
                学习主题
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#4B5563",
                  lineHeight: 22,
                }}
              >
                {baseQuestion?.trim()
                  ? baseQuestion.trim()
                  : "尚未填写学习目标"}
              </Text>
            </View>
            {plans.map((plan, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  width: "100%",
                  maxWidth: 520,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#1A1A1A",
                    marginBottom: 8,
                  }}
                >
                  {plan.title}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#4B5563",
                    lineHeight: 22,
                  }}
                >
                  {plan.content.replace(/\\n/g, "\n")}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ gap: 10, paddingTop: 12 }}>
            <Pressable
              onPress={() => setSuggestionModalVisible(true)}
              style={{
                height: 48,
                borderRadius: 100,
                backgroundColor: "#171717",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}
              >
                和 AI 继续调整规划
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/step-5" as any)}
              style={{
                height: 48,
                borderRadius: 100,
                backgroundColor: "#FFFFFF",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: "#1A1A1A" }}
              >
                好的
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <Modal transparent visible={suggestionModalVisible} animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#1A1A1A",
                marginBottom: 8,
              }}
            >
              告诉我你想怎么改
            </Text>
            <TextInput
              value={suggestion}
              onChangeText={setSuggestion}
              placeholder="例如：更细化到每天练什么，增加练习题建议..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              style={{
                height: 120,
                backgroundColor: "#F9FAFB",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: "#1A1A1A",
              }}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={() => setSuggestionModalVisible(false)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 100,
                  backgroundColor: "#FFFFFF",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#1A1A1A" }}
                >
                  取消
                </Text>
              </Pressable>
              <Pressable
                onPress={handleRegenerateWithSuggestion}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 100,
                  backgroundColor: "#171717",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}
                >
                  重新生成
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
