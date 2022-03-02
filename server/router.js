const insertion = require('./modules/Insertion/index');

module.exports = (app) =>{
  insertion.insertionRoutes(app, insertion);
}