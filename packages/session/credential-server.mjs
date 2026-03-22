#!/usr/bin/env node
/**
 * Minimal MCP server — credential store only.
 * Handles initialize handshake and keeps alive so CC can connect.
 * Credentials are accessed via the `env` block in .mcp.json.
 */

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  processBuffer();
});
process.stdin.resume();

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const len = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) return;

    const body = buffer.slice(bodyStart, bodyStart + len);
    buffer = buffer.slice(bodyStart + len);

    let msg;
    try { msg = JSON.parse(body); } catch { continue; }
    handleMessage(msg);
  }
}

function send(msg) {
  const json = JSON.stringify(msg);
  const out = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
  process.stdout.write(out);
}

function handleMessage(msg) {
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'neocortica-session', version: '2.0.0' },
      },
    });
  } else if (msg.method === 'notifications/initialized') {
    // no response needed
  } else if (msg.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } });
  } else if (msg.method === 'resources/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { resources: [] } });
  } else if (msg.method === 'prompts/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { prompts: [] } });
  } else if (msg.id !== undefined) {
    send({ jsonrpc: '2.0', id: msg.id, result: {} });
  }
}
