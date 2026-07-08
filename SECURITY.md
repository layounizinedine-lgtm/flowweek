# FlowWeek Security Notes

FlowWeek stores guest data locally in the browser. Account sync uses Supabase and must run with Row Level Security enabled.

## Required Production Settings

- Set `ANTHROPIC_API_KEY` only in Vercel environment variables.
- Optional: set `ANTHROPIC_MODEL` in Vercel to choose the model without editing code.
- Optional: set `ALLOWED_ORIGINS` to a comma-separated allowlist. Recommended:
  - `https://layounizinedine-lgtm.github.io`
- Optional: set `RATE_LIMIT_PER_MINUTE` for the AI proxy.

## Supabase

Apply `supabase/flowweek_kv_rls.sql` in the Supabase SQL editor before treating cloud sync as production-safe.

The frontend anon key is not a secret. Security depends on Supabase Auth plus Row Level Security policies.

## Privacy Defaults

Auto-polish is disabled by default so dictated text is not sent to the AI proxy automatically. Users explicitly opt in or press the AI buttons.

