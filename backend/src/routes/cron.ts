import { Router } from 'express';
import { taskAndTrashSweep } from '../services/taskWorker';
const r = Router();
r.post('/maintenance', async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    const supplied = req.headers['x-cron-secret'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!secret || supplied !== secret) return res.status(401).json({ error: 'Unauthorized' });
    const result = await taskAndTrashSweep();
    res.json({ ok: true, ranAt: new Date().toISOString(), result });
  } catch (e) { next(e); }
});
export default r;
