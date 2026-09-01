# 🌌 Antigravity (AGY) 연동 가이드 (Antigravity Integration Guide)

Google DeepMind **Antigravity (AGY CLI, Antigravity IDE, Subagent Mesh)** 환경에서 **Agent Local Mailer**를 통해 자율 에이전트 및 서브에이전트들이 비동기 통신과 작업 조율을 수행하는 표준 가이드입니다.

---

## 1. 기본 통신 원리

Antigravity 에이전트에게 고유한 **Agent Identity**(예: `antigravity-agent`, `agy-planner`, `agy-reviewer`)를 부여하고, `http://localhost:3300/api/mail`을 통해 메일을 송수신합니다.

| 역할 | HTTP 엔드포인트 | 설명 |
| :--- | :--- | :--- |
| **내 메일 확인 & 읽음 처리** | `GET http://localhost:3300/api/mail?agentId=antigravity-agent` | 내게 온 메시지 조회 + 자동으로 읽음(`isRead: true`) 처리 |
| **미열람 상태 유지 조회** | `GET http://localhost:3300/api/mail?agentId=antigravity-agent&peek=true` | 읽음 상태 변경 없이 내용만 확인 |
| **증분/페이지 조회 (읽기 전용)** | `GET http://localhost:3300/api/mail?agentId=antigravity-agent&limit=100&afterId=123` | `limit`(1~500)·`beforeId`·`afterId` cursor 조회, `read_at` 비변경 |
| **메일 발송** | `POST http://localhost:3300/api/mail` | 다른 에이전트에게 작업/대용량 데이터 전달 (최대 10MB) |
| **보낸 메일 취소/회수** | `DELETE http://localhost:3300/api/mail?from=antigravity-agent&id=123` | **발신자 전용**: 보낸 메시지 삭제 (수신자 삭제 불가, 403) |

---

## 2. 연동 방식 1: Antigravity Rules (`.agents/rules/` 또는 `GEMINI.md`)

Antigravity의 커스터마이징 시스템(`.agents/rules/` 또는 `GEMINI.md` / `AGENTS.md`)에 규칙을 추가하여, 에이전트가 턴 시작이나 턴 종료 시 자율적으로 메일박스를 확인하도록 설정합니다.

### `.agents/rules/mesh-mailer.md` 설정 예시
```markdown
# Agent Mesh Mailbox Coordination Rules
- Your Agent Identity: `antigravity-agent`
- Shared Mailbox Server: `http://localhost:3300`

## Turn Lifecycle Instructions
1. Check inbox at turn start / end using `run_command`:
   `curl -s "http://localhost:3300/api/mail?agentId=antigravity-agent"`
2. If new messages or tasks are received, incorporate them into the plan and execute.
3. Upon task completion, send reply to the target agent (e.g. `platform-claude` or `client-codex`):
   `curl -s -X POST http://localhost:3300/api/mail -H "Content-Type: application/json" -d '{"from": "antigravity-agent", "to": "platform-claude", "body": "Task completed successfully."}'`
4. Deleting mail: Recipients cannot delete received messages. Only senders can recall messages using `DELETE /api/mail?from=antigravity-agent&id=...`.
```

---

## 3. 연동 방식 2: Antigravity Skill 정의 (`skills/mesh-mailer/`)

Antigravity 에이전트가 온디맨드로 메일박스 조작 도구를 호출할 수 있도록 Skill을 구성합니다.

### `skills/mesh-mailer/SKILL.md`
```markdown
---
name: mesh-mailer
description: Inter-agent shared mailbox communication skill for sending, receiving, and peeking messages across agents.
---

# Mesh Mailer Skill

## 1. Check Inbox
Run the following command to check messages addressed to this agent:
\`\`\`bash
curl -s "http://localhost:3300/api/mail?agentId=antigravity-agent"
\`\`\`

## 2. Peek Inbox (Without Marking Read)
\`\`\`bash
curl -s "http://localhost:3300/api/mail?agentId=antigravity-agent&peek=true"
\`\`\`

## 3. Send Mail
\`\`\`bash
curl -s -X POST http://localhost:3300/api/mail \
  -H "Content-Type: application/json" \
  -d '{
    "from": "antigravity-agent",
    "to": "client-codex",
    "body": "Your message content or JSON payload here"
  }'
\`\`\`

## 4. Recall Sent Mail
\`\`\`bash
curl -s -X DELETE "http://localhost:3300/api/mail?from=antigravity-agent&id=MESSAGE_ID"
\`\`\`
```

---

## 4. 연동 방식 3: Subagent Mesh & 백그라운드 태스크 조율

Antigravity의 서브에이전트(Subagents)들이 메일박스를 공유 버스로 활용하여 대용량 컨텍스트나 분업 결과를 주고받을 수 있습니다.

```
┌─────────────────────────────────────────────────────────────┐
│                 Antigravity Primary Agent                   │
│               [Identity: 'antigravity-main']                │
└──────────────────────────────┬──────────────────────────────┘
                               │ 1. 메일로 서브태스크 발송 (POST /api/mail)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Agent Local Mailer (Port 3300)              │
│                  Shared SQLite Mailbox Bus                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ 2. 서브에이전트가 메일 수신 (GET /api/mail)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Antigravity Subagent (Worker)                 │
│               [Identity: 'antigravity-worker']              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 연동 방식 4: TypeScript SDK 연동

Antigravity Python SDK 또는 Node.js 확장 도구에서 직접 SDK를 사용할 수 있습니다.

```typescript
import { AgentLocalClient, createTurnHook } from 'agent-local-mailer/sdk';

// 1. 클라이언트 생성
const client = new AgentLocalClient({
  baseUrl: 'http://localhost:3300',
  agentId: 'antigravity-agent'
});

// 2. 턴 종료 훅 설정
const onTurnEnd = createTurnHook(client, {
  onMessage: async (msg) => {
    console.log(`[Antigravity TurnHook] Received from ${msg.from} (Msg #${msg.id}):`, msg.body);
  }
});

// 3. 에이전트 턴 실행 시 메일 확인
async function executeAntigravityTurn(turnNumber: number) {
  // 에이전트 작업 수행...

  // 턴 종료 시 훅 호출
  const hookResult = await onTurnEnd({ agentId: 'antigravity-agent', turnNumber });
  if (hookResult.hasMessages) {
    const injectedPrompt = onTurnEnd.formatForPrompt(hookResult.messages);
    console.log('Next Context Prompt:\n', injectedPrompt);
  }
}
```

---

## 6. 실전 테스트 cURL 시나리오

1. **Antigravity에게 작업 전달**:
   ```bash
   curl -X POST http://localhost:3300/api/mail \
     -H "Content-Type: application/json" \
     -d '{"from": "platform-claude", "to": "antigravity-agent", "body": "Please analyze the contracts package schema."}'
   ```

2. **Antigravity가 메일 확인**:
   ```bash
   curl -s "http://localhost:3300/api/mail?agentId=antigravity-agent"
   ```

3. **Antigravity가 분석 완료 후 회신**:
   ```bash
   curl -X POST http://localhost:3300/api/mail \
     -H "Content-Type: application/json" \
     -d '{"from": "antigravity-agent", "to": "platform-claude", "body": "Analysis complete. TypeBox validation schemas verified."}'
   ```

4. **보낸 메일 회수/취소**:
   ```bash
   curl -X DELETE "http://localhost:3300/api/mail?from=antigravity-agent&id=60"
   ```
