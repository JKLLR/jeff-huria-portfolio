// Structured data for search engines (schema.org Person), printed on the home page. Only facts the site
// already states and the data files back: name, title, city, contact, the published profiles, and what
// the work covers. Never the placeholder content from mock.json.
const site = require('./site.json');
const records = require('./records.js');
const capabilities = require('./capabilities.json');
const erp = (capabilities.find((c) => c.slug === 'erp-integration') || {}).technologies || [];

module.exports = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Jeff .K. Huria',
    jobTitle: site.title,
    url: site.url + '/',
    image: site.url + '/assets/og/default.jpg',
    email: 'mailto:' + site.email,
    address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' },
    sameAs: ['https://www.linkedin.com/in/jefferson-huria-26ab72351/'],
    knowsAbout: [
        'Software engineering',
        'ERP integration',
        ...erp,
        'Payments integration',
        ...records.payments.filter((p) => /M-PESA|KCB|STANBIC|EQUITY/.test(p)).map((p) => p.replace(/\b\w+/g, (w) => (w.length > 3 ? w[0] + w.slice(1).toLowerCase() : w))),
        'AI products',
    ],
};
