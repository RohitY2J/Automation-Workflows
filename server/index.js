let Connection = require('tedious').Connection;
let Request = require('tedious').Request
let TYPES = require('tedious').TYPES;
let fs = require('fs')
const express = require('express')
const app = express()
const cors = require('cors')


app.use(cors()) //for cors policy error
app.use(express.json()) //for catching the values thrown from front-end


let config = {
    server: 'localhost',  //update me
    authentication: {
        type: 'default',
        options: {
            userName: 'groot', //update me
            password: 'root'  //update me
        }
    },
    options: {
        // If you are on Microsoft Azure, you need encryption:
        encrypt: false,
        database: 'Links'  //update me
    }
};
let connection = new Connection(config);
connection.on('connect', function (err) {
    // If no error, then good to proceed.
    console.log("Connected");
    //   executeStatement1()
});

connection.connect();

/*router.get('/',(req,res)=>{
    console.log("Request handler")
    res.send("abc")

})*/

app.listen(3001, () => {
    console.log("This port is listening")
})

app.post("/create", (req, res) => {
    console.log("Here")
    console.log(req.body)


    const ip = req.body.ip
    const site = req.body.site

    // function executeStatement1{
    let request = new Request("INSERT into SiteData(ip, site) values (@ip , @site);", (err) => {
        if (err) {

            console.log(err);
        }
    });
    request.addParameter('ip', TYPES.VarChar, ip);
    request.addParameter('site', TYPES.VarChar, site);


    fs.writeFile('helloworld.txt', ip + site, (err) => {
        if (err) return console.log(err);
        console.log('Log inserted');
    });


    // Close the connection after the final event emitted by the request, after the callback passes
    request.on("requestCompleted", function (rowCount, more) {
        console.log("pasa")
        connection.close();
    })
    connection.execSql(request);
    res.send('sent')

})



