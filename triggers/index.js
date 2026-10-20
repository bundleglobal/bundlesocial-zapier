const { teamList } = require('./lists');
const polling = require('./polling');

module.exports = Object.fromEntries(
	[teamList, ...Object.values(polling)].map((trigger) => [trigger.key, trigger]),
);
