import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// The integration is CommonJS; loading it and nock through require keeps one shared http module to intercept.
const require = createRequire(import.meta.url);
const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
const API = 'https://api.bundle.social';
const authData = { apiKey: 'test-key' };

const bodyFieldsOf = (create) => create.operation.inputFields.find((field) => typeof field === 'function');

beforeAll(() => nock.disableNetConnect());
afterEach(() => {
	expect(nock.isDone()).toBe(true);
	nock.cleanAll();
});
afterAll(() => nock.enableNetConnect());

describe('creates', () => {
	it('builds a post body from flattened platform fields and mapped strings', async () => {
		let body;
		nock(API, { reqheaders: { 'x-api-key': 'test-key' } })
			.post('/api/v1/post/', (sent) => {
				body = sent;
				return true;
			})
			.reply(200, { id: 'post-1' });

		const result = await appTester(App.creates.post_create.operation.perform, {
			authData,
			inputData: {
				teamId: 'team-1',
				title: 'Hello',
				postDate: '2026-01-15T10:00:00+01:00',
				status: 'SCHEDULED',
				socialAccountTypes: ['TIKTOK'],
				data__TIKTOK__text: 'Caption',
				data__TIKTOK__uploadIds: 'up-1, up-2',
				data__TIKTOK__disableComments: 'true',
				data__TIKTOK__photoCoverIndex: '2',
				firstComment__TIKTOK: 'First!',
			},
		});

		expect(result).toEqual({ id: 'post-1' });
		expect(body).toEqual({
			teamId: 'team-1',
			title: 'Hello',
			postDate: '2026-01-15T10:00:00+01:00',
			status: 'SCHEDULED',
			socialAccountTypes: ['TIKTOK'],
			data: { TIKTOK: { text: 'Caption', uploadIds: ['up-1', 'up-2'], disableComments: true, photoCoverIndex: 2 } },
			firstComment: { TIKTOK: 'First!' },
		});
	});

	it('sends the raw body when Specify Body is Using JSON', async () => {
		nock(API).post('/api/v1/team/', { name: 'From JSON' }).reply(200, { id: 'team-1' });

		const result = await appTester(App.creates.team_create.operation.perform, {
			authData,
			inputData: { bodyInput: 'json', jsonBody: '{"name":"From JSON"}', name: 'Ignored' },
		});

		expect(result).toEqual({ id: 'team-1' });
	});

	it('lists every validation issue in the error', async () => {
		nock(API)
			.post('/api/v1/team/')
			.reply(400, { message: 'Validation failed', issues: [{ path: ['name'], message: 'Required' }] });

		await expect(
			appTester(App.creates.team_create.operation.perform, { authData, inputData: { name: '' } }),
		).rejects.toThrow(/Validation failed[\s\S]*name: Required/);
	});

	it('fills the path from the ID field', async () => {
		nock(API).delete('/api/v1/team/team-1').reply(200, { id: 'team-1' });

		const result = await appTester(App.creates.team_delete.operation.perform, {
			authData,
			inputData: { id: 'team-1' },
		});

		expect(result).toEqual({ id: 'team-1' });
	});

	it('sends post analytics filters as query parameters', async () => {
		nock(API)
			.get('/api/v1/analytics/post')
			.query({ postId: 'post-1', platformType: 'LINKEDIN' })
			.reply(200, { post: { id: 'post-1' }, items: [] });

		const result = await appTester(App.creates.analytics_get_post_analytics.operation.perform, {
			authData,
			inputData: { postId: 'post-1', platformType: 'LINKEDIN' },
		});

		expect(result).toEqual({ post: { id: 'post-1' }, items: [] });
	});

	it('uploads a file from a URL without sending the API key to the file host', async () => {
		nock('https://files.example.com', { badheaders: ['x-api-key'] })
			.get('/photo.jpg')
			.reply(200, 'image-bytes', { 'Content-Type': 'image/jpeg' });
		let body;
		nock(API, { reqheaders: { 'x-api-key': 'test-key' } })
			.post('/api/v1/upload/', (sent) => {
				body = sent;
				return true;
			})
			.reply(200, { id: 'up-1' });

		const result = await appTester(App.creates.upload_upload_file.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', file: 'https://files.example.com/photo.jpg' },
		});

		expect(result).toEqual({ id: 'up-1' });
		expect(body).toContain('name="teamId"\r\n\r\nteam-1');
		expect(body).toContain('filename="photo.jpg"');
		expect(body).toContain('Content-Type: image/jpeg\r\n\r\nimage-bytes');
	});
});

describe('dynamic fields', () => {
	const keysFor = (inputData) =>
		bodyFieldsOf(App.creates.post_create)(null, { inputData }).map((field) => field.key);

	it('shows only the sections of the selected platforms', () => {
		const keys = keysFor({ socialAccountTypes: ['TIKTOK'] });
		expect(keys).toContain('data__TIKTOK__text');
		expect(keys).toContain('firstComment__TIKTOK');
		expect(keys).not.toContain('data__INSTAGRAM__text');
		expect(keys).not.toContain('firstComment__INSTAGRAM');
		expect(keys).toContain('title');
	});

	it('shows every section when the platforms are mapped from an earlier step', () => {
		const keys = keysFor({ socialAccountTypes: '{{123__types}}' });
		expect(keys).toContain('data__TIKTOK__text');
		expect(keys).toContain('data__INSTAGRAM__text');
	});

	it('swaps the body fields for a JSON field', () => {
		expect(keysFor({ bodyInput: 'json' })).toEqual(['jsonBody']);
	});

	it('hides internal markers from Zapier', () => {
		const fields = bodyFieldsOf(App.creates.post_create)(null, { inputData: { socialAccountTypes: ['TIKTOK'] } });
		expect(fields.some((field) => Object.keys(field).some((key) => key.startsWith('_')))).toBe(false);
	});
});

describe('triggers', () => {
	it('polls published posts newest first, filtered by platform', async () => {
		nock(API)
			.get('/api/v1/post/')
			.query({
				teamId: 'team-1',
				status: 'POSTED',
				platforms: 'TIKTOK,INSTAGRAM',
				orderBy: 'postedDate',
				order: 'DESC',
				offset: '0',
				limit: '100',
			})
			.reply(200, { items: [{ id: 'p1' }], total: 1 });

		const result = await appTester(App.triggers.post_published.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', platforms: ['TIKTOK', 'INSTAGRAM'] },
		});

		expect(result).toEqual([{ id: 'p1' }]);
	});

	it('polls failed posts by last update', async () => {
		nock(API)
			.get('/api/v1/post/')
			.query({ teamId: 'team-1', status: 'ERROR', orderBy: 'updatedAt', order: 'DESC', offset: '0', limit: '100' })
			.reply(200, { items: [{ id: 'p2' }], total: 1 });

		const result = await appTester(App.triggers.post_failed.operation.perform, {
			authData,
			inputData: { teamId: 'team-1' },
		});

		expect(result).toEqual([{ id: 'p2' }]);
	});

	it('pages the team dropdown', async () => {
		nock(API)
			.get('/api/v1/team/')
			.query({ offset: '100', limit: '100' })
			.reply(200, { items: [{ id: 't1', name: 'Brand' }], total: 101 });

		const result = await appTester(App.triggers.team_list.operation.perform, {
			authData,
			inputData: {},
			meta: { page: 1 },
		});

		expect(result).toEqual([{ id: 't1', name: 'Brand' }]);
	});
});
