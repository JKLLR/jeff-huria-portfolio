const capabilities = require('./capabilities.json');

module.exports = capabilities.filter((capability) => capability.published === true);
