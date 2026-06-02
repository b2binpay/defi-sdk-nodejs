#!/usr/bin/env node
/**
 * Workaround for openapi-generator typescript-fetch bug:
 * oneOf-wrapper templates emit `from './PascalCaseName'` regardless of
 * `fileNaming=kebab-case`. Rewrite such imports to kebab-case so they
 * resolve to the actual generated files.
 *
 * See OpenAPITools/openapi-generator issues #11354, #14763 (related).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'generated-contracts');
const DIRS = [join(ROOT, 'models'), join(ROOT, 'apis')];

const pascalToKebab = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

const IMPORT_RE = /from '(\.\.?\/(?:models\/)?)([A-Z][A-Za-z0-9]+)';/g;

let patched = 0;
for (const dir of DIRS) {
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts')) {
      continue;
    }
    const path = join(dir, file);
    const src = readFileSync(path, 'utf8');
    const next = src.replace(IMPORT_RE, (_, prefix, name) => `from '${prefix}${pascalToKebab(name)}';`);
    if (next !== src) {
      writeFileSync(path, next);
      patched += 1;
      console.log(`patched imports: ${file}`);
    }
  }
}

/**
 * Workaround for oneOf without discriminator: the generated FromJSONTyped
 * iterates instanceOfX guards in declaration order. When one variant has no
 * required fields, its instanceOf returns `true` unconditionally and the parser
 * strips fields from every other variant. Replace the body with a pass-through.
 */
const ONE_OF_FROM_BODY = /(export function [A-Z][A-Za-z0-9]+FromJSONTyped\(json: any, ignoreDiscriminator: boolean\): [A-Z][A-Za-z0-9]+ \{)[\s\S]*?(^\})/gm;
const ONE_OF_TO_BODY = /(export function [A-Z][A-Za-z0-9]+ToJSONTyped\(value\?: [A-Z][A-Za-z0-9]+ \| null, ignoreDiscriminator: boolean = false\): any \{)[\s\S]*?(^\})/gm;

for (const file of readdirSync(DIRS[0])) {
  if (!file.endsWith('.ts')) {
    continue;
  }
  const path = join(DIRS[0], file);
  const src = readFileSync(path, 'utf8');
  if (!src.includes('instanceOf') || !src.match(/^export type [A-Z][A-Za-z0-9]+ = .+ \| .+;$/m)) {
    continue;
  }
  let next = src.replace(
    ONE_OF_FROM_BODY,
    `$1
    if (json == null) {
        return json;
    }
    return json;
$2`,
  );
  next = next.replace(
    ONE_OF_TO_BODY,
    `$1
    if (value == null) {
        return value;
    }
    return value;
$2`,
  );
  if (next !== src) {
    writeFileSync(path, next);
    patched += 1;
    console.log(`patched oneOf pass-through: ${file}`);
  }
}

if (patched === 0) {
  console.log('no generator-bug imports found');
}
