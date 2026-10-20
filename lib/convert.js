const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const TRUE_VALUES = new Set(['true', 'yes', 'y', '1', 'on']);
const FALSE_VALUES = new Set(['false', 'no', 'n', '0', 'off']);

/**
 * Turns Zapier input values back into the JSON the API expects. Mapped values from earlier
 * steps arrive as strings, so numbers, booleans and lists are parsed here.
 * Shapes come from the generator: number, boolean, list, json, dict, children.
 */
function createConverter(z) {
	const fail = (message) => new z.errors.Error(message, 'InvalidInput', 400);

	function parseJson(value, label) {
		if (typeof value !== 'string') return value;
		if (value.trim() === '') return undefined;
		try {
			return JSON.parse(value);
		} catch {
			throw fail(`"${label}" is not valid JSON`);
		}
	}

	function toList(value, numeric, label) {
		let list;
		if (Array.isArray(value)) {
			list = value;
		} else if (typeof value === 'string') {
			const text = value.trim();
			if (!text) return undefined;
			if (text.startsWith('[')) {
				const parsed = parseJson(text, label);
				list = Array.isArray(parsed) ? parsed : [parsed];
			} else {
				list = text.split(',').map((part) => part.trim());
			}
		} else {
			list = [value];
		}
		list = list.filter((entry) => entry !== '' && entry !== null && entry !== undefined);
		if (numeric) {
			list = list.map((entry) => {
				const num = Number(entry);
				if (Number.isNaN(num)) throw fail(`"${label}" must contain numbers only`);
				return num;
			});
		}
		return list.length ? list : undefined;
	}

	function toChildren(value, fields, label) {
		let rows = value;
		if (typeof rows === 'string') rows = parseJson(rows, label);
		if (isPlainObject(rows)) rows = [rows];
		if (!Array.isArray(rows)) return undefined;
		const items = rows
			.map((row) => {
				if (!isPlainObject(row)) return undefined;
				const out = {};
				for (const [key, entry] of Object.entries(row)) {
					const converted = convert(entry, fields && fields[key], `${label} > ${key}`);
					if (converted !== undefined) out[key] = converted;
				}
				return Object.keys(out).length ? out : undefined;
			})
			.filter((row) => row !== undefined);
		return items.length ? items : undefined;
	}

	function convert(value, shape, label) {
		if (value === undefined || value === null) return undefined;
		switch (shape && shape.kind) {
			case 'boolean': {
				if (typeof value === 'boolean') return value;
				const text = String(value).trim().toLowerCase();
				if (!text) return undefined;
				if (TRUE_VALUES.has(text)) return true;
				if (FALSE_VALUES.has(text)) return false;
				throw fail(`"${label}" must be true or false`);
			}
			case 'number': {
				if (typeof value === 'string' && value.trim() === '') return undefined;
				const num = Number(value);
				if (Number.isNaN(num)) throw fail(`"${label}" must be a number`);
				return num;
			}
			case 'list':
				return toList(value, shape.numeric === true, label);
			case 'json':
				return parseJson(value, label);
			case 'dict': {
				const dict = isPlainObject(value) ? value : parseJson(value, label);
				return isPlainObject(dict) && Object.keys(dict).length ? dict : undefined;
			}
			case 'children':
				return toChildren(value, shape.fields, label);
			default:
				if (value === '' || (Array.isArray(value) && value.length === 0)) return undefined;
				return value;
		}
	}

	return { convert, parseJson };
}

module.exports = { createConverter, isPlainObject, TRUE_VALUES };
