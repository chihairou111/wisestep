# Perplexity API 代理服务器

这是一个简单的 API 代理服务器，用于中转 Perplexity AI 的 API 请求，帮助无法直接访问 Perplexity 的用户（比如没有 VPN 的用户）。

## 快速开始

### 1. 安装依赖

```bash
cd api
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填入你的 Perplexity API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxx
PORT=3000
```

> 💡 获取 API Key: https://www.perplexity.ai/settings/api

### 3. 启动服务器

```bash
npm start
```

或使用开发模式（自动重启）：

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 运行。

## API 端点

### 1. 健康检查

```
GET /health
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": "2026-02-07T10:00:00.000Z"
}
```

### 2. Perplexity Chat

```
POST /api/chat
```

请求体：
```json
{
  "messages": [
    { "role": "user", "content": "你好，请介绍一下量子计算" }
  ],
  "model": "llama-3.1-sonar-small-128k-online"
}
```

可用模型：
- `llama-3.1-sonar-small-128k-online`（默认，快速）
- `llama-3.1-sonar-large-128k-online`（更强大）
- `llama-3.1-sonar-huge-128k-online`（最强大）

## 客户端使用示例

### JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: '什么是量子计算？' }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### React Native (在智步 App 中使用)

```typescript
// lib/perplexity.ts
export async function chatWithPerplexity(messages: Array<{role: string, content: string}>) {
  const response = await fetch('http://你的服务器IP:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });

  if (!response.ok) {
    throw new Error('API 请求失败');
  }

  return await response.json();
}

// 使用示例
const result = await chatWithPerplexity([
  { role: 'user', content: '你好' }
]);
console.log(result.choices[0].message.content);
```

### curl

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 📡 内网穿透 - 让国内用户无需 VPN 访问

使用 **Sakura Frp** 让你的 Mac 变成公网服务器，国内用户可以直接访问。

### Sakura Frp（免费，国内稳定）

**优点**：
- ✅ 完全免费（有免费节点）
- ✅ 国内访问速度快
- ✅ 固定域名（不会变）
- ✅ 支持 HTTPS
- ✅ 稳定可靠

**快速开始**：

```bash
# 1. 注册账号（免费）
访问: https://www.natfrp.com/

# 2. 下载客户端
https://www.natfrp.com/tunnel/download

# 3. 创建隧道
- 隧道类型: HTTP
- 本地端口: 3000
- 选择节点: 国内-广州（或其他免费节点）

# 4. 启动 API 服务器
cd api
npm start

# 5. 启动 Sakura Frp 客户端
# 登录并启动刚创建的隧道
```

启动后会获得固定域名：
```
https://your-name.natfrp.cloud
```

**详细教程**: 查看 [内网穿透使用说明.md](内网穿透使用说明.md)

### 使用示例

```bash
# 测试访问
curl -X POST https://your-name.natfrp.cloud/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "你好"}]}'
```

在智步 App 中使用：

```typescript
// lib/perplexity.ts
const API_URL = 'https://your-name.natfrp.cloud/api/chat';

export async function chatWithPerplexity(messages: Array<{role: string, content: string}>) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  return await response.json();
}
```

## 部署到云服务器

### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name wisestep-api

# 开机自启
pm2 startup
pm2 save
```

### 使用 Docker

创建 `Dockerfile`：

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

构建并运行：

```bash
docker build -t wisestep-api .
docker run -d -p 3000:3000 --env-file .env wisestep-api
```

## 安全建议

1. **API Key 保护**：不要将 `.env` 文件提交到 Git
2. **添加认证**：在生产环境建议添加 API Key 验证
3. **限流**：考虑添加请求限流防止滥用
4. **HTTPS**：生产环境使用 HTTPS
5. **防火墙**：仅开放必要的端口

## 故障排查

### 端口被占用

修改 `.env` 文件中的 `PORT` 值：

```env
PORT=8080
```

### API Key 无效

检查 `.env` 文件中的 API Key 是否正确：
- 获取 Perplexity API Key: https://www.perplexity.ai/settings/api

### CORS 错误

如果从浏览器访问，确保服务器的 CORS 已正确配置（已在代码中启用）。

## License

MIT
