const { apiRequest } = require('./lib/client');

module.exports = {
	type: 'custom',
	fields: [
		{
			key: 'apiKey',
			label: 'API Key',
			type: 'password',
			required: true,
			helpText:
				'Create one in the [bundle.social dashboard](https://bundle.social/dashboard) under **Organization > API Keys**.',
		},
	],
	test: (z, bundle) => apiRequest(z, bundle, 'GET', '/api/v1/organization/'),
	// Receives the organization returned by `test`.
	connectionLabel: (z, bundle) => bundle.inputData.name || 'bundle.social',
};
