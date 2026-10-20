const { apiRequest } = require('../lib/client');
const sources = require('../generated/sources');

// Zapier deduplicates by `id`, so a poll only needs the newest page.
const POLL_SIZE = 100;

// Triggers reuse the generated fields (team dropdown, platform choices) and sample of the post list.
function fieldOf(fieldKey, overrides = {}) {
	const field = sources.post_get_all.inputFields.find((entry) => entry.key === fieldKey);
	if (!field) throw new Error(`Generated post list has no field ${fieldKey}`);
	const plain = Object.fromEntries(Object.entries(field).filter(([key]) => !key.startsWith('_') && key !== 'group'));
	return { ...plain, ...overrides };
}

function postTrigger({ key, label, description, status, orderBy }) {
	return {
		key,
		noun: 'Post',
		display: { label, description },
		operation: {
			inputFields: [
				fieldOf('teamId'),
				fieldOf('platforms', {
					helpText: 'Only trigger on posts to these platforms. Leave empty for all platforms.',
				}),
			],
			perform: async (z, bundle) => {
				const data = await apiRequest(z, bundle, 'GET', '/api/v1/post/', {
					params: {
						teamId: bundle.inputData.teamId,
						status,
						platforms: bundle.inputData.platforms,
						orderBy,
						order: 'DESC',
						offset: 0,
						limit: POLL_SIZE,
					},
				});
				return (data && data.items) || [];
			},
			sample: { ...sources.post_get_all.sample.items[0], status },
		},
	};
}

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

module.exports = { postPublished, postFailed };
