const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('glob');
const fs = require('fs');
const path = require('path');
const request = require('request');

try {
  const auth = core.getInput('server-auth', {required: true});
  const url = new URL(core.getInput('server-url', {required: true}));
  const reportPath = core.getInput('path', {required: true});

  const results = glob.sync(path.join(reportPath, '*.junit'));

  url.pathname = path.join(url.pathname, 'uploads');

  results.forEach((file, i) => {
    const data = fs.readFileSync(file);
    const b64 = Buffer.from(data).toString('base64');
    const owner = github.context.repo.owner;

    const body = {
      junit_report_xml: b64,
      github_repository: owner + '/' + github.context.repo.repo,
      github_sha: github.context.sha,
      github_ref_name: process.env.GITHUB_REF_NAME,
      github_action: github.context.action,
      github_run_number: github.context.runNumber,
      github_run_attempt: process.env.GITHUB_RUN_ATTEMPT,
      github_run_id: github.context.runId.toString(),
      github_job: github.context.job,
      github_retention_days: process.env.GITHUB_RETENTION_DAYS,
      iteration: i + 1,
    };

    body.github_base_ref = process.env.GITHUB_BASE_REF || null;
    body.github_head_ref = process.env.GITHUB_HEAD_REF || null;

    const headers = {
      'Test-Observability-Auth-Key': auth,
    };

    const options = {
      method: 'post',
      url: url.toString(),
      headers,
      json: body,
    };

    request(options, function(err, response, body) {
      if (err) {
        console.log('Uploading test results failed:');
        console.log(err);
        console.log(body);
        core.setFailed(err.toString());
        return;
      }
      if (response.statusCode < 200 || response.statusCode > 299) {
        console.log('Uploading test results failed:');
        const msg = 'Server returned code ' + response.statusCode;
        console.log(msg);
        console.log(body);
        core.setFailed(msg);
        return;
      }
      console.log('Test results uploaded successfully');
    });
  });
} catch (error) {
  core.setFailed(error.toString());
}
