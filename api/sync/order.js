const handlePost = require('./_post_handler');
module.exports = async function(req,res){ return handlePost(req,res,'order'); };
