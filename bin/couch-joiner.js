#!/usr/bin/env node
/**
 * Command line utility for manipulating CouchDB documents
 */

var ProgressBar = require('progress');
var fs = require('fs');
var _ = require('underscore');
var http = require('http');
var https = require('https');
var url = require('url');
var q = require('q');
var prompt = require('prompt');
var CouchConnection = require('../lib/couch-connection').CouchConnection;

var yargs = require('yargs')
            .alias('f', 'file')
            .alias('m', 'method')
            .alias('u', 'url')
            .alias('c', 'credentials')
            .alias('h', 'help')
            .boolean('h')
            .describe('f', 'File (either input or output depending on method')
            .describe('m', 'Method: get, post, put, delete')
            .describe('u', 'CouchDB instance URL')
            .describe('c', 'Credentials: "username:password"')
            .describe('h', 'Show help')

            .default('m', 'get')
            .default('u', 'http://localhost:5984')
var argv = yargs.argv;

if (argv.help) {
    yargs.showHelp()
    return;
}
var dbUrl = argv.url + '/'+ argv._.join('/');
var dbOptions = url.parse(dbUrl);

var connection = new CouchConnection(dbOptions);

function template(id) {

    return {
        _id: id,
        type: 'webapp',
        contextPath: '/' + id
    }
}

if (argv.file) {
    if (/get/i.test(argv.method)) {
        connection.download(argv.file);
    } else {
        connection.upload(argv.file);
    }
} else {
    connection.sendRequest(argv.method).then(function(response) {
        console.log(response)
    }, function(error) {
        console.error(error);
    });
}

