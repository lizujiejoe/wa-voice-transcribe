import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSettings } from '../settings.js';

test('existing provider settings keep their keys and default to Chinese translation', () => {
  const settings = normalizeSettings({
    engine: 'custom',
    providers: {
      custom: { apiKey: 'existing-key', baseUrl: 'https://example.workers.dev/v1', model: 'whisper-large-v3-turbo' }
    }
  });
  assert.equal(settings.providers.custom.apiKey, 'existing-key');
  assert.equal(settings.targetLanguage, 'zh');
});

test('translation sends only the transcript to the custom text endpoint', async () => {
  let handler;
  let request;
  const settings = {
    engine: 'custom',
    targetLanguage: 'fr',
    providers: {
      custom: { apiKey: 'test-key', baseUrl: 'https://example.workers.dev/v1', model: 'whisper-large-v3-turbo' }
    }
  };

  globalThis.chrome = {
    i18n: { getMessage: (key) => key },
    storage: { local: { get: async () => settings } },
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener(fn) { handler = fn; } }
    },
    alarms: { onAlarm: { addListener() {} } }
  };
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({ text: 'Bonjour' });
  };

  await import('../background.js');
  const result = await new Promise((resolve) => {
    assert.equal(handler({ type: 'TRANSLATE', text: 'Hello' }, {}, resolve), true);
  });

  assert.deepEqual(result, { ok: true, text: 'Bonjour', targetLanguage: 'fr' });
  assert.equal(request.url, 'https://example.workers.dev/v1/text/translations');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.options.body), { text: 'Hello', target_language: 'fr' });
});
