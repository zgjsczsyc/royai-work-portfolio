import { Store } from './lib/store.mjs';
import { seedDemo } from './lib/demo.mjs';
import { createServer } from './server.mjs';

// Portfolio previews use an in-memory synthetic store, never the real database.
const store = new Store('demo', ':memory:');
seedDemo(store);
const server = createServer(store);
server.on('error', error => { console.error(error.message); store.close(); process.exitCode = 1; });
server.listen(8772, '127.0.0.1', () => console.log('FC Social Radar 合成演示：http://127.0.0.1:8772'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
