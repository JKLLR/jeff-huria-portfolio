// Every project, with placeholder content from mock.json filled into the
// fields the real record leaves empty. Real data always wins; whatever came
// from the mock file is listed in `mockFields` so templates can flag it.
const projects = require('./projects.json');
const mock = require('./mock.json').projects || {};

const isEmpty = (value) => value == null || (Array.isArray(value) && value.length === 0) || value === '';

module.exports = projects.map((project) => {
    const overlay = mock[project.id] || {};
    const merged = { ...project, mockFields: [] };
    for (const [field, value] of Object.entries(overlay)) {
        if (isEmpty(project[field])) {
            merged[field] = value;
            merged.mockFields.push(field);
        }
    }
    merged.hasPage = (merged.overview || []).length > 0;
    return merged;
});
