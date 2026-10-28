# Internship Radar private AI gateway

This is an **optional** private Cloudflare Worker. The public GitHub Pages app never contains the model provider key.

## Deploy
1. Create a Cloudflare account with Workers enabled. From this directory run `npx wrangler deploy`.
2. Run `npx wrangler secret put OPENAI_API_KEY`.
3. Run `npx wrangler secret put RADAR_ACCESS_TOKEN` and set a long, random token (24+ chars).
4. Optional: `npx wrangler secret put BRAVE_SEARCH_API_KEY` to enable live indexed web research. Without it, company research has no fresh search evidence.
5. In the Copilot page, enter the Worker URL and your access token. The token is kept in memory, never localStorage. Do **not** publish it.
6. Monitor Cloudflare and provider spend. Set Cloudflare firewall/rate limiting rules. The token is a personal shared secret, **not** multi-user authentication. Rotate it if exposed.

Only the deployed worker can call the AI API; requests require a matching origin AND the personal token. This is suitable for a personal trial, not a production user-account system. For a public multi-user launch, add per-user identity, quotas and a persistent consent model.

The worker does not send messages or submit applications. It provides source URLs when optional search is enabled and leaves applicant facts grounded in the supplied resume.
