// Build context. Netlify sets CONTEXT=production for the live site (built from master); there the
// placeholder highlighting and its toggle are left out. Preview and local builds keep them.
module.exports = {
    showMock: process.env.CONTEXT !== 'production',
    // prototypes still being judged (the whole-page data view) ship to previews only
    preview: process.env.CONTEXT !== 'production',
};
