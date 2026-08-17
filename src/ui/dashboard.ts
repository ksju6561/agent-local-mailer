export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Local Mailer - Shared Inter-Agent Inbox</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0b0f19;
      --bg-card: rgba(17, 24, 39, 0.85);
      --bg-card-hover: rgba(24, 34, 53, 0.95);
      --border-color: rgba(255, 255, 255, 0.08);
      --border-focus: #6366f1;
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --text-muted: #6b7280;
      --accent-indigo: #6366f1;
      --accent-emerald: #10b981;
      --accent-rose: #f43f5e;
      --accent-amber: #f59e0b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      padding: 24px 20px 60px;
      background-image: radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0px, transparent 50%);
    }

    .container {
      max-width: 1180px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 22px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .title h1 {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
    }

    .title p {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .refresh-control {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
    }

    .refresh-control select {
      background: transparent;
      border: none;
      color: #34d399;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      font-size: 12px;
    }

    .refresh-control select option {
      background: #111827;
      color: #fff;
    }

    .btn-pause {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .btn-pause:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 12px;
      color: #34d399;
      font-weight: 500;
    }

    /* Stats bar */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      margin-bottom: 22px;
    }

    .stat-box {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 14px 16px;
    }

    .stat-label {
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      margin-bottom: 4px;
      font-weight: 600;
    }

    .stat-val {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
    }

    /* Layout */
    .grid {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 20px;
    }

    @media (max-width: 860px) {
      .grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 18px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Filter Tabs */
    .filter-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }

    .tab-btn.active {
      color: #fff;
      background: var(--accent-indigo);
    }

    /* Message Item */
    .msg-item {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
      font-size: 12.5px;
      transition: border-color 0.15s ease;
    }

    .msg-item:hover {
      border-color: rgba(99, 102, 241, 0.4);
      background: rgba(0, 0, 0, 0.35);
    }

    .msg-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      flex-wrap: wrap;
      gap: 6px;
    }

    .agent-route {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .tag-from {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(99, 102, 241, 0.16);
      color: #c7d2fe;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid rgba(99, 102, 241, 0.35);
      font-weight: 500;
    }

    .tag-to {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(16, 185, 129, 0.16);
      color: #a7f3d0;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid rgba(16, 185, 129, 0.35);
      font-weight: 500;
    }

    .tag-broadcast {
      background: rgba(245, 158, 11, 0.16);
      color: #fde68a;
      border-color: rgba(245, 158, 11, 0.35);
    }

    .tag-label {
      font-size: 9.5px;
      font-weight: 700;
      opacity: 0.75;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .route-arrow {
      color: var(--text-muted);
      font-size: 11px;
    }

    /* Read / Unread Status Badge */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .badge-unread {
      background: rgba(244, 63, 94, 0.15);
      color: #fda4af;
      border: 1px solid rgba(244, 63, 94, 0.35);
    }

    .badge-read {
      background: rgba(16, 185, 129, 0.15);
      color: #6ee7b7;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }

    .msg-body {
      font-family: 'JetBrains Mono', monospace;
      white-space: pre-wrap;
      word-break: break-word;
      color: #e5e7eb;
      max-height: 220px;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.3);
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.04);
      line-height: 1.6;
    }

    .msg-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .btn-read-modal {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-read-modal:hover {
      color: #fff;
      border-color: var(--accent-indigo);
    }

    .form-group {
      margin-bottom: 12px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    input, textarea {
      width: 100%;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 10px;
      color: #fff;
      font-size: 13px;
    }

    input:focus, textarea:focus {
      outline: none;
      border-color: var(--border-focus);
    }

    .btn {
      width: 100%;
      background: var(--accent-indigo);
      color: #fff;
      border: none;
      padding: 9px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }

    .btn:hover {
      background: #4f46e5;
    }

    .btn-sec {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }

    .code-box {
      background: #000;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #93c5fd;
      overflow-x: auto;
      margin-top: 12px;
    }

    /* Full Message Reader Modal */
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 100;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      width: 100%;
      max-width: 800px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }

    .modal-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-body {
      padding: 18px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      color: #f3f4f6;
    }

    .modal-close {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
    }

    .modal-close:hover {
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title">
        <h1>Agent Local Mailer</h1>
        <p>Local Shared Mailbox with Zero-Flicker Live Stream for Agent Turn Hooks</p>
      </div>
      <div class="header-controls">
        <div class="refresh-control">
          <span>🔄 Auto-Refresh:</span>
          <select id="interval-select" onchange="changeInterval()">
            <option value="0">Off (Manual)</option>
            <option value="1000">1s</option>
            <option value="3000">3s</option>
            <option value="5000" selected>5s (Default)</option>
            <option value="10000">10s</option>
          </select>
          <button class="btn-pause" id="btn-pause" onclick="togglePause()">⏸ Pause</button>
        </div>
        <button class="badge" style="cursor:pointer;" onclick="fetchMessages(true)">⟳ Refresh</button>
      </div>
    </header>

    <!-- Stats Row -->
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-label">Total Messages</div>
        <div class="stat-val" id="stat-total">0</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Unread (미열람)</div>
        <div class="stat-val" id="stat-unread" style="color: #fda4af;">0</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Read (열람 완료)</div>
        <div class="stat-val" id="stat-read" style="color: #6ee7b7;">0</div>
      </div>
    </div>

    <div class="grid">
      <!-- Left: Mailbox Stream -->
      <div class="card">
        <div class="card-title">
          <span>📬 Shared Messages</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input id="filter-text" placeholder="Filter agent or text..." style="width: 160px; padding: 3px 8px; font-size: 11px;" oninput="renderMessages(true)">
          </div>
        </div>

        <div class="filter-tabs">
          <button class="tab-btn active" onclick="setTab('all', this)">All</button>
          <button class="tab-btn" onclick="setTab('unread', this)">🔴 Unread (미열람만)</button>
          <button class="tab-btn" onclick="setTab('read', this)">🟢 Read (열람 완료만)</button>
        </div>

        <div id="msg-container" onmouseenter="isHovered = true" onmouseleave="isHovered = false">
          Loading messages...
        </div>
      </div>

      <!-- Right: Send & Test Inbox -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="card">
          <div class="card-title">✉️ Send Message</div>
          <form onsubmit="sendMessage(event)">
            <div class="form-group">
              <label>📤 From (발신 에이전트)</label>
              <input id="from" value="platform-claude" required>
            </div>
            <div class="form-group">
              <label>📥 To (수신 에이전트 / * for broadcast)</label>
              <input id="to" value="client-codex" required>
            </div>
            <div class="form-group">
              <label>Message (Max 10MB)</label>
              <textarea id="body" rows="4" placeholder="Enter message text or JSON..." required></textarea>
            </div>
            <button type="submit" class="btn">Send Mail</button>
          </form>
        </div>

        <div class="card">
          <div class="card-title">🔍 Check Agent Inbox</div>
          <div class="form-group">
            <label>Agent Identity</label>
            <input id="check-agent" value="client-codex">
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sec" onclick="checkAgentInbox(true)">Peek (미열람 유지)</button>
            <button class="btn" style="background:#10b981;" onclick="checkAgentInbox(false)">Read & Mark</button>
          </div>
          <div id="check-result" class="code-box" style="display:none;"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Full View Modal -->
  <div class="modal-backdrop" id="modal-backdrop" onclick="closeModal(event)">
    <div class="modal-card" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div id="modal-title" style="font-weight:600; font-size:13px; font-family:'JetBrains Mono',monospace; display:flex; align-items:center; gap:8px;"></div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" id="modal-content"></div>
    </div>
  </div>

  <script>
    let rawMessages = [];
    let lastRenderedJson = '';
    let currentFilter = 'all';
    let isPaused = false;
    let isHovered = false;
    let pollInterval = null;

    async function fetchMessages(forceRender = false) {
      if (isPaused && !forceRender) return;

      try {
        const [msgsRes, statsRes] = await Promise.all([
          fetch('/api/mail?peek=true').then(r => r.json()),
          fetch('/api/mail/stats').then(r => r.json()).catch(() => null)
        ]);

        if (statsRes && statsRes.success) {
          document.getElementById('stat-total').textContent = statsRes.stats.total;
          document.getElementById('stat-unread').textContent = statsRes.stats.unread;
          document.getElementById('stat-read').textContent = statsRes.stats.read;
        }

        if (msgsRes && msgsRes.messages) {
          const newJson = JSON.stringify(msgsRes.messages);
          rawMessages = msgsRes.messages;

          if (forceRender || (newJson !== lastRenderedJson && !isHovered)) {
            lastRenderedJson = newJson;
            renderMessages(false);
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    }

    function setTab(tab, btn) {
      currentFilter = tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      renderMessages(true);
    }

    function renderMessages(force = false) {
      const container = document.getElementById('msg-container');
      const filterText = document.getElementById('filter-text').value.toLowerCase().trim();

      let list = rawMessages;
      if (currentFilter === 'unread') {
        list = list.filter(m => !m.isRead);
      } else if (currentFilter === 'read') {
        list = list.filter(m => m.isRead);
      }

      if (filterText) {
        list = list.filter(m => 
          m.from.toLowerCase().includes(filterText) ||
          m.to.toLowerCase().includes(filterText) ||
          m.body.toLowerCase().includes(filterText)
        );
      }

      if (list.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px;">No messages match filter.</div>';
        return;
      }

      container.innerHTML = list.map(m => {
        const timeStr = new Date(m.createdAt).toLocaleTimeString();
        const dateStr = new Date(m.createdAt).toLocaleDateString();
        const readTimeStr = m.readAt ? new Date(m.readAt).toLocaleTimeString() : '';
        const isBroadcast = m.to === '*';

        const statusBadge = m.isRead
          ? \`<span class="status-badge badge-read">✓ READ (\${readTimeStr})</span>\`
          : \`<span class="status-badge badge-unread">● UNREAD (미열람)</span>\`;

        const toTag = isBroadcast
          ? \`<span class="tag-to tag-broadcast"><span class="tag-label">TO:</span> ALL (*)</span>\`
          : \`<span class="tag-to"><span class="tag-label">TO:</span> \${escapeHtml(m.to)}</span>\`;

        return \`
          <div class="msg-item">
            <div class="msg-header">
              <div class="agent-route">
                <span class="tag-from"><span class="tag-label">FROM:</span> \${escapeHtml(m.from)}</span>
                <span class="route-arrow">➔</span>
                \${toTag}
              </div>
              \${statusBadge}
            </div>
            <div class="msg-body">\${escapeHtml(m.body)}</div>
            <div class="msg-footer">
              <span>Msg #\${m.id} | Sent: \${dateStr} \${timeStr}</span>
              <button class="btn-read-modal" onclick="openModal(\${m.id})">🔍 Full View</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    async function sendMessage(e) {
      e.preventDefault();
      const from = document.getElementById('from').value;
      const to = document.getElementById('to').value;
      const body = document.getElementById('body').value;

      await fetch('/api/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, body })
      });

      document.getElementById('body').value = '';
      fetchMessages(true);
    }

    async function checkAgentInbox(isPeek) {
      const agentId = document.getElementById('check-agent').value;
      const url = '/api/mail?agentId=' + encodeURIComponent(agentId) + (isPeek ? '&peek=true' : '');
      const res = await fetch(url);
      const data = await res.json();

      const el = document.getElementById('check-result');
      el.style.display = 'block';
      el.textContent = JSON.stringify(data, null, 2);
      fetchMessages(true);
    }

    function openModal(msgId) {
      const msg = rawMessages.find(m => m.id === msgId);
      if (!msg) return;

      const isBroadcast = msg.to === '*';
      const toTag = isBroadcast
        ? \`<span class="tag-to tag-broadcast"><span class="tag-label">TO:</span> ALL (*)</span>\`
        : \`<span class="tag-to"><span class="tag-label">TO:</span> \${escapeHtml(msg.to)}</span>\`;

      document.getElementById('modal-title').innerHTML = \`
        <span>Msg #\${msg.id}</span>
        <span style="color:var(--text-muted);">&nbsp;|&nbsp;</span>
        <span class="tag-from"><span class="tag-label">FROM:</span> \${escapeHtml(msg.from)}</span>
        <span class="route-arrow">➔</span>
        \${toTag}
      \`;
      document.getElementById('modal-content').textContent = msg.body;
      document.getElementById('modal-backdrop').style.display = 'flex';
    }

    function closeModal() {
      document.getElementById('modal-backdrop').style.display = 'none';
    }

    function togglePause() {
      isPaused = !isPaused;
      const btn = document.getElementById('btn-pause');
      if (isPaused) {
        btn.innerHTML = '▶ Resume';
        btn.style.color = '#fda4af';
      } else {
        btn.innerHTML = '⏸ Pause';
        btn.style.color = '';
        fetchMessages(true);
      }
    }

    function changeInterval() {
      const ms = Number(document.getElementById('interval-select').value);
      if (pollInterval) clearInterval(pollInterval);
      if (ms > 0) {
        pollInterval = setInterval(fetchMessages, ms);
      }
    }

    function escapeHtml(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    fetchMessages(true);
    changeInterval();
  </script>
</body>
</html>`;
}
