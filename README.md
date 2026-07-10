# FlowWeek

FlowWeek is a voice-first weekly planning app with dictation, AI text polish, weekly focus planning, local guest storage, and optional Supabase account sync.

## Security setup

Before using cloud sync in production, apply the Supabase RLS policies in `supabase/flowweek_kv_rls.sql`.

For the Vercel AI proxy, configure:

- `ANTHROPIC_API_KEY`
- `ALLOWED_ORIGINS=https://layounizinedine-lgtm.github.io`
- optional `RATE_LIMIT_PER_MINUTE`
- optional `ANTHROPIC_MODEL`

See `SECURITY.md` for details.

## Launch readiness

See [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md) for the current launch analysis, risk list, test plan, and release checklist.
