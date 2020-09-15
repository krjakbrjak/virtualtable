const path = require('path');

module.exports = (env = {}) => {
    const mode = env.production ? 'production' : 'development';
    return ({
        mode,
        entry: './src/index.js',
        output: {
            path: path.resolve('dist'),
            filename: 'main.js',
            libraryTarget: 'commonjs2',
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
};
