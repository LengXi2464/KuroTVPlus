/** 红果短剧数据源：类型定义与共享常量。 */

/** 8899 兜底后端（HONGGUO_SOURCE=remote 或直连失败时使用）。 */
export const HONGGUO_API_BASE = (
  process.env.NEXT_PUBLIC_HONGGUO_API_BASE || 'http://161.33.28.7:8899'
).replace(/\/+$/, '');

export interface HongguoSearchItem {
  id: string;
  title: string;
  cover: string;
  desc: string;
  episodeCount: number;
  score?: string | number;
  playCount?: number;
  tags?: string[];
}

export interface HongguoFilterItem {
  id: string;
  name: string;
}

/** 分类页筛选项：type 为 genre / category_dim_theme / sort / gender… */
export interface HongguoFilterRow {
  type: string;
  rowName: string;
  items: HongguoFilterItem[];
}

export interface HongguoPage {
  items: HongguoSearchItem[];
  hasMore: boolean;
  nextSkip: number;
}

export interface HongguoSeries {
  id: string;
  title: string;
  cover: string;
  description: string;
  episodeCount: number;
  status?: string;
}

export interface HongguoEpisode {
  id: string;
  title: string;
  seq: number;
  duration?: number;
  cover?: string;
}

export interface HongguoStream {
  definition: string;
  codec: string;
  url: string;
  size?: number;
  contentKey?: string;
}

export interface HongguoPlayInfo {
  ok: boolean;
  protected: boolean;
  contentKey: string;
  streams: HongguoStream[];
  message?: string;
}
