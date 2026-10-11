// Projects that get a /work/{slug}/ page — those with an overview
module.exports = require('./work.js').filter((project) => project.hasPage);
