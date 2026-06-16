module.exports = {
  default: {
    require: ['src/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      '@serenity-js/cucumber',
      'progress'
    ],
    timeout: 30000,
    publishQuiet: true,
    formatOptions: {
      outdir: './target/site/serenity'
    }
  }
}