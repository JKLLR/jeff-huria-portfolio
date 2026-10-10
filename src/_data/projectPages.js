const projects = require('./projects.json');

// A project earns a /work/{slug}/ page only once it has a real overview —
// thin records stay as cards. Same evidence-first rule as capabilities.
module.exports = projects.filter((project) => (project.overview || []).length > 0);
