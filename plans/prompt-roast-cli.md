# Plan: prompt-roast CLI

**PRD**: `./PRD.md`
**Repo**: alexandrakay/prompt-roast
**Created**: 2026-06-01

---

## Architectural Decisions

### Binary
- Single `roast` binary, entry point `index.js`
- Installed globally via `npm install -g prompt-roast`

### Key Models
- No persistent state — stateless per invocation
- Output parsed from three literal section markers: `[ROAST]`, `[CHARGES]`, `[FIXED]`
- Sections streamed and rendered progressively as markers arrive in the stream

### Service Boundaries
- `ANTHROPIC_API_KEY` env var → Anthropic Messages API (streaming)
- No other external services

### Error Contract
- All errors → stderr
- All errors → exit code 1
- No multi-line error messages — one pointed line per failure mode

---

## Phase 1: Verified happy path

**User stories**: core roast flow

### What to build
Smoke test the existing implementation with a real API key. Run `roast "bad prompt"` end-to-end and confirm all three sections render correctly: THE ROAST body text, CHARGES list with red ✗ prefixes, and FIXED VERSION wrapped in a dim border box. Confirm the spinner starts on launch and stops silently when the first token arrives. Fix any streaming or marker-parsing bugs surfaced during testing.

### Acceptance criteria
- [ ] `roast "write me a poem"` completes without error
- [ ] THE ROAST section prints with bold white header and 3-sentence body
- [ ] CHARGES section prints with bold white header and ✗ lines in red
- [ ] FIXED VERSION section prints with bold white header, dim border top and bottom, and rewritten prompt inside
- [ ] Spinner is visible on launch and disappears silently when output begins
- [ ] No leftover marker text (`[ROAST]`, `[CHARGES]`, `[FIXED]`) appears in output

---

## Phase 2: Flags and error states hardened

**User stories**: --task, --model, --no-color, all error paths

### What to build
Verify every flag and every error path against the spec. `--task` prepends context correctly to the user message. `--model` overrides the default. `--no-color` disables chalk formatting. Each error scenario (missing API key, invalid API key, rate limit, empty prompt) exits 1 and prints exactly the specified message to stderr — no stack traces, no multi-line output.

### Acceptance criteria
- [ ] `roast --task "customer email" "be professional"` includes task context in the request
- [ ] `roast --model claude-sonnet-4-6 "test"` uses the specified model
- [ ] `roast --no-color "test"` produces plain text output
- [ ] Running without `ANTHROPIC_API_KEY` set prints `✗ ANTHROPIC_API_KEY is not set. Set it and try again.` to stderr and exits 1
- [ ] An invalid API key prints `✗ Invalid API key. Check ANTHROPIC_API_KEY.` to stderr and exits 1
- [ ] `roast ""` or `roast " "` prints `✗ Provide a prompt to roast.` to stderr and exits 1

---

## Phase 3: Published to npm

**User stories**: discoverability, installation, name claim

### What to build
Write the README with installation instructions, required env var setup, usage examples with sample output, and available flags. Publish to npm to claim the `prompt-roast` package name. Verify the full install-and-use flow works from a clean environment.

### Acceptance criteria
- [ ] README includes install command, env var setup, and at least one example with sample output
- [ ] `npm publish` succeeds and `prompt-roast` is visible on npmjs.com
- [ ] `npm install -g prompt-roast` installs the `roast` binary correctly
- [ ] `roast --version` prints `1.0.0` after global install
- [ ] `roast --help` prints usage after global install
