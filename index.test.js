import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_PROMPT, MAX_TOKENS, buildUserMessage } from './index.js';

describe('SYSTEM_PROMPT', () => {
  it('contains a rubric of concrete charge categories', () => {
    const categories = [
      'missing context',
      'undefined audience',
      'output format',
      'no constraints',
      'underspecified',
    ];
    for (const category of categories) {
      assert.ok(
        SYSTEM_PROMPT.toLowerCase().includes(category),
        `SYSTEM_PROMPT missing charge category: "${category}"`
      );
    }
  });

  it('instructs Claude to quote the offending fragment', () => {
    assert.ok(
      SYSTEM_PROMPT.toLowerCase().includes('quote'),
      'SYSTEM_PROMPT should instruct Claude to quote the offending fragment'
    );
  });

  it('uses the [ROAST], [CHARGES], [FIXED] section markers', () => {
    assert.ok(SYSTEM_PROMPT.includes('[ROAST]'));
    assert.ok(SYSTEM_PROMPT.includes('[CHARGES]'));
    assert.ok(SYSTEM_PROMPT.includes('[FIXED]'));
  });
});

describe('MAX_TOKENS', () => {
  it('is at least 2048 to avoid truncating longer fixed prompts', () => {
    assert.ok(MAX_TOKENS >= 2048, `MAX_TOKENS is ${MAX_TOKENS}, expected >= 2048`);
  });
});

describe('buildUserMessage', () => {
  it('returns just the prompt when no task provided', () => {
    const msg = buildUserMessage('write me a poem', undefined);
    assert.ok(msg.includes('write me a poem'));
    assert.ok(!msg.includes('Task context'));
  });

  it('prepends task context when provided', () => {
    const msg = buildUserMessage('be professional', 'customer email');
    assert.ok(msg.includes('Task context: customer email'));
    assert.ok(msg.includes('be professional'));
  });
});
