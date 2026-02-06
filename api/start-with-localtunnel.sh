#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 使用 LocalTunnel 内网穿透${NC}"
echo -e "${BLUE}特点: 完全免费，无需注册，一行命令${NC}"
echo ""

# 检查是否安装 localtunnel
if ! command -v lt &> /dev/null; then
    echo -e "${YELLOW}📦 正在安装 localtunnel...${NC}"
    npm install -g localtunnel
fi

# 检查配置
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}❗️ 请先配置 .env 文件${NC}"
    exit 1
fi

if grep -q "your_perplexity_api_key_here" .env; then
    echo -e "${YELLOW}❗️ 请先配置 Perplexity API Key${NC}"
    exit 1
fi

# 启动 API 服务器（后台）
echo -e "${BLUE}📦 启动 API 服务器...${NC}"
npm start &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 检查服务器
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${YELLOW}❌ 服务器启动失败${NC}"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ 服务器运行成功${NC}"
echo ""

# 启动 LocalTunnel
echo -e "${BLUE}🌐 启动 LocalTunnel...${NC}"
echo -e "${YELLOW}📝 提示: 按 Ctrl+C 可以停止服务${NC}"
echo -e "${YELLOW}📝 首次访问时可能需要验证，点击链接按提示操作即可${NC}"
echo ""

# 捕获退出信号
trap "echo ''; echo '正在停止服务...'; kill $SERVER_PID 2>/dev/null; exit" INT TERM

# 启动 localtunnel
lt --port 3000 --subdomain wisestep-api
