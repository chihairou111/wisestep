import { chatWithTaskPanel, type ChatMessage, type ProjectContext } from "@/lib/chat";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera, Image as ImageIcon, Send, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";

type ChatOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskContext: {
    title: string;
    duration?: string;
    detail?: string;
  };
  onRefreshSearch?: (query?: string) => Promise<void>;
  initialInput?: string;
  onInitialInputConsumed?: () => void;
  onRequestComplete?: () => Promise<void>;
};

function ChatOverlay({
  open,
  onOpenChange,
  taskContext,
  onRefreshSearch,
  initialInput,
  onInitialInputConsumed,
  onRequestComplete,
}: ChatOverlayProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(
    null,
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    dataUrl: string;
  } | null>(null);
  const [completedMsgIds, setCompletedMsgIds] = useState<Set<number>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);

  // 键盘弹出时自动滚动到底部
  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardWillShow", () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });
    return () => showSubscription.remove();
  }, []);

  useEffect(() => {
    if (!open) return;

    const loadContext = async () => {
      try {
        const raw = await AsyncStorage.getItem("savedRoute");
        if (raw) {
          const parsed = JSON.parse(raw);
          setProjectContext({
            subjects: parsed.subjects || [],
            question: parsed.question || "",
            phases: parsed.phases || [],
          });
        }
      } catch (e) {
        console.log("Failed to load context:", e);
      }
    };

    loadContext();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialInput && !inputText) {
      setInputText(initialInput);
      onInitialInputConsumed?.();
    }
  }, [open, initialInput, inputText, onInitialInputConsumed]);

  const sendMessage = useCallback(
    async (text: string) => {
      if ((!text.trim() && !selectedImage) || isLoading || isRefreshing) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: text.trim(),
        imageDataUrl: selectedImage?.dataUrl,
        imageUri: selectedImage?.uri,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputText("");
      setSuggestions([]);
      setSelectedImage(null);
      setIsLoading(true);

      const { reply, refreshSearch, searchQuery, suggestions: newSuggestions, completeSuggestion, error } =
        await chatWithTaskPanel(
          [...messages, userMessage],
          taskContext,
          projectContext || undefined,
        );

      if (error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `[错误] ${error}` },
        ]);
        setSuggestions([]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply,
            completeSuggestion: Boolean(completeSuggestion),
          } as ChatMessage,
        ]);
        setSuggestions(newSuggestions || []);
      }

      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      if (refreshSearch && onRefreshSearch) {
        setIsRefreshing(true);
        try {
          await onRefreshSearch(searchQuery);
        } finally {
          setIsRefreshing(false);
          onOpenChange(false);
        }
      }
    },
    [isLoading, isRefreshing, messages, taskContext, projectContext, onRefreshSearch, onOpenChange],
  );

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const base64 = asset.base64 || "";
      if (!base64) return;
      const mime = asset.mimeType || "image/jpeg";
      setSelectedImage({
        uri: asset.uri,
        dataUrl: `data:${mime};base64,${base64}`,
      });
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const base64 = asset.base64 || "";
      if (!base64) return;
      const mime = asset.mimeType || "image/jpeg";
      setSelectedImage({
        uri: asset.uri,
        dataUrl: `data:${mime};base64,${base64}`,
      });
    }
  }, []);

  const handleSend = useCallback(() => {
    sendMessage(inputText);
  }, [inputText, sendMessage]);

  const handleClose = () => {
    onOpenChange(false);
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
          keyboardVerticalOffset={60} // pageSheet 模式通常不需要 offset
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>AI 助手</Text>
              <Pressable style={styles.closeButton} onPress={handleClose}>
                <X size={18} color="#525252" />
              </Pressable>
            </View>
          </View>

          {/* Task Info */}
          <View style={styles.taskInfo}>
            <Text style={styles.taskInfoText} numberOfLines={2}>
              当前任务：{taskContext.title}
            </Text>
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
                <Text style={styles.emptyStateTitle}>AI 助手</Text>
                <Text style={styles.emptyStateText}>
                  我可以帮你：{"\n"}
                  • 问项目/任务相关问题{"\n"}
                  • 让 AI 重新搜索学习资源{"\n"}
                  • 让 AI 给出下一步建议
                </Text>
                <Text style={styles.emptyStateHint}>
                  试试问我：“给我一个可执行的下一步”
                </Text>
              </View>
            ) : (
              messages.map((msg, index) => (
                <View
                  key={index}
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
                    {msg.content ? (
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
                    ) : null}
                    {msg.imageUri ? (
                      <Image
                        source={{ uri: msg.imageUri }}
                        style={styles.messageImage}
                      />
                    ) : null}
                    {msg.role === "assistant" && msg.completeSuggestion ? (
                      <Pressable
                        style={[
                          styles.completeBubbleBtn,
                          completedMsgIds.has(index) &&
                            styles.completeBubbleBtnDone,
                        ]}
                        onPress={async () => {
                          if (completedMsgIds.has(index)) return;
                          setCompletedMsgIds((prev) => {
                            const next = new Set(prev);
                            next.add(index);
                            return next;
                          });
                          // 先关闭聊天窗口，再调用完成回调
                          onOpenChange(false);
                          // 延迟调用以确保UI更新完成
                          setTimeout(async () => {
                            if (onRequestComplete) {
                              await onRequestComplete();
                            }
                          }, 100);
                        }}
                      >
                        <Text
                          style={[
                            styles.completeBubbleText,
                            completedMsgIds.has(index) &&
                              styles.completeBubbleTextDone,
                          ]}
                        >
                          完成
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
            {(isLoading || isRefreshing) && (
              <View style={[styles.messageRow, styles.messageRowAssistant]}>
                <View style={[styles.messageBubble, styles.assistantBubble]}>
                  {isRefreshing ? (
                    <Text style={styles.refreshingText}>正在刷新资源…</Text>
                  ) : (
                    <ActivityIndicator size="small" color="#737373" />
                  )}
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
                    onPress={() => sendMessage(s)}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Input Area - 处理安全区域 */}
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {selectedImage && (
              <View style={styles.previewRow}>
                <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
                <Pressable
                  style={styles.previewRemove}
                  onPress={() => setSelectedImage(null)}
                >
                  <X size={14} color="#111827" />
                </Pressable>
              </View>
            )}
            <View style={styles.inputRow}>
              <Pressable
                style={styles.iconButton}
                onPress={pickFromLibrary}
              >
                <ImageIcon size={18} color="#111827" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={takePhoto}>
                <Camera size={18} color="#111827" />
              </Pressable>
              <TextInput
                style={styles.input}
                placeholder="输入消息..."
                placeholderTextColor="#A3A3A3"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                enablesReturnKeyAutomatically
              />
              <Pressable
                style={[
                  styles.sendButton,
                  ((!inputText.trim() && !selectedImage) || isLoading) &&
                    styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={(!inputText.trim() && !selectedImage) || isLoading}
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

export default ChatOverlay;

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
  taskInfo: {
    margin: 16,
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },
  taskInfoText: {
    fontSize: 13,
    color: "#525252",
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
  messageImage: {
    marginTop: 8,
    width: 180,
    height: 180,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  userText: {
    color: "#FFFFFF",
  },
  assistantText: {
    color: "#171717",
  },
  refreshingText: {
    fontSize: 12,
    color: "#6B7280",
  },
  completeBubbleBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  completeBubbleBtnDone: {
    backgroundColor: "#16A34A",
  },
  completeBubbleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  completeBubbleTextDone: {
    color: "#FFFFFF",
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
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  previewRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
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
