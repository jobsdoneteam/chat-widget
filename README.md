# Jobs Done Chat Widget

A self-contained floating chat widget + Node.js/Express FAQ bot for [jobsdone.team](https://jobsdone.team). Powered by Anthropic Claude Haiku. Captures leads, answers FAQs, and escalates when needed.

---

## What This Is

- **`chat-widget.js`** — Drop-in vanilla JS widget. No dependencies, no frameworks. Shows a floating wrench-icon bubble in the bottom-right corner. Click opens a dark chat modal.
- **`chat-api/`** — Node.js Express API that handles conversations via Claude Haiku, captures lead info, and fires webhook/email notifications.

### Bot behavior
- Answers questions about Jobs Done services, pricing, $JOBS token
- Detects buying intent -> triggers 3-step lead capture flow (business type, biggest problem, contact info)
- Escalates out-of-scope questions with "Let me get J.D. on this"
- Logs every conversation to `conversations.jsonl`

---

## Deploy the Widget (Frontend)

Drop one `<script>` tag before `</body>` in any HTML page:

```html
<script src="https://YOUR_CDN_OR_SERVER/chat-widget.js"></script>
```

The widget auto-initializes. No config needed if your API is at `/api/chat` on the same domain.

If your API is on a different domain, edit the `API_URL` constant at the top of `chat-widget.js`:

```js
var API_URL = 'https://api.jobsdone.team/api/chat';
```

### Inject into jobsdone-web HTML files

For `onboard.html`, `onboard-v2.html`, or any other page in the `jobsdoneteam/jobsdone-web` repo:

```html
<!-- Just before </body> -->
<script src="/chat-widget.js"></script>
```

Serve `chat-widget.js` from the same webroot, or host it on the IONOS server and reference it with the full URL.

---

## Run the API

### 1. Install dependencies

```bash
cd chat-api
npm install
```

### 2. Set environment variables

```bash
cp .env.example .env
# Edit .env with your real values
```

Required:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)

Optional but recommended:
- `WEBHOOK_URL` — POST target for lead data (Make.com, Zapier, n8n, etc.)
- `NOTIFICATION_EMAIL` — defaults to `jobsdoneteam@gmail.com`
- `ALLOWED_ORIGIN` — set to `https://jobsdone.team` in production

### 3. Start the server

```bash
node server.js
# or for development with auto-restart:
node --watch server.js
```

API will be live at `http://localhost:3001`.

Health check: `GET /health`

---

## Deployment Notes

### IONOS Server (198.71.54.203)

```bash
# SSH in, clone repo, install, run with PM2
npm install -g pm2
cd chat-api
npm install
pm2 start server.js --name jobsdone-chat-api
pm2 save
pm2 startup
```

Proxy through your existing nginx config:

```nginx
location /api/chat {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Serve the widget JS file from the webroot:

```nginx
location /chat-widget.js {
    alias /var/www/jobsdone/chat-widget.js;
}
```

### Vercel (API only)

Vercel doesn't natively support long-lived Express apps, but you can wrap it:

1. Add `vercel.json` pointing routes to `chat-api/server.js`
2. Deploy with `vercel --prod`
3. Note: `conversations.jsonl` won't persist on serverless — swap for a DB or external log service

### Railway

1. Connect repo to Railway
2. Set root directory to `chat-api`
3. Add env vars in Railway dashboard
4. Deploy — Railway handles the rest

---

## API Reference

### `POST /api/chat`

Request:
```json
{
  "sessionId": "jd_abc123",
  "message": "What does the Growth plan include?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Response:
```json
{
  "reply": "Growth is $197/month and includes...",
  "action": "continue"
}
```

`action` values:
- `continue` — normal conversation
- `capture_lead` — widget starts the lead capture flow
- `escalate` — out-of-scope, J.D. notified

---

## $JOBS Token

Contract: `0xeCd6739417c96ec3FBE76d2852dDb6d76625cb07`  
10% of profits burned monthly. Not required to use the service.

---

## License

MIT
