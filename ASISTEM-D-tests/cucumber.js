module.exports = {
  default: {
    require: ['src/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      '@serenity-js/cucumber',
      'progress',
      ['@serenity-js/cucumber', {
        crew: [
          ['@serenity-js/serenity-bdd', { outputDirectory: 'target/site/serenity' }],
          ['@serenity-js/core:ArtifactArchiver', { outputDirectory: 'target/site/serenity' }]
        ]
      }]
    ],
    timeout: 30000,
    publishQuiet: true,
  }
}