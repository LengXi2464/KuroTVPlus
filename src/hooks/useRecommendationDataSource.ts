'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to get the recommendation data source configuration
 * @returns The recommendation data source setting (Douban, TMDB, Mixed, MixedSmart)
 */
export function useRecommendationDataSource(): string {
  const [dataSource, setDataSource] = useState<string>('Mixed');

  useEffect(() => {
    // 从运行时配置中读�?    if (typeof window !== 'undefined' && window.RUNTIME_CONFIG) {
      const configValue = window.RUNTIME_CONFIG.RecommendationDataSource;
      setDataSource(configValue || 'Mixed');
    }
  }, []);

  return dataSource;
}
