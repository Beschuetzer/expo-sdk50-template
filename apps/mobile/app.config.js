module.exports = ({ config }) => ({
  ...config,
  scheme: process.env.EXPO_PUBLIC_OAUTH_SCHEME?.trim() || config.scheme,
});
