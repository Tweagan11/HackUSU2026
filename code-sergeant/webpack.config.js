//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const webviewConfig = {
  target: 'web',
	mode: 'production',

  entry: './src/frontend/index.tsx',
  output: {
    path: path.resolve(__dirname, 'media'),
    filename: 'webview.js'
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        // Inline fonts as data URIs (Monaco codicon, etc.)
        test: /\.(ttf|woff|woff2|eot)$/,
        type: 'asset/inline'
      }
    ]
  },
  optimization: {
    splitChunks: false,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
  devtool: 'nosources-source-map',
  performance: {
    hints: false
  }
};
module.exports = [ webviewConfig ];
