import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TypeAnimation } from "react-native-type-animation";
import { Target, BarChart3, Sparkles } from "lucide-react-native";

export default function Index() {
  const router = useRouter();
  const [typeColor, setTypeColor] = useState("#171717");
  const [checking, setChecking] = useState(true);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    AsyncStorage.getItem("savedRoute").then((value) => {
      if (value) {
        router.replace("/dashboard" as any);
        return;
      }
      setChecking(false);
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideUp, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [router]);

  if (checking) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7FB" }} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部标题 — 固定左上角 */}
      <Animated.View style={{ opacity: fadeIn }}>
        <View style={styles.header}>
          <Text style={styles.appName}>智步</Text>
          <Text style={styles.tagline}>AI 驱动的学习伙伴</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeIn, transform: [{ translateY: slideUp }] },
        ]}
      >
        {/* 中间打字动画 */}
        <View style={styles.typeSection}>
          <Text style={styles.typePrefix}>在这里，你可以</Text>
          <TypeAnimation
            sequence={[
              { action: () => setTypeColor("#171717") },
              {
                text: "获得更清晰的学习目标",
                typeSpeed: 80,
                delayBetweenSequence: 800,
              },
              { action: () => setTypeColor("#171717") },
              {
                text: "拆解练习为可执行步骤",
                typeSpeed: 80,
                delayBetweenSequence: 800,
              },
              { action: () => setTypeColor("#171717") },
              {
                text: "优化你的学习规划节奏",
                typeSpeed: 80,
                delayBetweenSequence: 800,
              },
              { action: () => setTypeColor("#171717") },
              {
                text: "持续跟踪学习进度",
                typeSpeed: 80,
                delayBetweenSequence: 800,
              },
            ]}
            loop
            style={{ ...styles.typeText, color: typeColor }}
          />
        </View>

        {/* 简介亮点 */}
        <View style={styles.features}>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Target size={18} color="#171717" />
            </View>
            <Text style={styles.featureText}>输入想学的内容，AI 生成个性化学习路线</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <BarChart3 size={18} color="#171717" />
            </View>
            <Text style={styles.featureText}>实时追踪进度，每日状态词与状态条</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Sparkles size={18} color="#171717" />
            </View>
            <Text style={styles.featureText}>智能推荐练习，成就系统持续激励</Text>
          </View>
        </View>
      </Animated.View>

      {/* 底部按钮 */}
      <Animated.View style={{ opacity: fadeIn }}>
        <Pressable
          onPress={() => router.push("/step-3" as any)}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>开始规划学习</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    marginBottom: 0,
  },
  appName: {
    fontSize: 38,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 4,
  },
  typeSection: {
    marginBottom: 48,
    minHeight: 90,
  },
  typePrefix: {
    fontSize: 28,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 8,
  },
  typeText: {
    fontSize: 28,
    fontWeight: "700",
  },
  features: {
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 14,
    color: "#4B5563",
    fontWeight: "500",
    flex: 1,
  },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#171717",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#171717",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
