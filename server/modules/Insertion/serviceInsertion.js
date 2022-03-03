'use strict';
const { DALObj } = require('./dalInsertion');

let getTable =async (conn) => {
    let obj = await DALObj.getTable(conn)    
    return obj.result;
}

module.exports = { getTable }
