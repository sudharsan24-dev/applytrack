import { openDatabase } from './database.js';
import { createApp } from './app.js';
const db = await openDatabase();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const app = createApp(db);
const server = app.listen(port, host, () => console.log(`ApplyTrack API ready at http://${host}:${port} (${process.env.DB_DRIVER || 'sqlite'})`));
async function shutdown() { server.close(async () => { await db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
