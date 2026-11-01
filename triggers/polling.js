const { apiRequest } = require('../lib/client');
const operations = require('../generated');
const sources = require('../generated/sources');
const { getAllTeams, getTeamsPage, socialAccountsOf } = require('./lists');

// Zapier deduplicates by `id`, so a poll only needs the newest page.
const POLL_SIZE = 100;

const byKey = Object.fromEntries(operations.map((op) => [op.key, op]));

// Triggers reuse the generated fields (dropdowns, platform choices) and samples of the matching list actions.
function fieldFrom(fields, where, fieldKey, overrides) {
	const field = fields.find((entry) => entry.key === fieldKey);
	if (!field) throw new Error(`${where} has no field ${fieldKey}`);
	const plain = Object.fromEntries(Object.entries(field).filter(([key]) => !key.startsWith('_') && key !== 'group'));
	return { ...plain, ...overrides };
}

const fieldOf = (fieldKey, overrides = {}) =>
	fieldFrom(sources.post_get_all.inputFields, 'Generated post list', fieldKey, overrides);
const actionFieldOf = (opKey, fieldKey, overrides = {}) =>
	fieldFrom(byKey[opKey].inputFields, `Generated action ${opKey}`, fieldKey, overrides);

function postTrigger({ key, label, description, status, orderBy }) {
	return {
		key,
		noun: 'Post',
		display: { label, description },
		operation: {
			inputFields: [
				fieldOf('teamId'),
				...(status ? [] : [fieldOf('status', { helpText: 'Only trigger on posts with this status.' })]),
				fieldOf('platforms', {
					helpText: 'Only trigger on posts to these platforms. Leave empty for all platforms.',
				}),
			],
			perform: async (z, bundle) => {
				const data = await apiRequest(z, bundle, 'GET', '/api/v1/post/', {
					params: {
						teamId: bundle.inputData.teamId,
						status: status || bundle.inputData.status,
						platforms: bundle.inputData.platforms,
						orderBy,
						order: 'DESC',
						offset: 0,
						limit: POLL_SIZE,
					},
				});
				return (data && data.items) || [];
			},
			sample: { ...sources.post_get_all.sample.items[0], ...(status ? { status } : {}) },
		},
	};
}

const newPost = postTrigger({
	key: 'new_post',
	label: 'New Post',
	description: 'Triggers when a post is created in a team.',
	orderBy: 'createdAt',
});

const postPublished = postTrigger({
	key: 'post_published',
	label: 'Post Published',
	description: 'Triggers when a post finishes publishing to its social accounts.',
	status: 'POSTED',
	orderBy: 'postedDate',
});

const postFailed = postTrigger({
	key: 'post_failed',
	label: 'Post Failed',
	description: 'Triggers when a post fails to publish.',
	status: 'ERROR',
	orderBy: 'updatedAt',
});

const newTeam = {
	key: 'new_team',
	noun: 'Team',
	display: { label: 'New Team', description: 'Triggers when a team is created in your organization.' },
	operation: {
		perform: async (z, bundle) => {
			// Teams come oldest first, so read the total and fetch the last page.
			const { total } = await getTeamsPage(z, bundle, 0, 1);
			const offset = Math.max(0, (Number(total) || 0) - POLL_SIZE);
			const { items } = await getTeamsPage(z, bundle, offset, POLL_SIZE);
			return [...items].reverse();
		},
		sample: byKey.team_get_all.sample.items[0],
	},
};

const newSocialAccount = {
	key: 'new_social_account',
	noun: 'Social Account',
	display: { label: 'New Social Account', description: 'Triggers when a social account is connected to a team.' },
	operation: {
		inputFields: [
			fieldOf('teamId', {
				required: false,
				helpText: 'Only trigger on accounts connected to this team. Leave empty for all teams.',
			}),
		],
		perform: async (z, bundle) => {
			const teamId = bundle.inputData.teamId;
			return socialAccountsOf(await getAllTeams(z, bundle))
				.filter((account) => !teamId || account.teamId === teamId)
				.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
				.slice(0, POLL_SIZE);
		},
		sample: { ...byKey.social_account_get_by_type.sample, teamName: 'Marketing' },
	},
};

const newComment = {
	key: 'new_comment',
	noun: 'Comment',
	display: {
		label: 'New Comment',
		description:
			'Triggers when bundle.social imports a new comment on the selected post, through a comment import or the automatic comment import.',
	},
	operation: {
		inputFields: [
			actionFieldOf('comment_import_get_fetched_comments', 'teamId'),
			// The API lists fetched comments per post only, so the post is required.
			actionFieldOf('comment_import_get_fetched_comments', 'postId', {
				required: true,
				helpText: 'The post whose comments trigger the Zap.',
			}),
			actionFieldOf('comment_import_get_fetched_comments', 'socialAccountId', {
				helpText: 'Leave empty for all accounts.',
			}),
			actionFieldOf('comment_import_get_fetched_comments', 'platform', { helpText: 'Leave empty for all platforms.' }),
		],
		perform: async (z, bundle) => {
			const { teamId, socialAccountId, platform, postId } = bundle.inputData;
			// The API returns the newest comments first.
			const data = await apiRequest(z, bundle, 'GET', '/api/v1/comment/import/comments', {
				params: { teamId, postId, socialAccountId, platform, offset: 0, limit: POLL_SIZE },
			});
			return (data && data.items) || [];
		},
		sample: byKey.comment_import_get_fetched_comments.sample.items[0],
	},
};

module.exports = { newPost, postPublished, postFailed, newTeam, newSocialAccount, newComment };
