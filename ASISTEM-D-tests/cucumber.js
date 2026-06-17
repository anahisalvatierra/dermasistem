module.exports = {
  default: {
    require: ['src/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      '@serenity-js/cucumber',
      'progress',
      'json:target/cucumber-report.json'
    ],
    formatOptions: {
      serenity: {
        outputDirectory: 'target/site/serenity'
      }
    },
    timeout: 60000,
    publishQuiet: true,
  }
}