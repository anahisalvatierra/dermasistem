module.exports = {
  default: {
    require: ['src/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      '@serenity-js/cucumber',
      'progress',
      'json:target/site/serenity/cucumber-report.json'
    ],
    timeout: 30000,
    publishQuiet: true,
  }
}