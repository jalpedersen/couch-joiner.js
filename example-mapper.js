/**
 * Defines the view from where the mapper get it's documents
 *
 * This can either be a string specifying a view, or as here a bit of javascript for
 * a temporary view
 */
function view(dbOptions) {
    return function(doc) {
        emit(doc._id, null);
    };
}


/**
 * If this mapper returns an object this is post'ed to CouchDB
 * If a non-object is returned, nothing happens
 */
function map(key, value, doc) {
    console.log('mapping ' + doc._id);
    console.log(doc);

}

/**
 * Maybe do some heavy lifting here
 */
function prepare(dbOptions) {
    console.log('Preparing to run mapper');
}

/**
 * Maybe cleanup some stuff
 */
function finish(dbOptions) {
    console.log('mapping completed');
}


//Do the CommonJS dance
exports.view = view;
exports.prepare = prepare;
exports.map = map;
exports.finish = finish;
