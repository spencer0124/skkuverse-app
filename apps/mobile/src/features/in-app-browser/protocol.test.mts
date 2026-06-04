import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageMessage, PAGE_MSG_SENTINEL } from './protocol.ts';

test('parses a valid page_extracted message', () => {
  const raw = JSON.stringify({
    sentinel: PAGE_MSG_SENTINEL,
    type: 'page_extracted',
    title: '공지',
    text: '본문',
    url: 'https://x.test/a',
  });
  const msg = parsePageMessage(raw);
  assert.equal(msg?.type, 'page_extracted');
  assert.equal(msg && 'text' in msg ? msg.text : null, '본문');
});

test('parses a valid page_extract_error message', () => {
  const raw = JSON.stringify({
    sentinel: PAGE_MSG_SENTINEL,
    type: 'page_extract_error',
    message: 'boom',
  });
  const msg = parsePageMessage(raw);
  assert.equal(msg?.type, 'page_extract_error');
});

test('rejects a message without our sentinel (e.g. some other postMessage)', () => {
  const raw = JSON.stringify({ type: 'page_extracted', text: 'x' });
  assert.equal(parsePageMessage(raw), null);
});

test('rejects a message with a foreign sentinel', () => {
  const raw = JSON.stringify({ sentinel: 'other', type: 'page_extracted' });
  assert.equal(parsePageMessage(raw), null);
});

test('rejects non-JSON input', () => {
  assert.equal(parsePageMessage('not json {{{'), null);
});

test('rejects valid JSON that is not an object', () => {
  assert.equal(parsePageMessage('42'), null);
  assert.equal(parsePageMessage('"hi"'), null);
  assert.equal(parsePageMessage('null'), null);
});
