/**
 * The renderer imports stylesheets for their side effect, and TypeScript has no
 * opinion about what a stylesheet is.
 *
 * Declared here rather than by widening `types` in tsconfig.web.json, which is
 * empty on purpose so that Node's types cannot be reached from a page.
 */
declare module '*.css';
