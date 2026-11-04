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

	it('builds a LinkedIn poll, Pinterest carousel slides and a TikTok location', async () => {
		let body;
		nock(API)
			.post('/api/v1/post/', (sent) => {
				body = sent;
				return true;
			})
			.reply(200, { id: 'post-2' });

		await appTester(App.creates.post_create.operation.perform, {
			authData,
			inputData: {
				teamId: 'team-1',
				postDate: '2026-01-15T10:00:00Z',
				status: 'DRAFT',
				socialAccountTypes: ['LINKEDIN', 'PINTEREST', 'TIKTOK'],
				data__LINKEDIN__text: 'Vote',
				data__LINKEDIN__poll__question: 'Tabs or spaces?',
				data__LINKEDIN__poll__options: 'Tabs, Spaces',
				data__LINKEDIN__poll__duration: 'SEVEN_DAYS',
				data__PINTEREST__boardName: 'Ideas',
				data__PINTEREST__uploadIds: 'up-1, up-2',
				data__PINTEREST__carouselItems: [
					{ uploadId: 'up-1', title: 'First slide', link: 'https://example.com/1' },
					{ uploadId: 'up-2', description: '' },
				],
				data__TIKTOK__uploadIds: 'up-3',
				data__TIKTOK__title: 'Photo title',
				data__TIKTOK__locationId: 'loc-1',
				data__TIKTOK__locationName: 'Warsaw',
			},
		});

		expect(body.data).toEqual({
			LINKEDIN: { text: 'Vote', poll: { question: 'Tabs or spaces?', options: ['Tabs', 'Spaces'], duration: 'SEVEN_DAYS' } },
			PINTEREST: {
				boardName: 'Ideas',
				uploadIds: ['up-1', 'up-2'],
				carouselItems: [{ uploadId: 'up-1', title: 'First slide', link: 'https://example.com/1' }, { uploadId: 'up-2' }],
			},
			TIKTOK: { uploadIds: ['up-3'], title: 'Photo title', locationId: 'loc-1', locationName: 'Warsaw' },
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

	it('uploads a large file through init, storage and finalize', async () => {
		nock('https://files.example.com').get('/video.mp4').reply(200, 'video-bytes', {
			'Content-Type': 'video/mp4',
			'Content-Length': '11',
		});
		nock(API)
			.post('/api/v1/upload/init', { teamId: 'team-1', fileName: 'video.mp4', mimeType: 'video/mp4', fileSize: 11 })
			.reply(200, { url: 'https://storage.example.com/signed?sig=1', path: 'uploads/video.mp4' })
			.post('/api/v1/upload/finalize', { teamId: 'team-1', path: 'uploads/video.mp4' })
			.reply(200, { id: 'up-2' });
		nock('https://storage.example.com', { badheaders: ['x-api-key'] })
			.put('/signed', 'video-bytes')
			.query({ sig: '1' })
			.reply(200);

		const result = await appTester(App.creates.upload_upload_large_file.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', file: 'https://files.example.com/video.mp4' },
		});

		expect(result).toEqual({ id: 'up-2' });
	});

	it('pages through Get Many Teams with Return All', async () => {
		nock(API)
			.get('/api/v1/team/')
			.query({ offset: '0', limit: '100' })
			.reply(200, { items: [{ id: 'a' }, { id: 'b' }], total: 3 })
			.get('/api/v1/team/')
			.query({ offset: '2', limit: '100' })
			.reply(200, { items: [{ id: 'c' }], total: 3 });

		const result = await appTester(App.creates.team_get_all.operation.perform, {
			authData,
			inputData: { returnAll: 'true' },
		});

		expect(result).toEqual({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], total: 3 });
	});

	it('sends only the team fields that are set on update', async () => {
		nock(API).patch('/api/v1/team/team-1', { name: 'Renamed' }).reply(200, { id: 'team-1', name: 'Renamed' });

		const result = await appTester(App.creates.team_update.operation.perform, {
			authData,
			inputData: { id: 'team-1', name: 'Renamed' },
		});

		expect(result).toEqual({ id: 'team-1', name: 'Renamed' });
	});

	it('copies social accounts between teams', async () => {
		nock(API)
			.post('/api/v1/social-account/copy', {
				fromTeamId: 'team-1',
				toTeamId: 'team-2',
				socialAccountTypes: ['TIKTOK', 'INSTAGRAM'],
			})
			.reply(200, { success: true });

		const result = await appTester(App.creates.social_account_copy.operation.perform, {
			authData,
			inputData: { fromTeamId: 'team-1', toTeamId: 'team-2', socialAccountTypes: ['TIKTOK', 'INSTAGRAM'] },
		});

		expect(result).toEqual({ success: true });
	});

	it('deletes several uploads by ID', async () => {
		nock(API).delete('/api/v1/upload/', { ids: ['up-1', 'up-2'] }).reply(200, { deleted: 2 });

		const result = await appTester(App.creates.upload_delete_many_uploads.operation.perform, {
			authData,
			inputData: { ids: ['up-1', 'up-2'] },
		});

		expect(result).toEqual({ deleted: 2 });
	});
});

describe('post actions', () => {
	it('pages through Get Many Posts with Return All', async () => {
		nock(API)
			.get('/api/v1/post/')
			.query({ teamId: 'team-1', offset: '0', limit: '100' })
			.reply(200, { items: [{ id: 'a' }, { id: 'b' }], total: 3 })
			.get('/api/v1/post/')
			.query({ teamId: 'team-1', offset: '2', limit: '100' })
			.reply(200, { items: [{ id: 'c' }], total: 3 });

		const result = await appTester(App.creates.post_get_all.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', returnAll: 'true' },
		});

		expect(result).toEqual({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], total: 3 });
	});

	it('sends only the post fields that are set on update', async () => {
		nock(API)
			.patch('/api/v1/post/post-1', { title: 'New title', data: { TIKTOK: { text: 'New text' } } })
			.reply(200, { id: 'post-1' });

		const result = await appTester(App.creates.post_update.operation.perform, {
			authData,
			inputData: { id: 'post-1', title: 'New title', data__TIKTOK__text: 'New text' },
		});

		expect(result).toEqual({ id: 'post-1' });
	});

	it('retries a failed post', async () => {
		nock(API).post('/api/v1/post/post-1/retry').reply(200, { id: 'post-1', status: 'SCHEDULED' });

		const result = await appTester(App.creates.post_retry.operation.perform, {
			authData,
			inputData: { id: 'post-1' },
		});

		expect(result).toEqual({ id: 'post-1', status: 'SCHEDULED' });
	});

	it('starts a post history import', async () => {
		nock(API)
			.post('/api/v1/post-history-import/', {
				teamId: 'team-1',
				socialAccountType: 'INSTAGRAM',
				count: 50,
				withAnalytics: true,
			})
			.reply(200, { id: 'imp-1', status: 'PENDING' });

		const result = await appTester(App.creates.post_history_import_create.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', socialAccountType: 'INSTAGRAM', count: '50', withAnalytics: 'true' },
		});

		expect(result).toEqual({ id: 'imp-1', status: 'PENDING' });
	});

	it('retries a post history import with the team in the body', async () => {
		nock(API).post('/api/v1/post-history-import/imp-1/retry', { teamId: 'team-1' }).reply(200, { id: 'imp-1' });

		const result = await appTester(App.creates.post_history_import_retry.operation.perform, {
			authData,
			inputData: { importId: 'imp-1', teamId: 'team-1' },
		});

		expect(result).toEqual({ id: 'imp-1' });
	});

	it('deletes imported posts by ID', async () => {
		nock(API)
			.delete('/api/v1/post-history-import/posts', { teamId: 'team-1', postIds: ['ip-1', 'ip-2'] })
			.reply(200, { deleted: 2 });

		const result = await appTester(App.creates.post_history_import_delete_imported_posts.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', postIds: ['ip-1', 'ip-2'] },
		});

		expect(result).toEqual({ deleted: 2 });
	});
});

describe('analytics and comment actions', () => {
	it('joins bulk post analytics IDs with commas', async () => {
		nock(API)
			.get('/api/v1/analytics/post/bulk')
			.query({ postIds: 'post-1,post-2', platformType: 'TIKTOK' })
			.reply(200, { results: [], pagination: { page: 1 } });

		const result = await appTester(App.creates.analytics_get_bulk_post_analytics.operation.perform, {
			authData,
			inputData: { postIds: ['post-1', 'post-2'], platformType: 'TIKTOK' },
		});

		expect(result).toEqual({ results: [], pagination: { page: 1 } });
	});

	it('refreshes post analytics with the post and platform in the body', async () => {
		nock(API)
			.post('/api/v1/analytics/post/force', { postId: 'post-1', platformType: 'LINKEDIN' })
			.reply(200, { id: 'pa-1' });

		const result = await appTester(App.creates.analytics_refresh_post_analytics.operation.perform, {
			authData,
			inputData: { postId: 'post-1', platformType: 'LINKEDIN' },
		});

		expect(result).toEqual({ id: 'pa-1' });
	});

	it('creates a comment on a post from flattened platform fields', async () => {
		nock(API)
			.post('/api/v1/comment/', {
				teamId: 'team-1',
				internalPostId: 'post-1',
				postDate: '2026-01-15T10:00:00+01:00',
				status: 'SCHEDULED',
				socialAccountTypes: ['LINKEDIN'],
				data: { LINKEDIN: { text: 'First comment' } },
			})
			.reply(200, { id: 'c-1' });

		const result = await appTester(App.creates.comment_create.operation.perform, {
			authData,
			inputData: {
				teamId: 'team-1',
				internalPostId: 'post-1',
				postDate: '2026-01-15T10:00:00+01:00',
				status: 'SCHEDULED',
				socialAccountTypes: ['LINKEDIN'],
				data__LINKEDIN__text: 'First comment',
			},
		});

		expect(result).toEqual({ id: 'c-1' });
	});

	it('requires the platforms on comment update, which the API needs', async () => {
		const update = App.creates.comment_update.operation;
		const fields = update.inputFields.find((field) => typeof field === 'function')(null, {
			inputData: { socialAccountTypes: ['LINKEDIN'] },
		});
		expect(fields.find((field) => field.key === 'socialAccountTypes').required).toBe(true);
		expect(fields.map((field) => field.key)).toContain('data__LINKEDIN__text');
		expect(fields.map((field) => field.key)).not.toContain('data__TIKTOK__text');

		nock(API)
			.patch('/api/v1/comment/c-1', { socialAccountTypes: ['LINKEDIN'], data: { LINKEDIN: { text: 'Edited' } } })
			.reply(200, { id: 'c-1' });

		const result = await appTester(update.perform, {
			authData,
			inputData: { id: 'c-1', socialAccountTypes: ['LINKEDIN'], data__LINKEDIN__text: 'Edited' },
		});

		expect(result).toEqual({ id: 'c-1' });
	});

	it('runs an action on a fetched comment', async () => {
		nock(API)
			.post('/api/v1/comment/import/comments/fc-1/action', { teamId: 'team-1', action: 'HIDE' })
			.reply(200, { success: true });

		const result = await appTester(App.creates.comment_import_act_on_fetched_comment.operation.perform, {
			authData,
			inputData: { commentId: 'fc-1', teamId: 'team-1', action: 'HIDE' },
		});

		expect(result).toEqual({ success: true });
	});
});

describe('conversation and automation actions', () => {
	const fieldKeysOf = (create, inputData = {}) =>
		create.operation.inputFields.flatMap((field) =>
			typeof field === 'function' ? field(null, { inputData }).map((f) => f.key) : [field.key],
		);

	it('sends a message built from text, line items and JSON buttons', async () => {
		nock(API)
			.post('/api/v1/conversations/conv-1/messages', {
				content: {
					text: 'Pick one',
					attachments: [{ type: 'IMAGE', url: 'https://example.com/a.jpg' }],
					quickReplies: [{ label: 'Yes', payload: 'YES' }],
				},
				replyToMessageId: 'msg-1',
			})
			.reply(200, { conversation: { id: 'conv-1' }, message: { id: 'msg-2' }, conflict: false });

		const result = await appTester(App.creates.conversation_send_message.operation.perform, {
			authData,
			inputData: {
				id: 'conv-1',
				content__text: 'Pick one',
				content__attachments: [{ type: 'IMAGE', url: 'https://example.com/a.jpg' }],
				content__quickReplies: [{ label: 'Yes', payload: 'YES' }],
				replyToMessageId: 'msg-1',
			},
		});

		expect(result.message).toEqual({ id: 'msg-2' });
	});

	it('pages through conversations by offset and offers no cursor, which the API rejects with an offset', async () => {
		expect(fieldKeysOf(App.creates.conversation_get_all)).not.toContain('cursor');
		expect(fieldKeysOf(App.creates.conversation_get_messages)).not.toContain('cursor');
		expect(fieldKeysOf(App.creates.automation_get_executions)).not.toContain('cursor');
		// Only the first page carries `total`.
		nock(API)
			.get('/api/v1/conversations/')
			.query({ teamId: 'team-1', status: 'OPEN', offset: '0', limit: '3' })
			.reply(200, { items: [{ id: 'a' }, { id: 'b' }], total: 3, nextCursor: 'x' })
			.get('/api/v1/conversations/')
			.query({ teamId: 'team-1', status: 'OPEN', offset: '2', limit: '1' })
			.reply(200, { items: [{ id: 'c' }], nextCursor: null });

		const result = await appTester(App.creates.conversation_get_all.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', status: 'OPEN', limit: '3' },
		});

		expect(result).toEqual({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], total: 3 });
	});

	it('sends a text-only private reply and offers no media, which the API rejects there', async () => {
		const keys = fieldKeysOf(App.creates.conversation_send_private_reply);
		expect(keys).toContain('content__text');
		expect(keys).not.toContain('content__attachments');
		expect(keys).not.toContain('content__carousel__cards');
		nock(API)
			.post('/api/v1/conversations/private-reply', {
				teamId: 'team-1',
				fetchedCommentId: 'fc-1',
				content: { text: 'Sent you the price list' },
			})
			.reply(200, { conversation: { id: 'conv-1' }, message: { id: 'msg-1' }, conflict: false });

		const result = await appTester(App.creates.conversation_send_private_reply.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', fetchedCommentId: 'fc-1', content__text: 'Sent you the price list' },
		});

		expect(result.conflict).toBe(false);
	});

	it('creates an automation flow from trigger fields and JSON steps', async () => {
		nock(API)
			.post('/api/v1/automations', {
				teamId: 'team-1',
				name: 'Price replies',
				platformScope: 'INSTAGRAM',
				definition: {
					trigger: {
						type: 'DM_RECEIVED',
						platform: 'INSTAGRAM',
						socialAccountId: 'sa-1',
						keywords: ['price', 'pricing'],
						caseSensitive: false,
						actionDelaySeconds: 5,
					},
					steps: [{ type: 'SEND_MESSAGE', message: { text: 'Our prices: https://example.com/pricing' } }],
				},
			})
			.reply(201, { id: 'flow-1', status: 'DRAFT' });

		const result = await appTester(App.creates.automation_create.operation.perform, {
			authData,
			inputData: {
				teamId: 'team-1',
				name: 'Price replies',
				platformScope: 'INSTAGRAM',
				definition__trigger__type: 'DM_RECEIVED',
				definition__trigger__platform: 'INSTAGRAM',
				definition__trigger__socialAccountId: 'sa-1',
				definition__trigger__keywords: 'price, pricing',
				definition__trigger__caseSensitive: 'false',
				definition__trigger__actionDelaySeconds: '5',
				definition__steps: '[{"type":"SEND_MESSAGE","message":{"text":"Our prices: https://example.com/pricing"}}]',
			},
		});

		expect(result).toEqual({ id: 'flow-1', status: 'DRAFT' });
	});

	it('renames an automation flow without sending a definition', async () => {
		nock(API).patch('/api/v1/automations/flow-1', { name: 'Renamed' }).reply(200, { id: 'flow-1', name: 'Renamed' });

		const result = await appTester(App.creates.automation_update.operation.perform, {
			authData,
			inputData: { id: 'flow-1', name: 'Renamed' },
		});

		expect(result).toEqual({ id: 'flow-1', name: 'Renamed' });
	});

	it('publishes the saved draft with an empty body', async () => {
		expect(fieldKeysOf(App.creates.automation_publish)).toEqual(['id']);
		nock(API).post('/api/v1/automations/flow-1/publish', {}).reply(200, { id: 'flow-1', status: 'ACTIVE' });

		const result = await appTester(App.creates.automation_publish.operation.perform, {
			authData,
			inputData: { id: 'flow-1' },
		});

		expect(result).toEqual({ id: 'flow-1', status: 'ACTIVE' });
	});

	it('copies automation flows between teams', async () => {
		nock(API)
			.post('/api/v1/automations/copy', { sourceTeamId: 'team-1', targetTeamId: 'team-2', flowId: 'flow-1' })
			.reply(201, { items: [{ id: 'flow-2' }], total: 1, skipped: 0 });

		const result = await appTester(App.creates.automation_copy.operation.perform, {
			authData,
			inputData: { sourceTeamId: 'team-1', targetTeamId: 'team-2', flowId: 'flow-1' },
		});

		expect(result).toEqual({ items: [{ id: 'flow-2' }], total: 1, skipped: 0 });
	});

	it('saves ice breakers with the social account and type in the path', async () => {
		const iceBreakers = [{ question: 'What are your prices?', payload: 'ICE_PRICING' }];
		nock(API)
			.put('/api/v1/automation-provider-settings/sa-1/INSTAGRAM_ICE_BREAKERS', {
				teamId: 'team-1',
				platform: 'INSTAGRAM',
				config: { iceBreakers },
			})
			.reply(200, { id: 'ps-1', status: 'DRAFT' });

		const result = await appTester(App.creates.automation_provider_setting_create_or_update.operation.perform, {
			authData,
			inputData: {
				socialAccountId: 'sa-1',
				type: 'INSTAGRAM_ICE_BREAKERS',
				teamId: 'team-1',
				platform: 'INSTAGRAM',
				config: JSON.stringify({ iceBreakers }),
			},
		});

		expect(result).toEqual({ id: 'ps-1', status: 'DRAFT' });
	});

	it('sends a rich message with an uploaded image', async () => {
		nock(API)
			.post('/api/v1/automation-rich-messages/conversations/conv-1', {
				teamId: 'team-1',
				message: { text: 'Our bestseller', attachments: [{ uploadId: 'up-1', type: 'IMAGE' }] },
			})
			.reply(200, { conversationId: 'conv-1', messageId: 'msg-1', externalMessageId: 'ext-1' });

		const result = await appTester(App.creates.automation_send_rich_message.operation.perform, {
			authData,
			inputData: {
				conversationId: 'conv-1',
				teamId: 'team-1',
				message__text: 'Our bestseller',
				message__attachments: [{ uploadId: 'up-1', type: 'IMAGE' }],
			},
		});

		expect(result).toEqual({ conversationId: 'conv-1', messageId: 'msg-1', externalMessageId: 'ext-1' });
	});
});

describe('searches', () => {
	it('returns the record in a list', async () => {
		nock(API).get('/api/v1/team/team-1').reply(200, { id: 'team-1' });

		const result = await appTester(App.searches.team_get.operation.perform, {
			authData,
			inputData: { id: 'team-1' },
		});

		expect(result).toEqual([{ id: 'team-1' }]);
	});

	it('finds a post by its reference key', async () => {
		nock(API).get('/api/v1/post/reference-key/order-42').reply(200, { id: 'post-1', referenceKey: 'order-42' });

		const result = await appTester(App.searches.post_get_by_reference_key.operation.perform, {
			authData,
			inputData: { referenceKey: 'order-42' },
		});

		expect(result).toEqual([{ id: 'post-1', referenceKey: 'order-42' }]);
	});

	it('returns an empty list when the record does not exist', async () => {
		nock(API).get('/api/v1/upload/missing').reply(404, { message: 'Not found' });

		const result = await appTester(App.searches.upload_get.operation.perform, {
			authData,
			inputData: { id: 'missing' },
		});

		expect(result).toEqual([]);
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

	it('polls new posts by creation date, filtered by status', async () => {
		nock(API)
			.get('/api/v1/post/')
			.query({ teamId: 'team-1', status: 'SCHEDULED', orderBy: 'createdAt', order: 'DESC', offset: '0', limit: '100' })
			.reply(200, { items: [{ id: 'p3' }], total: 1 });

		const result = await appTester(App.triggers.new_post.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', status: 'SCHEDULED' },
		});

		expect(result).toEqual([{ id: 'p3' }]);
	});

	it('polls comments of the selected post', async () => {
		nock(API)
			.get('/api/v1/comment/import/comments')
			.query({ teamId: 'team-1', postId: 'post-1', offset: '0', limit: '100' })
			.reply(200, { items: [{ id: 'fc1' }], total: 1 });

		const result = await appTester(App.triggers.new_comment.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', postId: 'post-1' },
		});

		expect(result).toEqual([{ id: 'fc1' }]);
	});

	it('fires a direct message trigger once per received message, newest first', async () => {
		nock(API)
			.get('/api/v1/conversations/')
			.query({ teamId: 'team-1', platform: 'INSTAGRAM', offset: '0', limit: '100' })
			.reply(200, {
				items: [
					// Our reply is the latest activity here, but the trigger keys on the participant's last message.
					{ id: 'c1', lastMessageAt: '2026-01-15T11:00:00.000Z', platformData: { lastInboundAt: '2026-01-15T09:00:00.000Z' } },
					// Opened by a private reply: the participant has not written yet.
					{ id: 'c2', lastMessageAt: '2026-01-15T10:30:00.000Z', platformData: { canReply: false } },
					{ id: 'c3', lastMessageAt: '2026-01-15T10:00:00.000Z', platformData: { lastInboundAt: '2026-01-15T10:00:00.000Z' } },
				],
				total: 3,
			});

		const result = await appTester(App.triggers.new_direct_message.operation.perform, {
			authData,
			inputData: { teamId: 'team-1', platform: 'INSTAGRAM' },
		});

		expect(result.map((item) => [item.id, item.conversationId])).toEqual([
			['c3:2026-01-15T10:00:00.000Z', 'c3'],
			['c1:2026-01-15T09:00:00.000Z', 'c1'],
		]);
	});

	it('lists nothing in the post dropdown until a team is picked', async () => {
		const result = await appTester(App.triggers.post_list.operation.perform, { authData, inputData: {} });

		expect(result).toEqual([]);
	});

	it('lists the posts of the selected team for the dropdown', async () => {
		nock(API)
			.get('/api/v1/post/')
			.query({ teamId: 't1', orderBy: 'createdAt', order: 'DESC', offset: '100', limit: '100' })
			.reply(200, { items: [{ id: 'p1', title: 'Launch', status: 'SCHEDULED', postDate: '2026-01-15T10:00:00.000Z' }], total: 101 });

		const result = await appTester(App.triggers.post_list.operation.perform, {
			authData,
			inputData: { teamId: 't1' },
			meta: { page: 1 },
		});

		expect(result).toEqual([{ id: 'p1', name: 'Launch (SCHEDULED, 2026-01-15)' }]);
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

	it('returns the newest teams first', async () => {
		nock(API)
			.get('/api/v1/team/')
			.query({ offset: '0', limit: '1' })
			.reply(200, { items: [{ id: 't1' }], total: 2 })
			.get('/api/v1/team/')
			.query({ offset: '0', limit: '100' })
			.reply(200, { items: [{ id: 't1' }, { id: 't2' }], total: 2 });

		const result = await appTester(App.triggers.new_team.operation.perform, { authData, inputData: {} });

		expect(result.map((team) => team.id)).toEqual(['t2', 't1']);
	});

	it('returns the newest social accounts of the selected team first', async () => {
		nock(API)
			.get('/api/v1/team/')
			.query({ offset: '0', limit: '100' })
			.reply(200, {
				items: [
					{
						id: 't1',
						name: 'Brand',
						socialAccounts: [
							{ id: 's1', teamId: 't1', createdAt: '2026-01-01T00:00:00.000Z' },
							{ id: 's2', teamId: 't1', createdAt: '2026-02-01T00:00:00.000Z' },
						],
					},
					{ id: 't2', name: 'Other', socialAccounts: [{ id: 's3', teamId: 't2', createdAt: '2026-03-01T00:00:00.000Z' }] },
				],
				total: 2,
			});

		const result = await appTester(App.triggers.new_social_account.operation.perform, {
			authData,
			inputData: { teamId: 't1' },
		});

		expect(result.map((account) => [account.id, account.teamName])).toEqual([
			['s2', 'Brand'],
			['s1', 'Brand'],
		]);
	});

	it('labels uploads by type, extension and date', async () => {
		nock(API)
			.get('/api/v1/upload/')
			.query({ includePosts: 'false', offset: '0', limit: '100' })
			.reply(200, [{ id: 'abcdef123456', type: 'image', ext: 'jpg', createdAt: '2026-01-15T10:00:00.000Z' }]);

		const result = await appTester(App.triggers.upload_list.operation.perform, { authData, inputData: {} });

		expect(result).toEqual([{ id: 'abcdef123456', name: 'image .jpg (2026-01-15, abcdef12)' }]);
	});

	it('lists social accounts of the selected team for the dropdown', async () => {
		nock(API)
			.get('/api/v1/team/')
			.query({ offset: '0', limit: '100' })
			.reply(200, {
				items: [
					{ id: 't1', name: 'Brand', socialAccounts: [{ id: 's1', teamId: 't1', type: 'TIKTOK', displayName: 'Brand TT' }] },
					{ id: 't2', name: 'Other', socialAccounts: [{ id: 's2', teamId: 't2', type: 'INSTAGRAM', username: 'other' }] },
				],
				total: 2,
			});

		const result = await appTester(App.triggers.social_account_list.operation.perform, {
			authData,
			inputData: { teamId: 't1' },
		});

		expect(result).toEqual([{ id: 's1', name: 'Brand TT (TIKTOK, Brand)' }]);
	});
});
