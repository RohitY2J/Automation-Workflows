const { insertionService } = require(".");

module.exports = (app, routes) => {
  app.get('/show', (req, res) => {

    try{
      const details = insertionService.getTable();
      res.json(details);
    }
    catch(error){
        res.json({status:'error', message: error.message});
    }

  })
}