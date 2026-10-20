const DEFAULT_BASE_URL = 'https://api.bundle.social';

// Returned by apiRequest for a 404 when the caller allows it (searches).
const NOT_FOUND = Symbol('notFound');

// A non-production API is set per integration version (`zapier-platform env:set`), never by users.
const baseUrl = () => String(process.env.BUNDLESOCIAL_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

const isApiUrl = (url, bundle) => typeof url === 'string' && url.startsWith(`${baseUrl(bundle)}/`);

// Only API calls carry the key: file downloads and signed storage URLs must never see it.
const addApiKey = (request, z, bundle) => {
	const apiKey = bundle.authData && bundle.authData.apiKey;
	if (apiKey && isApiUrl(request.url, bundle)) {
		request.headers = { ...request.headers, 'x-api-key': apiKey };
	}
	return request;
};

function parseBody(response) {
	if (response.data !== undefined) return response.data;
	try {
		return JSON.parse(response.content);
	} catch {
		return undefined;
	}
}

// Validation errors carry one issue per invalid field; list them so the user sees which field failed.
function toApiError(z, response) {
	const raw = parseBody(response);
	const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	const message =
		typeof body.message === 'string' && body.message
			? body.message
			: `Request failed with status ${response.status}`;
	const issues = Array.isArray(body.issues)
		? body.issues.map((issue) => {
				const path = Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : 'body';
				return `${path}: ${String(issue.message)}`;
			})
		: [];
	const text = issues.length ? `${message}\n${issues.join('\n')}` : message;
	if (response.status === 401) return new z.errors.ExpiredAuthError(text);
	return new z.errors.Error(text, 'ApiError', response.status);
}

const handleErrors = (response, z, bundle) => {
	// Raw responses (file downloads, storage uploads) and opted-out requests are checked by the caller.
	if (response.skipThrowForStatus || (response.request && response.request.raw)) return response;
	if (response.status >= 400 && isApiUrl(response.request && response.request.url, bundle)) {
		throw toApiError(z, response);
	}
	return response;
};

// The API splits comma-separated query values into arrays, so arrays are sent joined.
function serializeQuery(params) {
	const out = {};
	for (const [key, value] of Object.entries(params || {})) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value)) {
			if (value.length) out[key] = value.join(',');
			continue;
		}
		out[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
	}
	return out;
}

async function apiRequest(z, bundle, method, endpoint, options = {}) {
	const { params, body, headers, allowNotFound } = options;
	const response = await z.request({
		method,
		url: `${baseUrl(bundle)}${endpoint}`,
		params: serializeQuery(params),
		body,
		headers,
		skipThrowForStatus: allowNotFound === true,
	});
	if (allowNotFound) {
		if (response.status === 404) return NOT_FOUND;
		if (response.status >= 400) throw toApiError(z, response);
	}
	return response.data;
}

module.exports = {
	NOT_FOUND,
	addApiKey,
	apiRequest,
	baseUrl,
	handleErrors,
	serializeQuery,
};
