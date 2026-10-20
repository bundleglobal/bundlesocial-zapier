const { runOperation, runSearch } = require('./run');

const JSON_BODY_FIELD = {
	key: 'jsonBody',
	label: 'JSON Body',
	type: 'code',
	required: true,
	helpText:
		'Full request body as JSON. See the [API reference](https://info.bundle.social/api-reference/introduction) for the schema.',
};

// Generated fields carry `_body` / `_platform` markers for the runtime; Zapier must not see them.
const isDynamic = (field) => field._body === true || field._platform !== undefined;
const strip = (field) => Object.fromEntries(Object.entries(field).filter(([key]) => !key.startsWith('_')));

function selectedPlatforms(value, known) {
	const values = (Array.isArray(value) ? value : value ? String(value).split(',') : [])
		.map((entry) => String(entry).trim())
		.filter(Boolean);
	// A value mapped from an earlier step is unknown until the Zap runs: show every section.
	if (values.some((entry) => !known.has(entry))) return undefined;
	return new Set(values);
}

/**
 * Body fields become one dynamic field function: "Specify Body: Using JSON" swaps them for a
 * JSON field, and on posts only the sections of the selected platforms are shown.
 */
function inputFieldsFor(op) {
	const first = op.inputFields.findIndex(isDynamic);
	if (first < 0) return op.inputFields.map(strip);
	const before = op.inputFields.slice(0, first).map(strip);
	const dynamicFields = op.inputFields.filter(isDynamic);
	const after = op.inputFields.slice(first).filter((field) => !isDynamic(field)).map(strip);
	const platforms = new Set(dynamicFields.map((field) => field._platform).filter(Boolean));

	const bodyFields = (z, bundle) => {
		const input = bundle.inputData || {};
		if (op.spec.bodySwitch && input.bodyInput === 'json') return [JSON_BODY_FIELD];
		const selected = op.selector ? selectedPlatforms(input[op.selector], platforms) : undefined;
		return dynamicFields
			.filter((field) => !field._platform || !selected || selected.has(field._platform))
			.map(strip);
	};
	return [...before, bodyFields, ...after];
}

function buildActions(operations) {
	const creates = {};
	const searches = {};
	for (const op of operations) {
		const isSearch = op.type === 'search';
		const definition = {
			key: op.key,
			noun: op.noun,
			display: { label: op.label, description: op.description },
			operation: {
				perform: isSearch
					? (z, bundle) => runSearch(z, bundle, op.spec)
					: (z, bundle) => runOperation(z, bundle, op.spec),
				inputFields: inputFieldsFor(op),
				...(op.inputFieldGroups ? { inputFieldGroups: op.inputFieldGroups } : {}),
				sample: op.sample,
			},
		};
		(isSearch ? searches : creates)[op.key] = definition;
	}
	return { creates, searches };
}

module.exports = { buildActions, inputFieldsFor, JSON_BODY_FIELD };
