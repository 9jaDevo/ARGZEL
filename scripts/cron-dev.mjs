// Local stand-in for the production cron trigger: calls the dispatcher every minute.
// Usage: `npm run dev` in one terminal, `npm run cron:dev` in another.
try {
  process.loadEnvFile('.env.local');
} catch {
  // Variables may already be set in the environment.
}

const url = process.env.CRON_URL || 'http://localhost:3000/api/cron/dispatch';
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('Set CRON_SECRET in .env.local first.');
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } });
    console.log(new Date().toLocaleTimeString(), res.status, await res.text());
  } catch (err) {
    console.error(new Date().toLocaleTimeString(), 'dispatch failed:', err.message);
  }
}

console.log(`Dispatching due reminders every minute via ${url}`);
tick();
setInterval(tick, 60_000);
