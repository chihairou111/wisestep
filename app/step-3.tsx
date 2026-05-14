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
    setQuestion(`我想系统学习 Python 数据分析，之前只会一点点基础语法。希望 4 周内能看懂常见表格数据，完成一次简单的数据清洗、可视化和结论汇报。
当前水平：会安装软件，知道变量和循环，但没怎么用过 pandas。
学习目标：
1. 掌握 pandas 的读取、筛选、分组和清洗
2. 能用图表展示趋势和对比
3. 做一个小练习：分析一份公开数据并写出 3 条发现
学习偏好：每天 30-45 分钟，希望多一点实操，少一点纯理论。`);
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
          你想学什么？
        </Text>

        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder={
            "说说你想学的内容、当前水平和目标（示例）：\n想学：Python 数据分析\n当前：只会基础语法\n目标：4 周内能清洗表格、画图并写出结论\n偏好：每天 30 分钟，多做练习"
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
            快速填充学习示例
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
          生成学习规划
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
