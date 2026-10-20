const zapier = require('zapier-platform-core');
const authentication = require('./authentication');
const operations = require('./generated');
const { addApiKey, handleErrors } = require('./lib/client');
const { buildActions } = require('./lib/operations');
const triggers = require('./triggers');

const { creates, searches } = buildActions(operations);

module.exports = {
	version: require('./package.json').version,
	platformVersion: zapier.version,
	// lib/convert.js drops empty values itself, so inputs reach the runtime exactly as the user set them.
	flags: { cleanInputData: false },
	authentication,
	beforeRequest: [addApiKey],
	afterResponse: [handleErrors],
	triggers,
	searches,
	creates,
};
