# PRD: prompt-roast CLI

## Overview
A Node.js CLI that takes a prompt, tears it apart, bills the user for every crime, and returns a rewritten version. Published to npm as `prompt-roast` with a `roast` binary.

## Goals
- Give developers instant, no-fluff feedback on their prompts
- Make prompt improvement fast enough to do in a terminal mid-workflow
- Be memorable enough that people share it

## Non-Goals
- No web UI (separate project)
- No saved history
- No config files

---

## Installation & Usage

```bash
npm install -g prompt-roast
export ANTHROPIC_API_KEY=sk-...
roast "summarize this document for me"
roast --task "customer email" "write something professional"
roast --model claude-sonnet-4-6 "my fancy prompt"
```

---

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `<prompt>` | required | The prompt to roast (positional arg) |
| `--task <task>` | none | Task context (e.g. "code review", "email writing") — prepended to the user message |
| `--model <model>` | `claude-haiku-4-5` | Claude model to use |
| `--no-color` | false | Disable chalk color output |
| `--version` | — | Print version |
| `--help` | — | Print usage |

---

## API Key
- Read from `ANTHROPIC_API_KEY` environment variable only
- No config file, no flag
- If missing: print one pointed error and exit 1

---

## Claude Integration
- SDK: `@anthropic-ai/sdk` (official)
- Model default: `claude-haiku-4-5` (fast, cheap, sharp enough)
- Streaming: yes — stream the response and parse section markers as they arrive
- `max_tokens`: 1024

### System Prompt (locked)
```
You are a brutal, snarky prompt critic. Your job is to tear apart bad prompts, charge for every crime, and then hand back a fixed version.

Output EXACTLY three sections with these literal markers — no markdown, no extra formatting:

[ROAST]
A 3-sentence roast of the prompt. Be sharp, specific, and rude about what's wrong. No softening. No praise.

[CHARGES]
A bulleted list of charges. Each charge is a specific flaw (max 5 bullets). Format each line as:
✗ <charge name>: <one-line description of the crime>
Only include real flaws you observe. Don't pad.

[FIXED]
The corrected prompt. Rewrite it from scratch. Infer the user's intent even if they were vague — ambiguity is a charge, but you still fix it. No commentary, just the improved prompt.
```

---

## Output Format

### Rendering Rules
- Show a spinner ("Analyzing your prompt...") while waiting for first token
- Stop spinner silently when first token arrives — no transition message
- Stream output section by section as markers arrive

### Section: THE ROAST
```
THE ROAST                    ← bold white
<roast text streamed live>
```

### Section: CHARGES
```
CHARGES                      ← bold white
✗ Vagueness: ...             ← ✗ in red, rest default
✗ No context: ...
```

### Section: FIXED VERSION
```
FIXED VERSION                ← bold white
────────────────────────────  ← dim/gray border (60 chars)
<fixed prompt streamed live>
────────────────────────────  ← dim/gray border
```

### Charge rules
- Max 5 charges
- Only charges for real observed flaws (no padding)
- Ambiguity always charged if intent unclear

---

## Error Handling

| Scenario | Message | Exit |
|----------|---------|------|
| `ANTHROPIC_API_KEY` not set | `✗ ANTHROPIC_API_KEY is not set. Set it and try again.` | 1 |
| 401 Unauthorized | `✗ Invalid API key. Check ANTHROPIC_API_KEY.` | 1 |
| 429 Rate limited | `✗ Rate limited. Slow down.` | 1 |
| Other API error | `✗ <error message>` | 1 |
| Empty prompt | `✗ Provide a prompt to roast.` | 1 |

All errors go to stderr.

---

## Tech Stack

| Concern | Choice | Reason |
|---------|--------|--------|
| Runtime | Node.js ESM (`"type": "module"`) | chalk v5 / ora v9 are ESM-only |
| CLI framework | `commander` v15 | standard, minimal |
| Spinner | `ora` v9 | clean, ESM-compatible |
| Color | `chalk` v5 | ESM-only, best terminal color lib |
| AI SDK | `@anthropic-ai/sdk` | official |

---

## Package

```json
{
  "name": "prompt-roast",
  "bin": { "roast": "./index.js" },
  "type": "module",
  "license": "MIT"
}
```

Published to npm. Users install globally with `npm install -g prompt-roast`.

---

## File Structure

```
prompt-roast/
├── index.js          ← entire CLI (single file)
├── package.json
├── package-lock.json
├── .gitignore
└── PRD.md
```

---

## Acceptance Criteria

- [ ] `roast "bad prompt"` streams output with all three sections formatted correctly
- [ ] `--task` prepends context to the user message
- [ ] `--model` overrides the default model
- [ ] Missing API key prints pointed error and exits 1
- [ ] Spinner stops silently when first token arrives
- [ ] Charges rendered with red ✗
- [ ] Fixed version wrapped in dim border box
- [ ] Published to npm and installable globally
