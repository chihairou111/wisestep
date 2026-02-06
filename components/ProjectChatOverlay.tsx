import {
  chatWithProjectAdvisor,
  applyProjectChanges,
  type ProjectChatMessage,
  type ProjectChange,
} from "@/lib/projectChat";
import { Check, RotateCcw, Send, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProjectChatOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage?: string; // 自动发送的第一条消息
  onProjectChanged?: () => void; // 项目更改后通知父组件刷新
};

export default function ProjectChatOverlay({
  open,
  onOpenChange,
  initialMessage,
  onProjectChanged,
}: ProjectChatOverlayProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ProjectChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // 打开时自动发送 initialMessage
  const initialSentRef = useRef(false);
  useEffect(() => {
    if (open && initialMessage && !initialSentRef.current && messages.length === 0) {
      initialSentRef.current = true;
      // 延迟一帧确保 sendMessage 已就绪
      setTimeout(() => sendMessage(initialMessage), 100);
    }
    if (!open) {
      initialSentRef.current = false;
    }
  }, [open, initialMessage]);

  // 键盘弹出时自动滚动到底部
  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardWillShow", () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });
    return () => showSubscription.remove();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ProjectChatMessage = {
        role: "user",
        content: text.trim(),
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInputText("");
      setSuggestions([]);
      setIsLoading(true);

      const response = await chatWithProjectAdvisor(updatedMessages);

      if (response.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `[错误] ${response.error}` },
        ]);
        setSuggestions([]);
      } else {
        const assistantMsg: ProjectChatMessage = {
          role: "assistant",
          content: response.message,
          changes: response.changes,
          changesApplied: false,
          suggestions: response.suggestions,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setSuggestions(response.suggestions || []);
      }

      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [isLoading, messages],
  );

  const handleSend = useCallback(() => {
    sendMessage(inputText);
  }, [inputText, sendMessage]);

  const handleSuggestionPress = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  const handleApplyChanges = useCallback(
    async (msgIndex: number) => {
      const msg = messages[msgIndex];
      if (!msg?.changes || msg.changesApplied) return;

      const result = await applyProjectChanges(msg.changes);

      if (result.success && result.appliedCount > 0) {
        // 标记当前为已应用，同时让所有之前未应用的更改过期（隐藏按钮）
        setMessages((prev) =>
          prev.map((m, i) => {
            if (i === msgIndex) return { ...m, changesApplied: true };
            // 之前有未应用更改的消息，标记为过期
            if (m.changes && m.changes.length > 0 && !m.changesApplied) {
              return { ...m, changesExpired: true };
            }
            return m;
          }),
        );
        // 通知父组件刷新
        onProjectChanged?.();
      }
    },
    [messages, onProjectChanged],
  );

  const handleClose = () => {
    onOpenChange(false);
  };

  const formatChangeType = (type: string) => {
    switch (type) {
      case "modify_goal":
        return "修改";
      case "add_goal":
        return "新增";
      default:
        return type;
    }
  };

  const formatChangeDetail = (change: ProjectChange) => {
    const parts: string[] = [];
    if (change.title) parts.push(`标题：${change.title}`);
    if (change.duration) parts.push(`时长：${change.duration}`);
    if (change.detail) parts.push(`详情：${change.detail}`);
    return parts.join("\n");
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
          keyboardVerticalOffset={60}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>项目顾问</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {messages.length > 0 && (
                  <Pressable
                    style={styles.closeButton}
                    onPress={() => {
                      setMessages([]);
                      setSuggestions([]);
                      initialSentRef.current = false;
                    }}
                  >
                    <RotateCcw size={16} color="#A3A3A3" />
                  </Pressable>
                )}
                <Pressable style={styles.closeButton} onPress={handleClose}>
                  <X size={18} color="#525252" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Message List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
            onLayout={() =>
              scrollViewRef.current?.scrollToEnd({ animated: true })
            }
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>项目顾问 AI</Text>
                <Text style={styles.emptyStateText}>
                  我可以帮你：{"\n"}
                  • 拆解项目成具体任务{"\n"}
                  • 调整任务的时长和顺序{"\n"}
                  • 根据你的状态优化计划{"\n"}
                  • 给出学习资源和方法建议
                </Text>
                <Text style={styles.emptyStateHint}>
                  试试问我："帮我把这个项目拆分成更小的任务"
                </Text>
              </View>
            ) : (
              messages.map((msg, index) => (
                <View key={index}>
                  <View
                    style={[
                      styles.messageRow,
                      msg.role === "user"
                        ? styles.messageRowUser
                        : styles.messageRowAssistant,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        msg.role === "user"
                          ? styles.userBubble
                          : styles.assistantBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          msg.role === "user"
                            ? styles.userText
                            : styles.assistantText,
                        ]}
                      >
                        {msg.content}
                      </Text>
                    </View>
                  </View>

                  {/* 更改提案卡片 */}
                  {msg.changes && msg.changes.length > 0 && (
                    <View style={styles.changesCard}>
                      <Text style={styles.changesTitle}>
                        {msg.changesApplied ? "已应用的更改" : "建议更改"}
                      </Text>
                      {msg.changes.map((change, ci) => (
                        <View key={ci} style={styles.changeItem}>
                          <View style={styles.changeHeader}>
                            <View
                              style={[
                                styles.changeTypeBadge,
                                change.type === "add_goal"
                                  ? styles.changeTypeBadgeAdd
                                  : styles.changeTypeBadgeModify,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.changeTypeText,
                                  change.type === "add_goal"
                                    ? styles.changeTypeTextAdd
                                    : styles.changeTypeTextModify,
                                ]}
                              >
                                {formatChangeType(change.type)}
                              </Text>
                            </View>
                            <Text style={styles.changePhase}>
                              阶段 {change.phaseIndex + 1}
                              {change.goalIndex !== undefined
                                ? ` · 任务 ${change.goalIndex + 1}`
                                : ""}
                            </Text>
                          </View>
                          {formatChangeDetail(change) ? (
                            <Text style={styles.changeDetail}>
                              {formatChangeDetail(change)}
                            </Text>
                          ) : null}
                          <Text style={styles.changeReason}>
                            {change.reason}
                          </Text>
                        </View>
                      ))}
                      {!msg.changesApplied && !msg.changesExpired && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.applyButton,
                            pressed && styles.applyButtonPressed,
                          ]}
                          onPress={() => handleApplyChanges(index)}
                        >
                          <Check size={16} color="#FFFFFF" />
                          <Text style={styles.applyButtonText}>应用更改</Text>
                        </Pressable>
                      )}
                      {msg.changesApplied && (
                        <View style={styles.appliedBadge}>
                          <Check size={14} color="#15803D" />
                          <Text style={styles.appliedText}>已应用</Text>
                        </View>
                      )}
                      {msg.changesExpired && !msg.changesApplied && (
                        <View style={styles.appliedBadge}>
                          <Text style={styles.expiredText}>已过期</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
            {isLoading && (
              <View style={[styles.messageRow, styles.messageRowAssistant]}>
                <View style={[styles.messageBubble, styles.assistantBubble]}>
                  <ActivityIndicator size="small" color="#737373" />
                </View>
              </View>
            )}
            {suggestions.length > 0 && !isLoading && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((s, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [
                      styles.suggestionBtn,
                      pressed && styles.suggestionBtnPressed,
                    ]}
                    onPress={() => handleSuggestionPress(s)}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="输入消息..."
                placeholderTextColor="#A3A3A3"
                value={inputText}
                onChangeText={setInputText}
                multiline={false}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                enablesReturnKeyAutomatically
              />
              <Pressable
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || isLoading}
              >
                <Send size={18} color="white" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#D4D4D4",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#171717",
  },
  closeButton: {
    padding: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#171717",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#525252",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyStateHint: {
    fontSize: 13,
    color: "#A3A3A3",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 12,
  },
  messageRow: {
    flexDirection: "row",
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  messageRowAssistant: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: "#171717",
  },
  assistantBubble: {
    backgroundColor: "#F3F4F6",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: "#FFFFFF",
  },
  assistantText: {
    color: "#171717",
  },
  // 更改提案
  changesCard: {
    marginLeft: 4,
    marginTop: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  changesTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#525252",
  },
  changeItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  changeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  changeTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  changeTypeBadgeAdd: {
    backgroundColor: "#DBEAFE",
  },
  changeTypeBadgeModify: {
    backgroundColor: "#FEF3C7",
  },
  changeTypeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  changeTypeTextAdd: {
    color: "#1D4ED8",
  },
  changeTypeTextModify: {
    color: "#B45309",
  },
  changePhase: {
    fontSize: 12,
    color: "#737373",
  },
  changeDetail: {
    fontSize: 12,
    color: "#525252",
    lineHeight: 18,
  },
  changeReason: {
    fontSize: 12,
    color: "#A3A3A3",
    fontStyle: "italic",
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#171717",
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  applyButtonPressed: {
    backgroundColor: "#262626",
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  appliedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  appliedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#15803D",
  },
  expiredText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#A3A3A3",
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
    alignItems: "flex-end",
  },
  suggestionBtn: {
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  suggestionBtnPressed: {
    backgroundColor: "#E5E7EB",
  },
  suggestionText: {
    fontSize: 13,
    color: "#525252",
  },
  footer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 22,
    fontSize: 14,
    color: "#171717",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
