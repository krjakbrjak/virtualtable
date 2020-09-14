const path = require('path');

module.exports = (env = {}) => ({
    devtool: 'inline-source-map',
    mode: 'development',
    entry: './testApp/src/index.js',
    output: {
        path: path.resolve('testApp/dist'),
        filename: 'index.js',
        publicPath: '/',
    },
    devServer: {
        contentBase: 'testApp',
        port: 9001,
        inline: true,
        hot: true,
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: ['babel-loader', 'eslint-loader'],
            },
            {
                test: /\.css$/i,
                exclude: /node_modules/,
                use: ['style-loader', 'css-loader?modules'],
            },
        ],
    },
    resolve: {
        extensions: ['.js'],
    },
});
