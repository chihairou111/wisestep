import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const DIGIT_HEIGHT = 52;
const ANIMATION_DURATION = 500;
// 数字 0-9 和小数点
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

type AnimatedNumberProps = {
  value: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
};

/**
 * 单个字符的滚动列
 */
function RollingDigit({
  digit,
  fontSize,
  fontWeight,
  color,
  digitHeight,
}: {
  digit: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  digitHeight: number;
}) {
  const initialIdx = DIGITS.includes(digit) ? DIGITS.indexOf(digit) : 0;
  const translateY = useRef(
    new Animated.Value(-initialIdx * digitHeight),
  ).current;
  const prevDigit = useRef(digit);
  const initialized = useRef(true);

  useEffect(() => {
    if (digit === prevDigit.current) return;

    const isNumeric = DIGITS.includes(digit);
    if (!isNumeric) {
      prevDigit.current = digit;
      return;
    }

    const newIdx = DIGITS.indexOf(digit);

    Animated.spring(translateY, {
      toValue: -newIdx * digitHeight,
      damping: 18,
      stiffness: 120,
      mass: 0.8,
      useNativeDriver: true,
    }).start();

    prevDigit.current = digit;
  }, [digit]);

  // 如果是小数点，直接渲染
  if (digit === ".") {
    return (
      <View style={{ height: digitHeight, justifyContent: "center" }}>
        <Text
          style={{
            fontSize,
            fontWeight: fontWeight as any,
            color,
            lineHeight: digitHeight,
          }}
        >
          .
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: digitHeight, overflow: "hidden" }}>
      <Animated.View
        style={{
          transform: [{ translateY }],
        }}
      >
        {DIGITS.map((d) => (
          <Text
            key={d}
            style={{
              fontSize,
              fontWeight: fontWeight as any,
              color,
              height: digitHeight,
              lineHeight: digitHeight,
              textAlign: "center",
            }}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * 浮动的 +/- 变化指示器
 */
function FloatingDelta({
  delta,
  digitHeight,
}: {
  delta: number;
  digitHeight: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [displayDelta, setDisplayDelta] = useState<number | null>(null);

  useEffect(() => {
    if (delta === 0) return;

    setDisplayDelta(delta);
    opacity.setValue(1);
    translateY.setValue(0);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1800,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -30,
        duration: 1800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDisplayDelta(null);
    });
  }, [delta]);

  if (displayDelta === null) return null;

  const isPositive = displayDelta > 0;
  const color = isPositive ? "#22C55E" : "#EF4444";
  const sign = isPositive ? "+" : "";

  return (
    <Animated.View
      style={{
        position: "absolute",
        right: -50,
        top: digitHeight * 0.15,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color,
        }}
      >
        {sign}
        {displayDelta.toFixed(1)}
      </Text>
    </Animated.View>
  );
}

export default function AnimatedNumber({
  value,
  fontSize = 48,
  fontWeight = "800",
  color = "#171717",
}: AnimatedNumberProps) {
  const digitHeight = fontSize * 1.1;
  const formatted = value.toFixed(1);
  const chars = formatted.split("");

  const prevValue = useRef(value);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    const diff = Math.round((value - prevValue.current) * 10) / 10;
    if (diff !== 0) {
      setDelta(diff);
    }
    prevValue.current = value;
  }, [value]);

  return (
    <View style={styles.container}>
      <View style={styles.digitsRow}>
        {chars.map((char, i) => (
          <RollingDigit
            key={`${i}-${char === "." ? "dot" : "num"}`}
            digit={char}
            fontSize={fontSize}
            fontWeight={fontWeight}
            color={color}
            digitHeight={digitHeight}
          />
        ))}
      </View>
      <FloatingDelta delta={delta} digitHeight={digitHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  digitsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
