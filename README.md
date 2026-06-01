# prompt-roast

Your prompt reviewed, roasted, and returned fixed.

```
$ roast "summarize this for me"

THE ROAST
"Summarize this for me" is the prompt equivalent of handing someone a locked box
and asking them to describe the contents. You've provided no subject, no target
length, no audience, and no format — just vibes. Congrats on outsourcing all the
thinking to the model.

CHARGES
✗ No subject: You said "this" but provided nothing to summarize.
✗ No output format: Bullet points? Paragraph? Tweet? Pick one.
✗ No audience: Who is this summary for? A 5-year-old? An exec? A peer?
✗ No length constraint: "Summarize" can mean 3 words or 3 pages.

FIXED VERSION
────────────────────────────────────────────────────────────
Summarize the following article in 3 bullet points for a non-technical audience.
Each bullet should be one sentence. Focus on the main takeaway, not the details.

[article text here]
────────────────────────────────────────────────────────────
```

## Install

```bash
npm install -g prompt-roast
```

## Setup

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Add that to your shell profile (`~/.zshrc`, `~/.bashrc`) to make it permanent.

## Usage

```bash
roast "<your prompt>"
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--task <task>` | — | Task context — shapes the roast (e.g. `"code review"`, `"customer email"`) |
| `--model <model>` | `claude-haiku-4-5` | Claude model to use |
| `--no-color` | — | Disable color output |
| `--version` | — | Print version |
| `--help` | — | Print usage |

### Examples

```bash
# Basic roast
roast "write me a poem"

# With task context
roast --task "customer support email" "be empathetic and resolve their issue"

# Use a more powerful model
roast --model claude-sonnet-4-6 "my very important prompt"

# Plain text output
roast --no-color "test prompt" > review.txt
```

## How it works

Streams your prompt to Claude with a locked system prompt that forces three sections: a 3-sentence roast, a charge sheet of specific flaws (max 5), and a rewritten version from scratch. Sections render progressively as they stream in.

## License

MIT
