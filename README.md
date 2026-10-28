# EvoMaster GitHub Action

This is a GitHub Action for running [EvoMaster](https://github.com/WebFuzzing/EvoMaster) as part of CI. 


## Usage

For now, it is recommended to use this action only for _black-box_ testing.
Documentation and configuration settings for _white-box_ testing will be done in the future. 

Example of configuration:

```
- name: Build the Application
  run: ... # this swill depend on your application

- name: Start Docker Compose
  run: docker compose up -d --build

- uses: webfuzzing/evomaster-action@v1
  with:
    args: >- 
         --blackBox true  
         --bbSwaggerUrl http://localhost:8080/v3/api-docs
         --maxTime 20s
         --showProgress false
     failOnErrors: "true"

- name: Stop Docker Compose
  if: always()
  run: docker compose down
```


How you want to run _EvoMaster_ is CI is up to you, e.g., if on each commit, or only on specific branches, or only for PRs, etc. 
Then, there are four steps.

1) Need to build your application. This will be programming language and framework dependent.

2) The recommended way to start your application is with _Docker Compose_. This alo helps if you need to start databases (e.g., Postgres, MySQL and MongoDB). 

3) Use `webfuzzing/evomaster-action@v1` to run _EvoMaster_. The action also uploads the generated tests and the interactive report as a workflow artifact, so you can download them as a zip file. 

4) Shutdown the application using _Docker Compose_


This action has the following options:

* __failOnErrors__: specify whether to fail the build if any fault was detected by _EvoMaster_.

* __args__: command-line arguments given to _EvoMaster_. These are exactly the same you would use when running _EvoMaster_ on your local machine. 

* __outputFolder__: folder where _EvoMaster_ writes its output. Default is `generated_tests`. If you use `--outputFolder` in `args`, set this option to the same value.

* __uploadArtifact__: whether to upload the output folder as a workflow artifact. Default is `true`.

* __artifactName__: name of the uploaded artifact. Default is `evomaster-results`.

* __annotations__: whether to create annotations for the found fault categories. Default is `true`.

* __prComment__: on pull requests, write a comment with a short summary of the results, and update it on each new run. Default is `false`. This needs `pull-requests: write` permission in your workflow. On PRs from forks, the token is read-only, and the comment is skipped with a warning.

The job summary of the action shows an overview of the results, the found faults per category and endpoint, and the code of the generated tests.
This requires a version of _EvoMaster_ that writes `wfc-summary.cjs` next to `report.json` (which is not done if `--writeWFCReportExcludeWebApp true` is used). 
With older versions, only the number of found faults is reported.

In this example, we used the arguments:

* _--blackBox true_: specifying we are doing _black_box_ testing. for historical reasons, default testing mode in _EvoMaster_ is _white-box_.
 
* _--bbSwaggerUrl http://localhost:8080/v3/api-docs_: when testing a REST API, need to tell where to find the schema. In this example, it is provided by the API itself, which is listening on port 8080. Note, however, that _Docker Compose_ needs to be configured to expose such port, so that _EvoMaster_ can communicate with the API running inside _Docker Compose_.  

* _--maxTime 20s_: specify for how long to run _EvoMaster_. The longer you run it the better results you can expect. Ideally, try to run for at least 10 minutes, but better if for 1 hour, or more. 

* _--showProgress false_: a progress bar is useful when running _EvoMaster_ on a local shell. But, on GitHub Actions, the line-overwrite feature does not work, and each update creates new lines. This can flood the logs of this action. If this is a problem, this option can be used to deactivate these logs. 


## New Features

At the time of writing, this is a first version of this new GitHub Action.
Several new features will be added in the next coming months. 
If there is any important feature you think it is missing, please let us know by creating a new post on the [Discussions page](https://github.com/WebFuzzing/evomaster-action/discussions).

## For Developers

To test this action, this repository itself is configured to use the action on itself (see [ci.yaml](.github/workflows/ci.yaml)). 
_EvoMaster_ is run in `--help` mode (so there is no need to have any actual API to test), where an example [report.json](generated_tests/report.json) file is already added to the repository for testing. 
The CI runs the action twice: once with `wfc-summary.cjs` taken from the [WFC](https://github.com/WebFuzzing/Commons) jar on Maven Central (rich summary), and once without it (fallback for older _EvoMaster_ versions).

