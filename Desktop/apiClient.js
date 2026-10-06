const http = require('node:http');
const https = require('node:https');

function requestJson(urlString, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return reject(new Error('Invalid backend protocol.'));
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: data ? 'POST' : 'GET', timeout: 300000,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {}) }
    }, response => {
      let text = '';
      response.on('data', chunk => {
        text += chunk;
        if (text.length > 1024 * 1024) request.destroy(new Error('Unexpectedly large backend response.'));
      });
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('Backend response was interrupted.')));
      response.on('end', () => {
        try { resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, body: JSON.parse(text) }); }
        catch { reject(new Error('Backend returned an invalid confirmation.')); }
      });
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('Upload timed out; the saved copy will be retried.')));
    if (data) request.write(data);
    request.end();
  });
}
module.exports = { requestJson };
