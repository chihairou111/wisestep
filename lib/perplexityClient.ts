import { PERPLEXITY_PROXY_URL, USE_PERPLEXITY_PROXY } from './config';

/**
 * Perplexity API 客户端
 * 支持直接调用或通过代理服务器调用
 */

type PerplexitySearchResult = {
  title?: string;
  url?: string;
};

/**
 * 调用 Perplexity 搜索学习资源
 * 根据配置自动选择直接调用或通过代理调用
 */
export async function perplexitySearch(
  query: string,
  maxResults: number = 8
): Promise<PerplexitySearchResult[]> {
  const apiKey = process.env.EXPO_PUBLIC_PERPLEXITY_API_KEY || '';

  try {
    if (USE_PERPLEXITY_PROXY) {
      // 通过代理服务器调用（推荐，国内可访问）
      const response = await fetch(PERPLEXITY_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: query
            }
          ],
          model: 'sonar'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity proxy error:', errorText);
        return [];
      }

      const data = await response.json();

      // 从 Perplexity 的 sonar 模型响应中提取搜索结果
      // search_results 包含 {title, url, snippet} 格式的搜索结果
      const searchResults = data.search_results || [];

      // 如果有 search_results，使用它们
      if (searchResults.length > 0) {
        return searchResults.slice(0, maxResults).map((result: any) => ({
          title: result.title || '',
          url: result.url || ''
        }));
      }

      // 否则从 citations 中提取 URL
      const citations = data.citations || [];
      if (citations.length > 0) {
        return citations.slice(0, maxResults).map((url: string) => ({
          title: '', // citations 只有 URL，没有标题
          url: url
        }));
      }

      return [];

    } else {
      // 直接调用 Perplexity API（需要 VPN）
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'user',
              content: query
            }
          ]
        })
      });

      if (!response.ok) {
        console.error('Perplexity API error:', response.status);
        return [];
      }

      const data = await response.json();

      // 提取搜索结果
      const searchResults = data.search_results || [];
      if (searchResults.length > 0) {
        return searchResults.slice(0, maxResults).map((result: any) => ({
          title: result.title || '',
          url: result.url || ''
        }));
      }

      const citations = data.citations || [];
      if (citations.length > 0) {
        return citations.slice(0, maxResults).map((url: string) => ({
          title: '',
          url: url
        }));
      }

      return [];
    }
  } catch (error) {
    console.error('Perplexity search error:', error);
    return [];
  }
}
