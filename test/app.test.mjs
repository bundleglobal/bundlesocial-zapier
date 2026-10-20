import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { compileApp, validateApp } = require('zapier-platform-core/src/tools/schema');
const App = require('../index');
const operations = require('../generated');

describe('app definition', () => {
	it('passes the Zapier schema checks', () => {
		expect(validateApp(compileApp(App))).toEqual([]);
	});

	it('maps every path placeholder of every action to a field', () => {
		const problems = [];
		for (const op of operations) {
			const placeholders = [...op.spec.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
			for (const name of placeholders) {
				const param = op.spec.params.find((p) => p.in === 'path' && p.to === name);
				const field = param && op.inputFields.find((f) => f.key === param.key);
				if (!field || !field.required) problems.push(`${op.key}: {${name}}`);
			}
		}
		expect(problems).toEqual([]);
	});

	it('only uses input field groups the action defines', () => {
		const problems = [];
		for (const op of operations) {
			const groups = new Set((op.inputFieldGroups || []).map((g) => g.key));
			if (groups.size !== (op.inputFieldGroups || []).length) problems.push(`${op.key}: duplicate group`);
			for (const field of op.inputFields) {
				if (field.group && !groups.has(field.group)) problems.push(`${op.key}.${field.key}: ${field.group}`);
			}
		}
		expect(problems).toEqual([]);
	});

	it('points every dropdown at a hidden trigger that exists', () => {
		const problems = [];
		const check = (where, fields) => {
			for (const field of fields) {
				if (field.children) check(`${where}.${field.key}`, field.children);
				if (!field.dynamic) continue;
				const trigger = App.triggers[field.dynamic.split('.')[0]];
				if (!trigger || !trigger.display.hidden) problems.push(`${where}.${field.key}: ${field.dynamic}`);
			}
		};
		for (const op of operations) check(op.key, op.inputFields);
		for (const trigger of Object.values(App.triggers)) check(trigger.key, trigger.operation.inputFields || []);
		expect(problems).toEqual([]);
	});

	it('keeps every body field mapped to a request location', () => {
		const problems = [];
		for (const op of operations) {
			const mapped = new Set(op.spec.params.map((p) => p.key));
			for (const field of op.inputFields) {
				if (['bodyInput', 'returnAll', 'limit'].includes(field.key)) continue;
				if (!mapped.has(field.key)) problems.push(`${op.key}.${field.key}`);
			}
		}
		expect(problems).toEqual([]);
	});
});
