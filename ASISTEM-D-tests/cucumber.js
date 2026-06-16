module.exports = {
  default: {
    require: ['src/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      '@serenity-js/cucumber',
      'progress'
    ],
    publishQuiet: true,
  }
}