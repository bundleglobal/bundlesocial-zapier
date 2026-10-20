const { apiRequest } = require('../lib/client');

const PAGE_SIZE = 100;

// Hidden trigger that powers the team dropdowns.
const teamList = {
	key: 'team_list',
	noun: 'Team',
	display: { label: 'List Teams', description: 'Lists teams for the team dropdowns.', hidden: true },
	operation: {
		canPaginate: true,
		perform: async (z, bundle) => {
			const page = Number(bundle.meta && bundle.meta.page) || 0;
			const data = await apiRequest(z, bundle, 'GET', '/api/v1/team/', {
				params: { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
			});
			return ((data && data.items) || []).map((team) => ({ id: team.id, name: team.name || team.id }));
		},
	},
};

module.exports = { teamList };
