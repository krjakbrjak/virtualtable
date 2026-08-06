import { defineConfig } from 'vite';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

export default defineConfig({
    // base.css is imported for its side effect, so it has to travel inside the
    // bundle rather than being emitted as a stylesheet consumers must import.
    plugins: [cssInjectedByJs()],
    test: {
        globals: true,
    },
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['es', 'cjs'],
            fileName: (format) => (format === 'cjs' ? 'index.cjs' : 'index.mjs'),
        },
        rollupOptions: {
            // Everything declared as a dependency or peer dependency is
            // resolved by the consumer, so it is never bundled.
            external: (id) => /^(react|react-dom|react-bootstrap|prop-types)(\/|$)/.test(id),
        },
    },
});
