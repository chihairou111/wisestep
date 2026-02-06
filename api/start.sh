#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Perplexity API 代理服务器${NC}"
echo ""

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件${NC}"
    echo "正在从 .env.example 创建..."
    cp .env.example .env
    echo ""
    echo -e "${RED}❗️ 请编辑 .env 文件并填入你的 Perplexity API Key${NC}"
    echo "   获取 API Key: https://www.perplexity.ai/settings/api"
    echo ""
    echo "   编辑命令: nano .env 或 vim .env"
    echo ""
    exit 1
fi

# 检查 API Key 是否配置
if grep -q "your_perplexity_api_key_here" .env; then
    echo -e "${RED}❗️ 请先在 .env 文件中配置 Perplexity API Key${NC}"
    echo "   获取 API Key: https://www.perplexity.ai/settings/api"
    echo ""
    echo "   编辑命令: nano .env 或 vim .env"
    echo ""
    exit 1
fi

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 正在安装依赖...${NC}"
    npm install
    echo ""
fi

# 启动服务器
echo -e "${GREEN}✅ 配置完成，正在启动服务器...${NC}"
echo ""
npm start
