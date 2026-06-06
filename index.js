#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

export const SYSTEM_PROMPT = `You are a brutal, snarky prompt critic. Your job is to tear apart bad prompts, charge them for every crime, and hand back a rewrite that actually works.

Output EXACTLY three sections with these literal markers — no markdown, no extra formatting:

[ROAST]
3 sentences. Be specific and cutting — name the exact failure mode, don't just say "this is vague." Reference what the prompt actually says (or doesn't say). No softening. No praise.

[CHARGES]
Charges for every flaw you observe (max 5). Evaluate against these categories: missing context, undefined audience, ambiguous output format, no constraints, underspecified task. Only charge for flaws you can actually see — don't invent them.

Format each line as:
✗ <charge name>: <one-line description> — quote the offending fragment or omission from the original prompt

[FIXED]
The corrected prompt. Rewrite from scratch. Infer intent even when the original is vague — ambiguity is a charge, but you still fix it. Resolve every charge. No commentary, just the improved prompt.`;

export const MAX_TOKENS = 2048;

const MARKERS = ['[ROAST]', '[CHARGES]', '[FIXED]'];
const SECTION_MAP = { '[ROAST]': 'ROAST', '[CHARGES]': 'CHARGES', '[FIXED]': 'FIXED' };

export function getClipboardCommand(platform) {
  if (platform === 'darwin') return { cmd: 'pbcopy', args: [] };
  if (platform === 'linux') return { cmd: 'xclip', args: ['-selection', 'clipboard'] };
  return null;
}

export function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    const spec = getClipboardCommand(process.platform);
    if (!spec) {
      process.stderr.write(chalk.yellow('⚠ Clipboard not supported on this platform.\n'));
      return resolve();
    }
    const proc = spawn(spec.cmd, spec.args);
    proc.stdin.write(text);
    proc.stdin.end();
    proc.on('close', code => {
      if (code === 0) {
        process.stdout.write(chalk.dim('✓ Fixed prompt copied to clipboard\n'));
        resolve();
      } else {
        process.stderr.write(chalk.yellow(`⚠ Could not copy to clipboard (${spec.cmd} exited ${code}).\n`));
        resolve();
      }
    });
    proc.on('error', () => {
      process.stderr.write(chalk.yellow(`⚠ Clipboard utility not found (${spec.cmd}). Install it and try again.\n`));
      resolve();
    });
  });
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}

export async function readFilePrompt(filePath) {
  const content = await readFile(filePath, 'utf8');
  return content.trim();
}

async function parseArgs() {
  program
    .name('roast')
    .description('Your prompt reviewed, roasted, and returned fixed.')
    .version('1.0.0')
    .argument('[prompt]', 'The prompt to roast (or pipe via stdin)')
    .option('-m, --model <model>', 'Claude model to use', 'claude-haiku-4-5')
    .option('-t, --task <task>', 'Task context (e.g. "code review", "email writing")')
    .option('-f, --file <path>', 'Read prompt from a file')
    .option('-c, --copy', 'Copy FIXED output to clipboard after streaming')
    .option('--no-color', 'Disable color output')
    .parse();

  const opts = program.opts();
  let prompt = program.args[0];

  if (prompt && opts.file) {
    process.stderr.write(chalk.red('✗ Provide a prompt as an argument or via --file, not both.\n'));
    process.exit(1);
  }

  if (opts.file) {
    prompt = await readFilePrompt(opts.file);
  } else if (!prompt && !process.stdin.isTTY) {
    prompt = await readStdin();
  }

  return { prompt, options: opts };
}

export function buildUserMessage(prompt, task) {
  if (task) {
    return `Task context: ${task}\n\nPrompt to roast:\n${prompt}`;
  }
  return `Prompt to roast:\n${prompt}`;
}

export function printSectionHeader(section) {
  if (section === 'ROAST') {
    process.stdout.write('\n' + chalk.bold.red('THE ROAST') + '\n');
  } else if (section === 'CHARGES') {
    process.stdout.write('\n' + chalk.bold.yellow('CHARGES') + '\n');
  } else if (section === 'FIXED') {
    process.stdout.write('\n' + chalk.bold.green('FIXED VERSION') + '\n');
    process.stdout.write(chalk.dim('─'.repeat(60)) + '\n');
  }
}

function printSectionFooter(section) {
  if (section === 'FIXED') {
    process.stdout.write(chalk.dim('─'.repeat(60)) + '\n');
  }
}

export function flushContent(section, text) {
  if (!text) return;
  if (section === 'ROAST') {
    process.stdout.write(chalk.yellow(text));
  } else if (section === 'CHARGES') {
    process.stdout.write(text.replace(/^✗/gm, chalk.red('✗')));
  } else if (section === 'FIXED') {
    process.stdout.write(chalk.cyan(text));
  } else {
    process.stdout.write(text);
  }
}

async function streamRoast(prompt, options) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    process.stderr.write(chalk.red('✗ ANTHROPIC_API_KEY is not set. Set it and try again.\n'));
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const spinner = ora({ text: 'Analyzing your prompt...', color: 'red' }).start();

  let currentSection = null;
  let buffer = '';
  let firstChunk = true;
  let fixedAccumulator = '';

  try {
    const stream = await client.messages.stream({
      model: options.model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(prompt, options.task) }],
    });

    for await (const chunk of stream) {
      if (chunk.type !== 'content_block_delta' || chunk.delta.type !== 'text_delta') continue;

      const text = chunk.delta.text;

      if (firstChunk) {
        spinner.stop();
        firstChunk = false;
      }

      buffer += text;

      let foundMarker = false;
      for (const marker of MARKERS) {
        const idx = buffer.indexOf(marker);
        if (idx !== -1) {
          foundMarker = true;
          const before = buffer.slice(0, idx);
          if (currentSection) {
            flushContent(currentSection, before);
            printSectionFooter(currentSection);
            if (options.copy && currentSection === 'FIXED') fixedAccumulator += before;
          }
          currentSection = SECTION_MAP[marker];
          printSectionHeader(currentSection);
          buffer = buffer.slice(idx + marker.length);
          break;
        }
      }

      if (!foundMarker && currentSection) {
        const mightBeMarker = MARKERS.some(m => {
          for (let i = 1; i < m.length; i++) {
            if (buffer.endsWith(m.slice(0, i))) return true;
          }
          return false;
        });

        if (!mightBeMarker && buffer.includes('\n')) {
          const lines = buffer.split('\n');
          const toFlush = lines.slice(0, -1).join('\n') + '\n';
          buffer = lines[lines.length - 1];
          flushContent(currentSection, toFlush);
          if (options.copy && currentSection === 'FIXED') fixedAccumulator += toFlush;
        }
      }
    }

    if (currentSection && buffer.trim()) {
      const tail = buffer.trim() + '\n';
      flushContent(currentSection, tail);
      printSectionFooter(currentSection);
      if (options.copy && currentSection === 'FIXED') fixedAccumulator += tail;
    }

    process.stdout.write('\n');

    if (options.copy && fixedAccumulator) {
      await copyToClipboard(fixedAccumulator.trim());
    }
  } catch (err) {
    spinner.stop();
    if (err.status === 401) {
      process.stderr.write(chalk.red('✗ Invalid API key. Check ANTHROPIC_API_KEY.\n'));
    } else if (err.status === 429) {
      process.stderr.write(chalk.red('✗ Rate limited. Slow down.\n'));
    } else {
      process.stderr.write(chalk.red(`✗ ${err.message}\n`));
    }
    process.exit(1);
  }
}

async function main() {
  const { prompt, options } = await parseArgs();

  if (options.color === false) {
    chalk.level = 0;
  }

  if (!prompt || !prompt.trim()) {
    process.stderr.write(chalk.red('✗ Provide a prompt to roast.\n'));
    process.exit(1);
  }

  await streamRoast(prompt, options);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
