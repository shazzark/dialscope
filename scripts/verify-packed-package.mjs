import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), 'dialscope-consumer-'));

function parseArguments(args) {
  if (args.length === 0) return undefined;
  if (args.length !== 2 || args[0] !== '--tarball' || !args[1]) {
    throw new Error('Usage: npm run verify:packed -- -- --tarball PATH');
  }
  return resolve(args[1]);
}

function run(command, args, cwd, expectedStatuses = [0]) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 180_000 });
  if (result.error) throw result.error;
  if (!expectedStatuses.includes(result.status ?? -1)) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function npm(args, cwd, expectedStatuses = [0]) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run this check through npm run verify:packed so npm uses its platform-specific executable.');
  return run(process.execPath, [npmCli, ...args], cwd, expectedStatuses);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a local API test port.');
  const port = address.port;
  await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function verifyInstalledApi(installRoot) {
  const port = await availablePort();
  const serverEntry = join(installRoot, 'dist', 'server.js');
  const child = spawn(process.execPath, [serverEntry], {
    cwd: temporary,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      DIALSCOPE_HOST: '127.0.0.1',
      DIALSCOPE_PORT: String(port),
      DIALSCOPE_RATE_LIMIT_MAX: '100',
      DIALSCOPE_RATE_LIMIT_WINDOW_MS: '60000',
      DIALSCOPE_CORS_ORIGINS: '',
    },
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  try {
    const base = `http://127.0.0.1:${port}`;
    let health;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Installed API exited during startup: ${stderr}`);
      try {
        health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) });
        if (health.ok) break;
      } catch { await new Promise(resolveDelay => setTimeout(resolveDelay, 100)); }
    }
    if (!health?.ok) throw new Error(`Installed API did not become healthy: ${stderr}`);
    const healthBody = await health.json();
    if (healthBody.status !== 'ok') throw new Error('Installed API health response was invalid.');

    const lookupResponse = await fetch(`${base}/v1/phone/lookup`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '08031234567', region: 'NG' }),
    });
    const lookup = await lookupResponse.json();
    if (lookupResponse.status !== 200 || lookup.e164 !== '+2348031234567') throw new Error('Installed API lookup request failed.');

    const batchResponse = await fetch(`${base}/v1/phone/lookup/batch`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumbers: ['08031234567', 'invalid'], region: 'NG' }),
    });
    const batch = await batchResponse.json();
    if (batchResponse.status !== 200 || batch.summary.totalDataRows !== 2 || batch.summary.invalidCount !== 1) {
      throw new Error('Installed API batch request failed.');
    }
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await new Promise(resolveExit => {
      if (child.exitCode !== null) resolveExit();
      else {
        const timeout = setTimeout(() => { child.kill('SIGKILL'); resolveExit(); }, 5000);
        child.once('exit', () => { clearTimeout(timeout); resolveExit(); });
      }
    });
  }
}

try {
  const requestedTarball = parseArguments(process.argv.slice(2));
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run this check through npm run verify:packed so npm uses its platform-specific executable.');
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const packageVersion = manifest.version;
  let tarball;
  if (requestedTarball) {
    await readFile(requestedTarball);
    tarball = requestedTarball;
    console.error(`Verifying the exact tarball ${tarball}.`);
  } else {
    console.error('Packing DialScope from the repository source.');
    const packResult = JSON.parse(npm(['pack', '--pack-destination', temporary, '--json'], root).stdout);
    tarball = join(temporary, packResult[0].filename);
  }

  await writeFile(join(temporary, 'package.json'), JSON.stringify({ name: 'dialscope-consumer-check', private: true, type: 'module' }));
  console.error('Installing the packed tarball in an isolated consumer.');
  npm(['install', '--offline', '--no-audit', '--no-fund', tarball], temporary);

  const installRoot = join(temporary, 'node_modules', 'dialscope');
  const consumer = `import { getMetadataInfo, lookupPhoneNumber, summarizeBatch } from 'dialscope';
import { createApiApp } from 'dialscope/api';
import type { BatchSummary, LookupResult, NumberType } from 'dialscope';
const result: LookupResult = await lookupPhoneNumber('+14155552671');
const summary: BatchSummary = summarizeBatch([]);
const info = getMetadataInfo();
const app = await createApiApp();
await app.close();
const kind: NumberType | null | undefined = result.ok ? result.numberType : undefined;
void kind;
if (summary.totalDataRows !== 0 || info.packageVersion !== '${packageVersion}') throw new Error('Consumer contract mismatch');
`;
  await writeFile(join(temporary, 'consumer.ts'), consumer);
  await writeFile(join(temporary, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, types: [] },
    files: ['consumer.ts'],
  }));
  run(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(temporary, 'tsconfig.json')], temporary);

  console.error('Running the installed CLI lookup, provenance, cleaning, and summary checks.');
  const info = JSON.parse(npm(['exec', '--offline', '--', 'dialscope', '--info'], temporary).stdout);
  if (info.packageVersion !== packageVersion || info.bundledMetadataDate !== 'unknown') throw new Error('Installed CLI provenance check failed.');
  const lookup = JSON.parse(npm(['exec', '--offline', '--', 'dialscope', '+14155552671', '--json'], temporary).stdout);
  if (lookup.ok !== true || lookup.e164 !== '+14155552671') throw new Error('Installed CLI lookup failed.');

  const contactPath = join(temporary, 'contacts.csv');
  const cleanedPath = join(temporary, 'cleaned.csv');
  const duplicatesPath = join(temporary, 'duplicates.csv');
  await writeFile(contactPath, 'phone,name,email,source\n08031234567,Ada,ada@example.test,legacy\n+234 803 123 4567,Ada Copy,copy@example.test,crm\n08031234567 ext 42,Bola,bola@example.test,referral\ninvalid,Chidi,chidi@example.test,manual\n');
  const cleaning = npm(['exec', '--offline', '--', 'dialscope', '--input', contactPath, '--column', 'phone', '--region', 'NG', '--output', cleanedPath, '--clean', '--dedupe', '--duplicates-output', duplicatesPath, '--report'], temporary, [3]);
  const report = JSON.parse(cleaning.stdout);
  const cleaned = await readFile(cleanedPath, 'utf8');
  const duplicates = await readFile(duplicatesPath, 'utf8');
  if (report.totalDataRows !== 4 || report.validCount !== 3 || report.invalidCount !== 1 || report.duplicateRowCount !== 1 || report.duplicateGroupCount !== 1) {
    throw new Error('Installed CLI summary counts did not match the synthetic contact fixture.');
  }
  if (!cleaned.includes('name,email,source') || !cleaned.includes('Chidi') || cleaned.includes('Ada Copy') || !duplicates.includes('Ada Copy') || !duplicates.includes('duplicate_of_row_id')) {
    throw new Error('Installed CLI cleaning or duplicate report check failed.');
  }
  if (!cleaning.stderr.includes('Wrote') || cleaning.stdout.trim().split('\n').length !== 1) throw new Error('Installed CLI mixed progress into JSON summary stdout.');

  console.error('Starting the installed API package and issuing loopback requests.');
  await verifyInstalledApi(installRoot);
  console.log(`Packed consumer verification passed for dialscope@${packageVersion}: installed CLI, root/API ESM and strict TypeScript imports, cleaning/report, provenance, and loopback API.`);
  if (basename(tarball) !== `dialscope-${packageVersion}.tgz`) console.error(`Note: tested tarball filename is ${basename(tarball)}.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
