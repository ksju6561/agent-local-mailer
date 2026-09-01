# 🤖 Claude App 연동 가이드 (Claude Integration Guide)

Claude(Claude Code, Claude Desktop, Anthropic API 기반 에이전트)가 **Agent Local Mailer**를 통해 다른 에이전트들과 비동기 통신, 작업 수신, 결과 전달을 수행하는 표준 가이드입니다.

---

## 1. 기본 통신 원리

Claude에게 고유한 **Agent Identity**(예: `platform-claude`, `claude-code`, `claude-agent`)를 부여하고, `http://localhost:3300/api/mail`을 통해 메일을 주고받습니다.

| 역할 | HTTP 엔드포인트 | 설명 |
| :--- | :--- | :--- |
| **내 메일 확인 & 읽음 처리** | `GET http://localhost:3300/api/mail?agentId=claude-agent` | 내게 온 메시지 조회 + 자동으로 읽음(`isRead: true`) 처리 |
| **미열람 상태 유지 조회** | `GET http://localhost:3300/api/mail?agentId=claude-agent&peek=true` | 읽음 상태 변경 없이 내용만 확인 |
| **증분/페이지 조회 (읽기 전용)** | `GET http://localhost:3300/api/mail?agentId=claude-agent&limit=100&afterId=123` | `limit`(1~500)·`beforeId`·`afterId` cursor 조회, `read_at` 비변경 |
| **메일 발송** | `POST http://localhost:3300/api/mail` | 다른 에이전트에게 메시지/작업 전달 (최대 10MB) |
| **보낸 메일 취소/회수** | `DELETE http://localhost:3300/api/mail?from=claude-agent&id=123` | **발신자 전용**: 보낸 메시지 삭제 (수신자 삭제 불가, 403) |

---

## 2. 연동 방식 1: `CLAUDE.md` (Claude Code / IDE 자율 에이전트)

Claude Code나 IDE 내 Claude를 사용할 때, 프로젝트 루트의 `CLAUDE.md`에 아래 가이드를 추가하면 Claude가 턴 시작/종료 시 자동으로 메일박스를 확인하고 협업합니다.

### `CLAUDE.md` 설정 예시
```markdown
# Agent Mailbox Guidelines
- Your Agent Identity: `platform-claude`
- Shared Mailbox Server: `http://localhost:3300`

## Turn Rules
1. Turn Start / Turn End: Check your incoming messages:
   `curl -s "http://localhost:3300/api/mail?agentId=platform-claude"`
2. If there are tasks or questions addressed to you, execute them.
3. Upon task completion or when notifying another agent (e.g. `client-codex`):
   `curl -s -X POST http://localhost:3300/api/mail -H "Content-Type: application/json" -d '{"from": "platform-claude", "to": "client-codex", "body": "PR ready: updated auth module"}'`
4. Deleting mail: Recipients cannot delete received mail. Only senders can recall messages using `DELETE /api/mail?from=platform-claude&id=...`.
```

---

## 3. 연동 방식 2: 3단계 딜리버리 아키텍처 (Hooks + Watcher)

고도화된 Claude 에이전트 시스템에서는 다음 3가지 경로로 메일을 완벽하게 처리할 수 있습니다:

1. **`UserPromptSubmit` Hook (턴 시작)**:
   - 사용자가 프롬프트를 입력할 때 대기 중인 메일을 조회하여 프롬프트 컨텍스트에 자동 주입.
2. **`Stop` Hook (턴 종료)**:
   - 에이전트가 턴을 마치는 시점에 `GET /api/mail?agentId=...`를 호출하여 도중에 도착한 메일이 있으면 턴을 연장하거나 처리.
3. **`Monitor / Watcher` (유휴 상태 백그라운드 폴링)**:
   - 에이전트가 대기(Idle) 중일 때 `GET /api/mail?agentId=...&peek=true`로 30초마다 폴링하다가 새 메일이 도착하면 에이전트 세션을 깨워 처리.

---

## 4. 연동 방식 3: MCP (Model Context Protocol) 연동

Claude Desktop이나 MCP 지원 클라이언트에서 도구(Tool) 형태로 연동할 때의 스키마입니다.

### Claude Custom Tools 스키마
```json
[
  {
    "name": "check_agent_inbox",
    "description": "공용 메일박스에서 내게 도착한 메시지를 확인합니다. (조회 시 읽음 처리)",
    "input_schema": {
      "type": "object",
      "properties": {
        "agentId": { "type": "string", "description": "내 에이전트 ID (예: platform-claude)" },
        "peek": { "type": "boolean", "description": "true일 경우 읽음 처리 없이 미리보기만 수행" }
      },
      "required": ["agentId"]
    }
  },
  {
    "name": "send_agent_mail",
    "description": "다른 에이전트에게 메일을 발송합니다. (최대 10MB)",
    "input_schema": {
      "type": "object",
      "properties": {
        "from": { "type": "string", "description": "발신자 ID" },
        "to": { "type": "string", "description": "수신자 ID (또는 * for broadcast)" },
        "body": { "type": "string", "description": "메시지 본문" }
      },
      "required": ["from", "to", "body"]
    }
  },
  {
    "name": "cancel_sent_mail",
    "description": "내가 보낸 메시지를 취소/회수합니다. (수신자는 삭제 불가)",
    "input_schema": {
      "type": "object",
      "properties": {
        "from": { "type": "string", "description": "내 발신자 ID" },
        "messageId": { "type": "number", "description": "취소할 메시지 ID (생략 시 전체 보낸 메일 취소)" }
      },
      "required": ["from"]
    }
  }
]
```

---

## 5. 연동 방식 4: Anthropic API / TypeScript SDK 연동

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AgentLocalClient, createTurnHook } from 'agent-local-mailer/sdk';

const anthropic = new Anthropic();

// 1. Mailer 클라이언트 초기화
const mailClient = new AgentLocalClient({
  baseUrl: 'http://localhost:3300',
  agentId: 'platform-claude'
});

// 2. 턴 종료 훅 설정
const onTurnEnd = createTurnHook(mailClient, {
  onMessage: async (msg) => {
    console.log(`[Claude Turn Hook] ${msg.from}님으로부터 메시지 수신 (ID: ${msg.id}):`, msg.body);
  }
});

// 3. Claude 턴 실행 루프
async function runClaudeTurn(turnNumber: number, prompt: string) {
  const response = await anthropic.messages.create({
    model: 'claude-3-7-sonnet-20250219',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }]
  });

  console.log('Claude 답변:', response.content);

  // 턴 종료 시점에 메일박스 확인 훅 실행
  const hookResult = await onTurnEnd({ agentId: 'platform-claude', turnNumber });

  if (hookResult.hasMessages) {
    const nextTurnContext = onTurnEnd.formatForPrompt(hookResult.messages);
    console.log('다음 턴에 전달할 새 메일:\n', nextTurnContext);
  }

  return response;
}
```

---

## 6. 실전 테스트 cURL 시나리오

1. **Claude에게 작업 지시 발송**:
   ```bash
   curl -X POST http://localhost:3300/api/mail \
     -H "Content-Type: application/json" \
     -d '{"from": "manager-01", "to": "platform-claude", "body": "src/index.ts 코드 리뷰 부탁드립니다."}'
   ```

2. **Claude가 수신 확인 (읽음 처리)**:
   ```bash
   curl "http://localhost:3300/api/mail?agentId=platform-claude"
   ```

3. **Claude가 작업 완료 후 답장 발송**:
   ```bash
   curl -X POST http://localhost:3300/api/mail \
     -H "Content-Type: application/json" \
     -d '{"from": "platform-claude", "to": "manager-01", "body": "리뷰 완료: 타입스크립트 strict 모드 통과 확인했습니다."}'
   ```

4. **보낸 메일 회수/취소 (발신자 전용)**:
   ```bash
   curl -X DELETE "http://localhost:3300/api/mail?from=platform-claude&id=58"
   ```
