// API 配置
// 🔧 部署后修改这里的地址为你的公网域名

// 本地开发服务器地址（使用电脑的局域网 IP）
const LOCAL_SERVER_IP = '172.16.86.168';  // 你的电脑 IP

// Perplexity 代理服务器地址
export const PERPLEXITY_PROXY_URL =
  __DEV__
    ? `http://${LOCAL_SERVER_IP}:3000/api/chat`  // 本地开发（真机和模拟器都能访问）
    : 'https://your-name.natfrp.cloud/api/chat';  // 生产环境（部署后修改这里）

// 是否使用代理（设为 false 则直接调用 Perplexity API）
export const USE_PERPLEXITY_PROXY = true;
