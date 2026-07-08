// Tiny health check: /api/ping — no fetch, no deps. If this returns JSON, the
// serverless functions are live on this deployment; if it's a blank page, the
// domain isn't serving our latest /api build (check which branch/commit Vercel
// deploys to production).
export default function handler(req, res) {
  return res.json({ ok: true, build: 'ping-v1', method: req.method })
}
