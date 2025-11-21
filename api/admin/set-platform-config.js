const rootHandler = require('../../set-platform-config');

module.exports = async function(req, res){
  // reuse existing root handler which expects (req,res)
  return rootHandler(req, res);
};
