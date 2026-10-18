import { mkdirSync } from 'fs';
import { createServer } from 'http';
import path from 'path';
import { createApp } from './app';
import env from './config/env';
import { attachGateway } from './ws/gateway';

mkdirSync(path.resolve(env.mediaDir), { recursive: true });

const app = createApp();
const httpServer = createServer(app);
attachGateway(httpServer);

httpServer.listen(env.port, '0.0.0.0', () => {
  console.log(`\n  QuizWave backend (${env.nodeEnv})`);
  console.log(`  → REST   /api`);
  console.log(`  → WS     socket.io`);
  console.log(`  → Media  /media`);
  console.log(
    `  → Port ${env.port}, storage=${env.storageDriver}, media=${env.mediaDriver}, cors=${env.corsOrigins.join(', ') || '(unset)'}\n`
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n[${signal}] shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
