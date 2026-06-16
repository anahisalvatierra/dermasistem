const reporter = require('cucumber-html-reporter');

const options = {
  theme: 'bootstrap',
  jsonFile: 'target/cucumber-report.json',
  output: 'target/site/cucumber-report.html',
  reportSuiteAsScenarios: true,
  scenarioTimestamp: true,
  launchReport: true,
  metadata: {
    'App Version': '1.0.0',
    'Test Environment': 'Vercel Production',
    'Browser': 'Chromium (Playwright)',
    'Platform': 'Windows',
  }
};

reporter.generate(options);