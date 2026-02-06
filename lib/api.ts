import OpenAI from "openai";

// 基础 API 客户端
export const client = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_QWEN_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

// 通用消息类型
export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type Message = {
  role: "system" | "user" | "assistant";
  content: string | MessageContentPart[];
};

// 通用聊天调用
export async function chat(
  messages: Message[],
  model: string = "qwen3-omni-flash",
  enableSearch: boolean = true,
): Promise<{ content: string; error?: string }> {
  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      // @ts-ignore - 阿里云特有参数
      enable_search: enableSearch,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return { content: "", error: "无法获取响应" };
    }
    return { content: text };
  } catch (error: any) {
    console.log("API Error:", error);
    if (error?.status === 429) {
      return { content: "", error: "请求太频繁，请稍后再试" };
    }
    if (error?.status === 403) {
      return { content: "", error: "API Key 无效或未开通服务" };
    }
    return { content: "", error: `请求失败: ${error?.message || error}` };
  }
}
