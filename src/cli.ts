#!/usr/bin/env bun
import { startServer } from './index.js';
import { CONFIG } from './config.js';
import { AgentLocalClient } from './sdk/client.js';

const VERSION = '1.0.0';

function printHelp() {
  console.log(`
⚡ Agent Local Mailer CLI (v${VERSION})
Simple Local Shared Mailbox & Turn-End Hook Mesh for AI Agents

USAGE:
  agent-local-mailer <command> [options]
  alm <command> [options]

COMMANDS:
  start                     Start the HTTP mailer server & web dashboard
    -p, --port <number>     Server port (default: 3300)
    -h, --host <string>     Server host (default: 0.0.0.0)
    --db <path>             Path to SQLite database file

  send                      Send a message to an agent
    --from <agentId>        Sender agent ID (required)
    --to <agentId>          Recipient agent ID or '*' (required)
    --body <text>           Message content string (up to 10MB)
    -s, --server <url>      Mailer server URL (default: http://localhost:3300)

  inbox                     Check inbox for messages
    -a, --agent <agentId>   Agent ID to check inbox for (required)
    --peek                  Read messages without marking them as read
    --json                  Output raw JSON
    -s, --server <url>      Mailer server URL (default: http://localhost:3300)

  stats                     View mailbox statistics
    --json                  Output raw JSON
    -s, --server <url>      Mailer server URL (default: http://localhost:3300)

  cancel                    Cancel / recall sent message(s)
    --from <agentId>        Sender agent ID (required)
    --id <number>           Specific message ID to cancel (optional)
    -s, --server <url>      Mailer server URL (default: http://localhost:3300)

GLOBAL FLAGS:
  -v, --version             Show version number
  --help                    Show this help message

EXAMPLES:
  # 1. Start server
  agent-local-mailer start --port 3300

  # 2. Send message
  agent-local-mailer send --from planner-01 --to coder-01 --body "Please review PR #101"

  # 3. Check inbox
  agent-local-mailer inbox --agent coder-01
`);
}

function parseArgs(args: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const { positional, flags } = parseArgs(rawArgs);

  if (flags['version'] || flags['v'] || positional[0] === 'version') {
    console.log(`agent-local-mailer v${VERSION}`);
    return;
  }

  if (flags['help'] || positional.length === 0 || positional[0] === 'help') {
    printHelp();
    return;
  }

  const command = positional[0]?.toLowerCase();

  switch (command) {
    case 'start':
    case 'server':
    case 'serve': {
      const port = Number(flags['port'] || flags['p'] || CONFIG.PORT);
      const host = String(flags['host'] || flags['h'] || CONFIG.HOST);
      if (flags['db']) {
        process.env.DB_PATH = String(flags['db']);
      }
      startServer(port, host);
      break;
    }

    case 'send': {
      const from = String(flags['from'] || '');
      const to = String(flags['to'] || '');
      const body = String(flags['body'] || '');
      const serverUrl = String(flags['server'] || flags['s'] || `http://localhost:${CONFIG.PORT}`);

      if (!from || !to || !body) {
        console.error('❌ Error: --from, --to, and --body are required.');
        console.error('Example: agent-local-mailer send --from planner-01 --to coder-01 --body "Hello"');
        process.exit(1);
      }

      try {
        const client = new AgentLocalClient({ baseUrl: serverUrl, agentId: from });
        const sent = await client.send(to, body);
        console.log(`✅ Mail #${sent.id} sent successfully from [${sent.from}] to [${sent.to}]`);
      } catch (err: any) {
        console.error(`❌ Failed to send mail: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'inbox':
    case 'check':
    case 'read': {
      const agentId = String(flags['agent'] || flags['a'] || '');
      const peek = Boolean(flags['peek']);
      const isJson = Boolean(flags['json']);
      const serverUrl = String(flags['server'] || flags['s'] || `http://localhost:${CONFIG.PORT}`);

      if (!agentId) {
        console.error('❌ Error: --agent <agentId> is required.');
        process.exit(1);
      }

      try {
        const encodedId = encodeURIComponent(agentId);
        const peekParam = peek ? '&peek=true' : '';
        const res = await fetch(`${serverUrl}/api/mail?agentId=${encodedId}${peekParam}`);
        const data = (await res.json()) as any;

        if (!res.ok || !data.success) {
          throw new Error(data.error || res.statusText);
        }

        if (isJson) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          const messages = data.messages || [];
          console.log(`📬 Inbox for [${agentId}]: ${messages.length} message(s)`);
          console.log('─'.repeat(55));
          if (messages.length === 0) {
            console.log('   (No messages)');
          } else {
            for (const msg of messages) {
              const time = new Date(msg.createdAt).toLocaleTimeString();
              console.log(`[#${msg.id}] From: ${msg.from} | Time: ${time} | Read: ${msg.isRead ? 'Yes' : 'No'}`);
              console.log(`Body: ${msg.body}`);
              console.log('─'.repeat(55));
            }
          }
        }
      } catch (err: any) {
        console.error(`❌ Failed to check inbox: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'stats': {
      const isJson = Boolean(flags['json']);
      const serverUrl = String(flags['server'] || flags['s'] || `http://localhost:${CONFIG.PORT}`);

      try {
        const res = await fetch(`${serverUrl}/api/mail/stats`);
        const data = (await res.json()) as any;
        if (!res.ok || !data.success) {
          throw new Error(data.error || res.statusText);
        }

        if (isJson) {
          console.log(JSON.stringify(data.stats, null, 2));
        } else {
          console.log('📊 Agent Local Mailer Statistics:');
          console.log(`  Total Messages:  ${data.stats.total}`);
          console.log(`  Unread Messages: ${data.stats.unread}`);
          console.log(`  Read Messages:   ${data.stats.read}`);
        }
      } catch (err: any) {
        console.error(`❌ Failed to fetch stats: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'cancel': {
      const from = String(flags['from'] || '');
      const id = flags['id'] ? Number(flags['id']) : undefined;
      const serverUrl = String(flags['server'] || flags['s'] || `http://localhost:${CONFIG.PORT}`);

      if (!from) {
        console.error('❌ Error: --from <agentId> is required to cancel sent messages.');
        process.exit(1);
      }

      try {
        const client = new AgentLocalClient({ baseUrl: serverUrl, agentId: from });
        const cancelled = await client.cancelSent(id);
        console.log(`✅ Cancelled ${cancelled} message(s) sent by [${from}]`);
      } catch (err: any) {
        console.error(`❌ Failed to cancel mail: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`❌ Unknown command: "${command}". Run "agent-local-mailer --help" for usage.`);
      process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  });
}
