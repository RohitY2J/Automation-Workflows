let Request = require('tedious').Request
let TYPES = require('tedious').TYPES;
let fs = require('fs')
const express = require('express')
const app = express()
const cors = require('cors')
const config = require('./config')
const dbconnection = require('./connection/dbconnection')
const insertionRouter = require('./modules/Insertion/index')

app.use(cors()) //for cors policy error
app.use(express.json()) //for catching the values thrown from front-end

let connection = dbconnection.connect();

insertionRouter.insertionRoutes(app, connection);

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