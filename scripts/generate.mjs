#!/usr/bin/env node
// Generates the Zapier creates and searches from the bundle.social OpenAPI spec.
// Usage: node scripts/generate.mjs [path/to/openapi.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = process.argv[2] ?? path.join(ROOT, 'openapi', 'bundlesocial.openapi.json');
const OUT_DIR = path.join(ROOT, 'generated');
const README_PATH = path.join(ROOT, 'README.md');
const API_DOCS_URL = 'https://info.bundle.social/api-reference/introduction';

// Objects nested deeper than this become JSON fields.
const MAX_DEPTH = 4;
// Response samples stop expanding objects at this depth.
const SAMPLE_DEPTH = 4;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_LIMIT = '50';
// Zapier schema limits.
const MAX_LABEL = 64;
const MAX_HELP_TEXT = 1000;
// Operations the integration exposes as Zapier actions: the publishing workflow from team setup to analytics,
// plus organization, team, social account, post, post history import, upload, analytics and comment management.
const PUBLISHED_OPERATIONS = new Set([
	'organization.getOrganization',
	'organization.getPostsUsage',
	'organization.getCommentsUsage',
	'organization.getUploadsUsage',
	'organization.getDailyLimitsUsage',
	'organization.getImportsUsage',
	'team.createTeam',
	'team.getTeam',
	'team.getList',
	'team.updateTeam',
	'team.deleteTeam',
	'socialAccount.connect',
	'socialAccount.disconnect',
	'socialAccount.getByType',
	'socialAccount.setChannel',
	'socialAccount.unsetChannel',
	'socialAccount.refreshChannels',
	'socialAccount.profileRefresh',
	'socialAccount.connectionCheck',
	'socialAccount.createPortalLink',
	'socialAccount.copy',
	'socialAccount.enableMessaging',
	'socialAccount.disableMessaging',
	'socialAccount.getAccountsToDelete',
	'post.create',
	'post.get',
	'post.getByReferenceKey',
	'post.getList',
	'post.update',
	'post.retry',
	'post.delete',
	'post.getReconnectSocialAccountCandidates',
	'post.reconnectSocialAccount',
	'postImport.create',
	'postImport.getStatus',
	'postImport.getById',
	'postImport.retryImport',
	'postImport.getImportedPosts',
	'postImport.deleteImportedPosts',
	'upload.create',
	'upload.createFromUrl',
	'upload.get',
	'upload.getList',
	'upload.delete',
	'upload.deleteMany',
	'upload.initLargeUpload',
	'upload.finalizeLargeUpload',
	'upload.initMultipartUpload',
	'upload.signMultipartParts',
	'upload.completeMultipartUpload',
	'upload.abortMultipartUpload',
	'analytics.getPostAnalytics',
	'analytics.getPostAnalyticsRaw',
	'analytics.getBulkPostAnalytics',
	'analytics.forcePostAnalytics',
	'analytics.getSocialAccountAnalytics',
	'analytics.getSocialAccountAnalyticsRaw',
	'analytics.forceSocialAccountAnalytics',
	'comment.create',
	'comment.get',
	'comment.getList',
	'comment.update',
	'comment.delete',
	'comment.retry',
	'comment.importCreate',
	'comment.importGetList',
	'comment.importGetById',
	'comment.importGetFetchedComments',
	'comment.importActionFetchedComment',
]);
// Action descriptions in the style Zapier's review asks for; the spec's own read as API notes.
const ACTION_DESCRIPTIONS = {
	'organization.getOrganization': 'Retrieves your bundle.social organization with its plan details.',
	'organization.getPostsUsage': 'Retrieves how many posts your organization has used against its plan limit this billing period.',
	'organization.getCommentsUsage':
		'Retrieves how many comments your organization has used against its plan limit this billing period.',
	'organization.getUploadsUsage':
		'Retrieves how much upload capacity your organization has used against its plan limit this billing period.',
	'organization.getDailyLimitsUsage':
		"Retrieves how many posts a social account has published on a given day against the network's daily cap.",
	'organization.getImportsUsage': 'Retrieves the post history import usage of each social account, by team or platform.',
	'team.createTeam': 'Creates a new team in your bundle.social organization.',
	'team.getTeam': 'Finds a team by ID, with its connected social accounts and settings.',
	'team.updateTeam': "Updates a team's name or avatar. Fields left empty keep their current value.",
	'team.deleteTeam': 'Permanently deletes a team along with its connected social accounts, posts and uploads.',
	'socialAccount.connect':
		'Generates the link that connects a social account to a team. Open the returned URL to sign in to the network and finish connecting.',
	'socialAccount.disconnect': 'Disconnects a social account from a team and removes it from all scheduled posts.',
	'socialAccount.getByType': "Retrieves the team's connected social account on the selected network.",
	'socialAccount.setChannel':
		'Selects the page, channel or organization a YouTube, Instagram, Facebook or LinkedIn account posts to.',
	'socialAccount.unsetChannel':
		'Clears the selected page, channel or organization of a social account, keeping its authorization.',
	'socialAccount.refreshChannels':
		'Reloads the channels available to a Reddit, Discord, Slack or Pinterest account from the network.',
	'socialAccount.profileRefresh': 'Updates the profile name, handle and avatar of a social account from the network.',
	'socialAccount.connectionCheck':
		'Checks right away whether a social account is still authorized, so an expired connection shows up before a post fails.',
	'socialAccount.createPortalLink':
		'Generates a hosted portal link where your users connect and manage the social accounts of a team themselves.',
	'socialAccount.copy':
		'Copies connected social accounts from one team to another, reusing their authorization without signing in again.',
	'socialAccount.enableMessaging':
		'Turns on direct message processing for the Facebook page or Instagram account of a team. Requires DM access for your organization.',
	'socialAccount.disableMessaging': 'Turns off direct message processing for the Facebook page or Instagram account of a team.',
	'socialAccount.getAccountsToDelete': 'Lists the social accounts queued for permanent deletion.',
	'post.create': 'Schedules a post, or publishes it right away, to one or more connected social accounts.',
	'post.get': 'Finds a post by ID, with its per-platform status, scheduled time, media and publishing errors.',
	'post.getByReferenceKey': 'Finds a post by the reference key you gave it when creating it.',
	'post.update':
		'Updates the content, media, scheduled time or platforms of a post that has not been published yet. Fields left empty keep their current value.',
	'post.retry': 'Publishes a failed post again, for example after reconnecting an expired account.',
	'post.delete': 'Permanently deletes a post from bundle.social.',
	'post.getReconnectSocialAccountCandidates':
		'Lists the posts that lost their social account when it was disconnected and can be moved to a newly connected account of the same network.',
	'post.reconnectSocialAccount':
		"Moves posts that lost their social account to the team's newly connected account of the same network, so scheduled posts publish instead of failing.",
	'postImport.create':
		'Starts importing the posts a social account published before it was connected, together with their analytics.',
	'postImport.getStatus': 'Lists the post history imports of a team with their status.',
	'postImport.getById': 'Finds a post history import by ID, with its status, progress and result.',
	'postImport.retryImport': 'Runs a failed post history import again.',
	'postImport.getImportedPosts':
		'Lists the posts imported for a social account with their analytics, and the import capacity left.',
	'postImport.deleteImportedPosts':
		'Permanently deletes up to 100 imported posts and their analytics, freeing import capacity.',
	'upload.create': 'Uploads an image, video or document of up to 90 MB to the media library, for use in posts.',
	'upload.createFromUrl': 'Adds an image or video to the media library from a public URL, for use in posts.',
	'upload.get': 'Finds a media file by ID, with its processing status, dimensions, duration and the posts using it.',
	'upload.delete': 'Permanently deletes a media file from the media library.',
	'upload.deleteMany': 'Permanently deletes several media files from the media library at once.',
	'upload.initLargeUpload':
		'Starts an upload of a file over 90 MB and returns the signed URL to send the file to. Upload Large File does every step for you.',
	'upload.finalizeLargeUpload': 'Adds a file sent to the signed URL of Initialize Large Upload to the media library.',
	'upload.initMultipartUpload':
		'Starts an upload of a file over 5 GB in parts and returns one signed URL per part. Upload Large File covers files up to 5 GB.',
	'upload.signMultipartParts': 'Issues new signed URLs for parts of a multipart upload whose URLs expired.',
	'upload.completeMultipartUpload': 'Assembles the uploaded parts of a multipart upload and adds the file to the media library.',
	'upload.abortMultipartUpload': 'Discards an unfinished multipart upload and the parts already sent.',
	'analytics.getPostAnalytics': 'Retrieves engagement metrics such as likes, comments, shares and views for a published post.',
	'analytics.getPostAnalyticsRaw':
		'Retrieves the analytics of a published post exactly as the network returns them, for metrics the standard analytics leave out.',
	'analytics.getBulkPostAnalytics': 'Retrieves the analytics of up to 60 published posts on one network in a single step.',
	'analytics.forcePostAnalytics':
		'Fetches fresh analytics for a published post from the network right away. Uses network rate limits, so use it sparingly.',
	'analytics.getSocialAccountAnalytics':
		'Retrieves profile metrics such as followers, reach and impressions for a connected social account.',
	'analytics.getSocialAccountAnalyticsRaw':
		'Retrieves the analytics of a connected social account exactly as the network returns them, for metrics the standard analytics leave out.',
	'analytics.forceSocialAccountAnalytics':
		'Fetches fresh analytics for a connected social account from the network right away. Uses network rate limits, so use it sparingly.',
	'comment.create':
		'Schedules a comment, or publishes it right away, on a published post or as a reply to a comment, for example the first comment of an Instagram or LinkedIn post.',
	'comment.get': 'Finds a comment created through bundle.social by ID, with its publishing status and errors.',
	'comment.update':
		'Updates the text or scheduled time of a comment that has not been published yet. Fields left empty keep their current value.',
	'comment.delete': 'Permanently deletes a comment from bundle.social. Deleting a scheduled comment cancels it.',
	'comment.retry': 'Publishes a failed comment again, for example after reconnecting an expired account.',
	'comment.importCreate': 'Starts importing the existing comments of a published post from the network.',
	'comment.importGetList': 'Lists the comment imports of a team with their status.',
	'comment.importGetById': 'Finds a comment import by ID, with its status, progress and result.',
	'comment.importGetFetchedComments': 'Lists the comments imported from the network for a post.',
	'comment.importActionFetchedComment':
		'Hides, unhides, likes, unlikes, approves, rejects or deletes an imported comment directly on the network.',
};
// Operations generated only for their fields and samples, which the hand-written triggers reuse.
const TRIGGER_SOURCES = new Set(['post.getList']);
const GET_MANY = 'Get Many';

const BRANDS = {
	TIKTOK: 'TikTok',
	YOUTUBE: 'YouTube',
	INSTAGRAM: 'Instagram',
	FACEBOOK: 'Facebook',
	TWITTER: 'X (Twitter)',
	THREADS: 'Threads',
	LINKEDIN: 'LinkedIn',
	PINTEREST: 'Pinterest',
	REDDIT: 'Reddit',
	MASTODON: 'Mastodon',
	DISCORD: 'Discord',
	SLACK: 'Slack',
	BLUESKY: 'Bluesky',
	GOOGLE_BUSINESS: 'Google Business Profile',
	SNAPCHAT: 'Snapchat',
};

const ACRONYMS = {
	id: 'ID',
	ids: 'IDs',
	url: 'URL',
	urls: 'URLs',
	uri: 'URI',
	dm: 'DM',
	dms: 'DMs',
	csv: 'CSV',
	api: 'API',
	ai: 'AI',
	cta: 'CTA',
	utc: 'UTC',
	iso: 'ISO',
	sku: 'SKU',
	json: 'JSON',
	html: 'HTML',
	gbp: 'GBP',
	oauth: 'OAuth',
	cml: 'CML',
	sms: 'SMS',
	utm: 'UTM',
	nsfw: 'NSFW',
};

// Resource value -> display name, plural noun for "Get many" actions.
const RESOURCES = {
	analytics: { name: 'Analytics', plural: 'analytics' },
	comment: { name: 'Comment', plural: 'comments' },
	commentImport: { name: 'Comment Import', plural: 'comment imports' },
	organization: { name: 'Organization' },
	post: { name: 'Post', plural: 'posts' },
	postHistoryImport: { name: 'Post History Import', plural: 'post history imports' },
	socialAccount: { name: 'Social Account', plural: 'social accounts' },
	team: { name: 'Team', plural: 'teams' },
	upload: { name: 'Upload', plural: 'uploads' },
};

// Same names as the n8n node, so both integrations describe an endpoint the same way.
const OPERATION_NAMES = {
	'organization.getOrganization': 'Get',
	'team.createTeam': 'Create',
	'team.getTeam': 'Get',
	'team.getList': GET_MANY,
	'team.updateTeam': 'Update',
	'team.deleteTeam': 'Delete',
	'socialAccount.connectionCheck': 'Run Connection Check',
	'socialAccount.profileRefresh': 'Refresh Profile',
	'socialAccount.getByType': 'Get by Type',
	'socialAccount.getAccountsToDelete': 'Get Scheduled for Deletion',
	'post.getList': GET_MANY,
	'post.getByReferenceKey': 'Get by Reference Key',
	'post.getReconnectSocialAccountCandidates': 'Get Reconnect Candidates',
	'postImport.create': 'Create',
	'postImport.getStatus': GET_MANY,
	'postImport.getById': 'Get',
	'postImport.retryImport': 'Retry',
	'upload.getList': GET_MANY,
	'upload.create': 'Upload File',
	'upload.createFromUrl': 'Upload From URL',
	'upload.deleteMany': 'Delete Many Uploads',
	'upload.initLargeUpload': 'Initialize Large Upload',
	'upload.finalizeLargeUpload': 'Finalize Large Upload',
	'upload.initMultipartUpload': 'Initialize Multipart Upload',
	'upload.signMultipartParts': 'Sign Multipart Upload Parts',
	'upload.completeMultipartUpload': 'Complete Multipart Upload',
	'upload.abortMultipartUpload': 'Abort Multipart Upload',
	'analytics.getSocialAccountAnalytics': 'Get Social Account Analytics',
	'analytics.getPostAnalytics': 'Get Post Analytics',
	'analytics.getBulkPostAnalytics': 'Get Bulk Post Analytics',
	'analytics.forceSocialAccountAnalytics': 'Refresh Social Account Analytics',
	'analytics.forcePostAnalytics': 'Refresh Post Analytics',
	'analytics.getSocialAccountAnalyticsRaw': 'Get Raw Social Account Analytics',
	'analytics.getPostAnalyticsRaw': 'Get Raw Post Analytics',
	'comment.getList': GET_MANY,
	'comment.importCreate': 'Create',
	'comment.importGetList': GET_MANY,
	'comment.importGetFetchedComments': 'Get Fetched Comments',
	'comment.importActionFetchedComment': 'Act on Fetched Comment',
	'comment.importGetById': 'Get',
};

// Spec descriptions that are wrong or read badly as help text. Keys are `<operationId>.<field>` or `<field>`.
const DESCRIPTION_OVERRIDES = {
	// The spec has the Duet and Stitch descriptions swapped.
	disableDuet: 'If true, other TikTok users cannot make Duets with this post.',
	disableStitch: 'If true, other TikTok users cannot make Stitches with this post.',
	// Cross-field rules the API enforces in a refinement, which the spec does not show.
	'comment.importGetFetchedComments.postId': 'Set either this or Imported Post ID, not both.',
	'comment.importGetFetchedComments.importedPostId': 'Set either this or Post, not both.',
	...Object.fromEntries(
		['getPostAnalytics', 'getPostAnalyticsRaw', 'forcePostAnalytics'].flatMap((op) => [
			[`analytics.${op}.postId`, 'Set together with Platform Type. For an imported post, set only Imported Post ID.'],
			[`analytics.${op}.platformType`, 'Required with Post ID.'],
			[`analytics.${op}.importedPostId`, 'Use instead of Post ID and Platform Type for an imported post.'],
		]),
	),
};

// Body fields the API requires although the spec marks them optional. Keys are `<operationId>.<field>`.
const REQUIRED_OVERRIDES = new Set([
	// Create Comment answers 400 "Title is required" without it.
	'comment.create.title',
	// Update Comment answers 500 without it, even when only the title changes.
	'comment.update.socialAccountTypes',
]);
const usedRequiredOverrides = new Set();

// Response keys the spec marks required but the API leaves out, so they stay out of the samples.
const SAMPLE_OMIT = {
	'postImport.getImportedPosts': ['limit', 'remainingCapacity'],
};

// Strings that are dates in practice but typed as plain strings in the spec.
const DATE_FIELDS = new Set(['postDate']);
// Dropdowns, each backed by a hidden trigger in triggers/lists.js.
const DYNAMIC = {
	teamId: 'team_list.id.name',
	fromTeamId: 'team_list.id.name',
	toTeamId: 'team_list.id.name',
	socialAccountId: 'social_account_list.id.name',
	socialAccountIds: 'social_account_list.id.name',
};
// Dropdowns for `{id}` path parameters, keyed by what the ID belongs to.
const PATH_DYNAMIC = {
	uploadId: { dynamic: 'upload_list.id.name', label: 'Upload' },
};
// Dropdowns whose list is scoped to a team: only added when the form has a Team field to depend on.
const TEAM_SCOPED_DYNAMIC = {
	postId: { dynamic: 'post_list.id.name', label: 'Post' },
	internalPostId: { dynamic: 'post_list.id.name', label: 'Post' },
};
const DYNAMIC_HELP = 'Pick from the list, or map an ID from an earlier step.';
const SENSITIVE_NAME = /secret|password|token|apikey/i;
const LONG_TEXT = /^(text|description|message|caption|content|body|summary|commentary)$/i;
// Keys the runtime reads itself; spec fields with these names get a location prefix.
const RESERVED_KEYS = new Set(['bodyInput', 'jsonBody', 'returnAll', 'limit']);

// ---------- text helpers ----------

const SMALL_WORDS = new Set(
	'a an and as at because but by en for if in neither nor of on only or over per so some than that the then to up upon v versus via vs when with without yet'.split(
		' ',
	),
);

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const camelCase = (text) =>
	text
		.replace(/[^A-Za-z0-9 ]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((word, i) => (i === 0 ? word.toLowerCase() : capitalize(word.toLowerCase())))
		.join('');
const snakeCase = (text) =>
	text
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.replace(/[^A-Za-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.toLowerCase();
const isAllCaps = (s) => /[A-Z]/.test(s) && s === s.toUpperCase();
const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// Words with inner capitals that camelCase splitting would break apart or flatten.
const MIXED_CASE_WORDS = { oauth: 'OAuth', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn' };

function splitWords(key) {
	return String(key)
		.replace(/OAuth/g, ' oauth ')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.split(/[\s_\-./:()]+/)
		.filter(Boolean);
}

function titleCase(text) {
	const words = text.split(' ').filter(Boolean);
	return words
		.map((word, i) => {
			const lower = word.toLowerCase();
			if (i > 0 && i < words.length - 1 && SMALL_WORDS.has(lower)) return lower;
			return word.replace(/[A-Za-z0-9]/, (c) => c.toUpperCase());
		})
		.join(' ');
}

function labelFor(key) {
	if (BRANDS[key]) return BRANDS[key];
	const words = splitWords(key).map((word) => {
		const fixed = ACRONYMS[word.toLowerCase()] ?? MIXED_CASE_WORDS[word.toLowerCase()];
		if (fixed) return fixed;
		if (isAllCaps(word) && word.length > 1) return capitalize(word.toLowerCase());
		return word;
	});
	return titleCase(words.join(' ')) || String(key);
}

function singular(word) {
	if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
	if (/ss$/i.test(word) || !/s$/i.test(word)) return word;
	return word.slice(0, -1);
}

// The path segment before `{id}` names what the ID belongs to, e.g. `/team/{id}` -> team.
function idOwnerWords(apiPath) {
	const segments = apiPath.split('/');
	const index = segments.indexOf('{id}');
	const words = splitWords(index > 0 ? segments[index - 1] : 'item');
	words[words.length - 1] = singular(words[words.length - 1]);
	return words;
}

function fixCasing(text) {
	return text
		.replace(/\bids\b/gi, 'IDs')
		.replace(/\bid\b/gi, 'ID')
		.replace(/\burls\b/gi, 'URLs')
		.replace(/\burl\b/gi, 'URL')
		.replace(/\bjson\b/gi, 'JSON')
		.replace(/comma separated/gi, 'comma-separated');
}

const ensurePeriod = (text) => (/[.!?)]$/.test(text) ? text : `${text}.`);

function clip(text, max) {
	if (text.length <= max) return text;
	return text.slice(0, max - 3).replace(/\s+\S*$/, '') + '...';
}

// Help text is Markdown in Zapier, so links and code spans stay as they are.
function helpText(text) {
	if (!text) return undefined;
	const out = String(text).replace(/\s+/g, ' ').trim();
	if (!out) return undefined;
	return clip(fixCasing(capitalize(out)), MAX_HELP_TEXT);
}

function firstSentence(text, max = 200) {
	if (!text) return undefined;
	const plain = String(text)
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/`/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	const match = plain.match(/^(.+?[.!?])(\s|$)/);
	let sentence = (match ? match[1] : plain).replace(/[.!?]$/, '');
	if (sentence.length > max) sentence = sentence.slice(0, max - 3).replace(/\s+\S*$/, '') + '...';
	return sentence;
}

// ---------- schema helpers ----------

const SCALARS = new Set(['string', 'number', 'integer', 'boolean']);
const SCALAR_KINDS = new Set(['string', 'datetime', 'number', 'boolean', 'options']);

function resolveSchema(schema) {
	if (!schema || typeof schema !== 'object') return { type: 'json' };
	const variants = schema.oneOf ?? schema.anyOf;
	if (variants) {
		if (variants.every((v) => SCALARS.has(v.type))) {
			// Unions like boolean | "true" | "false" collapse to their first scalar type.
			const first = variants[0];
			return {
				...first,
				enum: first.type === 'boolean' ? undefined : first.enum,
				description: schema.description ?? first.description,
				default: schema.default ?? first.default,
			};
		}
		return { type: 'json', description: schema.description };
	}
	if (schema.allOf?.length === 1) {
		return resolveSchema({ ...schema.allOf[0], description: schema.description ?? schema.allOf[0].description });
	}
	return schema;
}

const hasProperties = (s) => s.properties && Object.keys(s.properties).length > 0;
const isRecord = (s) => s.additionalProperties !== undefined && s.additionalProperties !== false;
const isScalarRecord = (s) =>
	isPlainObject(s.additionalProperties) && SCALARS.has(resolveSchema(s.additionalProperties).type);

function kindOf(schema, key, depth) {
	const s = resolveSchema(schema);
	if (s.type === 'json') return 'json';
	if (s.type === 'string') {
		if (s.format === 'binary') return 'file';
		if (s.enum) return 'options';
		if (s.format === 'date-time' || DATE_FIELDS.has(key)) return 'datetime';
		return 'string';
	}
	if (s.type === 'integer' || s.type === 'number') return s.enum ? 'options' : 'number';
	if (s.type === 'boolean') return 'boolean';
	if (s.type === 'array') {
		const item = resolveSchema(s.items);
		if (item.type === 'string' && item.enum) return 'multiOptions';
		if (SCALARS.has(item.type) && item.type !== 'boolean') return 'list';
		// Zapier line items hold one level of scalar fields.
		if (item.type === 'object' && hasProperties(item) && !isRecord(item)) {
			const flat = Object.entries(item.properties).every(([k, c]) => SCALAR_KINDS.has(kindOf(c, k, MAX_DEPTH)));
			if (flat) return 'children';
		}
		return 'json';
	}
	if (s.type === 'object') {
		if (hasProperties(s) && !isRecord(s) && depth < MAX_DEPTH) return 'object';
		if (!hasProperties(s) && isScalarRecord(s)) return 'dict';
	}
	return 'json';
}

// Objects whose children are all objects, like the per-platform `data` of a post.
function isPromotable(schema) {
	const s = resolveSchema(schema);
	if (s.type !== 'object' || !hasProperties(s) || isRecord(s)) return false;
	return Object.values(s.properties).every((child) => {
		const c = resolveSchema(child);
		return c.type === 'object' && hasProperties(c) && !isRecord(c);
	});
}

function sortIfLong(items, key) {
	if (items.length < 5) return items;
	return [...items].sort((a, b) => a[key].localeCompare(b[key]));
}

function choicesFor(values) {
	const seen = new Set();
	const choices = values
		.filter((value) => value !== '' && value !== null && value !== undefined)
		.map((value) => {
			let label = typeof value === 'string' ? labelFor(value) : String(value);
			if (seen.has(label)) label = `${label} (${value})`;
			seen.add(label);
			return { value: String(value), label, sample: String(value) };
		});
	return sortIfLong(choices, 'label');
}

// ---------- field builder ----------

const KEY_ORDER = [
	'key',
	'label',
	'type',
	'required',
	'list',
	'dict',
	'children',
	'choices',
	'dynamic',
	'dependsOn',
	'altersDynamicFields',
	'default',
	'placeholder',
	'helpText',
	'group',
];

function orderKeys(field) {
	const ordered = {};
	for (const key of KEY_ORDER) if (field[key] !== undefined) ordered[key] = field[key];
	for (const [key, value] of Object.entries(field)) if (!(key in ordered) && value !== undefined) ordered[key] = value;
	return ordered;
}

// Operation being generated, for per-operation description overrides.
let currentOperationId = '';

function descriptionOf(key, rawSchema) {
	const s = resolveSchema(rawSchema);
	return DESCRIPTION_OVERRIDES[`${currentOperationId}.${key}`] ?? DESCRIPTION_OVERRIDES[key] ?? s.description ?? rawSchema?.description;
}

function asDropdown(field, { dynamic, label }) {
	const { choices: _choices, ...rest } = field;
	const override = DESCRIPTION_OVERRIDES[`${currentOperationId}.${field.key}`];
	const helpText = override ? `${DYNAMIC_HELP} ${override}` : DYNAMIC_HELP;
	return orderKeys({ ...rest, type: 'string', dynamic, label, helpText });
}

/**
 * Turns one schema property into Zapier input fields plus the mappings the runtime uses to
 * rebuild the request. Objects flatten into one field per leaf, keyed `parent__child`.
 *
 * ctx: { key, label, to, location, depth, required, group, platform, marker }
 */
function buildFields(key, rawSchema, ctx) {
	const s = resolveSchema(rawSchema);
	const kind = kindOf(rawSchema, key, ctx.depth);

	if (kind === 'object') {
		const required = new Set(s.required ?? []);
		const out = { fields: [], params: [] };
		for (const [childKey, childSchema] of Object.entries(s.properties)) {
			if (resolveSchema(childSchema).format === 'binary') continue;
			const child = buildFields(childKey, childSchema, {
				...ctx,
				key: `${ctx.key}__${childKey}`,
				label: `${ctx.label}: ${labelFor(childKey)}`,
				to: `${ctx.to}.${childKey}`,
				depth: ctx.depth + 1,
				required: ctx.required && required.has(childKey),
			});
			out.fields.push(...child.fields);
			out.params.push(...child.params);
		}
		return out;
	}

	const field = { key: ctx.key, label: ctx.label };
	let shape;
	const description = descriptionOf(key, rawSchema);
	let help = helpText(description);

	switch (kind) {
		case 'string':
			field.type = SENSITIVE_NAME.test(key)
				? 'password'
				: (s.maxLength ?? 0) > 300 || LONG_TEXT.test(key)
					? 'text'
					: 'string';
			if (s.format === 'uri') field.placeholder = 'https://example.com';
			break;
		case 'datetime':
			field.type = 'datetime';
			break;
		case 'number':
			field.type = s.type === 'integer' ? 'integer' : 'number';
			shape = { kind: 'number' };
			break;
		case 'boolean':
			field.type = 'boolean';
			shape = { kind: 'boolean' };
			break;
		case 'options':
			field.type = 'string';
			field.choices = choicesFor(s.enum);
			if (s.type !== 'string') shape = { kind: 'number' };
			break;
		case 'multiOptions':
			field.type = 'string';
			field.list = true;
			field.choices = choicesFor(resolveSchema(s.items).enum);
			shape = { kind: 'list' };
			break;
		case 'list': {
			const item = resolveSchema(s.items);
			field.type = item.type === 'string' ? 'string' : item.type === 'integer' ? 'integer' : 'number';
			field.list = true;
			shape = { kind: 'list', ...(item.type === 'string' ? {} : { numeric: true }) };
			break;
		}
		case 'children': {
			const item = resolveSchema(s.items);
			const required = new Set(item.required ?? []);
			const shapes = {};
			field.children = Object.entries(item.properties).map(([childKey, childSchema]) => {
				const child = buildFields(childKey, childSchema, {
					key: childKey,
					label: labelFor(childKey),
					to: childKey,
					location: ctx.location,
					depth: MAX_DEPTH,
					required: required.has(childKey),
				});
				if (child.params[0].shape) shapes[childKey] = child.params[0].shape;
				return child.fields[0];
			});
			shape = { kind: 'children', ...(Object.keys(shapes).length ? { fields: shapes } : {}) };
			// Line item groups take no help text in Zapier.
			help = undefined;
			break;
		}
		case 'dict':
			field.dict = true;
			shape = { kind: 'dict' };
			break;
		case 'file':
			field.type = 'file';
			break;
		case 'json':
		default: {
			const isArray = s.type === 'array' || rawSchema?.type === 'array';
			field.type = 'code';
			shape = { kind: 'json' };
			const base = help ?? `${isArray ? 'Array' : 'Object'} in JSON format`;
			help = clip(`${ensurePeriod(base)} See the [API reference](${API_DOCS_URL}) for the expected shape.`, MAX_HELP_TEXT);
			break;
		}
	}

	if (DYNAMIC[key] && ['string', 'options', 'list'].includes(kind)) {
		field.type = 'string';
		field.dynamic = DYNAMIC[key];
		delete field.choices;
		field.label = field.label.replace(/ IDs$/, 's').replace(/ ID$/, '');
		help = DYNAMIC_HELP;
	}

	if (ctx.required && kind !== 'boolean') field.required = true;
	if (help && help.toLowerCase() !== field.label.toLowerCase()) field.helpText = help;
	if (ctx.group) field.group = ctx.group;
	if (ctx.marker) field._body = true;
	if (ctx.platform) field._platform = ctx.platform;

	return {
		fields: [orderKeys(field)],
		params: [{ key: ctx.key, in: ctx.location, to: ctx.to, ...(shape ? { shape } : {}) }],
	};
}

// ---------- operations ----------

function resourceOf(operationId) {
	const [group, sub] = operationId.split('.');
	if (group === 'misc') return sub === 'google_business' ? 'googleBusinessProfile' : sub;
	if (group === 'comment' && sub.startsWith('import')) return 'commentImport';
	if (group === 'automation' && /ProviderSetting/.test(sub)) return 'automationProviderSetting';
	if (group === 'postImport') return 'postHistoryImport';
	if (group === 'postCSV') return 'postCsvImport';
	return group;
}

function operationName(operationId, resource) {
	if (OPERATION_NAMES[operationId]) return OPERATION_NAMES[operationId];
	const tail = operationId.split('.').pop();
	const resourceWords = new Set(splitWords(RESOURCES[resource].name).map((w) => w.toLowerCase()));
	const words = splitWords(tail);
	const kept = words.filter((w, i) => i === 0 || !resourceWords.has(w.toLowerCase()));
	return labelFor(kept.join(' '));
}

// Adds "(Noun)" when the label does not already say what it acts on.
function withNoun(text, info) {
	const words = new Set(splitWords(text).map((w) => singular(w.toLowerCase())));
	const nounWords = splitWords(info.name).map((w) => singular(w.toLowerCase()));
	return nounWords.every((w) => words.has(w)) ? text : `${text} (${info.name})`;
}

function actionLabel(name, info, type) {
	let label;
	if (type === 'search') {
		const rest = name.replace(/^Get\b\s*/, '');
		if (!rest) label = `Find ${info.name}`;
		else if (/^by\b/.test(rest)) label = `Find ${info.name} ${rest}`;
		else label = withNoun(`Find ${rest}`, info);
	} else if (name === GET_MANY) {
		label = `Get Many ${titleCase(info.plural ?? info.name)}`;
	} else if (!name.includes(' ') || name === 'Create or Update') {
		label = `${name} ${info.name}`;
	} else if (/^\w+ by /.test(name)) {
		label = name.replace(/^(\w+) /, `$1 ${info.name} `);
	} else {
		label = withNoun(name, info);
	}
	if (label.length > MAX_LABEL) throw new Error(`Label longer than ${MAX_LABEL} characters: ${label}`);
	return label;
}

function actionDescription(op, name, info, type) {
	if (ACTION_DESCRIPTIONS[op.operationId]) return ACTION_DESCRIPTIONS[op.operationId];
	if (name === GET_MANY) {
		return `Returns many ${info.plural ?? info.name.toLowerCase()}. Paging is handled for you.`;
	}
	// Some spec descriptions are implementation notes; the summary reads better there.
	const described = firstSentence(op.description, 300);
	const weak = !described || described.length < 25 || /^(body requires|use typed|requires|field mask)/i.test(described);
	const text = weak ? firstSentence(String(op.summary ?? name).replace(/\[[^\]]*\]\s*/g, ''), 300) : described;
	const sentence = ensurePeriod(fixCasing(capitalize(text)));
	return type === 'search' ? `${sentence} Returns nothing when it does not exist.` : sentence;
}

function jsonSchemaOf(content, type) {
	return content?.[type]?.schema;
}

// ---------- samples ----------

const SAMPLE_DATE = '2026-01-15T10:00:00.000Z';
const SAMPLE_ID = 'c9b1e4a2-5f0d-4e8b-9a3c-1d2e3f4a5b6c';

function sampleString(schema, key) {
	if (schema.format === 'date-time' || DATE_FIELDS.has(key) || /(At|Date)$/.test(key)) return SAMPLE_DATE;
	if (schema.format === 'uri' || /url$/i.test(key)) return 'https://example.com/image.jpg';
	if (schema.format === 'email' || /email$/i.test(key)) return 'user@example.com';
	if (key === 'id' || /Id$/.test(key)) return SAMPLE_ID;
	return `Sample ${labelFor(key || 'text').toLowerCase()}`;
}

function sampleOf(schema, key = '', depth = 0) {
	if (!schema || typeof schema !== 'object') return null;
	const variants = schema.oneOf ?? schema.anyOf;
	if (variants?.length) return sampleOf(variants[0], key, depth);
	if (schema.allOf?.length === 1) return sampleOf(schema.allOf[0], key, depth);
	if (schema.default !== undefined && (schema.default === null || typeof schema.default !== 'object')) {
		return schema.default;
	}
	if (schema.enum?.length) return schema.enum[0];
	switch (schema.type) {
		case 'string':
			return sampleString(schema, key);
		case 'integer':
		case 'number':
			return typeof schema.minimum === 'number' ? Math.max(schema.minimum, 1) : 1;
		case 'boolean':
			return false;
		case 'array': {
			if (depth >= SAMPLE_DEPTH) return [];
			const item = sampleOf(schema.items, singular(key), depth + 1);
			return item === null ? [] : [item];
		}
		case 'object': {
			if (!hasProperties(schema) || depth >= SAMPLE_DEPTH) return {};
			// Zapier requires the sample keys to be a subset of every live result, so optional keys,
			// per-platform entries (only the post's platforms come back) and lists that may be empty are left out.
			const required = schema.required ? new Set(schema.required) : null;
			const entries = Object.entries(schema.properties)
				.filter(([k]) => (!required || required.has(k)) && !(k in BRANDS))
				.map(([k, v]) => [k, sampleOf(v, k, depth + 1)])
				.filter(([k, v]) => (depth === 0 && k === 'items') || !isEmptySample(v));
			return Object.fromEntries(entries);
		}
		default:
			return null;
	}
}

function isEmptySample(value) {
	if (Array.isArray(value)) return value.length === 0 || isPlainObject(value[0]);
	return isPlainObject(value) && Object.keys(value).length === 0;
}

// A response that only holds lists of objects, like `{ imports: [...] }`, keeps its required lists empty:
// the keys are always there, while `{ success: true }` is what an empty response becomes.
function emptyListsSample(schema) {
	const s = resolveSchema(schema);
	const lists = (s.required ?? []).filter((k) => resolveSchema(s.properties?.[k]).type === 'array');
	return lists.length ? Object.fromEntries(lists.map((k) => [k, []])) : { success: true };
}

// Mirrors how lib/run.js turns a response into a Zapier result.
function resultSample(schema) {
	const value = sampleOf(schema);
	if (Array.isArray(value)) return { items: value };
	if (isPlainObject(value)) return Object.keys(value).length ? value : emptyListsSample(schema);
	if (value === null || value === undefined) return { success: true };
	return { value };
}

// ---------- operation builder ----------

function buildOperation(operationId, method, apiPath, op) {
	currentOperationId = operationId;
	const resource = resourceOf(operationId);
	const info = RESOURCES[resource];
	if (!info) throw new Error(`No resource mapping for ${operationId}`);
	const name = operationName(operationId, resource);
	const isGetMany = name === GET_MANY;
	// Keys are stored in users' Zaps: renaming an operation breaks them.
	const value = isGetMany ? 'getAll' : camelCase(name);

	const parameters = op.parameters ?? [];
	const pathParams = parameters.filter((p) => p.in === 'path');
	const queryParams = parameters.filter((p) => p.in === 'query');
	const pathOrder = [...apiPath.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
	const responseSchema = jsonSchemaOf((op.responses?.['200'] ?? op.responses?.['201'])?.content, 'application/json');

	// Offset pagination when the response carries `total` plus an array of items.
	const hasOffset = queryParams.some((p) => p.name === 'offset');
	const limitParam = queryParams.find((p) => p.name === 'limit');
	let pagination;
	if (hasOffset && limitParam && responseSchema?.properties?.total) {
		const itemsKey = Object.keys(responseSchema.properties).find(
			(k) => resolveSchema(responseSchema.properties[k]).type === 'array',
		);
		if (itemsKey) {
			const max = limitParam.schema?.maximum;
			pagination = { itemsKey, pageSize: Math.min(DEFAULT_PAGE_SIZE, typeof max === 'number' ? max : DEFAULT_PAGE_SIZE) };
		}
	}

	// A single record fetched by its ID or key is a Zapier search, so it can feed "find" steps.
	const response = resolveSchema(responseSchema);
	const type =
		method === 'get' &&
		!pagination &&
		pathOrder.length > 0 &&
		/^Get(| by .+| .+ by ID)$/.test(name) &&
		response.type === 'object' &&
		hasProperties(response) &&
		!response.properties.items
			? 'search'
			: 'create';

	const fields = [];
	const params = [];
	const groups = [];
	const used = new Set(RESERVED_KEYS);
	const uniqueKey = (base, prefix) => {
		let candidate = base;
		if (used.has(candidate)) candidate = `${prefix}_${base}`;
		let n = 2;
		while (used.has(candidate)) candidate = `${prefix}_${base}${n++}`;
		used.add(candidate);
		return candidate;
	};
	const push = (built) => {
		fields.push(...built.fields);
		params.push(...built.params);
	};
	const schemaOf = (param) => ({ ...param.schema, description: param.description ?? param.schema?.description });

	// Path parameters, in URL order. `{id}` is named after its owner so team IDs get the team dropdown.
	for (const key of pathOrder) {
		const param = pathParams.find((p) => p.name === key) ?? { name: key, schema: { type: 'string' } };
		const owner = key === 'id' ? idOwnerWords(apiPath) : undefined;
		const semantic = owner ? camelCase(`${owner.join(' ')} id`) : key;
		const built = buildFields(semantic, schemaOf(param), {
			key: uniqueKey(key, 'path'),
			label: owner ? `${labelFor(owner.join(' '))} ID` : labelFor(key),
			to: key,
			location: 'path',
			depth: 0,
			required: true,
		});
		if (PATH_DYNAMIC[semantic]) built.fields[0] = asDropdown(built.fields[0], PATH_DYNAMIC[semantic]);
		push(built);
	}

	for (const param of queryParams.filter((p) => p.required)) {
		if (pagination && (param.name === 'offset' || param.name === 'limit')) continue;
		push(
			buildFields(param.name, schemaOf(param), {
				key: uniqueKey(param.name, 'query'),
				label: labelFor(param.name),
				to: param.name,
				location: 'query',
				depth: 0,
				required: true,
			}),
		);
	}

	// Request body.
	const content = op.requestBody?.content ?? {};
	const multipartSchema = jsonSchemaOf(content, 'multipart/form-data');
	const jsonSchema = jsonSchemaOf(content, 'application/json');
	let body;
	let bodySwitch = false;
	let jsonBodyOnly = false;
	let bodyDefaults;
	let selector;

	const addBodyProperties = (schema, marker) => {
		const required = new Set([
			...(schema.required ?? []),
			...Object.keys(schema.properties ?? {}).filter((k) => {
				const id = `${operationId}.${k}`;
				if (REQUIRED_OVERRIDES.has(id)) usedRequiredOverrides.add(id);
				return REQUIRED_OVERRIDES.has(id);
			}),
		]);
		// A required platform list (e.g. socialAccountTypes) hides the sections of unselected platforms.
		const selectorKey = Object.entries(schema.properties ?? {}).find(
			([k, s]) => required.has(k) && kindOf(s, k, 0) === 'multiOptions',
		)?.[0];
		const platforms = new Set(selectorKey ? resolveSchema(resolveSchema(schema.properties[selectorKey]).items).enum : []);
		const entries = Object.entries(schema.properties ?? {});
		const ordered = [...entries.filter(([k]) => required.has(k)), ...entries.filter(([k]) => !required.has(k))];

		for (const [key, childSchema] of ordered) {
			const resolved = resolveSchema(childSchema);
			const base = { location: 'body', depth: 1, marker };

			if (resolved.format === 'binary') {
				const fileKey = uniqueKey(key, 'body');
				fields.push({
					key: fileKey,
					label: labelFor(key),
					type: 'file',
					required: true,
					helpText: 'A file from an earlier step, or a public URL Zapier downloads the file from.',
				});
				params.push({ key: fileKey, in: 'file', to: key });
				continue;
			}

			if (isPromotable(childSchema)) {
				if (required.has(key)) (bodyDefaults ??= {})[key] = {};
				for (const [childKey, grandChild] of Object.entries(resolved.properties)) {
					const group = snakeCase(`${key} ${childKey}`);
					groups.push({ key: group, label: `${labelFor(childKey)} Settings` });
					push(
						buildFields(childKey, grandChild, {
							...base,
							key: uniqueKey(`${key}__${childKey}`, 'body'),
							label: labelFor(childKey),
							to: `${key}.${childKey}`,
							group,
							platform: platforms.has(childKey) ? childKey : undefined,
						}),
					);
				}
				continue;
			}

			const kind = kindOf(childSchema, key, 0);
			if (kind === 'object') {
				if (required.has(key)) (bodyDefaults ??= {})[key] = {};
				const group = snakeCase(key);
				groups.push({ key: group, label: labelFor(key) });
				const childKeys = Object.keys(resolved.properties);
				// Objects keyed by platform (e.g. firstComment) only offer the selected platforms.
				if (platforms.size && childKeys.every((k) => platforms.has(k))) {
					for (const [childKey, grandChild] of Object.entries(resolved.properties)) {
						push(
							buildFields(childKey, grandChild, {
								...base,
								key: uniqueKey(`${key}__${childKey}`, 'body'),
								label: `${labelFor(key)}: ${labelFor(childKey)}`,
								to: `${key}.${childKey}`,
								group,
								platform: childKey,
							}),
						);
					}
				} else {
					push(
						buildFields(key, childSchema, {
							...base,
							key: uniqueKey(key, 'body'),
							label: labelFor(key),
							to: key,
							depth: 0,
							required: required.has(key),
							group,
						}),
					);
				}
				continue;
			}

			const built = buildFields(key, childSchema, {
				...base,
				key: uniqueKey(key, 'body'),
				label: labelFor(key),
				to: key,
				depth: 0,
				required: required.has(key),
			});
			if (key === selectorKey) {
				built.fields[0].altersDynamicFields = true;
				selector = built.fields[0].key;
			}
			push(built);
		}
	};

	if (multipartSchema) {
		body = 'multipart';
		addBodyProperties(multipartSchema, false);
	} else if (jsonSchema) {
		body = 'json';
		const root = resolveSchema(jsonSchema);
		if (root.type === 'object' && hasProperties(root) && !isRecord(root)) {
			bodySwitch = true;
			used.add('bodyInput');
			fields.push({
				key: 'bodyInput',
				label: 'Specify Body',
				type: 'string',
				choices: [
					{ value: 'fields', label: 'Using fields below', sample: 'fields' },
					{ value: 'json', label: 'Using JSON', sample: 'json' },
				],
				altersDynamicFields: true,
				default: 'fields',
				helpText:
					'Switch to **Using JSON** to send the raw request body, which is handy for automation flow definitions or when the body comes from an earlier step.',
			});
			params.push({ key: 'jsonBody', in: 'jsonBody' });
			addBodyProperties(root, true);
		} else if (root.type === 'object' && !hasProperties(root)) {
			// Empty object body: nothing to configure, the runtime sends `{}`.
		} else {
			jsonBodyOnly = true;
			fields.push({
				key: 'jsonBody',
				label: 'JSON Body',
				type: 'code',
				required: true,
				helpText: `Full request body as JSON. See the [API reference](${API_DOCS_URL}) for the schema.`,
			});
			params.push({ key: 'jsonBody', in: 'jsonBody' });
		}
	}

	for (const param of queryParams.filter((p) => !p.required)) {
		if (pagination && (param.name === 'offset' || param.name === 'limit')) continue;
		push(
			buildFields(param.name, schemaOf(param), {
				key: uniqueKey(param.name, 'query'),
				label: labelFor(param.name),
				to: param.name,
				location: 'query',
				depth: 0,
				required: false,
			}),
		);
	}

	if (pagination) {
		fields.push(
			{
				key: 'returnAll',
				label: 'Return All',
				type: 'boolean',
				default: 'false',
				helpText: 'Return every result instead of stopping at **Limit**.',
			},
			{
				key: 'limit',
				label: 'Limit',
				type: 'integer',
				default: DEFAULT_LIMIT,
				helpText: 'Max number of results to return when **Return All** is off.',
			},
		);
	}

	if (fields.some((field) => field.key === 'teamId')) {
		fields.forEach((field, i) => {
			const dropdown = TEAM_SCOPED_DYNAMIC[field.key];
			if (!dropdown || field.type !== 'string' || field.list) return;
			fields[i] = asDropdown({ ...field, dependsOn: ['teamId'] }, dropdown);
		});
	}

	const keys = new Set();
	for (const field of fields) {
		if (keys.has(field.key)) throw new Error(`Duplicate field key ${field.key} in ${operationId}`);
		keys.add(field.key);
	}

	let sample = type === 'search' ? sampleOf(responseSchema) : resultSample(responseSchema);
	if (SAMPLE_OMIT[operationId]) {
		const omitted = SAMPLE_OMIT[operationId].filter((k) => !(k in sample));
		if (omitted.length) throw new Error(`Sample of ${operationId} has no ${omitted.join(', ')} to omit`);
		sample = Object.fromEntries(Object.entries(sample).filter(([k]) => !SAMPLE_OMIT[operationId].includes(k)));
	}
	const spec = {
		method: method.toUpperCase(),
		path: apiPath,
		params,
		...(body ? { body } : {}),
		...(bodySwitch ? { bodySwitch: true } : {}),
		...(jsonBodyOnly ? { jsonBodyOnly: true } : {}),
		...(bodyDefaults ? { bodyDefaults } : {}),
		...(pagination ? { pagination } : {}),
	};

	return {
		key: `${snakeCase(resource)}_${snakeCase(value)}`,
		type,
		noun: info.name,
		label: actionLabel(name, info, type),
		description: actionDescription(op, name, info, type),
		operationId,
		inputFields: fields,
		...(groups.length ? { inputFieldGroups: groups } : {}),
		...(selector ? { selector } : {}),
		spec,
		sample,
		resource,
		apiPath,
	};
}

// Operations that chain several requests; the runtime runs them via `spec.custom`.
function buildCustomOperations(spec) {
	currentOperationId = 'custom.uploadLargeFile';
	const finalize = spec.paths['/api/v1/upload/finalize']?.post;
	if (!finalize) throw new Error('Upload Large File needs POST /api/v1/upload/finalize in the spec');
	const team = buildFields('teamId', { type: 'string' }, {
		key: 'teamId',
		label: 'Team ID',
		to: 'teamId',
		location: 'body',
		depth: 0,
	});
	return [
		{
			key: 'upload_upload_large_file',
			type: 'create',
			noun: 'Upload',
			label: 'Upload Large File',
			description:
				'Uploads a file of up to 5 GB, such as a long video, to the media library: sends the file straight to storage and adds it for use in posts.',
			operationId: 'custom.uploadLargeFile',
			inputFields: [
				{
					key: 'file',
					label: 'File',
					type: 'file',
					required: true,
					helpText: 'A file from an earlier step, or a public URL Zapier downloads the file from.',
				},
				...team.fields,
			],
			spec: {
				method: 'POST',
				path: '/api/v1/upload/init',
				params: [{ key: 'file', in: 'file', to: 'file' }, ...team.params],
				custom: 'uploadLargeFile',
			},
			sample: resultSample(jsonSchemaOf(finalize.responses?.['200']?.content, 'application/json')),
			resource: 'upload',
			apiPath: '/api/v1/upload/init, then storage PUT, then /api/v1/upload/finalize',
		},
	];
}

// ---------- output ----------

function quote(s) {
	return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function jsKey(k) {
	return /^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k);
}

function toJs(value, indent = 0) {
	const pad = '\t'.repeat(indent);
	const pad1 = '\t'.repeat(indent + 1);
	if (Array.isArray(value)) {
		if (!value.length) return '[]';
		const inline = value.every((v) => v === null || typeof v !== 'object');
		if (inline) {
			const text = `[${value.map((v) => toJs(v)).join(', ')}]`;
			if (text.length + indent * 2 < 90) return text;
		}
		return `[\n${value.map((v) => `${pad1}${toJs(v, indent + 1)},`).join('\n')}\n${pad}]`;
	}
	if (value && typeof value === 'object') {
		const entries = Object.entries(value).filter(([, v]) => v !== undefined);
		if (!entries.length) return '{}';
		return `{\n${entries.map(([k, v]) => `${pad1}${jsKey(k)}: ${toJs(v, indent + 1)},`).join('\n')}\n${pad}}`;
	}
	if (typeof value === 'string') return quote(value);
	return String(value);
}

const HEADER = '// Generated by scripts/generate.mjs from openapi/bundlesocial.openapi.json. Do not edit by hand.\n';

function writeResourceFile(resource, operations) {
	const sorted = [...operations]
		.sort((a, b) => a.label.localeCompare(b.label))
		.map(({ resource: _resource, apiPath: _apiPath, ...op }) => op);
	fs.writeFileSync(path.join(OUT_DIR, `${resource}.js`), `${HEADER}module.exports = ${toJs(sorted)};\n`);
}

function writeIndex(resources) {
	const source = `${HEADER}module.exports = [
${resources.map((r) => `\t...require('./${r}'),`).join('\n')}
];
`;
	fs.writeFileSync(path.join(OUT_DIR, 'index.js'), source);
}

// Fields and samples of operations that only back triggers, keyed like actions (e.g. post_get_all).
function writeSources(sources) {
	const byKey = Object.fromEntries(sources.map((op) => [op.key, { inputFields: op.inputFields, sample: op.sample }]));
	fs.writeFileSync(path.join(OUT_DIR, 'sources.js'), `${HEADER}module.exports = ${toJs(byKey)};\n`);
}

function updateReadme(byResource, resources) {
	if (!fs.existsSync(README_PATH)) return;
	const readme = fs.readFileSync(README_PATH, 'utf8');
	const start = '<!-- actions:start -->';
	const end = '<!-- actions:end -->';
	if (!readme.includes(start) || !readme.includes(end)) return;
	const all = resources.flatMap((r) => byResource[r]);
	const lines = [
		start,
		'',
		`${all.length} actions, generated from the bundle.social OpenAPI spec.`,
		'',
		'| Action | What it does | Endpoint |',
		'|---|---|---|',
	];
	for (const resource of [...resources].sort((a, b) => RESOURCES[a].name.localeCompare(RESOURCES[b].name))) {
		for (const op of [...byResource[resource]].sort((a, b) => a.label.localeCompare(b.label))) {
			lines.push(`| ${op.label} | ${op.description} | \`${op.spec.method} ${op.apiPath}\` |`);
		}
	}
	lines.push('', end);
	const next = readme.replace(new RegExp(`${start}[\\s\\S]*${end}`), lines.join('\n'));
	fs.writeFileSync(README_PATH, next);
}

// ---------- main ----------

function main() {
	const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
	const byResource = {};
	const sources = [];
	const found = new Set();
	for (const [apiPath, methods] of Object.entries(spec.paths)) {
		for (const [method, op] of Object.entries(methods)) {
			const id = op?.operationId;
			if (!PUBLISHED_OPERATIONS.has(id) && !TRIGGER_SOURCES.has(id)) continue;
			found.add(id);
			const built = buildOperation(id, method, apiPath, op);
			if (TRIGGER_SOURCES.has(id)) sources.push(built);
			if (PUBLISHED_OPERATIONS.has(id)) (byResource[built.resource] ??= []).push(built);
		}
	}
	// A renamed or removed operation in the spec must fail loudly, not silently drop an action from Zaps.
	const missing = [...PUBLISHED_OPERATIONS, ...TRIGGER_SOURCES].filter((id) => !found.has(id));
	if (missing.length) throw new Error(`Operations not found in the spec: ${missing.join(', ')}`);
	const unusedRequired = [...REQUIRED_OVERRIDES].filter((id) => !usedRequiredOverrides.has(id));
	if (unusedRequired.length) throw new Error(`Required overrides match no body field: ${unusedRequired.join(', ')}`);
	for (const built of buildCustomOperations(spec)) (byResource[built.resource] ??= []).push(built);

	// Zapier keys are unique per action type; labels should be too, or the action list gets confusing.
	const seen = new Map();
	for (const op of Object.values(byResource).flat()) {
		for (const id of [`${op.type}:${op.key}`, `label:${op.label}`]) {
			if (seen.has(id)) throw new Error(`Duplicate ${id} (${seen.get(id)} and ${op.operationId})`);
			seen.set(id, op.operationId);
		}
	}

	const resources = Object.keys(byResource).sort();
	fs.rmSync(OUT_DIR, { recursive: true, force: true });
	fs.mkdirSync(OUT_DIR, { recursive: true });
	for (const resource of resources) writeResourceFile(resource, byResource[resource]);
	writeIndex(resources);
	writeSources(sources);
	updateReadme(byResource, resources);
	const total = resources.reduce((n, r) => n + byResource[r].length, 0);
	console.log(`Generated ${total} actions across ${resources.length} resources into ${path.relative(ROOT, OUT_DIR)}`);
}

main();
