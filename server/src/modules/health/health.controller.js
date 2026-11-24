import { getHealth } from './health.service.js';
import { errorBody } from '../../common/utils/response.js';

export async function health(_req, res) {
  const data = await getHealth();
  if (data.db !== 'up') {
    return res.status(503).json(errorBody('SERVICE_UNAVAILABLE', 'Database unavailable.', data));
  }
  return res.status(200).json({ success: true, data });
}
