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

    // Finds a single object in an array by its `slug` field
    eleventyConfig.addFilter("findBySlug", (items, slug) => {
        return (items || []).find(item => item.slug === slug);
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
