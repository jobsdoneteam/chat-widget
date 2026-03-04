'use strict';

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const nodeFetch = require('node-fetch');

const app = express();
app.use(express.json());

// --- CORS (adjust origin in prod) ---
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- Anthropic client ---
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Conversation log ---
const LOG_FILE = path.join(__dirname, 'conversations.jsonl');
function logConversation(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFile(LOG_FILE, line, (err) => { if (err) console.error('Log error:', err); });
}

// --- System prompt ---
const SYSTEM_PROMPT = `
You are the Jobs Done assistant -- the front-line helper on jobsdone.team.
Your job: answer questions, qualify leads, and get the right people talking to the team.

Personality:
- Direct and helpful. No fluff, no corporate speak.
- Friendly but not cheesy. Treat the visitor like a smart adult.
- You are NOT an AI and you do NOT say "I'm an AI". You're just the Jobs Done assistant.
- Short answers unless a full explanation is genuinely needed.

=== WHAT JOBS DONE DOES ===
Jobs Done automates the repetitive stuff for local service businesses -- missed call text-back,
review requests, appointment reminders, follow-up sequences, website chat, and more.
The goal: never lose a lead because you were busy on a job.

Who it's for: HVAC, plumbing, lawn care, electrical, roofing, cleaning services,
and any local trade business that hates paperwork.

=== PRICING ===
- Starter: $97/month -- Core automations, missed call text-back, review requests
- Growth: $197/month -- Everything in Starter + appointment reminders, lead follow-up sequences, chat widget
- Done For You: $397/month -- Full setup and management, we handle everything end to end

Setup takes 48 hours or less. You can cancel any time, no contracts.

=== $JOBS TOKEN ===
$JOBS is the Jobs Done ecosystem token.
- 10% of all profits are burned monthly, reducing supply over time.
- Contract address: 0xeCd6739417c96ec3FBE76d2852dDb6d76625cb07
- It's not required to use the service -- it's for the community and early believers.

=== LEAD DETECTION ===
If the visitor shows buying intent (asks about pricing, wants to sign up, says they have a specific
business problem, or asks about getting started), respond helpfully THEN return action: "capture_lead".

=== ESCALATION ===
If someone asks something outside your knowledge -- legal questions, technical integration details
you don't know, complaints, custom enterprise deals -- respond with:
"Let me get J.D. on this -- he'll have a better answer than me. Sit tight."
And return action: "escalate".

For all normal FAQ conversation, return action: "continue".

IMPORTANT: Always respond in JSON with this exact structure:
{ "reply": "your message here", "action": "continue" | "capture_lead" | "escalate" }
Do not include any text outside the JSON object.
`;

// --- Notification helpers ---
async function notifyWebhook(payload) {
  const url = process.env.WEBHOOK_URL;
  if (!url) return;
  try {
    await nodeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('Webhook error:', e.message);
  }
}

async function notifyEmail(leadData, sessionId) {
  // Simple log -- swap this for nodemailer / SendGrid in prod
  const email = process.env.NOTIFICATION_EMAIL || 'jobsdoneteam@gmail.com';
  console.log(`[LEAD] New lead for ${email}`);
  console.log(`  Session:  ${sessionId}`);
  console.log(`  Business: ${leadData.businessType || 'unknown'}`);
  console.log(`  Problem:  ${leadData.problem || 'unknown'}`);
  console.log(`  Contact:  ${leadData.contact || 'unknown'}`);
  logConversation({ event: 'lead_captured', sessionId, email, leadData });
}

// --- POST /api/chat ---
app.post('/api/chat', async (req, res) => {
  const { sessionId, message, history = [], leadData } = req.body;

  // Lead submission from widget (phase = done)
  if (message === '__lead__') {
    await notifyWebhook({ event: 'lead_captured', sessionId, leadData });
    await notifyEmail(leadData, sessionId);
    return res.json({ reply: 'Got it.', action: 'continue' });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  // Build messages for Claude
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages
    });

    const raw = response.content[0].text.trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Fallback if Claude doesn't return clean JSON
      parsed = { reply: raw, action: 'continue' };
    }

    const { reply, action } = parsed;

    // Log everything
    logConversation({ sessionId, userMessage: message, botReply: reply, action });

    // Handle escalation
    if (action === 'escalate') {
      console.log(`[ESCALATE] Session ${sessionId}: "${message}"`);
      await notifyWebhook({ event: 'escalate', sessionId, message });
    }

    return res.json({ reply: reply || 'Something went wrong.', action: action || 'continue' });

  } catch (err) {
    console.error('Anthropic error:', err.message);
    return res.status(500).json({
      reply: "I'm having a moment -- try again in a sec.",
      action: 'continue'
    });
  }
});

// --- Health check ---
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// --- Start ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Jobs Done chat API running on port ${PORT}`);
});
