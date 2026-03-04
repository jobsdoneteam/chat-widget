(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  var API_URL = '/api/chat';
  var SESSION_ID = 'jd_' + Math.random().toString(36).slice(2);

  // ─── State ────────────────────────────────────────────────────────────────
  var state = {
    open: false,
    phase: 'chat',        // 'chat' | 'capture' | 'done'
    history: [],
    captureStep: 0,       // 0=business type, 1=problem, 2=contact
    leadData: {}
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  var css = `
    #jd-widget-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      background: #0f0f0f;
      border: 1.5px solid #2a2a2a;
      border-radius: 50%;
      cursor: pointer;
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #jd-widget-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(0,0,0,0.7);
    }
    #jd-widget-bubble svg {
      width: 26px;
      height: 26px;
      fill: #e8e8e8;
    }
    #jd-pulse-ring {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.18);
      z-index: 99997;
      animation: jdPulse 2.4s ease-out infinite;
      pointer-events: none;
    }
    @keyframes jdPulse {
      0%   { transform: scale(1);   opacity: 0.7; }
      70%  { transform: scale(1.7); opacity: 0; }
      100% { transform: scale(1.7); opacity: 0; }
    }
    #jd-widget-modal {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 360px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #0d0d0d;
      border: 1px solid #222;
      border-radius: 16px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.8);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 0;
      transform: translateY(12px) scale(0.97);
      transition: opacity 0.22s ease, transform 0.22s ease;
      pointer-events: none;
    }
    #jd-widget-modal.jd-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }
    #jd-modal-header {
      background: #111;
      border-bottom: 1px solid #1e1e1e;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #jd-modal-header .jd-avatar {
      width: 32px;
      height: 32px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #jd-modal-header .jd-avatar svg {
      width: 16px;
      height: 16px;
      fill: #aaa;
    }
    #jd-modal-header .jd-name {
      font-size: 13px;
      font-weight: 600;
      color: #e8e8e8;
      line-height: 1.2;
    }
    #jd-modal-header .jd-status {
      font-size: 11px;
      color: #555;
      line-height: 1.2;
    }
    #jd-modal-header .jd-close {
      margin-left: auto;
      background: none;
      border: none;
      color: #555;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      padding: 2px 4px;
      transition: color 0.15s;
    }
    #jd-modal-header .jd-close:hover { color: #ccc; }
    #jd-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scrollbar-width: thin;
      scrollbar-color: #222 transparent;
    }
    #jd-messages::-webkit-scrollbar { width: 4px; }
    #jd-messages::-webkit-scrollbar-track { background: transparent; }
    #jd-messages::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
    .jd-msg {
      max-width: 82%;
      padding: 9px 13px;
      border-radius: 12px;
      font-size: 13.5px;
      line-height: 1.5;
      word-break: break-word;
    }
    .jd-msg-bot {
      background: #161616;
      border: 1px solid #1f1f1f;
      color: #d8d8d8;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .jd-msg-user {
      background: #1c1c1c;
      border: 1px solid #2a2a2a;
      color: #e8e8e8;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .jd-typing {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 10px 14px;
    }
    .jd-typing span {
      width: 6px;
      height: 6px;
      background: #444;
      border-radius: 50%;
      animation: jdBounce 1.2s infinite;
    }
    .jd-typing span:nth-child(2) { animation-delay: 0.2s; }
    .jd-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes jdBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    #jd-input-area {
      border-top: 1px solid #1a1a1a;
      padding: 10px 12px;
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-shrink: 0;
      background: #0d0d0d;
    }
    #jd-input {
      flex: 1;
      background: #141414;
      border: 1px solid #232323;
      border-radius: 10px;
      color: #e0e0e0;
      font-size: 13.5px;
      font-family: inherit;
      padding: 8px 12px;
      resize: none;
      outline: none;
      line-height: 1.4;
      max-height: 100px;
      overflow-y: auto;
      transition: border-color 0.15s;
    }
    #jd-input::placeholder { color: #444; }
    #jd-input:focus { border-color: #333; }
    #jd-send {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      color: #ccc;
      cursor: pointer;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    #jd-send:hover { background: #222; color: #fff; }
    #jd-send svg { width: 16px; height: 16px; fill: currentColor; }
    #jd-done-msg {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 24px;
      color: #888;
      font-size: 14px;
      line-height: 1.6;
    }
    #jd-done-msg strong { color: #e0e0e0; display: block; font-size: 16px; margin-bottom: 8px; }
    @media (max-width: 480px) {
      #jd-widget-modal {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        max-width: 100%;
        height: 70vh;
        border-radius: 16px 16px 0 0;
      }
      #jd-pulse-ring, #jd-widget-bubble {
        bottom: 16px;
        right: 16px;
      }
    }
  `;

  // ─── Icons ────────────────────────────────────────────────────────────────
  var wrenchSVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>';
  var sendSVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

  // ─── Build DOM ────────────────────────────────────────────────────────────
  function init() {
    // Inject styles
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // Pulse ring
    var ring = document.createElement('div');
    ring.id = 'jd-pulse-ring';
    document.body.appendChild(ring);

    // Bubble
    var bubble = document.createElement('div');
    bubble.id = 'jd-widget-bubble';
    bubble.innerHTML = wrenchSVG;
    bubble.setAttribute('aria-label', 'Chat with Jobs Done');
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');
    document.body.appendChild(bubble);

    // Modal
    var modal = document.createElement('div');
    modal.id = 'jd-widget-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Jobs Done Chat');
    modal.innerHTML = `
      <div id="jd-modal-header">
        <div class="jd-avatar">${wrenchSVG}</div>
        <div>
          <div class="jd-name">Jobs Done Assistant</div>
          <div class="jd-status">Ask me anything</div>
        </div>
        <button class="jd-close" id="jd-close-btn" aria-label="Close chat">&times;</button>
      </div>
      <div id="jd-messages"></div>
      <div id="jd-input-area">
        <textarea id="jd-input" placeholder="Type a message..." rows="1"></textarea>
        <button id="jd-send" aria-label="Send">${sendSVG}</button>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners
    bubble.addEventListener('click', toggleModal);
    bubble.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') toggleModal(); });
    document.getElementById('jd-close-btn').addEventListener('click', closeModal);
    document.getElementById('jd-send').addEventListener('click', handleSend);
    document.getElementById('jd-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    document.getElementById('jd-input').addEventListener('input', autoResize);

    // Greeting after short delay
    setTimeout(function() {
      appendMessage('bot', "Hey! I'm the Jobs Done assistant. Looking to automate your business, or just want to see what we do?");
    }, 600);
  }

  // ─── Modal toggle ─────────────────────────────────────────────────────────
  function toggleModal() {
    state.open ? closeModal() : openModal();
  }
  function openModal() {
    state.open = true;
    document.getElementById('jd-widget-modal').classList.add('jd-open');
    document.getElementById('jd-pulse-ring').style.animationPlayState = 'paused';
    document.getElementById('jd-pulse-ring').style.opacity = '0';
    setTimeout(function() { document.getElementById('jd-input').focus(); }, 250);
  }
  function closeModal() {
    state.open = false;
    document.getElementById('jd-widget-modal').classList.remove('jd-open');
    document.getElementById('jd-pulse-ring').style.animationPlayState = 'running';
    document.getElementById('jd-pulse-ring').style.opacity = '';
  }

  // ─── Messages ─────────────────────────────────────────────────────────────
  function appendMessage(role, text) {
    var msgs = document.getElementById('jd-messages');
    var div = document.createElement('div');
    div.className = 'jd-msg ' + (role === 'bot' ? 'jd-msg-bot' : 'jd-msg-user');
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showTyping() {
    var msgs = document.getElementById('jd-messages');
    var div = document.createElement('div');
    div.className = 'jd-msg jd-msg-bot jd-typing';
    div.id = 'jd-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function removeTyping() {
    var el = document.getElementById('jd-typing-indicator');
    if (el) el.remove();
  }

  // ─── Auto-resize textarea ─────────────────────────────────────────────────
  function autoResize() {
    var el = document.getElementById('jd-input');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }

  // ─── Lead capture flow ────────────────────────────────────────────────────
  var capturePrompts = [
    "What type of business do you run? (e.g. HVAC, plumbing, lawn care, cleaning, roofing, electrical)",
    "What's your biggest headache right now — missed calls, slow follow-ups, no-shows, manual admin?",
    "Last thing — what's the best way to reach you? Drop your name, phone or email and we'll be in touch."
  ];

  function startCapture() {
    state.phase = 'capture';
    state.captureStep = 0;
    state.leadData = {};
    setTimeout(function() {
      appendMessage('bot', capturePrompts[0]);
    }, 300);
  }

  function handleCaptureInput(text) {
    if (state.captureStep === 0) {
      state.leadData.businessType = text;
      state.captureStep = 1;
      appendMessage('bot', capturePrompts[1]);
    } else if (state.captureStep === 1) {
      state.leadData.problem = text;
      state.captureStep = 2;
      appendMessage('bot', capturePrompts[2]);
    } else if (state.captureStep === 2) {
      state.leadData.contact = text;
      submitLead();
    }
  }

  function submitLead() {
    state.phase = 'done';
    var msgs = document.getElementById('jd-messages');
    var inputArea = document.getElementById('jd-input-area');
    msgs.innerHTML = '';
    inputArea.style.display = 'none';

    var done = document.createElement('div');
    done.id = 'jd-done-msg';
    done.innerHTML = '<strong>We got it. You\'re in the queue.</strong>We\'ll be in touch within a few hours.<br><br>In the meantime, check out <a href="https://jobsdone.team" target="_blank" style="color:#666;text-decoration:underline">jobsdone.team</a> to see what\'s possible.';
    msgs.appendChild(done);

    // Fire-and-forget to API
    try {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          message: '__lead__',
          history: state.history,
          leadData: state.leadData
        })
      });
    } catch(e) {}
  }

  // ─── Main send handler ────────────────────────────────────────────────────
  function handleSend() {
    var input = document.getElementById('jd-input');
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    appendMessage('user', text);

    // Lead capture flow
    if (state.phase === 'capture') {
      handleCaptureInput(text);
      return;
    }
    if (state.phase === 'done') return;

    // Push to history
    state.history.push({ role: 'user', content: text });

    showTyping();
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        message: text,
        history: state.history
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      removeTyping();
      var reply = data.reply || 'Something went wrong on my end. Try again in a sec.';
      appendMessage('bot', reply);
      state.history.push({ role: 'assistant', content: reply });

      if (data.action === 'capture_lead') {
        startCapture();
      }
    })
    .catch(function() {
      removeTyping();
      appendMessage('bot', 'Connection issue. Check back in a moment.');
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
