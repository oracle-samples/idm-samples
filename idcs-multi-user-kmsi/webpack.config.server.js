// Props to nilsmehlhorn (https://github.com/nilsmehlhorn/ts-react-ssr-webpack) for
// the webpack config examples.

const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

module.exports = {
  name: 'server',
  entry: {
    server: path.resolve(__dirname, 'server/server.ts'),
  },
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.tsx'],
  },
  externals: [nodeExternals()],
  target: 'node',
  node: {
    __dirname: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.server.json',
        },
      },
      {
        test: /\.css$/i,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              emit: false
            }
          },
          "css-loader"
        ]
      }
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/bundle.css'
    }),
    new CopyWebpackPlugin({
      patterns:[{from: 'sslcert', to: 'sslcert'}]
    })
  ]
}