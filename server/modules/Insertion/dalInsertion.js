//const request = require('request');
'use strict';

let Request = require('tedious').Request

let DALObj = {
    getTable: (connection) => new Promise((resolve, reject) => {
        let request = new Request("Select * from SiteData", (err) => {
            if (err) {
                console.log(err);
            }
    
        })
        
        let result = [];
        request.on('row', function (columns) {
            let siteIp = {}
            columns.forEach(function (column,index) {
    
                if (column.value === null) {
                    console.log('NULL');
                } else {
    
                    siteIp[column.metadata.colName]=column.value
                }
            });
    
            result.push(siteIp)
        });
    
        request.on("requestCompleted", function (rowCount, more) {
            return resolve({
                status: 'success',
                result,
              });
        });

        connection.execSql(request)
    })

}

module.exports  = {DALObj}
