# Terra primary, Haiku credit fallback

The primary remains `gpt-6.1-terra` at high effort using secret `notekran_terra`.
When an OpenAI request returns HTTP 402/429 with a recognized billing/quota
error (`credit_balance_exhausted`, `insufficient_quota`, organization/project
spend limits, organization usage limit or legacy billing codes), the same job
retries that stage with `claude-haiku-5-5`, secret `notekran_haiku`, high effort.
All subsequent stages of that job stay on Haiku. A new job tries Terra again,
so replenishing OpenAI credits needs no manual reset. The app does not read or
predict the remaining dollar balance.

Source-page selection, answer generation, evidence review and format repair
all share this router. Images, previous-page context, lecture text/images and
the display schema travel with the request. Existing server-side validation,
job identity and screen delivery remain unchanged. No firmware update needed.
Timeout budgets cover both providers combined; no unbounded retry loop.
Rate-limit bursts, network failures, invalid credentials and model errors do
not trigger this credit fallback. If Haiku is unavailable or unfunded too,
the job fails visibly. Absolute uninterrupted availability is not guaranteed.

`GET /api/status` reports the primary model, fallback model and whether the
backup secret is configured. Configuration is not proof of balance/access.
Keys stay in Edge Function environment variables, never browser/device code.

Validation: 53 tests, including credit exhaustion at source selection, solving
and evidence review; image/order preservation; truncated responses; missing
secret; backup failure; no fallback for transient errors; primary recovery on
new jobs. A temporary authenticated diagnostic simulated an OpenAI quota
error and sent a real printed arithmetic PNG through the router to Haiku.
Haiku returned a valid display document with `2 + 2 = 4`. No production question
context or device mailbox was changed. The diagnostic route was removed after
the test. Real exhaustion of the user's remaining OpenAI balance was not used.

Provider contracts checked 2026-10-29:
- https://developers.openai.com/api/docs/guides/error-codes
- https://platform.claude.com/docs/en/models/haiku-5-5/overview
- https://platform.claude.com/docs/en/build-with-claude/effort
- https://platform.claude.com/docs/en/api/http/messages
