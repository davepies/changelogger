/* eslint-env node */

'use strict';

// Dependencies
// ======================================================================

var shell = require('shelljs');
var diff = require('deep-diff');
var R = require('ramda');

var bc = require('bureaucat');

// Private
// ======================================================================

// raw diff data:
// [ { kind: 'E', path: [ 'module_a' ], lhs: '1.0.2', rhs: '1.0.4' },
// { kind: 'E', path: [ 'module_b' ], lhs: '1.0.5', rhs: '1.0.7' } ]
// ==> [ changes: {moduleName: pathProp, prevVersion: lhs, currentVersion: rhs}];
var transform = bc({
    'moduleName': 'path[0]',
    'prevVersion': 'lhs',
    'currentVersion': 'rhs'
});

// only pick diffs of kind 'E' = Edited
var onlyEditChanges = R.filter(R.where({ kind: R.equals('E')}));

function getPropFromJSONString(jsonString, prop) {
    try {
        return JSON.parse(jsonString)[prop];
    } catch (e) {
        return false;
    }
}

function getFileContentForVersion(version, filename) {
    return shell.exec('git show v' + version + ':./' + filename, { silent: true }).output;
}

// Public
// ======================================================================

function getDependenciesDiff (prevVersion, currVersion) {
    // get package.json strings for each version
    var prevPckgJson = getFileContentForVersion(prevVersion, 'package.json');
    var currPckgJson = getFileContentForVersion(currVersion, 'package.json');

    // get the dependencies property for each version
    var prevVersionDeps = getPropFromJSONString(prevPckgJson, 'dependencies');
    var currVersionDeps = getPropFromJSONString(currPckgJson, 'dependencies');

    // something went wrong
    if (!prevVersionDeps || !prevVersionDeps) {
        return false;
    }

    // do a diff on the dependencies, filter them and return the desired props
    return transform(onlyEditChanges(diff(prevVersionDeps, currVersionDeps)));
}

module.exports = getDependenciesDiff;
