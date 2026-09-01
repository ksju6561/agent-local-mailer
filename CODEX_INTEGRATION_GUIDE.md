# 🧠 Codex App 연동 가이드 (Codex Integration Guide)

OpenAI Codex, Codex CLI, ChatGPT/OpenAI API 기반 에이전트가 **Agent Local Mailer**를 통해 다른 에이전트와 비동기 통신 및 작업을 인계받는 표준 가이드입니다.

---

## 1. 기본 통신 원리

Codex 에이전트에게 고유한 **Agent Identity**(예: `client-codex`, `codex-agent`, `codex-worker`)를 부여하고, `http://localhost:3300/api/mail`을 통해 메일을 주고받습니다.

| 역할 | HTTP 엔드포인트 | 설명 |
| :--- | :--- | :--- |
| **내 메일 확인 & 읽음 처리** | `GET http://localhost:3300/api/mail?agentId=client-codex` | 내게 온 메시지 조회 + 자동으로 읽음(`isRead: true`) 처리 |
| **미열람 상태 유지 조회** | `GET http://localhost:3300/api/mail?agentId=client-codex&peek=true` | 읽음 상태 변경 없이 내용만 확인 |
| **증분/페이지 조회 (읽기 전용)** | `GET http://localhost:3300/api/mail?agentId=client-codex&limit=100&afterId=123` | `limit`(1~500)·`beforeId`·`afterId` cursor 조회, `read_at` 비변경 |
| **메일 발송** | `POST http://localhost:3300/api/mail` | 다른 에이전트에게 작업/결과 전달 (최대 10MB) |
| **보낸 메일 취소/회수** | `DELETE http://localhost:3300/api/mail?from=client-codex&id=123` | **발신자 전용**: 보낸 메시지 삭제 (수신자 삭제 불가, 403) |

---

## 2. 연동 방식 1: `CODEX.md` 또는 `AGENTS.md` (Codex CLI / 에이전트 지침)

Codex CLI 또는 저장소 루트의 `CODEX.md` / `AGENTS.md` 파일에 지침을 추가하여 Codex가 자율적으로 메일박스를 확인하고 결과를 전달하도록 설정합니다.

### `CODEX.md` (또는 `AGENTS.md`) 설정 예시
```markdown
# Codex Agent Mailbox Guidelines
- Your Identity: `client-codex`
- Mailbox Server: `http://localhost:3300`

## Turn Instructions
1. Check inbox at the beginning or end of your turn:
   `curl -s "http://localhost:3300/api/mail?agentId=client-codex"`
2. If tasks are addressed to you, execute code generation or refactoring accordingly.
3. Upon task completion, notify the requester (e.g. `platform-claude`):
   `curl -s -X POST http://localhost:3300/api/mail -H "Content-Type: application/json" -d '{"from": "client-codex", "to": "platform-claude", "body": "Codex completed implementation for task #42"}'`
4. Note on deletion: You cannot delete received messages. Only senders can recall messages using `DELETE /api/mail?from=client-codex&id=...`.
```

---

## 3. 연동 방식 2: OpenAI Function Calling / Tools 정의

OpenAI SDK나 ChatGPT 기반 앱에서 Function Calling을 통해 도구 형태로 연결하는 스키마입니다.

```json
[
  {
    "type": "function",
    "function": {
      "name": "check_agent_inbox",
      "description": "공용 메일박스에서 내게 도착한 메시지를 확인합니다. (조회 시 읽음 처리)",
      "parameters": {
        "type": "object",
        "properties": {
          "agentId": {
            "type": "string",
            "description": "내 에이전트 ID (예: client-codex)"
          },
          "peek": {
            "type": "boolean",
            "description": "true일 경우 읽음 처리 없이 미리보기만 수행"
          }
        },
        "required": ["agentId"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "send_agent_mail",
      "description": "다른 에이전트에게 메일을 발송합니다. (최대 10MB)",
      "parameters": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "description": "내 발신자 ID"
          },
          "to": {
            "type": "string",
            "description": "수신 에이전트 ID (예: platform-claude 또는 * for broadcast)"
          },
          "body": {
            "type": "string",
            "description": "메시지 본문 (최대 10MB)"
          }
        },
        "required": ["from", "to", "body"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "cancel_sent_mail",
      "description": "내가 보낸 메시지를 취소/회수합니다. (수신자는 삭제 불가)",
      "parameters": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "description": "내 발신자 ID"
          },
          "messageId": {
            "type": "number",
            "description": "취소할 메시지 ID (생략 시 전체 보낸 메일 취소)"
          }
        },
        "required": ["from"]
      }
    }
  }
]
```

---

## 4. 연동 방식 3: Python / Node.js OpenAI SDK 턴 훅 예제

### Python 예제 (`openai` + `requests`)
```python
import openai
import requests

MAILER_URL = "http://localhost:3300/api/mail"
AGENT_ID = "client-codex"

client = openai.OpenAI()

def check_inbox(peek: bool = False):
    """턴 종료 시 메일함 확인 (peek=False 시 읽음 처리)"""
    url = f"{MAILER_URL}?agentId={AGENT_ID}"
    if peek:
        url += "&peek=true"
    res = requests.get(url)
    data = res.json()
    return data.get("messages", [])

def send_mail(to_agent: str, body: str):
    """다른 에이전트에게 결과 발송"""
    requests.post(MAILER_URL, json={
        "from": AGENT_ID,
        "to": to_agent,
        "body": body
    })

def cancel_mail(message_id: int = None):
    """내가 보낸 메일 취소/회수"""
    url = f"{MAILER_URL}?from={AGENT_ID}"
    if message_id:
        url += f"&id={message_id}"
    requests.delete(url)

# Codex 턴 실행 루프 예시
def run_codex_turn(prompt: str):
    # 1. LLM 추론 및 코드 생성
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    output = response.choices[0].message.content
    print("Codex Output:", output)

    # 2. 턴 종료 훅: 메일박스 확인
    incoming_messages = check_inbox(peek=False)
    if incoming_messages:
        print(f"📬 {len(incoming_messages)}개의 새 작업 메일 수신됨:")
        for msg in incoming_messages:
            print(f"- [From: {msg['from']}] (Msg #{msg['id']}): {msg['body']}")

    return output
```

### TypeScript / Node.js 예제
```typescript
import OpenAI from 'openai';
import { AgentLocalClient, createTurnHook } from 'agent-local-mailer/sdk';

const openai = new OpenAI();
const mailClient = new AgentLocalClient({
  baseUrl: 'http://localhost:3300',
  agentId: 'client-codex'
});

const onTurnEnd = createTurnHook(mailClient, {
  onMessage: async (msg) => {
    console.log(`[Codex Turn Hook] Received from ${msg.from} (Msg #${msg.id}):`, msg.body);
  }
});

async function runCodexTurn(prompt: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  });

  // 턴 종료 시 훅 실행
  const hookResult = await onTurnEnd({ agentId: 'client-codex' });
  if (hookResult.hasMessages) {
    const nextContext = onTurnEnd.formatForPrompt(hookResult.messages);
    console.log('Next Context:\n', nextContext);
  }

  return completion.choices[0].message.content;
}
```

---

## 5. 실전 협업 시나리오 (`platform-claude` ➔ `client-codex` ➔ `reviewer`)

1. **`platform-claude`가 `client-codex`에게 작업 할당**:
   ```bash
   curl -X POST http://localhost:3300/api/mail \
     -H "Content-Type: application/json" \
     -d '{"from": "platform-claude", "to": "client-codex", "body": "Task: Create JWT verification utility function in TypeScript."}'
   ```

2. **`client-codex`가 턴 시작/종료 시 메일 확인 (읽음 처리)**:
   ```bash
   curl "http://localhost:3300/api/mail?agentId=client-codex"
   ```

3. **`client-codex`가 코드 작성 후 답장 전달**:
   ```bash
   curl -X POST http://localhost:3300/api/mail \
     -H "Content-Type: application/json" \
     -d '{"from": "client-codex", "to": "platform-claude", "body": "PR: export function verifyJWT(token: string) { ... }"}'
   ```

4. **보낸 메일 회수/취소 (발신자 전용)**:
   ```bash
   curl -X DELETE "http://localhost:3300/api/mail?from=client-codex&id=59"
   ```
