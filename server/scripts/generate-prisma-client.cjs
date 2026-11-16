// server/scripts/generate-prisma-client.cjs
// Runs after every `pnpm install` (the server's postinstall). pnpm keeps @prisma/client in a folder whose name
// changes when dependencies change, and the generated client lives inside it, so an install can leave the
// server without its database types (hundreds of "Property 'user' does not exist on type 'PrismaService'").
// Regenerating here fixes that.
//
// prisma.config.ts needs DATABASE_URL (from server/.env or the environment). Where there is neither, such as
// the phone app's cloud build, this skips instead of failing the whole install.
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const serverDir = join(__dirname, '..');
if (!process.env.DATABASE_URL && !existsSync(join(serverDir, '.env'))) {
  console.log('[server] No DATABASE_URL or .env here: skipping prisma generate.');
  process.exit(0);
}

const result = spawnSync('npx', ['prisma', 'generate'], { cwd: serverDir, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
