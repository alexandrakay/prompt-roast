import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import chalk from 'chalk';
import { SYSTEM_PROMPT, MAX_TOKENS, buildUserMessage, printSectionHeader, flushContent } from './index.js';

const ANSI_RE = /\x1b\[[0-9;]*m/;

function captureStdout(fn) {
  let output = '';
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { output += chunk; return true; };
  fn();
  process.stdout.write = original;
  return output;
}

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

describe('printSectionHeader colors (color enabled)', () => {
  beforeEach(() => { chalk.level = 3; });

  it('ROAST header uses red styling', () => {
    const out = captureStdout(() => printSectionHeader('ROAST'));
    assert.ok(ANSI_RE.test(out), 'expected ANSI color codes in ROAST header');
    assert.ok(out.includes('THE ROAST'));
  });

  it('CHARGES header uses yellow styling', () => {
    const out = captureStdout(() => printSectionHeader('CHARGES'));
    assert.ok(ANSI_RE.test(out), 'expected ANSI color codes in CHARGES header');
    assert.ok(out.includes('CHARGES'));
  });

  it('FIXED VERSION header uses green styling', () => {
    const out = captureStdout(() => printSectionHeader('FIXED'));
    assert.ok(ANSI_RE.test(out), 'expected ANSI color codes in FIXED header');
    assert.ok(out.includes('FIXED VERSION'));
  });
});

describe('flushContent colors (color enabled)', () => {
  beforeEach(() => { chalk.level = 3; });

  it('ROAST body text is colored', () => {
    const out = captureStdout(() => flushContent('ROAST', 'this prompt is a disaster\n'));
    assert.ok(ANSI_RE.test(out), 'expected ANSI color codes in ROAST body');
    assert.ok(out.includes('this prompt is a disaster'));
  });

  it('FIXED body text is visually distinct (colored)', () => {
    const out = captureStdout(() => flushContent('FIXED', 'improved prompt here\n'));
    assert.ok(ANSI_RE.test(out), 'expected ANSI color codes in FIXED body');
    assert.ok(out.includes('improved prompt here'));
  });
});

describe('--no-color mode (chalk.level = 0)', () => {
  beforeEach(() => { chalk.level = 0; });
  afterEach(() => { chalk.level = 3; });

  it('ROAST header produces plain text', () => {
    const out = captureStdout(() => printSectionHeader('ROAST'));
    assert.ok(!ANSI_RE.test(out), 'no ANSI codes expected when chalk.level = 0');
    assert.ok(out.includes('THE ROAST'));
  });

  it('FIXED header produces plain text', () => {
    const out = captureStdout(() => printSectionHeader('FIXED'));
    assert.ok(!ANSI_RE.test(out), 'no ANSI codes expected when chalk.level = 0');
    assert.ok(out.includes('FIXED VERSION'));
  });

  it('ROAST body produces plain text', () => {
    const out = captureStdout(() => flushContent('ROAST', 'some roast text\n'));
    assert.ok(!ANSI_RE.test(out), 'no ANSI codes expected when chalk.level = 0');
  });
});
