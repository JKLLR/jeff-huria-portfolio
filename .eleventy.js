module.exports = function (eleventyConfig) {
    // Static assets — copied as-is, same paths as before the migration
    eleventyConfig.addPassthroughCopy("src/css");
    eleventyConfig.addPassthroughCopy("src/js");
    eleventyConfig.addPassthroughCopy("src/assets");

    // Filters items (projects, experience) down to ones tagged as
    // evidence for a given capability slug
    eleventyConfig.addFilter("byCapability", (items, slug) => {
        return (items || []).filter(item => (item.capabilities || []).includes(slug));
    });

    // Renders "2023-04" and "2026-06" as "APR 2023 — JUN 2026".
    // Pass null as the end date for a role that is still current.
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    eleventyConfig.addFilter("dateRange", (start, end) => {
        const label = (ym) => {
            if (!ym) return 'PRESENT';
            const [year, month] = String(ym).split('-');
            return `${MONTHS[Number(month) - 1] || month} ${year}`;
        };
        return `${label(start)} — ${label(end)}`;
    });

    return {
        dir: {
            input: "src",
            includes: "_includes",
            data: "_data",
            output: "_site"
        }
    };
};
