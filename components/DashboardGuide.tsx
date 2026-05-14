import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Defs, Mask, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type HighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type GuideStep = {
  title: string;
  description: string;
  tooltipPosition: "above" | "below";
};

const STEPS: GuideStep[] = [
  {
    title: "你的学习计划",
    description:
      "这里是你的所有学习阶段和练习。点击任意阶段查看详情，选一个练习开始专注。",
    tooltipPosition: "above",
  },
  {
    title: "今日状态",
    description:
      "每完成一个练习，AI 会给出一个简短的状态词，并更新状态条。它反映你今天的学习节奏，不用分数驱动。",
    tooltipPosition: "below",
  },
  {
    title: "AI 推荐",
    description:
      "AI 会根据你的进度、状态和成就，推荐最适合开始的学习练习。完成第一个练习后出现。",
    tooltipPosition: "below",
  },
  {
    title: "成就",
    description:
      "连续学习、完成学习计划、突破习性……都会解锁成就。点击这里查看。",
    tooltipPosition: "below",
  },
  {
    title: "AI 顾问",
    description:
      "随时和 AI 对话。它了解你的学习上下文，可以帮你调整计划、解答问题。",
    tooltipPosition: "above",
  },
];

type Props = {
  visible: boolean;
  onDone: () => void;
  targetRefs: (React.RefObject<View | null> | null)[];
};

export default function DashboardGuide({ visible, onDone, targetRefs }: Props) {
  const [step, setStep] = useState(0);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);

  // Animations
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTranslateY = useRef(new Animated.Value(12)).current;
  const insets = useSafeAreaInsets();

  // Fade in overlay on mount
  useEffect(() => {
    if (visible) {
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Animate tooltip on step change
  useEffect(() => {
    if (!visible) return;

    // Fade out
    tooltipOpacity.setValue(0);
    tooltipTranslateY.setValue(12);

    const ref = targetRefs[step];
    if (!ref?.current) {
      setHighlight(null);
      // Still animate tooltip in
      Animated.parallel([
        Animated.timing(tooltipOpacity, {
          toValue: 1,
          duration: 300,
          delay: 100,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipTranslateY, {
          toValue: 0,
          duration: 300,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    const timer = setTimeout(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setHighlight({ x, y, width, height });
        } else {
          setHighlight(null);
        }
        // Animate tooltip in after measuring
        Animated.parallel([
          Animated.timing(tooltipOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(tooltipTranslateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [visible, step, targetRefs]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setStep(0);
        setHighlight(null);
        onDone();
      });
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setStep(0);
      setHighlight(null);
      onDone();
    });
  };

  const PAD = 8;
  const TOOLTIP_MARGIN = 14;

  let tooltipStyle: any = { left: 20, right: 20 };
  if (highlight) {
    if (current.tooltipPosition === "above") {
      tooltipStyle.bottom = SCREEN_H - highlight.y + PAD + TOOLTIP_MARGIN;
    } else {
      tooltipStyle.top = highlight.y + highlight.height + PAD + TOOLTIP_MARGIN;
    }
  } else {
    tooltipStyle.top = SCREEN_H * 0.35;
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
      pointerEvents="box-none"
    >
      {/* Soft overlay with cutout */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Svg width={SCREEN_W} height={SCREEN_H}>
          <Defs>
            <Mask id="cutout">
              <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="white" />
              {highlight && (
                <Rect
                  x={highlight.x - PAD}
                  y={highlight.y - PAD}
                  width={highlight.width + PAD * 2}
                  height={highlight.height + PAD * 2}
                  rx={16}
                  ry={16}
                  fill="black"
                />
              )}
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={SCREEN_W}
            height={SCREEN_H}
            fill="rgba(0,0,0,0.35)"
            mask="url(#cutout)"
          />
        </Svg>
      </View>

      {/* Soft glow ring around highlighted area */}
      {highlight && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: highlight.x - PAD,
            top: highlight.y - PAD,
            width: highlight.width + PAD * 2,
            height: highlight.height + PAD * 2,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.6)",
            shadowColor: "#FFFFFF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 18,
            elevation: 20,
          }}
        />
      )}

      {/* Block taps on overlay */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

      {/* Tooltip card with animation */}
      <Animated.View
        style={[
          styles.tooltipCard,
          tooltipStyle,
          {
            opacity: tooltipOpacity,
            transform: [{ translateY: tooltipTranslateY }],
          },
        ]}
      >
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>

        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.description}>{current.description}</Text>

        <Pressable style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {isLast ? "开始使用" : "下一步"}
          </Text>
        </Pressable>

        {!isLast && (
          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>跳过</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tooltipCard: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D4D4D4",
  },
  dotActive: {
    backgroundColor: "#171717",
    width: 18,
    borderRadius: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#171717",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#525252",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#171717",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  skipButton: {
    marginTop: 12,
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 13,
    color: "#A3A3A3",
    fontWeight: "500",
  },
});
