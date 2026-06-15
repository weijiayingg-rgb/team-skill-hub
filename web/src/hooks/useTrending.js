import { useState, useEffect } from 'react';
import apiClient from '../api/client';

/**
 * 热门资源 Hook
 * @param {string} period - 时间维度: 'all' | 'weekly' | 'monthly'
 * @param {string} sortBy - 排序维度: 'hot' | 'downloads' | 'likes' | 'favorites'
 * @param {string} type - 资源类型筛选: 'skill' | 'expert' | null(全部)
 * @returns {{ resources: Array, loading: boolean, error: Error|null }}
 */
export function useTrending(period = 'all', sortBy = 'hot', type = null) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // 当 sortBy 为 hot 时，使用 /trending 接口（支持 period 过滤）
    // 当 sortBy 为 downloads/likes/favorites 时，使用 /resources 接口的 sort 参数
    const request = sortBy === 'hot'
      ? apiClient.get('/trending', { params: { period, type, limit: 20 } })
      : apiClient.get('/resources', {
          params: { sort: sortBy, order: 'desc', pageSize: 20, page: 1, type },
        });

    request
      .then((res) => {
        if (cancelled) return;
        // /trending 返回 res.data，/resources 返回 res.data + res.meta
        const list = Array.isArray(res.data) ? res.data : (res.data || []);
        setResources(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [period, sortBy, type]);

  return { resources, loading, error };
}
