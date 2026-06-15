import axios from 'axios';

// Token 迁移：从旧 key 'ahub_token' 迁移到 'skhub_token'
(function migrateToken() {
  const oldKey = 'ahub_token';
  const newKey = 'skhub_token';
  if (localStorage.getItem(newKey) === null && localStorage.getItem(oldKey) !== null) {
    localStorage.setItem(newKey, localStorage.getItem(oldKey));
    localStorage.removeItem(oldKey);
  }
})();

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('skhub_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const errorData = err.response?.data?.error;
    const message = errorData?.message || '网络请求失败';

    // 401 未认证或 token 过期：清除 token 并跳转登录页
    if (status === 401) {
      localStorage.removeItem('skhub_token');
      // 避免在登录页重复跳转
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('登录已过期，请重新登录'));
    }

    // 构造增强错误对象：保留 status code 和 errorData 供业务层判断
    const enhanced = new Error(message);
    enhanced.status = status;
    enhanced.errorData = errorData;
    return Promise.reject(enhanced);
  }
);

export default apiClient;
