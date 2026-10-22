// Validates an env file without printing any values.
// Usage: npm run check:env            (checks .env.production as production)
//        npm run check:env .env.local (checks another file; production rules if its name says so)
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { checkEnv } from '../src/server/env-check.ts';

const file = process.argv[2] || '.env.production';
const production = file.includes('production') || process.argv.includes('--production');

let env;
try {
  env = parseEnv(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`Cannot read ${file}: ${err.message}`);
  process.exit(1);
}

const { errors, warnings } = checkEnv(env, production);
console.log(`Checked ${file} (${production ? 'production' : 'development'} rules)`);
for (const error of errors) console.log(`  ✗ ${error}`);
for (const warning of warnings) console.log(`  ! ${warning}`);
if (!errors.length) console.log('  ✓ all required variables present and well-formed');
process.exit(errors.length ? 1 : 0);
