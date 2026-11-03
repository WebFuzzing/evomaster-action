const core = require('@actions/core');
const github = require('@actions/github');
const { readFileSync, existsSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

// Marker written by wfc-summary.cjs at the start of the PR comment, used to update the same comment on each run
const PR_COMMENT_MARKER = '<!-- wfc-summary:pr-comment -->';

function runSummaryScript(script, reportPath, format, extraArgs) {
    return execFileSync(process.execPath, [script, '--report', reportPath, '--format', format, ...extraArgs], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
    });
}

async function writePrComment(body) {
    const pr = github.context.payload.pull_request;
    if (!pr) {
        core.info("Not a pull request event, skipping PR comment");
        return;
    }
    try {
        const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
        const { owner, repo } = github.context.repo;
        const comments = await octokit.paginate(octokit.rest.issues.listComments, { owner, repo, issue_number: pr.number });
        const previous = comments.find(c => c.body && c.body.startsWith(PR_COMMENT_MARKER));
        if (previous) {
            await octokit.rest.issues.updateComment({ owner, repo, comment_id: previous.id, body });
        } else {
            await octokit.rest.issues.createComment({ owner, repo, issue_number: pr.number, body });
        }
    } catch (error) {
        // e.g., PRs from forks only get a read-only token
        core.warning("Cannot write PR comment: " + error.message + ". The workflow needs 'pull-requests: write' permission.");
    }
}

// Rich summary with the script exported by EvoMaster next to report.json. Returns false if it is not available.
async function writeRichSummary(outputFolder, reportPath) {
    const script = path.join(outputFolder, 'wfc-summary.cjs');
    if (!existsSync(script)) {
        core.info(script + " not found (older EvoMaster version?), writing a simple summary");
        return false;
    }

    const { serverUrl, runId } = github.context;
    const { owner, repo } = github.context.repo;
    const links = ['--run-url', `${serverUrl}/${owner}/${repo}/actions/runs/${runId}`];
    if (process.env.ARTIFACT_URL) {
        links.push('--artifact-url', process.env.ARTIFACT_URL);
    }

    try {
        core.summary.addRaw(runSummaryScript(script, reportPath, 'summary', [...links, '--include-tests']));
    } catch (error) {
        core.warning("Cannot render the report with " + script + ": " + error.message);
        return false;
    }

    try {
        if (process.env.ANNOTATIONS === 'true') {
            for (const a of JSON.parse(runSummaryScript(script, reportPath, 'annotations', []))) {
                if (a.level === 'warning') {
                    core.warning(a.message, { title: a.title });
                } else {
                    core.notice(a.message, { title: a.title });
                }
            }
        }
        if (process.env.PR_COMMENT === 'true') {
            await writePrComment(runSummaryScript(script, reportPath, 'pr', links));
        }
    } catch (error) {
        core.warning("Cannot create annotations or PR comment: " + error.message);
    }
    return true;
}

async function run() {
    core.info("Analyzing results of EvoMaster run")

    const outputFolder = process.env.OUTPUT_FOLDER || 'generated_tests';
    const reportPath = path.join(outputFolder, 'report.json');

    const report = JSON.parse(readFileSync(reportPath, 'utf8'));

    const faults = report.faults.totalNumber

    const rich = await writeRichSummary(outputFolder, reportPath);

    if(faults == 0) {
        if (!rich) {
            core.summary.addHeading('No potential fault was found', '2')
        }
    } else {

        let message;

        if(faults == 1){
            message = 'EvoMaster found 1 potential fault in the tested application'
        } else {
            message ="EvoMaster found " + faults + ' potential faults in the tested application'
        }

        if (!rich) {
            core.summary.addHeading(message, '2')
        }

        const failOnErrors = process.env.FAIL_ON_ERRORS
        if(failOnErrors.toLowerCase() === "true"){
            core.setFailed(message);
        } else if(failOnErrors.toLowerCase() === "false"){
            core.warning(message)
        } else {
            core.setFailed("Invalid 'failOnErrors' value: '" + failOnErrors + "'. Use either 'true' or 'false'");
        }
    }
    await core.summary.write()
}

run().catch(error => core.setFailed(error.message));
