const insertionDal = require('./dalInsertion');
const serviceInsertion = {
  getTable: () => {
    insertionDal.getTable();
  }
}