import http from 'node:http';
import { registry } from './metrics.js';
import { config } from '../config.js';
import logger from '../utils/logger.js';

export function startMetricsServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/metrics') {
      try {
        const metrics = await registry.metrics();
        res.writeHead(200, { 'Content-Type': registry.contentType });
        res.end(metrics);
      } catch (err) {
        res.writeHead(500);
        res.end('metrics error');
      }
    } else if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(config.METRICS_PORT, () => {
    logger.info({ port: config.METRICS_PORT }, 'Metrics server listening');
  });

  return server;
}
