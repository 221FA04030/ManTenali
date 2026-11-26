import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Megaphone, ThumbsUp } from 'lucide-react';
import { api } from '../../lib/apiClient.js';

/** Mirrors the server (community.model.js POST_LIMITS); the server re-checks. */
export const POST_LIMITS = { textMin: 3, textMax: 1000, commentMax: 500 };

export const POST_KINDS = [
  { key: 'recommendation', icon: ThumbsUp },
  { key: 'question', icon: HelpCircle },
  { key: 'update', icon: Megaphone },
];
export const kindInfo = (key) => POST_KINDS.find((k) => k.key === key) ?? POST_KINDS[0];

export const postKeys = {
  all: ['posts'],
  feed: (params) => ['posts', 'feed', params],
  detail: (id) => ['posts', 'detail', id],
  comments: (id) => ['posts', 'comments', id],
};

export const postsApi = {
  feed: (query) => api.get('/posts', { query }),
  get: (id) => api.get(`/posts/${id}`).then((r) => r.data),
  create: (body) => api.post('/posts', body).then((r) => r.data),
  update: (id, body) => api.patch(`/posts/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/posts/${id}`).then((r) => r.data),
  like: (id) => api.post(`/posts/${id}/like`).then((r) => r.data),
  unlike: (id) => api.delete(`/posts/${id}/like`).then((r) => r.data),
  comments: (id, query) => api.get(`/posts/${id}/comments`, { query }),
  addComment: (id, body) => api.post(`/posts/${id}/comments`, body).then((r) => r.data),
  removeComment: (id) => api.delete(`/comments/${id}`).then((r) => r.data),
};

const nextPage = (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined);

export function usePostFeed(params) {
  return useInfiniteQuery({
    queryKey: postKeys.feed(params),
    queryFn: ({ pageParam }) => postsApi.feed({ ...params, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export const usePost = (id) => useQuery({ queryKey: postKeys.detail(id), queryFn: () => postsApi.get(id), enabled: Boolean(id) });

export function useComments(id) {
  return useInfiniteQuery({
    queryKey: postKeys.comments(id),
    queryFn: ({ pageParam }) => postsApi.comments(id, { page: pageParam, limit: 50 }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: Boolean(id),
  });
}

/** Any community write refreshes every post query (feed, detail, comments). */
export function usePostMutation(fn, options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSettled: (...args) => {
      qc.invalidateQueries({ queryKey: postKeys.all });
      options.onSettled?.(...args);
    },
  });
}

/** Like / unlike with the new count applied to the cached post straight away. */
export function useLike(post) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => (post.likedByMe ? postsApi.unlike(post.id) : postsApi.like(post.id)),
    onSuccess: (res) => {
      const patch = (p) => (p && p.id === post.id ? { ...p, likedByMe: res.liked, likeCount: res.likeCount } : p);
      qc.setQueryData(postKeys.detail(post.id), patch);
      qc.setQueriesData({ queryKey: ['posts', 'feed'] }, (data) =>
        data ? { ...data, pages: data.pages.map((pg) => ({ ...pg, data: pg.data.map(patch) })) } : data,
      );
    },
  });
}
