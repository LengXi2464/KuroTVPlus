/* eslint-disable @typescript-eslint/no-explicit-any */

interface EmbyConfig {
  ServerURL: string;
  ApiKey?: string;
  Username?: string;
  Password?: string;
  UserId?: string;
  AuthToken?: string;
  // 高级流媒体选项
  removeEmbyPrefix?: boolean;
  appendMediaSourceId?: boolean;
  transcodeMp4?: boolean;
  proxyPlay?: boolean; // 视频播放代理开�?  customUserAgent?: string; // 自定义User-Agent
  key?: string; // Emby源的唯一标识
}

interface EmbyItem {
  Id: string;
  Name: string;
  Type: 'Movie' | 'Series' | 'Season' | 'Episode';
  Overview?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  PremiereDate?: string;
  ImageTags?: { Primary?: string };
  ParentIndexNumber?: number;
  IndexNumber?: number;
  MediaSources?: Array<{
    Id: string;
    MediaStreams?: Array<{
      Type: string;
      Index: number;
      DisplayTitle?: string;
      Language?: string;
      Codec?: string;
      IsExternal?: boolean;
      DeliveryUrl?: string;
    }>;
  }>;
}

interface EmbyItemsResult {
  Items: EmbyItem[];
  TotalRecordCount: number;
}

interface GetItemsParams {
  ParentId?: string;
  IncludeItemTypes?: string;
  Recursive?: boolean;
  Fields?: string;
  SortBy?: string;
  SortOrder?: string;
  StartIndex?: number;
  Limit?: number;
  searchTerm?: string;
}

interface EmbyView {
  Id: string;
  Name: string;
  CollectionType?: string;
}

export class EmbyClient {
  private serverUrl: string;
  private apiKey?: string;
  private userId?: string;
  private authToken?: string;
  private username?: string;
  private password?: string;
  private removeEmbyPrefix: boolean;
  private appendMediaSourceId: boolean;
  private transcodeMp4: boolean;
  private proxyPlay: boolean;
  private embyKey?: string;
  private customUserAgent: string;

  constructor(config: EmbyConfig) {
    let serverUrl = config.ServerURL.replace(/\/$/, '');

    // 存储高级选项
    this.removeEmbyPrefix = config.removeEmbyPrefix || false;
    this.appendMediaSourceId = config.appendMediaSourceId || false;
    this.transcodeMp4 = config.transcodeMp4 || false;
    this.proxyPlay = config.proxyPlay || false;
    this.embyKey = config.key;
    // 设置自定义UA，如果没有设置则使用默认浏览器UA
    this.customUserAgent = config.customUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // 如果 URL 不包�?/emby 路径，自动添加（除非启用�?removeEmbyPrefix�?    if (!serverUrl.endsWith('/emby') && !this.removeEmbyPrefix) {
      serverUrl += '/emby';
    }

    // 如果启用�?removeEmbyPrefix �?URL 包含 /emby，移除它
    if (this.removeEmbyPrefix && serverUrl.endsWith('/emby')) {
      serverUrl = serverUrl.slice(0, -5); // Remove '/emby'
    }

    this.serverUrl = serverUrl;
    this.apiKey = config.ApiKey;
    this.userId = config.UserId;
    this.authToken = config.AuthToken;
    this.username = config.Username;
    this.password = config.Password;
  }

  private async ensureAuthenticated(): Promise<void> {
    // 如果�?ApiKey，不需要认�?    if (this.apiKey) return;

    // 如果�?AuthToken，假设它是有效的
    if (this.authToken) return;

    // 如果有用户名，自动认证（密码可选）
    if (this.username) {
      const authResult = await this.authenticate(this.username, this.password || '');
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;
    }
  }

  private getHeaders(includeContentType: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.customUserAgent,
    };

    // 只在需要时添加 Content-Type（POST/PUT 请求�?    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.apiKey) {
      headers['X-Emby-Token'] = this.apiKey;
    } else if (this.authToken) {
      headers['X-Emby-Token'] = this.authToken;
    }

    return headers;
  }

  async authenticate(username: string, password: string): Promise<{ AccessToken: string; User: { Id: string } }> {
    const url = `${this.serverUrl}/Users/AuthenticateByName`;

    const body = JSON.stringify({
      Username: username,
      Pw: password,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': 'MediaBrowser Client="LunaTV", Device="Web", DeviceId="lunatv-web", Version="1.0.0"',
        'User-Agent': this.customUserAgent,
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Emby 认证失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    this.authToken = data.AccessToken;
    this.userId = data.User.Id;
    return data;
  }

  async getCurrentUser(): Promise<{ Id: string; Name: string }> {
    const url = `${this.serverUrl}/Users/Me`;
    const headers = this.getHeaders();

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取当前用户信息失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  async getUserViews(): Promise<EmbyView[]> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配�?Emby 用户 ID，请在管理面板重新保�?Emby 配置');
    }

    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Users/${this.userId}/Views${token ? `?api_key=${token}` : ''}`;

    const response = await fetch(url);

    // 如果�?401 错误且有用户名密码，尝试重新认证
    if (response.status === 401 && this.username && !this.apiKey) {
      const authResult = await this.authenticate(this.username, this.password || '');
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      const retryUrl = `${this.serverUrl}/Users/${this.userId}/Views?api_key=${this.authToken}`;
      const retryResponse = await fetch(retryUrl);

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(`获取 Emby 媒体库列表失�?(${retryResponse.status}): ${errorText}`);
      }

      const retryData = await retryResponse.json();
      return retryData.Items || [];
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取 Emby 媒体库列表失�?(${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.Items || [];
  }

  async getItems(params: GetItemsParams): Promise<EmbyItemsResult> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配�?Emby 用户 ID，请在管理面板重新保�?Emby 配置');
    }

    const searchParams = new URLSearchParams();

    if (params.ParentId) searchParams.set('ParentId', params.ParentId);
    if (params.IncludeItemTypes) searchParams.set('IncludeItemTypes', params.IncludeItemTypes);
    if (params.Recursive !== undefined) searchParams.set('Recursive', params.Recursive.toString());
    if (params.Fields) searchParams.set('Fields', params.Fields);
    if (params.SortBy) searchParams.set('SortBy', params.SortBy);
    if (params.SortOrder) searchParams.set('SortOrder', params.SortOrder);
    if (params.StartIndex !== undefined) searchParams.set('StartIndex', params.StartIndex.toString());
    if (params.Limit !== undefined) searchParams.set('Limit', params.Limit.toString());
    if (params.searchTerm) searchParams.set('searchTerm', params.searchTerm);

    // 添加认证参数
    const token = this.apiKey || this.authToken;
    if (token) {
      searchParams.set('api_key', token);
    }

    const url = `${this.serverUrl}/Users/${this.userId}/Items?${searchParams.toString()}`;

    const response = await fetch(url);

    // 如果�?401 错误且有用户名密码，尝试重新认证
    if (response.status === 401 && this.username && !this.apiKey) {
      const authResult = await this.authenticate(this.username, this.password || '');
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      searchParams.set('api_key', this.authToken);
      const retryUrl = `${this.serverUrl}/Users/${this.userId}/Items?${searchParams.toString()}`;
      const retryResponse = await fetch(retryUrl);

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(`获取 Emby 媒体列表失败 (${retryResponse.status}): ${errorText}`);
      }

      return await retryResponse.json();
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`获取 Emby 媒体列表失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  async getItem(itemId: string): Promise<EmbyItem> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配�?Emby 用户 ID，请在管理面板重新保�?Emby 配置');
    }

    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Users/${this.userId}/Items/${itemId}?Fields=MediaSources${token ? `&api_key=${token}` : ''}`;
    const response = await fetch(url);

    // 如果�?401 错误且有用户名密码，尝试重新认证
    if (response.status === 401 && this.username && !this.apiKey) {
      const authResult = await this.authenticate(this.username, this.password || '');
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      const retryToken = this.authToken;
      const retryUrl = `${this.serverUrl}/Users/${this.userId}/Items/${itemId}?Fields=MediaSources${retryToken ? `&api_key=${retryToken}` : ''}`;
      const retryResponse = await fetch(retryUrl);

      if (!retryResponse.ok) {
        throw new Error('获取 Emby 媒体详情失败');
      }

      return await retryResponse.json();
    }

    if (!response.ok) {
      throw new Error('获取 Emby 媒体详情失败');
    }

    return await response.json();
  }

  async getSeasons(seriesId: string): Promise<EmbyItem[]> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配�?Emby 用户 ID，请在管理面板重新保�?Emby 配置');
    }

    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Shows/${seriesId}/Seasons?userId=${this.userId}${token ? `&api_key=${token}` : ''}`;
    const response = await fetch(url);

    // 如果�?401 错误且有用户名密码，尝试重新认证
    if (response.status === 401 && this.username && !this.apiKey) {
      const authResult = await this.authenticate(this.username, this.password || '');
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      const retryToken = this.authToken;
      const retryUrl = `${this.serverUrl}/Shows/${seriesId}/Seasons?userId=${this.userId}${retryToken ? `&api_key=${retryToken}` : ''}`;
      const retryResponse = await fetch(retryUrl);

      if (!retryResponse.ok) {
        throw new Error('获取 Emby 季列表失�?);
      }

      const retryData = await retryResponse.json();
      return retryData.Items || [];
    }

    if (!response.ok) {
      throw new Error('获取 Emby 季列表失�?);
    }

    const data = await response.json();
    return data.Items || [];
  }

  async getEpisodes(seriesId: string, seasonId?: string): Promise<EmbyItem[]> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配�?Emby 用户 ID，请在管理面板重新保�?Emby 配置');
    }

    const token = this.apiKey || this.authToken;
    const searchParams = new URLSearchParams({
      userId: this.userId!,
      Fields: 'MediaSources',
    });

    if (seasonId) {
      searchParams.set('seasonId', seasonId);
    }

    if (token) {
      searchParams.set('api_key', token);
    }

    const url = `${this.serverUrl}/Shows/${seriesId}/Episodes?${searchParams.toString()}`;
    const response = await fetch(url);

    // 如果�?401 错误且有用户名密码，尝试重新认证
    if (response.status === 401 && this.username && !this.apiKey) {
      const authResult = await this.authenticate(this.username, this.password || '');
      this.authToken = authResult.AccessToken;
      this.userId = authResult.User.Id;

      // 重试请求
      const retrySearchParams = new URLSearchParams({
        userId: this.userId!,
        Fields: 'MediaSources',
      });

      if (seasonId) {
        retrySearchParams.set('seasonId', seasonId);
      }

      if (this.authToken) {
        retrySearchParams.set('api_key', this.authToken);
      }

      const retryUrl = `${this.serverUrl}/Shows/${seriesId}/Episodes?${retrySearchParams.toString()}`;
      const retryResponse = await fetch(retryUrl);

      if (!retryResponse.ok) {
        throw new Error('获取 Emby 集列表失�?);
      }

      const retryData = await retryResponse.json();
      return retryData.Items || [];
    }

    if (!response.ok) {
      throw new Error('获取 Emby 集列表失�?);
    }

    const data = await response.json();
    return data.Items || [];
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      const token = this.apiKey || this.authToken;
      const url = `${this.serverUrl}/System/Info/Public${token ? `?api_key=${token}` : ''}`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  getImageUrl(itemId: string, imageType: 'Primary' | 'Backdrop' | 'Logo' = 'Primary', maxWidth?: number, proxyToken?: string, forceDirectUrl = false): string {
    // 如果启用了代理播放且不是强制获取直接URL，返回代�?URL
    if (this.proxyPlay && !forceDirectUrl) {
      // 使用固定的token占位符，实际验证在服务端进行
      const subscribeToken = proxyToken || 'proxy';
      const params = new URLSearchParams();
      params.set('imageType', imageType);
      if (maxWidth) params.set('maxWidth', maxWidth.toString());
      if (this.embyKey) params.set('embyKey', this.embyKey);

      return `/api/emby/image/${subscribeToken}/${itemId}?${params.toString()}`;
    }

    // 否则返回直连 URL
    const params = new URLSearchParams();
    const token = this.apiKey || this.authToken;

    if (maxWidth) params.set('maxWidth', maxWidth.toString());
    if (token) params.set('api_key', token);

    const queryString = params.toString();
    return `${this.serverUrl}/Items/${itemId}/Images/${imageType}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * 获取 PlaybackInfo 以获�?MediaSourceId
   */
  async getPlaybackInfo(itemId: string): Promise<{ MediaSourceId?: string }> {
    await this.ensureAuthenticated();

    if (!this.userId) {
      throw new Error('未配�?Emby 用户 ID');
    }

    const token = this.apiKey || this.authToken;
    const url = `${this.serverUrl}/Items/${itemId}/PlaybackInfo?UserId=${this.userId}${token ? `&api_key=${token}` : ''}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      const mediaSourceId = data.MediaSources?.[0]?.Id;

      return { MediaSourceId: mediaSourceId };
    } catch (error) {
      return {};
    }
  }

  async getStreamUrl(itemId: string, direct = true, forceDirectUrl = false): Promise<string> {
    await this.ensureAuthenticated();
    const token = this.apiKey || this.authToken;

    // 如果启用了代理播放且不是强制获取直接URL，返回代理URL
    if (this.proxyPlay && !forceDirectUrl) {
      // 使用固定的token占位符，实际验证在服务端进行
      const subscribeToken = 'proxy';
      const filename = this.transcodeMp4 ? 'video.mp4' : 'video';

      // 构建代理URL（相对路径）
      let proxyUrl = `/api/emby/play/${subscribeToken}/${filename}?itemId=${itemId}`;

      // 如果有embyKey，添加到查询参数
      if (this.embyKey) {
        proxyUrl += `&embyKey=${this.embyKey}`;
      }

      return proxyUrl;
    }

    // 原有的直接播放逻辑
    let url: string;

    if (direct) {
      // 选项3: 转码mp4
      if (this.transcodeMp4) {
        url = `${this.serverUrl}/Videos/${itemId}/stream.mp4?api_key=${token}`;
      } else {
        url = `${this.serverUrl}/Videos/${itemId}/stream?Static=true&api_key=${token}`;
      }

      // 选项2: 拼接MediaSourceId参数
      if (this.appendMediaSourceId) {
        try {
          const playbackInfo = await this.getPlaybackInfo(itemId);
          if (playbackInfo.MediaSourceId) {
            url += `&MediaSourceId=${playbackInfo.MediaSourceId}`;
          }
        } catch (error) {
          // 继续使用不带 MediaSourceId �?URL
        }
      }
    } else {
      url = `${this.serverUrl}/Videos/${itemId}/master.m3u8?api_key=${token}`;
    }

    return url;
  }

  getSubtitles(item: EmbyItem): Array<{ url: string; language: string; label: string }> {
    const subtitles: Array<{ url: string; language: string; label: string }> = [];

    if (!item.MediaSources || item.MediaSources.length === 0) {
      return subtitles;
    }

    const mediaSource = item.MediaSources[0];
    if (!mediaSource.MediaStreams) {
      return subtitles;
    }

    const token = this.apiKey || this.authToken;

    mediaSource.MediaStreams
      .filter((stream) => stream.Type === 'Subtitle')
      .forEach((stream) => {
        const language = stream.Language || 'unknown';
        const label = stream.DisplayTitle || `${language} (${stream.Codec})`;

        // 外部字幕使用 DeliveryUrl
        if (stream.IsExternal && stream.DeliveryUrl) {
          subtitles.push({
            url: `${this.serverUrl}${stream.DeliveryUrl}`,
            language,
            label,
          });
        } else {
          // 内嵌字幕使用 Stream API
          subtitles.push({
            url: `${this.serverUrl}/Videos/${item.Id}/${mediaSource.Id}/Subtitles/${stream.Index}/Stream.vtt?api_key=${token}`,
            language,
            label,
          });
        }
      });

    return subtitles;
  }

  getUserAgent(): string {
    return this.customUserAgent;
  }

  isProxyEnabled(): boolean {
    return this.proxyPlay;
  }
}
