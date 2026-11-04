// The vocabulary of the data theme: every system name that streams through the site's record fields
// (the loader, the manifesto and footer fields, the projector) comes from the real data files, so the
// decoration stays as true as the content. Add a project or an ERP and the records follow.
// Systems and technologies only: never client names.
const projects = require('./projects.json');
const capabilities = require('./capabilities.json');
const experience = require('./experience.json');

// What the glyph atlases can draw (datafield.js CHARSET, minus the space)
const ALLOWED = /[^A-Z0-9 \-·.,:/+]/g;
const clean = (s) => String(s)
    .toUpperCase()
    .replace(/[’']/g, '')
    .replace(/&/g, '+')
    .replace(/\(.*?\)/g, ' ')
    .replace(ALLOWED, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ERP names as they would appear in a sync log
const SHORT = [
    [/^MICROSOFT /, ''],
    [/BUSINESS ONE/, 'B1'],
    [/BUSINESS CENTRAL/, 'BC'],
    [/ EVOLUTION$/, ''],
    [/BUSINESS CLOUD/, 'CLOUD'],
    [/ PRIME$/, ''],
];
const shorten = (s) => SHORT.reduce((t, [re, to]) => t.replace(re, to), clean(s));

const uniq = (list, max = 18) => [...new Set(list.map((s) => s.trim()).filter((s) => s && s.length <= max))];

const stackGroup = (pattern) => projects.flatMap((p) => (p.stack || [])
    .filter((g) => pattern.test(g.group))
    .flatMap((g) => g.items.map(clean)));

const erpCapability = capabilities.find((c) => c.slug === 'erp-integration') || {};
const erps = uniq([
    ...(erpCapability.technologies || []),
    ...experience.flatMap((e) => e.technologies || []).filter((t) => (erpCapability.technologies || []).includes(t)),
].map(shorten));

module.exports = {
    erps,                                                       // SAP B1, DYNAMICS 365 BC, SYSPRO, ...
    payments: uniq(stackGroup(/payment/i)),                     // M-PESA DARAJA, KCB BUNI, PAYSTACK, ...
    access: uniq(stackGroup(/erp access/i), 16),                // ODBC, REST, SOAP, TALLY XML, ...
    messaging: uniq(stackGroup(/messag/i)),                     // AFRICAS TALKING, WHATSAPP CLOUD API, ...
    services: uniq(stackGroup(/integrations$/i)),               // HUBSPOT, ZOHO, SALESFORCE, ...
};
