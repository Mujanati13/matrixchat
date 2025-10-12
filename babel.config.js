module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '@components': './src/components',
          '@navigation': './src/navigation',
          '@screens': './src/screens',
          '@services': './src/services',
          '@storage': './src/storage',
          '@theme': './src/theme',
          '@utils': './src/utils',
          '@contexts': './src/contexts',
          '@hooks': './src/hooks',
          '@app-types': './src/types',
        },
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
      },
    ],
  ],
};
