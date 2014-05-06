/**
 * Defines the view + query options from where the mapper get it's documents
 *
 * The map can either be a string or array specifying a view, or as here a bit of javascript for
 * a temporary view
 */
var view = {
    map: function(doc) {
        emit(doc._id, null);
    },
    query: {}
};

/*
var view = {
    //This translates to _design/some_design/_view/some_view
    map: ['some_design', 'some_view']
}
*/

/**
 * If this mapper returns an object this is post'ed to CouchDB
 * If an array is returned, each of it's objects are posted to CouchDB
 * If a non-object is returned, nothing happens
 */
function map(key, value, doc) {
    doc.new_value = 'hello';
    //return doc;

}

/**
 * Maybe do some heavy lifting here
 */
function prepare(connection) {
    console.log('Preparing to run mapper');
    connection.sendRequest('get', '_all_docs', null, {query: {include_docs: true}}).then(function(response) {
        console.log(response);
    }, function(error) {console.error(error);});
}

/**
 * Maybe cleanup some stuff
 */
function finish(connection) {
    console.log('mapping completed');
}


//Do the CommonJS dance
exports.view = view;
exports.prepare = prepare;
exports.map = map;
exports.finish = finish;
