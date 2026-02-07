import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function Step3() {
  const router = useRouter();
  const [question, setQuestion] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("userQuestion").then((value) => {
      if (value) {
        setQuestion(value);
      }
    });
  }, []);

  const handleNext = async () => {
    await AsyncStorage.setItem("userQuestion", question);
    const existingSubjects = await AsyncStorage.getItem("selectedSubjects");
    if (!existingSubjects) {
      await AsyncStorage.setItem("selectedSubjects", JSON.stringify(["综合"]));
    }
    router.push("/step-4" as any);
  };

  const fillExample = () => {
    setQuestion(`我在学校负责一个线下活动，类型是读书会。主题是"城市观察：如何把日常变成写作素材"，形式是线下小型沙龙（30-40人）。我想做一份"可落地的宣传方案"，能在一周内执行。
背景：目标受众是同校学生（对写作/观察/记录感兴趣），预算不超过 200 元，主要渠道是班群/社群/公告栏。
预期成果：
1. 一份宣传策略（目标人群、核心卖点、传播渠道、时间安排）
2. 3 条宣传文案（海报/社群/朋友圈）
3. 一张简单海报或视觉说明（用文字描述版式即可）
范围：不需要真实发布，只要方案可执行、有时间表和资源清单。`);
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
      <ProgressBar current={3} total={5} />

      <View
        style={{
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          alignContent: "center",
        }}
      >
        <Text
          style={{
            marginTop: 20,
            marginBottom: 50,
            fontSize: 25,
            fontWeight: "700",
            color: "#1A1A1A",
          }}
        >
          请键入你对项目的愿景和期望
        </Text>

        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder={
            "简要说明（示例）：\n主题：生物-细胞结构\n目标：做一个细胞模型并能讲解细胞器功能\n计划：本周找资料+画草图，下周制作+演示"
          }
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          style={{
            height: 200,
            backgroundColor: "#F9FAFB",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 16,
            padding: 16,
            fontSize: 14,
            color: "#1A1A1A",
          }}
        />

        <Pressable
          onPress={fillExample}
          style={{
            marginTop: 12,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: "#F3F4F6",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#6B7280" }}>
            💡 快速填充示例（演示用）
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleNext}
        style={{
          height: 48,
          borderRadius: 100,
          backgroundColor: "#171717",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
          Next
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
