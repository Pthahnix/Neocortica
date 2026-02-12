// src/server.ts — NEOCORTICA Backend API

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { paperRoutes } from './routes.js';

const app = new Hono();

app.route('/api/paper', paperRoutes);

app.get('/health', (c) => c.json({ status: 'ok', version: '2.0.0' }));

const port = parseInt(process.env['PORT'] ?? '3000');
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`NEOCORTICA backend listening on 0.0.0.0:${port}`);
});
