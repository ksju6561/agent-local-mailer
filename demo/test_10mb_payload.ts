import { createApp } from '../src/server/app.js';
import { MailStore } from '../src/db/mail-store.js';
import { Database } from 'bun:sqlite';
import { AgentMeshClient } from '../src/sdk/client.js';
import crypto from 'node:crypto';

async function main() {
  console.log('='.repeat(65));
  console.log('🧪 10MB LARGE PAYLOAD INTEGRITY TEST (BUN NATIVE)');
  console.log('='.repeat(65));

  const testDb = new Database(':memory:');
  const { initSchema } = await import('../src/db/database.js');
  initSchema(testDb);

  const mailStore = new MailStore(testDb);
  const app = createApp(mailStore);

  const PORT = 3198;
  const server = Bun.serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '127.0.0.1',
  });

  const baseUrl = `http://127.0.0.1:${PORT}`;
  await new Promise((r) => setTimeout(r, 50));

  const sender = new AgentMeshClient({ baseUrl, agentId: 'agent-exporter' });
  const receiver = new AgentMeshClient({ baseUrl, agentId: 'agent-analyst' });

  // Generate ~9.5 MB payload string
  const targetBytes = 9.5 * 1024 * 1024;
  console.log(`\n⏳ Generating ~${(targetBytes / (1024 * 1024)).toFixed(2)} MB string payload...`);

  const chunk = 'AgentPayloadChunk_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\n';
  const repeatCount = Math.ceil(targetBytes / chunk.length);
  const largeBody = chunk.repeat(repeatCount);
  const actualBytes = Buffer.byteLength(largeBody, 'utf8');

  console.log(`📦 Payload size: ${(actualBytes / (1024 * 1024)).toFixed(2)} MB (${actualBytes.toLocaleString()} bytes).`);

  const originalHash = crypto.createHash('sha256').update(largeBody).digest('hex');
  console.log(`🔑 SHA-256: ${originalHash}`);

  // Send message
  console.log('\n🚀 Sending 10MB message via sender.send()...');
  const start = Date.now();
  const sentMsg = await sender.send('agent-analyst', largeBody);
  console.log(`✅ Sent in ${Date.now() - start} ms! ID: ${sentMsg.id}`);

  // Check inbox
  console.log('\n📥 Checking inbox at receiver.checkInbox()...');
  const checkStart = Date.now();
  const messages = await receiver.checkInbox();
  console.log(`✅ Received ${messages.length} message(s) in ${Date.now() - checkStart} ms.`);

  const receivedMsg = messages[0];
  const receivedHash = crypto.createHash('sha256').update(receivedMsg.body).digest('hex');

  if (receivedHash === originalHash && receivedMsg.body.length === largeBody.length) {
    console.log('\n' + '='.repeat(65));
    console.log('🎉 10MB PAYLOAD TEST PASSED! Hash and byte length matched perfectly.');
    console.log('='.repeat(65));
  } else {
    throw new Error('Payload verification failed!');
  }

  server.stop(true);
  testDb.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('10MB test failed:', err);
  process.exit(1);
});
