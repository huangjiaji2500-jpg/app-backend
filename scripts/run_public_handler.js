const fs = require('fs');
function loadEnv(file){
  const content = fs.readFileSync(file,'utf8');
  content.split(/\r?\n/).forEach(line=>{
    const m = line.match(/^([^=]+)=(.*)$/);
    if(!m) return;
    let k = m[1];
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1);
    process.env[k] = v;
  });
}
try{
  loadEnv('.vercel.env');
  (async ()=>{
    try{
      const handler = require('../api/public/platform-config');
      const req = { method: 'GET' };
      const res = {
        headers: {}, statusCode: 200,
        setHeader(k,v){ this.headers[k]=v },
        end(s){ console.log('\n---HANDLER OUTPUT START---\n'+s+'\n---HANDLER OUTPUT END---\n'); }
      };
      await handler(req,res);
      console.log('handler finished');
    } catch(e){
      console.error('HANDLER ERROR', e && (e.stack || e));
    }
  })();
} catch(e){ console.error('failed to load env or run handler', e && e.stack); }
