#!/usr/bin/env node
//
//  runner.js
//  ---------
//
//  Automated testing of Knockout-Secure-Binding
//
//  Run with Chromedriver locally with;
// chromedriver --url-base=/wd/hub --port=4445
// SELENIUM_HOST=localhost SELENIUM_PORT=4445 npm test
//
//
// Run local tests on Sauce Labs with:
// $ SELENIUM_HOST=localhost
//     SELENIUM_PORT=4445 SAUCE_USERNAME=brianmhunt
//     SAUCE_ACCESS_KEY=... npm test
// ^^^ requires Sauce Connect to be listening on 4445.
//
// Run local tests with BrowserStack with
//    ./BrowserStackLocal <<KEY>> localhost,4445,0

'use strict'
require('colors')

var webdriver = require('wd'),
    env = process.env,

    // our webdriver desired capabilities
    capabilities,

   // Address of the server that is serving up our tests. (i.e. our
  //  local server with CSP headers)
    local_server = {
      host: "localhost",
      port: 7777
    },

    // we use this for ensuring the document is loaded, below
    EXPECT_TITLE = "Knockout Secure Binding - Local unit tests",

    webdriver_host = "localhost",
    webdriver_port = 4445;


exports.start_tests =
function start_tests(browser_name, browser_version, os_name, os_version, target_string) {
  var username, token;
  var capabilities = {
    'browserstack.local': true,
    'tunner-identifier': env.TRAVIS_JOB_NUMBER,
    browser: browser_name,
    browserName: browser_name,
    browser_version: browser_version,
    build: env.CI_AUTOMATE_BUILD || 'Manual',
    javascriptEnabled: true,
    name: 'KSB',
    os: os_name,
    os_version: os_version,
    project: env.BS_AUTOMATE_PROJECT || 'local - Knockout Secure Binding',
    tags: ['CI'],
  }

  username = env.BS_USER
  token = env.BS_KEY
  var selenium_host = env.SELENIUM_HOST || 'localhost';
  var selenium_port = env.SELENIUM_PORT || 4445;

  console.log("\n\n");
  console.log("       TESTING       ".bold + target_string.yellow)
  console.log("       ----------------------------------------".bold)
  console.log("\n\n ... Connecting Webdriver to ", username.cyan, "@",
    selenium_host.cyan, ":", ("" + selenium_port).cyan);

  var browser =  webdriver.promiseChainRemote(
    selenium_host, selenium_port, username, token
  );

  var uri = 'http://' + local_server.host + ":" + local_server.port;

  // extra logging.
  browser.on('status', function(info) {
    console.log(info.cyan);
  });
  browser.on('command', function(eventType, command, response) {
    console.log(' > ' + eventType.blue, command, (response || '').grey);
  });
  browser.on('http', function(meth, path, data) {
    console.log(' > ' + meth.yellow, path, (data || '').grey);
  });

  process.on("SIGINT", function () {
    console.log("\n\tCtrl-C received; shutting down browser\n".red)
    if (browser) {
      browser.quit(function () { process.exit(1) })
    } else {
      process.exit(1)
    }
  })

  var poll_script = "return window.tests_complete";
  var results_script = "return window.fails";
  var attempts = 25;
  var poll = 1500;

  console.log(">>> ", uri.green)
  return browser
    .init(capabilities)
    .get(uri)
    .title()
    .then(function (title) {
      if (title !== EXPECT_TITLE) {
        throw new Error("Expected title " + EXPECT_TITLE + " but got "
          + title)
      }
    })
    .then(function () {
      // Our custom polling, because waitForConditionInBrowser calls 'eval'.
      // i.e. Our CSP prevents wd's safeExecute* (basically anything
      // in wd/browser-scripts).
      function exec() {
        return browser
          .chain()
          .delay(poll)
          .execute(poll_script)
          .then(function (complete) {
            if (--attempts == 0) {
              throw new Error("Taking too long.")
            }
            if (!complete) {
              return exec()
            }
          });
      }
      return exec()
    })
    .execute(results_script)
    .then(function (fails) {
      if (fails.length == 0) {
        return
      }
      console.log("\t Some tests failed:".red)
      fails.forEach(function (failure) {
        console.log("  - " + failure.yellow)
      });
      throw new Error("Some tests failed for " + target_string.yellow)
    })
    .fin(function() { return browser.quit(); })
}
