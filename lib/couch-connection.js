
var ProgressBar = require('progress');
var fs = require('fs');
var _ = require('underscore');
var http = require('http');
var https = require('https');
var url = require('url');
var querystring = require('querystring');
var q = require('q');
var prompt = require('prompt');


var CouchConnection = function(dbOptions) {
    
    return {
        map: map,
        sendRequest: sendRequest,
        upload: upload,
        download: download
    };


    function request(options, deferred, responseHandler, retryHandler) {
        var client = http;
        if (dbOptions.protocol === 'https:') {
            client = https;
        }

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
                validate(res, options, data).then(function(){
                    res.emit('success', data);
                }, function(retry) {
                    if (retry) {
                        retryHandler(options, deferred, responseHandler);
                    }
                });
            });
        })
        .on('error', function(error) {
            throw error;
        });
    }

    function validate(response, options, data) {
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
                        deferred.reject(false);
                    } else {
                        dbOptions.auth = result.username + ':' + result.password;
                        options.auth = dbOptions.auth;
                        deferred.reject(true);
                    }
                });
            } else {
                throw data;
            }
        } else {
            deferred.resolve();
        }
        return deferred.promise;
    }

    function _dbOptions(method, path, options) {
        var p = path;
        if (!_.isArray(p)) {
            p = [p];
        }
        var newPath = dbOptions.pathname + (/\/$/.test(dbOptions.pathname)?'':'/')+ p.join('/');
        //Query needs to be appended to path
        var opts = _.defaults(options || {}, dbOptions);
        if (opts.query) {
            if (dbOptions.query) {
                opts.query = _.defaults(opts.query, dbOptions.query);
            }
            newPath += '?'+querystring.stringify(opts.query);
        }
        return  _.defaults({method: method, path: newPath}, opts );
    }

    function upload(method, path, file, options) {
        var deferred = q.defer();
        doUpload(deferred, _dbOptions(method, path, options), file);
        return deferred.promise;
    }

    function doUpload(deferred, options, file) {
        try {
            var req = request(options, deferred, function(res){
                res.on('success', function (data) {
                    deferred.resolve(JSON.parse(data));
                });
            }, function() {
                doUpload(deferred, options, file);
            });
            var fsStat = fs.statSync(file);
            var bar = new ProgressBar('  Uploading ' +file + ' [:bar] :percent :etas', {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: fsStat.size
            });

            var stream = fs.createReadStream(file);
            var bytesPending = 0;
            stream.on('data', function(chunk) {
                var written = req.write(chunk);
                if ( ! written) {
                    bytesPending = chunk.length;
                    stream.pause();
                } else {
                    bytesPending = 0;
                    bar.tick(chunk.length);
                }
            });
            req.on('drain', function() {
                stream.resume();
                bar.tick(bytesPending);
            });
            stream.on('end', function() {
                req.end();
            });
        } catch (err) {
            deferred.reject(err);
        }
 
    }

    function download(method, path, file, options) {
        var deferred = q.defer();
        doDownload(deferred, _dbOptions(method, path, options), file);
        return deferred.promise;
    }
    function doDownload(deferred, options, file) {
        try {
            var req = request(options, deferred, function(res){
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
                doDownload(deferred, options, file);
            })
            .end();
        } catch (err) {
            deferred.reject(err);
        }
    }
    function sendRequest(method, path, body, options) {
        var deferred = q.defer();
        doSendRequest(deferred, _dbOptions(method, path, options), body);
        return deferred.promise;
    }

    function doSendRequest(deferred, options, body) {
        try {
            var req = request(options, deferred, function(res){
                res.on('success', function (data) {
                    deferred.resolve(JSON.parse(data));
                });
            }, function() {
                doSendRequest(deferred, options, body);
            });
            if (body) {
                req.write(body);
                req.end();
            } else {
                req.end();
            }
        }catch (err) {
            deferred.reject(err);
        }
    }

    function map(mapper) {
        var deferred = q.defer();
        var prepared = mapper.prepare(dbOptions);

        if (_.isFunction(mapper.view)) {
            var view = {map: mapper.view().toString()};
            sendRequest('post', '_temp_view', JSON.stringify(view), {query: {include_docs: true}}).then(function(result){
                _.each(result.rows, function(value) {
                    try {
                        mapper.map(value.key, value, value.doc);
                    } catch (e) {
                        console.error(e);
                    }
                });
                var finished = mapper.finish();
            });
        } else {
        }

        return deferred.promise;
    }
};

exports.CouchConnection = CouchConnection;

