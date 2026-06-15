/**
 * useLeaderboard - 贡献榜数据 hook
 */
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export function useLeaderboard(period = 'all', limit = 20) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.get('/leaderboard', { params: { period, limit } })
      .then(res => {
        if (!cancelled) {
          setData(res.data?.data || res.data || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [period, limit]);

  return { data, loading, error };
}