
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


    function request(method, deferred, responseHandler, retryHandler) {
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
                    retryHandler(method, deferred, responseHandler);
                });
            });
        })
        .on('error', function(error) {
            throw error;
        });
    }

    function validate(response, data) {
        var deferred = q.defer();
        if (response.statusCode >= 400) {
            if (response.statusCode === 401 || response.statusCode === 403) {
                //Request authentication and store new credentials in dbOptions
                //then:
                //return request(method, responseHandler)
                console.error('\nEnter credentials');
                prompt.message = '';
                prompt.delimiter = ' ';
                prompt.start();
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

    function upload(method, file) {
        var deferred = q.defer();
        doUpload(deferred, method, file);
        return deferred.promise;
    }

    function doUpload(deferred, method, file) {
        try {
            var req = request(method, deferred, function(res){
                res.on('success', function (data) {
                    deferred.resolve(JSON.parse(data));
                });
            }, function() {
                doUpload(deferred, method, file);
            });
            var fsStat = fs.statSync(file);
            var bar = new ProgressBar('  Uploading ' +file + ' [:bar] :percent :etas', {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: fsStat.size
            });

            var stream = fs.createReadStream(file);
            stream.on('data', function(chunk) {
                bar.tick(chunk.length);
                var written = req.write(chunk);
                if ( ! written) {
                    stream.pause();
                }
            });
            req.on('drain', function() {
                stream.resume();
            });
            stream.on('end', function() {
                req.end();
            });
        } catch (err) {
            deferred.reject(err);
        }
 
    }

    function download(method, file) {
        var deferred = q.defer();
        doDownload(deferred, method, file);
        return deferred.promise;
    }
    function doDownload(deferred, method, file) {
        try {
            var req = request(method, deferred, function(res){
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    var len = parseInt(res.headers['content-length'], 10);
                    var direction = 1;
                    var title ='  Downloading ' + file + ' [:bar] :percent :etas (:elapsed)'; 
                    var indeterminate = _.isNaN(len);
                    if (indeterminate) {
                        len = 20;
                        title = '  Downloading ' + file + ' [:bar] (:elapsed)';
                    }
                    var bar = new ProgressBar(title, {
                        complete: '=',
                        incomplete: ' ',
                        width: 20,
                        total: len
                    });
                    var stream = fs.createWriteStream(file);
                    res.pipe(stream);
                    res.on('data', function (chunk) {
                        if (indeterminate) {
                            if (bar.curr >= len-1) {
                               direction = -1;
                            } else if (bar.curr <= 0) {
                                direction = 1;
                            }
                            //divide by 100 to slow down bar a little
                            bar.tick(direction / 100);
                        } else {
                            bar.tick(chunk.length);
                        }
                    });
                    res.on('success', function (data) {
                        bar.update(len);
                        deferred.resolve({id: id, file: file});
                    });
                }
            }, function() {
                doDownload(deferred, method, file);
            })
            .end();
        } catch (err) {
            deferred.reject(err);
        }
    }

    function sendRequest(method) {
        var deferred = q.defer();
        doSendRequest(deferred, method);
        return deferred.promise;
    }

    function doSendRequest(deferred, method) {
        try {
            var req = request(method, deferred, function(res){
                res.on('success', function (data) {
                    deferred.resolve(JSON.parse(data));
                });
            }, function() {
                doSendRequest(deferred, method);
            })
            .end();
        }catch (err) {
            deferred.reject(err);
        }
    }
};

exports.CouchConnection = CouchConnection;

