/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

/**
 * Pansou 网盘搜索 API 客户�? * 文档: https://github.com/fish2018/pansou
 */

// Token 缓存
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

export interface PansouLink {
  url: string;
  password: string;
  note: string;
  datetime: string;
  source: string;
  images?: string[];
}

export interface PansouSearchResult {
  total: number;
  merged_by_type?: {
    [key: string]: PansouLink[];
  };
}

export interface PansouLoginResponse {
  token: string;
  expires_at: number;
  username: string;
}

/**
 * 登录 Pansou 获取 Token
 */
export async function loginPansou(
  apiUrl: string,
  username: string,
  password: string
): Promise<string> {
  try {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '登录失败');
    }

    const data: PansouLoginResponse = await response.json();

    // 缓存 Token
    cachedToken = data.token;
    tokenExpiry = data.expires_at;

    return data.token;
  } catch (error) {
    console.error('Pansou 登录失败:', error);
    throw error;
  }
}

/**
 * 获取有效�?Token（自动处理登录和缓存�? */
async function getValidToken(
  apiUrl: string,
  username?: string,
  password?: string
): Promise<string | null> {
  // 如果没有配置账号密码，返�?null（不需要认证）
  if (!username || !password) {
    return null;
  }

  // 检查缓存的 Token 是否有效
  if (cachedToken && tokenExpiry) {
    const now = Math.floor(Date.now() / 1000);
    // 提前 5 分钟刷新 Token
    if (tokenExpiry - now > 300) {
      return cachedToken;
    }
  }

  // Token 过期或不存在，重新登�?  try {
    return await loginPansou(apiUrl, username, password);
  } catch (error) {
    console.error('获取 Pansou Token 失败:', error);
    return null;
  }
}

/**
 * 搜索网盘资源
 */
export async function searchPansou(
  apiUrl: string,
  keyword: string,
  options?: {
    username?: string;
    password?: string;
    refresh?: boolean;
    cloudTypes?: string[];
  }
): Promise<PansouSearchResult> {
  try {
    // 获取 Token（如果需要认证）
    const token = await getValidToken(
      apiUrl,
      options?.username,
      options?.password
    );

    // 构建请求�?    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 构建请求�?    const body: any = {
      kw: keyword,
      res: 'merge', // 只返回按网盘类型分类的结�?    };

    if (options?.refresh) {
      body.refresh = true;
    }

    if (options?.cloudTypes && options.cloudTypes.length > 0) {
      body.cloud_types = options.cloudTypes;
    }

    const response = await fetch(`${apiUrl}/api/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || '搜索失败');
    }

    const responseData = await response.json();

    // Pansou API 返回的数据结构是 { code, message, data }
    // 实际数据�?data 字段�?    let data: PansouSearchResult;

    if (responseData.data) {
      // 如果�?data 字段，使�?data 中的内容
      data = responseData.data;
    } else {
      // 否则直接使用返回的数�?      data = responseData;
    }

    // 验证返回的数据结�?    if (!data || typeof data !== 'object') {
      throw new Error('返回数据格式错误');
    }

    // 确保 merged_by_type 存在
    if (!data.merged_by_type) {
      data.merged_by_type = {};
    }

    // 确保 total 存在
    if (typeof data.total !== 'number') {
      data.total = 0;
    }

    return data;
  } catch (error) {
    console.error('Pansou 搜索失败:', error);
    throw error;
  }
}

/**
 * 清除缓存�?Token
 */
export function clearPansouToken(): void {
  cachedToken = null;
  tokenExpiry = null;
}

/**
 * 检�?Pansou 服务是否可用
 */
export async function checkPansouHealth(apiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    console.error('Pansou 健康检查失�?', error);
    return false;
  }
}
