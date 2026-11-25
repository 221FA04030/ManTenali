import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/apiClient.js';

export const CONTENT_REASONS = ['wrong_info', 'closed', 'spam', 'offensive', 'fraud', 'duplicate', 'other'];
/** "closed" only makes sense for a business. */
export const reasonsFor = (targetType) => (targetType === 'business' ? CONTENT_REASONS : CONTENT_REASONS.filter((r) => r !== 'closed'));
export const SUGGESTION_REASONS = ['new_business', 'correction', 'idea'];
export const MIN_DETAILS = 10;

export const reportsApi = { create: (body) => api.post('/reports', body).then((r) => r.data) };

export const useCreateReport = (options) => useMutation({ mutationFn: reportsApi.create, ...options });
