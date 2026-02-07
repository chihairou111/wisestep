import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Perplexity API 代理端点
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'sonar' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'messages 参数必须是一个数组'
      });
    }

    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

    if (!PERPLEXITY_API_KEY) {
      return res.status(500).json({
        error: '服务器未配置 Perplexity API Key'
      });
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: 'Perplexity API 请求失败',
        details: errorData
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message
    });
  }
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '端点不存在' });
});

const sslOptions = {
  key: fs.readFileSync(new URL('./certs/key.pem', import.meta.url)),
  cert: fs.readFileSync(new URL('./certs/fullchain.pem', import.meta.url)),
};

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`🚀 API 服务器运行在 https://localhost:${PORT}`);
  console.log(`✅ Perplexity 代理: POST https://localhost:${PORT}/api/chat`);
  console.log(`✅ 健康检查: GET https://localhost:${PORT}/health`);
});
