import { useState, useCallback } from 'react';
import apiClient from '../api/client';

export function useInteractions(resourceId) {
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleLike = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    try {
      if (liked) {
        await apiClient.delete(`/resources/${resourceId}/like`);
        setLiked(false);
      } else {
        await apiClient.post(`/resources/${resourceId}/like`);
        setLiked(true);
      }
    } catch (err) {
      console.error('Toggle like failed:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceId, liked]);

  const toggleFavorite = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    try {
      if (favorited) {
        await apiClient.delete(`/resources/${resourceId}/favorite`);
        setFavorited(false);
      } else {
        await apiClient.post(`/resources/${resourceId}/favorite`);
        setFavorited(true);
      }
    } catch (err) {
      console.error('Toggle favorite failed:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceId, favorited]);

  return { liked, favorited, loading, toggleLike, toggleFavorite };
}
