const path = require('path');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = (env = {}) => ({
    devtool: 'inline-source-map',
    mode: 'development',
    entry: './testApp/src/index.tsx',
    output: {
        path: path.resolve('testApp/dist'),
        filename: 'index.js',
        publicPath: '/',
    },
    devServer: {
        static: 'testApp',
        port: 9001,
        hot: true,
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
