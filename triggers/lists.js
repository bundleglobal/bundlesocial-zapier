const { apiRequest } = require('../lib/client');

const PAGE_SIZE = 100;

const pageOf = (bundle) => Number(bundle.meta && bundle.meta.page) || 0;
const day = (date) => (date ? String(date).slice(0, 10) : undefined);

async function getTeamsPage(z, bundle, offset, limit = PAGE_SIZE) {
	const data = await apiRequest(z, bundle, 'GET', '/api/v1/team/', { params: { offset, limit } });
	return { items: (data && data.items) || [], total: data && data.total };
}

async function getAllTeams(z, bundle) {
	const teams = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const { items, total } = await getTeamsPage(z, bundle, offset);
		teams.push(...items);
		if (items.length < PAGE_SIZE || (typeof total === 'number' && teams.length >= total)) return teams;
	}
}

function socialAccountsOf(teams) {
	return teams.flatMap((team) =>
		(team.socialAccounts || []).map((account) => ({ ...account, teamName: team.name })),
	);
}

// Hidden triggers that power the team, social account, post and upload dropdowns.
const teamList = {
	key: 'team_list',
	noun: 'Team',
	display: { label: 'List Teams', description: 'Lists teams for the team dropdowns.', hidden: true },
	operation: {
		canPaginate: true,
		perform: async (z, bundle) => {
			const { items } = await getTeamsPage(z, bundle, pageOf(bundle) * PAGE_SIZE);
			return items.map((team) => ({ id: team.id, name: team.name || team.id }));
		},
	},
};

const socialAccountList = {
	key: 'social_account_list',
	noun: 'Social Account',
	display: {
		label: 'List Social Accounts',
		description: 'Lists social accounts for the social account dropdowns.',
		hidden: true,
	},
	operation: {
		perform: async (z, bundle) => {
			const teamId = bundle.inputData && bundle.inputData.teamId;
			const accounts = socialAccountsOf(await getAllTeams(z, bundle)).filter(
				(account) => !teamId || account.teamId === teamId,
			);
			return accounts
				.map((account) => ({
					id: account.id,
					name: `${account.displayName || account.username || account.id} (${account.type}, ${account.teamName})`,
				}))
				.sort((a, b) => a.name.localeCompare(b.name));
		},
	},
};

const postList = {
	key: 'post_list',
	noun: 'Post',
	display: { label: 'List Posts', description: 'Lists the posts of the selected team for the post dropdowns.', hidden: true },
	operation: {
		canPaginate: true,
		perform: async (z, bundle) => {
			// Posts are listed per team; the field stays disabled until a team is picked (dependsOn).
			const teamId = bundle.inputData && bundle.inputData.teamId;
			if (!teamId) return [];
			const data = await apiRequest(z, bundle, 'GET', '/api/v1/post/', {
				params: { teamId, orderBy: 'createdAt', order: 'DESC', offset: pageOf(bundle) * PAGE_SIZE, limit: PAGE_SIZE },
			});
			return ((data && data.items) || []).map((post) => {
				const details = [post.status, day(post.postDate)].filter(Boolean).join(', ');
				return { id: post.id, name: `${post.title || post.id}${details ? ` (${details})` : ''}` };
			});
		},
	},
};

// Uploads have no file name, so the label is the type, extension and upload date.
const uploadList = {
	key: 'upload_list',
	noun: 'Upload',
	display: { label: 'List Uploads', description: 'Lists uploads for the upload dropdowns.', hidden: true },
	operation: {
		canPaginate: true,
		perform: async (z, bundle) => {
			const teamId = bundle.inputData && bundle.inputData.teamId;
			const data = await apiRequest(z, bundle, 'GET', '/api/v1/upload/', {
				params: { teamId, includePosts: 'false', offset: pageOf(bundle) * PAGE_SIZE, limit: PAGE_SIZE },
			});
			const uploads = Array.isArray(data) ? data : (data && data.items) || [];
			return uploads.map((upload) => {
				const kind = [upload.type, upload.ext && `.${upload.ext}`].filter(Boolean).join(' ') || 'file';
				const details = [day(upload.createdAt), String(upload.id).slice(0, 8)].filter(Boolean).join(', ');
				return { id: upload.id, name: `${kind} (${details})` };
			});
		},
	},
};

module.exports = {
	getAllTeams,
	getTeamsPage,
	socialAccountsOf,
	teamList,
	socialAccountList,
	postList,
	uploadList,
};
