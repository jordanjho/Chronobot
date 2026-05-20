import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import type net from 'node:net';

vi.mock('../../src/config.js', () => ({
  config: { METRICS_PORT: 0 },
}));

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { startMetricsServer } = await import('../../src/metrics/server.js');
const { registry } = await import('../../src/metrics/metrics.js');

function httpGet(port: number, path: string): Promise<{ statusCode: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body, headers: res.headers }));
    }).on('error', reject);
  });
}

describe('metrics HTTP server', () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    registry.resetMetrics();
    server = startMetricsServer();
    await new Promise<void>((resolve) => server.once('listening', resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /metrics returns 200', async () => {
    const { statusCode } = await httpGet(port, '/metrics');
    expect(statusCode).toBe(200);
  });

  it('GET /metrics Content-Type matches registry.contentType', async () => {
    const { headers } = await httpGet(port, '/metrics');
    expect(headers['content-type']).toBe(registry.contentType);
  });

  it('GET /metrics body contains chronobot_jobs_enqueued_total', async () => {
    const { body } = await httpGet(port, '/metrics');
    expect(body).toContain('chronobot_jobs_enqueued_total');
  });

  it('GET /healthz returns 200 with body ok', async () => {
    const { statusCode, body } = await httpGet(port, '/healthz');
    expect(statusCode).toBe(200);
    expect(body).toBe('ok');
  });

  it('GET /unknown returns 404', async () => {
    const { statusCode } = await httpGet(port, '/unknown');
    expect(statusCode).toBe(404);
  });
});
