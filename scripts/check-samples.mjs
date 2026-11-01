#!/usr/bin/env node
// Checks that every sample only holds keys the live results have, which Zapier requires.
// Reads the `zapier-platform invoke` logs that scripts/smoke-test.sh writes to smoke-output/.
// Usage: node scripts/check-samples.mjs [smoke-output]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.resolve(process.argv[2] ?? path.join(ROOT, 'smoke-output'));
const App = createRequire(import.meta.url)(path.join(ROOT, 'index.js'));

const definitions = {
	create: App.creates,
	search: App.searches,
	trigger: App.triggers,
};

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// Sample keys missing from a live result, as dotted paths. A list of objects is checked against every live entry.
function missingKeys(sample, live, prefix = '') {
	return Object.keys(sample).flatMap((key) => {
		if (!isObject(live) || !(key in live)) return [prefix + key];
		const value = sample[key];
		if (isObject(value)) return missingKeys(value, live[key], `${prefix}${key}.`);
		if (Array.isArray(value) && isObject(value[0]) && Array.isArray(live[key])) {
			const missing = new Set(live[key].flatMap((entry) => missingKeys(value[0], entry, `${prefix}${key}[].`)));
			return [...missing];
		}
		return [];
	});
}

// The invoke output: log lines, then the JSON result, then the command the smoke test appends.
function resultOf(text) {
	const end = text.indexOf('\n\n$ invoke');
	const body = end < 0 ? text : text.slice(0, end);
	const start = body.search(/^[[{]/m);
	return start < 0 ? undefined : JSON.parse(body.slice(start));
}

let checked = 0;
const problems = [];
for (const file of fs.readdirSync(LOG_DIR).sort()) {
	const match = file.match(/^\d+-(create|search|trigger)-(.+)\.log$/);
	const definition = match && definitions[match[1]][match[2]];
	if (!definition || !definition.operation.sample) continue;
	const text = fs.readFileSync(path.join(LOG_DIR, file), 'utf8');
	// Calls the smoke test expects to fail have no result to compare.
	if (/Error:/.test(text)) continue;
	const result = resultOf(text);
	const items = Array.isArray(result) ? result : result === undefined ? [] : [result];
	if (!items.length) continue;
	checked += 1;
	for (const item of items) {
		const missing = missingKeys(definition.operation.sample, item);
		if (missing.length) {
			problems.push(`${match[1]} ${match[2]}: sample keys not in the live result: ${missing.join(', ')} (${file})`);
			break;
		}
	}
}

console.log(`  Compared the samples of ${checked} calls with their live results.`);
for (const problem of problems) console.log(`  - ${problem}`);
process.exit(problems.length ? 1 : 0);
