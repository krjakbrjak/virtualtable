const path = require('path');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = (env = {}) => {
    const mode = env.production ? 'production' : 'development';
    return ({
        mode,
        entry: './src/index.ts',
        output: {
            path: path.resolve('dist'),
            filename: 'index.js',
            libraryTarget: 'commonjs2',
        },
        externals: {
            "react": {
                "commonjs": "react",
                "commonjs2": "react",
                "amd": "react",
                "root": "React"
            },
            "react-dom": {
                "commonjs": "react-dom",
                "commonjs2": "react-dom",
                "amd": "react-dom",
                "root": "ReactDOM"
            }
        },
        plugins: [new ESLintPlugin()],
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: ['babel-loader'],
                },
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/i,
                    exclude: /node_modules/,
                    use: ['style-loader', {
                        loader: 'css-loader',
                        options: {
                            modules: true
                        }
                    }],
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
    });
};
