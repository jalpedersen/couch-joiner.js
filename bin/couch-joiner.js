#!/usr/bin/env node
/**
 * Command line utility for manipulating CouchDB documents
 */

var ProgressBar = require('progress');
var fs = require('fs');
var _ = require('underscore');
var url = require('url');
var CouchConnection = require('../lib/couch-connection').CouchConnection;

var yargs = require('yargs')
            .alias('f', 'file')
            .alias('m', 'method')
            .alias('u', 'url')
            .alias('q', 'query')
            .alias('c', 'credentials')
            .alias('H', 'header')
            .alias('h', 'help')
            .boolean('h')
            .describe('f', 'File (either input or output depending on method')
            .describe('m', 'Method: get, post, put, delete')
            .describe('u', 'CouchDB instance URL')
            .describe('q', 'Query parameters')
            .describe('c', 'Credentials: "username:password"')
            .describe('H', 'Headers')
            .describe('h', 'Show help')

            .default('m', 'get')
            .default('u', 'http://localhost:5984');
var argv = yargs.argv;

if (argv.help) {
    yargs.showHelp();
    return;
}
var dbUrl = argv.url + '/'+ argv._.join('/');
if (argv.query) {
    dbUrl += '?' + argv.query;
}
var headers = {
    'content-type': 'application/json'
};
function headerSplit(str) {
    var idx = str.indexOf(':');
    if (idx > -1) {
        return [str.substring(0,idx), str.substring(idx+1)];
    } else {
        return [str, ''];
    }
}
if (argv.header) {
    var hs =  argv.header;
    if ( ! _.isArray(argv.header)) {
        hs = [argv.header];
    }
    _.each(hs, function(v,k) {
        var h = headerSplit(argv.header);
        headers[h[0]] = h[1];
    });
}
var dbOptions = url.parse(dbUrl);
dbOptions.headers = headers;

var connection = new CouchConnection(dbOptions);

if (argv.file) {
    if (/get/i.test(argv.method)) {
        connection.download(argv.method, argv.file);
    } else {
        connection.upload(argv.method, argv.file).then(function(response) {
            console.log(response);
        },
        function(error) {
            console.error(error);
        });
    }
} else {
    connection.sendRequest(argv.method).then(function(response) {
        console.log(response);
    }, function(error) {
        console.error(error);
    });
}

