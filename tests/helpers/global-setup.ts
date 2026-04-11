/**
 * Jest globalSetup — runs once before the entire test suite.
 * Verifies that the API + database are reachable before attempting tests.
 */
import axios from 'axios';

export default async function globalSetup() {
  const apiBase = process.env.API_URL ?? 'http://localhost:3001/api/v1';
  const maxRetries = 20;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await axios.get(`${apiBase}/health`, { timeout: 3000, validateStatus: () => true });
      if (res.status === 200) {
        console.log('\n✅ API is healthy — starting tests\n');
        return;
      }
    } catch {
      // not ready yet
    }
    if (i < maxRetries - 1) {
      process.stdout.write(`⏳ Waiting for API... (${i + 1}/${maxRetries})\r`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`API at ${apiBase}/health did not become healthy within ${maxRetries * 2}s. Is docker-compose up?`);
}
