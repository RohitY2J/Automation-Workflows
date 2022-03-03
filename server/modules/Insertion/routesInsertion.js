const { getTable } = require("./serviceInsertion");

module.exports = (app, conn) => {
  
  app.get('/show', async (req, res) => {

    try{
      const details = await getTable(conn);
      res.json(details);
    }
    catch(error){
      console.log(error)
        res.json({status:'error', message: error.message});
    }

  })
}