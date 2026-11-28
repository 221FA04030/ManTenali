import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useCategories } from '../../categories/api.js';
import { ENGAGEMENT, HOME_FEATURES } from '../../../config/features.js';
import { rankFeatures } from './scoring.js';
import {
  completeOrder,
  flushEngagement,
  getSnapshot,
  savedOrder,
  sessionOrder,
  setEngagementOwner,
  subscribe,
  trackLocation,
} from './engagementStore.js';

const DEFAULT_ORDER = completeOrder([]);

/**
 * App-wide (mounted once in the Layout): follows who is signed in, counts
 * visits to feature pages, and saves pending scores when the app is hidden.
 */
export function useEngagementTracking() {
  const { user, status } = useAuth();
  const location = useLocation();
  // Only needed to tell which category a /businesses?categoryId=… list is.
  const { data: categories } = useCategories('business', { enabled: location.pathname === '/businesses' });
  const counted = useRef(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (status !== 'loading') setEngagementOwner(userId);
  }, [status, userId]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushEngagement();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Once per navigation (location.key), never for re-renders.
  useEffect(() => {
    if (status === 'loading' || counted.current === location.key) return;
    // A category list is counted once categories are known (cached when opened from Home).
    const isCategoryList = location.pathname === '/businesses' && new URLSearchParams(location.search).has('categoryId');
    if (isCategoryList && !categories) return;
    counted.current = location.key;
    trackLocation(location.pathname, location.search, categories);
  }, [status, location.key, location.pathname, location.search, categories]);
}

/**
 * Feature keys in this person's order (most used first). The order is fixed
 * for the session, so the grid never moves while it is being used.
 */
export function useFeatureOrder() {
  const { owner, ready } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [order, setOrder] = useState(() => (owner && savedOrder(owner)) || DEFAULT_ORDER);
  useEffect(() => {
    if (!owner) return;
    if (!ready) {
      const kept = savedOrder(owner);
      if (kept) setOrder(kept);
      return;
    }
    setOrder(sessionOrder(owner, () => rankFeatures(HOME_FEATURES, getSnapshot().features, Date.now(), ENGAGEMENT)));
  }, [owner, ready]);
  return order;
}
