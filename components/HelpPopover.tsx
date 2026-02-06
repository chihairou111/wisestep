import { HelpCircle } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const TOOLTIP_MAX_WIDTH = 230;
const ARROW_SIZE = 10;
const SCREEN_PADDING = 16;

type HelpPopoverProps = {
  text: string;
};

export default function HelpPopover({ text }: HelpPopoverProps) {
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState({ top: 0, left: 0, arrowLeft: 0 });
  const triggerRef = useRef<View>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      const triggerCenterX = x + width / 2;
      const tooltipTop = y + height + 8;

      // 计算 tooltip 左边位置：尽量让箭头对准 trigger 中心
      let tooltipLeft = triggerCenterX - TOOLTIP_MAX_WIDTH / 2;

      // 防止超出屏幕右边
      if (tooltipLeft + TOOLTIP_MAX_WIDTH > screenWidth - SCREEN_PADDING) {
        tooltipLeft = screenWidth - SCREEN_PADDING - TOOLTIP_MAX_WIDTH;
      }
      // 防止超出屏幕左边
      if (tooltipLeft < SCREEN_PADDING) {
        tooltipLeft = SCREEN_PADDING;
      }

      // 箭头相对于 tooltip 左边的偏移
      const arrowLeft = triggerCenterX - tooltipLeft - ARROW_SIZE / 2;

      setLayout({ top: tooltipTop, left: tooltipLeft, arrowLeft });
      setVisible(true);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const close = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={open}
        hitSlop={10}
        style={styles.trigger}
      >
        <HelpCircle size={15} color="#C4C4C4" />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Animated.View
            style={[
              styles.tooltip,
              {
                opacity,
                transform: [
                  {
                    scale: opacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
                top: layout.top,
                left: layout.left,
              },
            ]}
          >
            <View style={[styles.arrow, { left: layout.arrowLeft }]} />
            <Text style={styles.text}>{text}</Text>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    marginLeft: 6,
    padding: 2,
  },
  backdrop: {
    flex: 1,
  },
  tooltip: {
    position: "absolute",
    maxWidth: TOOLTIP_MAX_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  arrow: {
    position: "absolute",
    top: -5,
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
    shadowColor: "#000",
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    fontSize: 13,
    lineHeight: 20,
    color: "#525252",
  },
});
