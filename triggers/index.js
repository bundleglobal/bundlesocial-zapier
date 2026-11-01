const { teamList, socialAccountList, uploadList } = require('./lists');
const polling = require('./polling');

module.exports = Object.fromEntries(
	[teamList, socialAccountList, uploadList, ...Object.values(polling)].map((trigger) => [trigger.key, trigger]),
);
