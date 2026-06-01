#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a brutal, snarky prompt critic. Your job is to tear apart bad prompts, charge for every crime, and then hand back a fixed version.

Output EXACTLY three sections with these literal markers — no markdown, no extra formatting:

[ROAST]
A 3-sentence roast of the prompt. Be sharp, specific, and rude about what's wrong. No softening. No praise.

[CHARGES]
A bulleted list of charges. Each charge is a specific flaw (max 5 bullets). Format each line as:
✗ <charge name>: <one-line description of the crime>
Only include real flaws you observe. Don't pad.

[FIXED]
The corrected prompt. Rewrite it from scratch. Infer the user's intent even if they were vague — ambiguity is a charge, but you still fix it. No commentary, just the improved prompt.`;

const MARKERS = ['[ROAST]', '[CHARGES]', '[FIXED]'];
const SECTION_MAP = { '[ROAST]': 'ROAST', '[CHARGES]': 'CHARGES', '[FIXED]': 'FIXED' };

function parseArgs() {
  program
    .name('roast')
    .description('Your prompt reviewed, roasted, and returned fixed.')
    .version('1.0.0')
    .argument('<prompt>', 'The prompt to roast')
    .option('-m, --model <model>', 'Claude model to use', 'claude-haiku-4-5')
    .option('-t, --task <task>', 'Task context (e.g. "code review", "email writing")')
    .option('--no-color', 'Disable color output')
    .parse();

  return { prompt: program.args[0], options: program.opts() };
}

function buildUserMessage(prompt, task) {
  if (task) {
    return `Task context: ${task}\n\nPrompt to roast:\n${prompt}`;
  }
  return `Prompt to roast:\n${prompt}`;
}

function printSectionHeader(section) {
  if (section === 'ROAST') {
    process.stdout.write('\n' + chalk.bold.white('THE ROAST') + '\n');
  } else if (section === 'CHARGES') {
    process.stdout.write('\n' + chalk.bold.white('CHARGES') + '\n');
  } else if (section === 'FIXED') {
    process.stdout.write('\n' + chalk.bold.white('FIXED VERSION') + '\n');
    process.stdout.write(chalk.dim('─'.repeat(60)) + '\n');
  }
}

function printSectionFooter(section) {
  if (section === 'FIXED') {
    process.stdout.write(chalk.dim('─'.repeat(60)) + '\n');
  }
}

function flushContent(section, text) {
  if (!text) return;
  if (section === 'CHARGES') {
    process.stdout.write(text.replace(/^✗/gm, chalk.red('✗')));
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

  try {
    const stream = await client.messages.stream({
      model: options.model,
      max_tokens: 1024,
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
        }
      }
    }

    if (currentSection && buffer.trim()) {
      flushContent(currentSection, buffer.trim() + '\n');
      printSectionFooter(currentSection);
    }

    process.stdout.write('\n');
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
  const { prompt, options } = parseArgs();

  if (options.color === false) {
    chalk.level = 0;
  }

  if (!prompt || !prompt.trim()) {
    process.stderr.write(chalk.red('✗ Provide a prompt to roast.\n'));
    process.exit(1);
  }

  await streamRoast(prompt, options);
}

main();
