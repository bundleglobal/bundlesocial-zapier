const { NOT_FOUND, apiRequest } = require('./client');
const { TRUE_VALUES, createConverter, isPlainObject } = require('./convert');

const DEFAULT_LIMIT = 50;
// Zapier caps how long an action may run, so "Return All" stops after this many pages.
const MAX_PAGES = 20;

const MIME_EXTENSIONS = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/heic': 'heic',
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'video/webm': 'webm',
	'application/pdf': 'pdf',
	'text/plain': 'txt',
};

function setPath(target, dotted, value) {
	const keys = dotted.split('.');
	let current = target;
	for (const key of keys.slice(0, -1)) {
		if (!isPlainObject(current[key])) current[key] = {};
		current = current[key];
	}
	current[keys[keys.length - 1]] = value;
}

// Field keys of flattened objects are `parent__child`; read them flat, or nested if Zapier unflattened them.
function readInput(input, key) {
	if (input[key] !== undefined) return input[key];
	let current = input;
	for (const part of key.split('__')) {
		if (!isPlainObject(current)) return undefined;
		current = current[part];
	}
	return current;
}

const isTrue = (value) => value === true || TRUE_VALUES.has(String(value).trim().toLowerCase());

function buildRequest(z, bundle, spec) {
	const input = bundle.inputData || {};
	const { convert, parseJson } = createConverter(z);
	const useJsonBody = spec.jsonBodyOnly === true || (spec.bodySwitch === true && input.bodyInput === 'json');

	let endpoint = spec.path;
	const params = {};
	let body = JSON.parse(JSON.stringify(spec.bodyDefaults || {}));
	let file;

	for (const param of spec.params) {
		const value = readInput(input, param.key);
		switch (param.in) {
			case 'jsonBody':
				if (useJsonBody) body = parseJson(value, 'JSON Body') ?? {};
				break;
			case 'path': {
				const text = String(value ?? '').trim();
				if (!text) throw new z.errors.Error(`"${param.key}" is required`, 'InvalidInput', 400);
				endpoint = endpoint.replace(`{${param.to}}`, encodeURIComponent(text));
				break;
			}
			case 'query': {
				const converted = convert(value, param.shape, param.key);
				if (converted !== undefined) params[param.to] = converted;
				break;
			}
			case 'body': {
				if (useJsonBody) break;
				const converted = convert(value, param.shape, param.key);
				if (converted !== undefined) setPath(body, param.to, converted);
				break;
			}
			case 'file':
				file = { field: param.to, value };
				break;
		}
	}
	return { endpoint, params, body, file };
}

function toResult(data) {
	if (Array.isArray(data)) return { items: data };
	if (isPlainObject(data)) return data;
	if (data === undefined || data === null || data === '') return { success: true };
	return { value: data };
}

function fileNameFrom(response, url, mimeType) {
	const disposition = response.headers.get('content-disposition') || '';
	const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
	let name = match ? decodeURIComponent(match[1]) : '';
	if (!name) {
		try {
			name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
		} catch {
			name = '';
		}
	}
	name = name || 'file';
	const extension = MIME_EXTENSIONS[mimeType];
	return extension && !/\.[A-Za-z0-9]{2,5}$/.test(name) ? `${name}.${extension}` : name;
}

// Zapier hands files over as URLs (its own hydrated files or public links); plain text becomes a .txt file.
async function openFile(z, value) {
	const text = String(value ?? '').trim();
	if (!text) throw new z.errors.Error('"File" is required', 'InvalidInput', 400);
	if (!/^https?:\/\//i.test(text)) return { data: Buffer.from(text), name: 'file.txt', mimeType: 'text/plain' };
	const response = await z.request({ url: text, raw: true, skipThrowForStatus: true });
	if (response.status >= 400) {
		throw new z.errors.Error(`Downloading the file failed with status ${response.status}`, 'FileError', 400);
	}
	const mimeType = (response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
	return { data: await response.buffer(), name: fileNameFrom(response, text, mimeType), mimeType };
}

function buildMultipartBody(fields, file) {
	const boundary = `----ZapierBundleSocial${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
	const escape = (text) => text.replace(/"/g, '%22').replace(/\r?\n/g, ' ');
	const chunks = [];
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null) continue;
		const text = typeof value === 'string' ? value : JSON.stringify(value);
		chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${escape(key)}"\r\n\r\n${text}\r\n`));
	}
	chunks.push(
		Buffer.from(
			`--${boundary}\r\nContent-Disposition: form-data; name="${escape(file.field)}"; filename="${escape(file.name)}"\r\n` +
				`Content-Type: ${file.mimeType}\r\n\r\n`,
		),
		file.data,
		Buffer.from(`\r\n--${boundary}--\r\n`),
	);
	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function uploadMultipart(z, bundle, spec, request) {
	if (!request.file) throw new z.errors.Error('No file field configured for the upload', 'InvalidInput', 400);
	const file = await openFile(z, request.file.value);
	const multipart = buildMultipartBody(request.body, { ...file, field: request.file.field });
	return apiRequest(z, bundle, spec.method, request.endpoint, {
		params: request.params,
		body: multipart.body,
		headers: { 'Content-Type': multipart.contentType },
	});
}

async function paginate(z, bundle, spec, request) {
	const { itemsKey, pageSize } = spec.pagination;
	const input = bundle.inputData || {};
	const limit = isTrue(input.returnAll) ? Infinity : Math.max(1, Number(input.limit) || DEFAULT_LIMIT);
	const items = [];
	let offset = 0;
	let total;

	for (let page = 0; page < MAX_PAGES && items.length < limit; page++) {
		const data = await apiRequest(z, bundle, spec.method, request.endpoint, {
			params: { ...request.params, offset, limit: Math.min(pageSize, limit - items.length) },
		});
		const batch = data && Array.isArray(data[itemsKey]) ? data[itemsKey] : [];
		items.push(...batch);
		offset += batch.length;
		if (data && typeof data.total === 'number') total = data.total;
		if (!batch.length || (total !== undefined && offset >= total)) break;
	}
	const results = items.slice(0, limit);
	return { [itemsKey]: results, total: total ?? results.length };
}

async function runOperation(z, bundle, spec) {
	const request = buildRequest(z, bundle, spec);
	if (spec.pagination) return paginate(z, bundle, spec, request);
	if (spec.body === 'multipart') return toResult(await uploadMultipart(z, bundle, spec, request));
	const data = await apiRequest(z, bundle, spec.method, request.endpoint, {
		params: request.params,
		body: spec.body === 'json' ? request.body : undefined,
	});
	return toResult(data);
}

// Searches return a list; a missing record is an empty list so Zapier can report "nothing found".
async function runSearch(z, bundle, spec) {
	const request = buildRequest(z, bundle, spec);
	const data = await apiRequest(z, bundle, spec.method, request.endpoint, {
		params: request.params,
		allowNotFound: true,
	});
	if (data === NOT_FOUND || data === undefined || data === null) return [];
	return [toResult(data)];
}

module.exports = { runOperation, runSearch, toResult };
