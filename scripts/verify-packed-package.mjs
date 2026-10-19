import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), 'dialscope-consumer-'));

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 180_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Run this check through npm run verify:packed so npm uses its platform-specific executable.');
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const packageVersion = manifest.version;
  const npm = (args, cwd) => run(process.execPath, [npmCli, ...args], cwd);
  console.error('Packing DialScope from the repository source.');
  const packOutput = npm(['pack', '--pack-destination', temporary, '--json'], root);
  const packResult = JSON.parse(packOutput);
  const tarball = join(temporary, packResult[0].filename);
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ name: 'dialscope-consumer-check', private: true, type: 'module' }));
  console.error('Installing the packed tarball in an isolated consumer.');
  npm(['install', '--offline', '--no-audit', '--no-fund', tarball], temporary);

  const consumer = `import { getMetadataInfo, lookupPhoneNumber, summarizeBatch } from 'dialscope';
import { createApiApp } from 'dialscope/api';
import type { BatchSummary, LookupResult, NumberType } from 'dialscope';
const result: LookupResult = await lookupPhoneNumber('+14155552671');
const summary: BatchSummary = summarizeBatch([]);
const info = getMetadataInfo();
void createApiApp;
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

  console.error('Running installed CLI checks.');
  const installedCli = join(temporary, 'node_modules', 'dialscope', 'dist', 'cli.js');
  const info = JSON.parse(run(process.execPath, [installedCli, '--info'], temporary));
  if (info.packageVersion !== packageVersion) throw new Error('Installed CLI returned the wrong package version');
  const lookup = JSON.parse(run(process.execPath, [installedCli, '+14155552671', '--json'], temporary));
  if (lookup.ok !== true || lookup.e164 !== '+14155552671') throw new Error('Installed CLI lookup failed');
  console.log('Packed consumer verification passed: installed ESM API, strict TypeScript imports, --info, and CLI lookup.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
