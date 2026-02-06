#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🌐 内网穿透启动工具${NC}"
echo ""
echo "选择一个内网穿透方案："
echo ""
echo "1. Pinggy         (推荐！无需注册，一行命令)"
echo "2. localhost.run  (最稳定，基于SSH)"
echo "3. LocalTunnel    (可指定子域名)"
echo "4. Loophole       (速度快)"
echo "5. Bore           (简单)"
echo ""
read -p "请选择 (1-5): " choice

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

# 启动 API 服务器
echo ""
echo -e "${BLUE}📦 启动 API 服务器...${NC}"
npm start &
SERVER_PID=$!
sleep 3

if ! curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${RED}❌ 服务器启动失败${NC}"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ 服务器运行成功${NC}"
echo ""

# 捕获退出信号
trap "echo ''; echo '正在停止服务...'; kill $SERVER_PID 2>/dev/null; exit" INT TERM

case $choice in
    1)
        echo -e "${BLUE}🚀 启动 Pinggy...${NC}"
        echo -e "${YELLOW}📝 提示: 首次使用会分配随机域名${NC}"
        echo ""
        ssh -p 443 -R0:localhost:3000 a.pinggy.io
        ;;
    2)
        echo -e "${BLUE}🚀 启动 localhost.run...${NC}"
        echo -e "${YELLOW}📝 提示: 基于 SSH，很稳定${NC}"
        echo ""
        ssh -R 80:localhost:3000 nokey@localhost.run
        ;;
    3)
        if ! command -v lt &> /dev/null; then
            echo -e "${YELLOW}📦 LocalTunnel 未安装，正在安装...${NC}"
            sudo npm install -g localtunnel
        fi
        echo -e "${BLUE}🚀 启动 LocalTunnel...${NC}"
        echo -e "${YELLOW}📝 提示: 可指定子域名${NC}"
        echo ""
        lt --port 3000 --subdomain wisestep-api
        ;;
    4)
        if ! command -v loophole &> /dev/null; then
            echo -e "${RED}❌ Loophole 未安装${NC}"
            echo "请先安装: curl -LO https://loophole.cloud/download/loophole-cli-darwin-amd64"
            kill $SERVER_PID 2>/dev/null
            exit 1
        fi
        echo -e "${BLUE}🚀 启动 Loophole...${NC}"
        echo ""
        loophole http 3000
        ;;
    5)
        if ! command -v bore &> /dev/null; then
            echo -e "${YELLOW}📦 Bore 未安装，正在安装...${NC}"
            brew install bore-cli
        fi
        echo -e "${BLUE}🚀 启动 Bore...${NC}"
        echo ""
        bore local 3000 --to bore.pub
        ;;
    *)
        echo -e "${RED}❌ 无效选择${NC}"
        kill $SERVER_PID 2>/dev/null
        exit 1
        ;;
esac
