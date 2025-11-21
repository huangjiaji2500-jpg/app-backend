const https = require('https');
const url = 'https://app-tau-gilt-23.vercel.app/admin/index.html';
const maxAttempts = 30;
const delayMs = 8000;
let attempt = 0;

function checkContent(body){
  // Look for signatures of the new admin UI
  const markers = [
    '上传二维码图片',
    '一键同步到所有用户端',
    '保存汇率',
    'ratesForm',
    '平台收款二维码管理',
    '欢迎使用管理员后台 — 新手引导'
  ];
  for(const m of markers){ if(body.indexOf(m) !== -1) return m; }
  return null;
}

function fetchOnce(){
  attempt++;
  console.log(`[poll] Attempt ${attempt}/${maxAttempts} - fetching ${url}`);
  https.get(url, (res)=>{
    let d = '';
    res.on('data', c=> d+=c);
    res.on('end', ()=>{
      console.log(`[poll] HTTP ${res.statusCode}`);
      if(res.statusCode === 200){
        const found = checkContent(d);
        if(found){
          console.log(`[poll] FOUND marker: ${found} on attempt ${attempt}`);
          // print a short snippet
          const snippet = d.slice(0, 2000);
          console.log('---snippet---');
          console.log(snippet);
          process.exit(0);
        } else {
          console.log('[poll] marker not found in body');
        }
      }
      if(attempt >= maxAttempts){
        console.log('[poll] Max attempts reached, giving up');
        process.exit(2);
      }
      setTimeout(fetchOnce, delayMs);
    });
  }).on('error', (e)=>{
    console.log('[poll] request error', e && e.message);
    if(attempt >= maxAttempts){ console.log('[poll] Max attempts reached after error, giving up'); process.exit(2); }
    setTimeout(fetchOnce, delayMs);
  });
}

fetchOnce();
