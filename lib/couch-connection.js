
var ProgressBar = require('progress');
var fs = require('fs');
var _ = require('underscore');
var http = require('http');
var https = require('https');
var url = require('url');
var q = require('q');
var prompt = require('prompt');


var CouchConnection = function(dbOptions) {
    
    return {
        sendRequest: sendRequest,
        upload: upload,
        download: download
    };


    function request(method, deferred, responseHandler) {
        var client = http;
        if (dbOptions.protocol === 'https:') {
            client = https;
        }
        var options = _.defaults({method: method}, dbOptions);

        var data = '';
        return client.request(options)
        .on('response', function(res) {
            if (responseHandler) {
                responseHandler(res);
            }
            res.on('data', function(chunk) {
                data += chunk;
            })
            .on('end', function() {

                validate(res, data).then(function(){
                    res.emit('success', data);
                }, function() {
                    request(method, deferred, responseHandler);
                });
            })
        })
        .on('error', function(error) {
            throw error;
        })
        .end();
    }

    function validate(response, data) {
        var deferred = q.defer();
        if (response.statusCode >= 400) {
            if (response.statusCode === 401 || response.statusCode === 403) {
                //Request authentication and store new credentials in dbOptions
                //then:
                //return request(method, responseHandler)
                console.error('Enter credentials');
                prompt.message = '';
                prompt.delimiter = ' ';
                prompt.start()
                var authProperties = [{
                    name: 'username',
                    required: true,
                    default: dbOptions.auth?dbOptions.auth.split(':')[0]:""
                }, {
                    name: 'password',
                    hidden: true
                }];

                prompt.get(authProperties, function(err, result) {
                    if ( ! result ) {
                        deferred.reject();
                    }
                    dbOptions.auth = result.username + ':' + result.password;
                    deferred.reject();
                });
            } else {
                throw data;
            }
        } else {
            deferred.resolve();

        }
        return deferred.promise;
    }

    function upload(file) {
    }

    function download(file) {
        var deferred = q.defer();
        try {
            var req = request('get', deferred, function(res){
                var len = parseInt(res.headers['content-length'], 10);
                var bar = new ProgressBar('  Downloading ' +file + ' [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: len
                });
                var stream = fs.createWriteStream(file);
                res.pipe(stream);
                res.on('data', function (chunk) {
                    bar.tick(chunk.length);
                });
                res.on('success', function (data) {
                    deferred.resolve({id: id, file: file});
                });
            });
        } catch (err) {
            deferred.reject(err);
        };
        return deferred.promise;
    }

    function sendRequest(method) {
        var deferred = q.defer();
        try {
            var req = request(method, deferred, function(res){
                res.on('success', function (data) {
                    deferred.resolve(JSON.parse(data));
                });
            })
        }catch (err) {
            deferred.reject(err);
        };
        return deferred.promise;
    }
};

exports.CouchConnection = CouchConnection;

