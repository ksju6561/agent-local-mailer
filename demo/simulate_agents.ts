import { createApp } from '../src/server/app.js';
import { MailStore } from '../src/db/mail-store.js';
import { Database } from 'bun:sqlite';
import { AgentMeshClient } from '../src/sdk/client.js';
import { createTurnHook } from '../src/sdk/hook.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('='.repeat(65));
  console.log('🤖 AGENT LOCAL MAILER - TURN HOOK SIMULATION (BUN NATIVE)');
  console.log('='.repeat(65));

  // 1. In-memory DB and Server
  const testDb = new Database(':memory:');
  const { initSchema } = await import('../src/db/database.js');
  initSchema(testDb);

  const mailStore = new MailStore(testDb);
  const app = createApp(mailStore);

  const PORT = 3199;
  const server = Bun.serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '127.0.0.1',
  });

  const baseUrl = `http://127.0.0.1:${PORT}`;
  await sleep(50);

  // 2. Agents setup
  const planner = new AgentMeshClient({ baseUrl, agentId: 'planner-01' });
  const coder = new AgentMeshClient({ baseUrl, agentId: 'coder-01' });
  const reviewer = new AgentMeshClient({ baseUrl, agentId: 'reviewer-01' });

  // 3. Turn Hooks
  const plannerHook = createTurnHook(planner);
  const coderHook = createTurnHook(coder);
  const reviewerHook = createTurnHook(reviewer);

  // -------------------------------------------------------------
  // ROUND 1: Planner sends task
  // -------------------------------------------------------------
  console.log('\n🔄 [ROUND 1] Planner executes Turn #1...');
  console.log('   Planner sends task to Coder...');
  await planner.send('coder-01', 'Task #1: Implement user authentication module.');

  console.log('   Planner ends Turn #1 and checks inbox...');
  await plannerHook({ agentId: 'planner-01', turnNumber: 1 });

  await sleep(100);

  // -------------------------------------------------------------
  // ROUND 2: Coder checks inbox at turn end
  // -------------------------------------------------------------
  console.log('\n🔄 [ROUND 2] Coder executes Turn #1...');
  console.log('   Coder ends Turn #1 -> Hook checks shared inbox:');
  const coderResult = await coderHook({ agentId: 'coder-01', turnNumber: 1 });

  if (coderResult.hasMessages) {
    console.log('   💡 Context formatted for Coder prompt:');
    console.log(coderHook.formatForPrompt(coderResult.messages));

    console.log('   Coder implements code and sends PR to Reviewer...');
    await coder.send('reviewer-01', 'PR #101: Added JWT auth & bcrypt hashing. Please review.');
  }

  await sleep(100);

  // -------------------------------------------------------------
  // ROUND 3: Reviewer checks inbox
  // -------------------------------------------------------------
  console.log('\n🔄 [ROUND 3] Reviewer executes Turn #1...');
  console.log('   Reviewer ends Turn #1 -> Hook checks shared inbox:');
  const reviewerResult = await reviewerHook({ agentId: 'reviewer-01', turnNumber: 1 });

  if (reviewerResult.hasMessages) {
    console.log('   💡 Context formatted for Reviewer prompt:');
    console.log(reviewerHook.formatForPrompt(reviewerResult.messages));

    console.log('   Reviewer approves PR and notifies Planner...');
    await reviewer.send('planner-01', 'LGTM! Auth module verified and merged.');
  }

  await sleep(100);

  // -------------------------------------------------------------
  // ROUND 4: Planner receives final status
  // -------------------------------------------------------------
  console.log('\n🔄 [ROUND 4] Planner executes Turn #2...');
  console.log('   Planner ends Turn #2 -> Hook checks shared inbox:');
  const plannerFinalResult = await plannerHook({ agentId: 'planner-01', turnNumber: 2 });

  if (plannerFinalResult.hasMessages) {
    console.log('   💡 Final status received by Planner:');
    console.log(plannerHook.formatForPrompt(plannerFinalResult.messages));
  }

  console.log('\n' + '='.repeat(65));
  console.log('✨ All agent turns completed successfully via Turn Hooks!');
  console.log('='.repeat(65));

  server.stop(true);
  testDb.close();
}

main().catch(console.error);
