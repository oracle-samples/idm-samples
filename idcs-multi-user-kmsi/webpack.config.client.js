// Props to nilsmehlhorn (https://github.com/nilsmehlhorn/ts-react-ssr-webpack) for
// the webpack config examples.

const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const { WebpackManifestPlugin } = require('webpack-manifest-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');


module.exports = {
  name: 'client',
  entry: {
    client: path.resolve(__dirname, 'client/client.tsx'),
  },
  mode: 'production',
  output: {
    path: path.resolve(__dirname + '/dist/static'),
    filename: '[name].[contenthash].js',
    publicPath: '',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.client.json',
        }
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      }
    ],
  },
  plugins: [
    new CleanWebpackPlugin(), 
    new WebpackManifestPlugin(), 
    new MiniCssExtractPlugin({
      filename: 'css/bundle.css'
    })
  ]
}