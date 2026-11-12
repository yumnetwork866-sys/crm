// Compatibility entry point; production processes are defined together.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const production = require('./ecosystem.config.cjs');
module.exports = { apps: production.apps.filter((app) => app.name === 'crm-frontend') };
