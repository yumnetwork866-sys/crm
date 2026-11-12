/* eslint-disable @typescript-eslint/no-require-imports */
const pretty = require('pino-pretty');
const compact = require('./prettyConfig.cjs');

module.exports = (options) => {
  const { details, ...rest } = options;
  return pretty({
    ...compact,
    hideObject: !details,
    errorLikeObjectKeys: details ? ['err', 'error'] : [],
    ...rest,
  });
};
