#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 使用 Sakura Frp 内网穿透${NC}"
echo ""
echo -e "${YELLOW}Sakura Frp 是国内免费的内网穿透服务${NC}"
echo ""
echo "📝 使用步骤："
echo ""
echo "1. 注册账号: https://www.natfrp.com/"
echo "2. 下载客户端: https://www.natfrp.com/tunnel/download"
echo "3. 创建隧道："
echo "   - 类型: HTTP"
echo "   - 本地端口: 3000"
echo "   - 远程端口: 随机"
echo "4. 启动客户端并登录"
echo ""
echo -e "${GREEN}启动 API 服务器...${NC}"

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

# 启动服务器
npm start
