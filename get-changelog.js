#!/usr/bin/env node

/* eslint-env node */

'use strict';

// Dependencies
// ======================================================================

var path = require('path');
var fs = require('fs');
var R = require('ramda');

var getDepsDiff = require('./get-deps-diff');

// Config
// ======================================================================

var jiraUrl = 'http://dashboard.news.com.au/browse/';

// Helpers
// ======================================================================

var getChangedModuleNames = R.pipe(R.map(R.compose(R.values, R.pick(['moduleName']))), R.flatten);

var plugins = [
    getChangelogFromTo,
    extractJIRATickets,
    R.uniq,
    createJIRALinks,
    log
];

// Public
// ======================================================================

function getModulesChangelog(prevVersion, currVersion, options) {
    options = options || {};

    var depsDiff = getDepsDiff(prevVersion, currVersion);
    var changedModules = getChangedModuleNames(depsDiff);

    // something went wrong - abort
    if (!depsDiff || !changedModules.length) {
        throw new Error('Something went wrong. Please check that the versions are correct.');
    }

    if (options.debug) {
        console.log(depsDiff);
    }

    depsDiff.forEach(function (diff) {
        readChangelog(diff.moduleName, function (err, changelog) {
            if (err) {
                return log(err);
            }
            R.pipe.apply(null, plugins)(diff.prevVersion, diff.currentVersion, changelog);
        });
    });

}

// Command line usage
// ======================================================================

if (!module.parent) {
    var args = process.argv.slice(2);

    if (args.length !== 2) {
        log('Usage: <currentVersion> <previousVersion>');
        process.exit(1);
    }

    getModulesChangelog(args[0], args[1]);
}

// Exports
// ======================================================================

module.exports = getModulesChangelog;

// Private
// ======================================================================

function readChangelog(moduleName, callback) {
    fs.readFile(path.join('./node_modules/', moduleName, 'changelog.md'), 'utf-8', function (err, content) {
        log('Generating changelog for ' + moduleName);
        if (err) {
            return console.log(err);
        }
        callback(null, content);
    });
}

function getChangelogFromTo(fromVersion, toVersion, changelog) {
    // split the string
    var lines = changelog.split('\n');
    // once came there is header (eg.: '# 0.0.1) that matches either <fromVersion>
    // or <toVersion> stop appending
    var versionMatchesLeft = 2;
    var stopAppending = false;

    log('From Version: ' + fromVersion);
    log('To Version: ' + toVersion);

    return lines.reduce(function acc(output, line) {
        if (!versionMatchesLeft && isVersionHeader(line)) {
            stopAppending = true;
        }
        if (stopAppending) {
            return output;
        }

        output += line + '\n';

        if (isVersionHeader(line) && matchesFromOrToVersion(line, fromVersion, toVersion)) {
            versionMatchesLeft -= 1;
        }

        return output;
    }, '');

    function matchesFromOrToVersion(line, fromVersion, toVersion) {
        return ~line.indexOf(fromVersion) || ~line.indexOf(toVersion);
    }

    function isVersionHeader(line) {
        return !!line.match(/\d+\.\d+\.\d+$/);
    }
}


function extractJIRATickets(changelogString) {
    log('Grabbing JIRA tickets');
    var jiraRegex = /[A-Z]+-\d+/;

    return changelogString.split('\n').reduce(function (jirasArr, line) {
        var jiraMatch = line.match(jiraRegex);
        if (jiraMatch) {
            // return a new array by calling concat
            return [].concat.call(jirasArr, jiraMatch[0]);
        }
        return jirasArr;
    }, []);
}

function createJIRALinks(jiraTicketArr) {
    return jiraTicketArr.map(function (jiraTicket) {
        return jiraUrl + jiraTicket;
    }).join('\n');
}

function log(msg) {
    console.log('-- ' + msg);
    return msg;
}

