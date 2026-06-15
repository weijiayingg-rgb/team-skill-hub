import { useState, useEffect, useMemo } from 'react';
import apiClient from '../api/client';

export function useResources(params = {}) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 20 });

  // 序列化 params 作为稳定依赖 key，避免内联对象每次渲染引用不同导致无限循环
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  useEffect(() => {
    // 支持 null 参数不发请求（用于条件延迟加载）
    if (!params) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    apiClient
      .get('/resources', { params })
      .then((res) => {
        if (!cancelled) {
          setResources(res.data || []);
          setMeta(res.meta || { total: 0, page: 1, pageSize: 20 });
        }
      })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [paramsKey]);

  return { resources, loading, error, meta };
}

export function useResource(id) {
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .get(`/resources/${id}`)
      .then((res) => { if (!cancelled) setResource(res.data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { resource, loading, error };
}