import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 9001,
    },
    resolve: {
        // The library is linked with portal:, so its imports resolve from the
        // parent's node_modules. Without this the demo and the library get
        // separate React instances and hooks fail.
        dedupe: ['react', 'react-dom', 'react-bootstrap'],
    },
});
