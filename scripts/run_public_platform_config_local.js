// Local runner for api/public/platform-config
const path = require('path');
const fn = require(path.join(__dirname,'..','api','public','platform-config.js'));

const req = { method: 'GET', headers: {}, body: null, rawBody: null };
const res = {
  statusCode: 200,
  headers: {},
  setHeader(k,v){ this.headers[k]=v },
  end(s){ console.log('RES END:', s); }
};

(async ()=>{
  try{
    await fn(req,res);
  }catch(e){
    console.error('Local invocation error:', e && e.stack ? e.stack : e);
  }
})();
