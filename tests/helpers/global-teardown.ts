import { closePool } from './db-helpers';

export default async function globalTeardown() {
  await closePool();
}
