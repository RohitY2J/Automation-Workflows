let Connection = require('tedious').Connection;
let Request = require('tedious').Request
let TYPES = require('tedious').TYPES;
let fs = require('fs')
const express = require('express')
const app = express()
const cors = require('cors')
const config = require('./config')

app.use(cors()) //for cors policy error
app.use(express.json()) //for catching the values thrown from front-end

let conf = {
    server: config.server,  //update me
    authentication: {
        type: 'default',
        options: {
            userName: config.userName, //update
            password: config.password //update me
        }
    },
    options: {
        // If you are on Microsoft Azure, you need encryption:
        encrypt: false,
        database: config.database  //update me
    }
};
//For connection to database
let connection = new Connection(conf);

connection.on('connect', (err) => {
    console.log("Connected");
});


//opening a port for api
//=================================== GET REQUEST===================================================
connection.connect()


app.get('/show', (req, res) => {

    console.log("data")
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
        console.log("Disconnected")
        res.send(result)
         /*connection.close();*/
    });
    connection.execSql(request)


})
//========================================================================================================

//==========================================POST REQUEST START==================================================
//will be triggered when '/create' is used in url like "https://3001/create"
app.post("/create", (req, res) => {
    console.log("Here")
    const ip = req.body.ip
    const site = req.body.site
    console.log("Before request")
    let request = new Request("INSERT into SiteData(ip, site) values (@ip , @site);", (err) => {
        if (err) {
            console.log(err);
        }
    });
    request.addParameter('ip', TYPES.VarChar, ip);
    request.addParameter('site', TYPES.VarChar, site);
    console.log("Before writing file")
    console.log(ip)

    request.on('row',(columns)=>{

        columns.forEach((column)=>{
            if(column.value==NULL)
                console.log("NULL")
            else console.log(column.value + "is inserted")
        })
    })
    console.log("After request on")
    connection.execSql(request);

    let content = ip + " "+ site + "\r\n"

    fs.access(config.filepath,(err) => {
        if (err) {
            fs.writeFile(config.filepath, content , (err) => {
                if (err) return console.log(err)
                console.log("after writefile")
            })
        } else {
            fs.appendFile(config.filepath, content, (err) => {
                if (err) return console.log(err)
                else console.log('Appended')
            })
        }

    });

    // Close the connection after the final event emitted by the request, after the callback passes
  /*  request.on("requestCompleted", function (rowCount, more) {
        /!*connection.close();*!/
    })*/



})
//============================================POST REQUEST CLOSED============================================

//=========================================LISTENING PORT FOR BACKEND========================================
app.listen(3001, () => {
    console.log("This port is listening")
})
//===========================================================================================================