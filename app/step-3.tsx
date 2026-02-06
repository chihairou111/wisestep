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
