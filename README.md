# ⚡ Agent Local Mailer

> **Zero-Dependency Shared Mailbox & Turn-End Hook Mesh for AI Agents**  
> Built with Bun, `bun:sqlite`, and Hono. Compiles to a single standalone binary.

---

## 📖 Overview (개요)

**Agent Local Mailer**는 Multi-Agent 환경에서 에이전트들이 턴(Turn)이 끝날 때마다 로컬 공용 Inbox를 확인하여 자신에게 온 메시지를 가져갈 수 있도록 지원하는 **초경량 로컬 SQLite 기반 HTTP 메일박스 서버, CLI 유틸리티 및 SDK**입니다.

- **Standalone Single Binary**: Bun/Node.js 설치 없이 바이너리 하나로 즉시 실행 가능 (`curl | sh` 설치 지원).
- **Agent Identity**: 문자열 기반 고유 식별자 (예: `planner-01`, `coder-01`, `reviewer-01`).
- **High-Performance SQLite**: `bun:sqlite` 내장 엔진으로 최대 10MB 대용량 페이로드(코드, 로그 등) 고속 처리.
- **Turn Hook**: 에이전트 턴 종료 시 공용 메일박스를 확인하는 `onTurnEnd` 훅 제공.
- **Unified CLI (`alm`)**: 서버 구동 및 터미널 기반 메시지 송수신 지원.

---

## ⚡ Quick Install (1줄 설치)

Bun이나 Node.js가 설치되어 있지 않아도 다음 명령어로 단일 실행 바이너리를 설치할 수 있습니다:

```bash
curl -fsSL https://raw.githubusercontent.com/sir-mirr/agent-local-mailer/main/install.sh | sh
```

설치 후 `agent-local-mailer` 또는 `alm` 명령어를 바로 사용할 수 있습니다:

```bash
alm --help
```

---

## 💻 CLI Usage (CLI 사용법)

```bash
# 1. 메일박스 서버 & 웹 대시보드 실행 (기본 포트: 3300)
alm start --port 3300

# 2. 메시지 발송 (최대 10MB)
alm send --from planner-01 --to coder-01 --body "Task #1: Implement auth module"

# 3. 에이전트 수신함 확인
alm inbox --agent coder-01

# 4. 수신함 미리보기 (읽음 처리하지 않음)
alm inbox --agent coder-01 --peek

# 5. 메일박스 통계 확인
alm stats

# 6. 발신 메시지 회수/취소
alm cancel --from planner-01 --id 1
```

---

## 🚀 Development Quick Start (개발 및 소스 실행)

```bash
# 1. 의존성 설치
bun install

# 2. 서버 실행 (포트 3300, 대시보드: http://localhost:3300)
bun run dev

# 3. 단일 바이너리 로컬 컴파일
bun run compile
# -> dist/agent-local-mailer 생성

# 4. 에이전트 턴 훅 협업 시뮬레이션 데모 실행
bun run demo:sim

# 5. 10MB 대용량 페이로드 무결성 테스트 실행
bun run demo:10mb

# 6. 테스트 실행
bun test
```

---

## 🛠️ TypeScript SDK & Hook Usage (에이전트 연동)

```typescript
import { AgentLocalClient, createTurnHook } from 'agent-local-mailer';

// 1. 에이전트 클라이언트 생성 (Identity 문자열 부여)
const client = new AgentLocalClient({
  baseUrl: 'http://localhost:3300',
  agentId: 'coder-01'
});

// 2. 턴 종료 훅 생성
const onTurnEnd = createTurnHook(client, {
  onMessage: async (msg) => {
    console.log(`[TurnHook] Received mail from ${msg.from}:`, msg.body);
  }
});

// 3. 메시지 발송 (최대 10MB)
await client.send('reviewer-01', 'PR #101 is ready for review.');

// 4. 에이전트 턴 종료 시 훅 실행
async function runAgentTurn(turnNumber: number) {
  // ... 에이전트 작업 수행 ...
  
  // 턴 종료 시점에 공용 메일박스 확인
  const hookResult = await onTurnEnd({ agentId: 'coder-01', turnNumber });
  
  if (hookResult.hasMessages) {
    // 다음 턴 프롬프트 컨텍스트에 주입
    const promptText = onTurnEnd.formatForPrompt(hookResult.messages);
    console.log(promptText);
  }
}
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/mail` | 메시지 발송 (`from`, `to`, `body` - 최대 10MB) |
| `GET` | `/api/mail?agentId=...` | 특정 에이전트에게 온 메시지 목록 조회 (`to = agentId` 또는 `to = '*'`) |
| `GET` | `/api/mail?agentId=...&limit=...` | 읽기 전용 cursor 조회 (`status`, `q`, `agent`, `fromAgent`, `toAgent` 선택) |
| `DELETE`| `/api/mail?from=...` | **발신자 전용**: 보낸 메시지 회수/취소 삭제 (`id` 선택 지정 가능, 수신자 삭제 불가) |
| `GET` | `/api/mail/stats` | 메일 통계 (전체, 미확인, 확인) |
| `GET` | `/health` | 서버 상태 확인 (10MB payload limit 표시) |
| `GET` | `/` | 웹 대시보드 모니터링 |

### 읽기 전용 cursor 조회

`limit`, `beforeId`, `afterId`, `status`, `q`, `agent`, `fromAgent`, `toAgent` 중 하나라도 명시하면
cursor 조회로 동작한다. `limit`은 1~500 범위이고 기본값은 100이다. `beforeId`는 지정한 id보다
오래된 행을, `afterId`는 지정한 id보다 새로운 행을 반환하며, 두 파라미터는 함께 사용할 수 없다.
`status`는 `all`, `read`, `unread` 중 하나다. `q`는 발신자, 수신자, 본문을 검색하고, `agent`는
발신자 또는 수신자 이름을 검색한다. `fromAgent`와 `toAgent`는 각 방향을 부분 일치로 필터링한다.

```text
GET /api/mail?agentId=coder-01&limit=100
GET /api/mail?limit=20&status=unread&agent=planner&fromAgent=wallet&toAgent=reviewer
GET /api/mail?agentId=coder-01&limit=100&beforeId=1200
GET /api/mail?agentId=coder-01&limit=100&afterId=1300
```

cursor 조회는 항상 읽기 전용이며 `read_at`을 바꾸지 않는다. 응답의 `page` 블록은 `limit`,
`hasMore`, `latestId`(이번 페이지의 최대 id), `nextBeforeId`(이번 페이지의 최소 id)를 담는다.
과거 이력은 `nextBeforeId`를 다음 요청의 `beforeId`로 넘겨 이어서 조회하고, 폴링 클라이언트는
마지막으로 처리한 id를 `afterId`로 넘겨 그 이후에 도착한 메시지만 받는다. cursor 파라미터가
없는 기존 inbox `GET`의 전체 반환과 read-on-GET 동작은 그대로 유지된다.

---

## 📚 Documentation

- ⚡ [Turn-End Hook 규격서](file:///Users/lyong/work/ai/agent-local-mailer/docs/HOOK_SPEC.md)
- 📦 [Bun 단일 바이너리 릴리스 가이드](file:///Users/lyong/work/ai/agent-local-mailer/docs/bun-single-binary-release.md)

---

## 📄 License

MIT © [sir-mirr](https://github.com/sir-mirr)
