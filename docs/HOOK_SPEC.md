# Agent Local Mailer: Turn-End Hook 연동 규격

에이전트가 턴(Turn)을 마칠 때마다 공용 메일박스를 확인하여 메시지를 수신하는 규격입니다.

---

## 1. 라이프사이클 및 동작 원리

에이전트는 턴 종료 시점마다 **`onTurnEnd` 훅**을 실행하여 자신에게 도착한 메시지를 확인합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT EXECUTION TURN                     │
├─────────────────────────────────────────────────────────────┤
│ 1. 입력 수신 및 LLM 추론                                    │
│ 2. 작업 수행 및 메일 발송: client.send('target-agent', body) │
│ 3. 턴 응답 생성                                            │
│                                                             │
│ ───▶ [턴 종료 시점: onTurnEnd Hook 자동 실행] ◀──────────── │
│      - 공용 메일박스 확인: GET /api/mail?agentId=coder-01    │
│      - 도착한 메시지가 있으면 다음 턴 프롬프트 컨텍스트에 주입 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 데이터 구조 (SQLite)

```sql
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
```

- **`from`**: 발송 에이전트 문자열 ID (예: `platform-claude`, `client-codex`)
- **`to`**: 수신 에이전트 문자열 ID (예: `antigravity-agent`) 또는 전체 브로드캐스트 (`*`)
- **`body`**: 메시지 본문 문자열 (최대 **10MB**)
- **`readAt` / `isRead`**: 수신 에이전트 조회 시점 타임스탬프 기록

---

## 3. HTTP API

### 1) 메시지 발송
```http
POST /api/mail
Content-Type: application/json

{
  "from": "platform-claude",
  "to": "client-codex",
  "body": "Task: Implement authentication module"
}
```

### 2) 내 Inbox 확인 & 읽음 처리
```http
GET /api/mail?agentId=client-codex
```
*(미열람 상태를 유지하면서 미리보기만 하려면 `&peek=true` 추가)*

**응답:**
```json
{
  "success": true,
  "agentId": "client-codex",
  "count": 1,
  "unreadCount": 0,
  "messages": [
    {
      "id": 1,
      "from": "platform-claude",
      "to": "client-codex",
      "body": "Task: Implement authentication module",
      "createdAt": 1786794000000,
      "readAt": 1786807339078,
      "isRead": true
    }
  ]
}
```

### 3) 보낸 메시지 회수/취소 (발신자 전용)
```http
DELETE /api/mail?from=platform-claude&id=1
```
*(참고: 수신자는 받은 메시지를 삭제할 수 없으며, 시도 시 403 Forbidden이 반환됩니다.)*

---

## 4. TypeScript SDK 연동

```typescript
import { AgentLocalClient, createTurnHook } from 'agent-local-mailer/sdk';

// 1. 클라이언트 생성
const client = new AgentLocalClient({
  baseUrl: 'http://localhost:3300',
  agentId: 'coder-01'
});

// 2. 턴 종료 훅 생성
const onTurnEnd = createTurnHook(client, {
  onMessage: async (msg) => {
    console.log(`[TurnHook] 메일 수신 from ${msg.from} (Msg #${msg.id}):`, msg.body);
  }
});

// 3. 에이전트 실행 루프
async function executeAgentTurn(turnNumber: number, prompt: string) {
  const result = await myAgentLlm.run(prompt);

  // 턴 종료 시점에 훅 실행
  const hookResult = await onTurnEnd({ agentId: 'coder-01', turnNumber });

  if (hookResult.hasMessages) {
    const injectedPrompt = onTurnEnd.formatForPrompt(hookResult.messages);
    // 다음 턴 프롬프트 컨텍스트에 추가
  }

  return result;
}
```

---

## 📚 에이전트별 연동 가이드

- 🤖 [Claude App 연동 가이드](file:///Users/lyong/work/ai/agent-mesh-mailer/docs/CLAUDE_INTEGRATION_GUIDE.md)
- 🧠 [Codex App 연동 가이드](file:///Users/lyong/work/ai/agent-mesh-mailer/docs/CODEX_INTEGRATION_GUIDE.md)
- 🌌 [Antigravity 연동 가이드](file:///Users/lyong/work/ai/agent-mesh-mailer/docs/ANTIGRAVITY_INTEGRATION_GUIDE.md)
