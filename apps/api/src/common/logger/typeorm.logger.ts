import { Logger as ITypeOrmLogger } from 'typeorm';
import { createLogger } from 'winston';
import { winstonConfig } from './winston.config';

const logger = createLogger(winstonConfig);

function formatParam(p: unknown): string {
  if (p === null || p === undefined) return 'NULL';
  if (p instanceof Date) return p.toISOString();
  if (typeof p === 'string' && p.length > 20) return `'${p.slice(0, 8)}…'`;
  if (typeof p === 'string') return `'${p}'`;
  return String(p);
}

function prettify(query: string, parameters?: unknown[]): string {
  let q = query.trim();

  // Inline $1 $2 ... with actual values
  if (parameters?.length) {
    parameters.forEach((param, i) => {
      q = q.replace(new RegExp(`\\$${i + 1}(?!\\d)`, 'g'), formatParam(param));
    });
  }

  // Collapse full-entity SELECT col list → SELECT *
  q = q.replace(
    /SELECT\s+(?:"[^"]+"\."[^"]+"(?:\s+AS\s+"[^"]+")?(?:\s*,\s*)?)+(?=\s+FROM)/i,
    'SELECT * ',
  );

  // FROM "table" "Alias"  →  FROM table
  q = q.replace(/FROM\s+"([^"]+)"\s+"[A-Z][^"\s]*"/gi, 'FROM $1');

  // Strip remaining double-quoted identifiers
  q = q.replace(/"([^"]+)"/g, '$1');

  // Table.column  →  column  (e.g. Genre.name → name)
  q = q.replace(/\b[A-Z][a-zA-Z]+\.(\w+)/g, '$1');

  // Collapse extra whitespace
  return q.replace(/\s+/g, ' ').trim();
}

export class PrettyTypeOrmLogger implements ITypeOrmLogger {
  logQuery(query: string, parameters?: unknown[]) {
    if (process.env.NODE_ENV === 'production') return;
    logger.debug(prettify(query, parameters), { context: 'DB' });
  }

  logQueryError(error: string | Error, query: string, parameters?: unknown[]) {
    logger.error(`${prettify(query, parameters)} — ${String(error)}`, {
      context: 'DB',
    });
  }

  logQuerySlow(time: number, query: string, parameters?: unknown[]) {
    logger.warn(`SLOW ${time}ms — ${prettify(query, parameters)}`, {
      context: 'DB',
    });
  }

  logSchemaBuild(message: string) {
    logger.debug(message, { context: 'Schema' });
  }

  logMigration(message: string) {
    logger.info(message, { context: 'Migration' });
  }

  log(level: 'log' | 'info' | 'warn', message: unknown) {
    if (level === 'warn') logger.warn(String(message), { context: 'DB' });
    else logger.debug(String(message), { context: 'DB' });
  }
}
