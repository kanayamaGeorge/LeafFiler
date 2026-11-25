import {identity,readSecret,writeSecret,exchange,tokenFor,random,hash,readBody,cookie,json,redirect,failure} from './google-auth.mjs';
const SCOPE='https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata';
const settingsPage=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Google接続設定</title><h1>Google接続設定</h1><form><label>クライアントID <input name="id" required></label><br><label>クライアントシークレット <input name="secret" type="password" required></label><br><button>保存して接続</button></form><a href="/">戻る</a><p id="status"></p><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const h={'Content-Type':'application/json','X-Leaf-Request':'1'};const r=await fetch('/api/drive/settings',{method:'POST',headers:h,body:JSON.stringify({clientId:e.target.id.value,clientSecret:e.target.secret.value})});if(!r.ok)throw Error('設定保存失敗');const a=await fetch('/auth/google/start',{method:'POST',headers:h,body:'{}'});if(!a.ok)throw Error('接続開始失敗');location.assign((await a.json()).authorizationUrl)}catch(e){document.querySelector('#status').textContent=e.message}}</script></html>`;
export function driveTarget(value,method){
 const u=new URL(value);
 if(u.origin!=='https://www.googleapis.com'||u.username||u.password||u.hash)throw failure(403,'許可されていない送信先');
 const p=u.pathname;
 if(!['GET','POST','PATCH','PUT'].includes(method))throw failure(405,'未対応の操作');
 if(!/^\/drive\/v3\/(?:files(?:\/[a-zA-Z0-9_-]+)?|about)$/.test(p)&&!/^\/upload\/drive\/v3\/files(?:\/[a-zA-Z0-9_-]+)?$/.test(p))throw failure(403,'未対応のAPI');
 return u;
}
export default {async fetch(request,env){
 try{
 const url=new URL(request.url),p=url.pathname;
 if(!p.startsWith('/api/drive/')&&!p.startsWith('/auth/google/')&&p!=='/drive-settings')return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
 if(!env.LEAF_SITE_ORIGIN||url.origin!==env.LEAF_SITE_ORIGIN)throw failure(403,'サイトURLが一致しません');
 const user=identity(request,env), callback=env.LEAF_SITE_ORIGIN+'/auth/google/callback';
 if(request.method==='POST'&&(request.headers.get('Origin')!==env.LEAF_SITE_ORIGIN||request.headers.get('X-Leaf-Request')!=='1'))throw failure(403,'不正な操作');
 if(p==='/drive-settings'&&request.method==='GET')return new Response(settingsPage,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 const k=user+'/configuration';let config=await readSecret(env,k);
 if(p==='/api/drive/settings'&&request.method==='POST'){
 const data=await readBody(request);
 if(!/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(data.clientId)||typeof data.clientSecret!=='string'||!data.clientSecret||data.clientSecret.length>512)throw failure(400,'認証設定が不正です');
 if(config?.clientId!==data.clientId||config?.clientSecret!==data.clientSecret)await writeSecret(env,k,{clientId:data.clientId,clientSecret:data.clientSecret,revision:crypto.randomUUID()});
 return json({configured:true});
 }
 if(p==='/api/drive/session'&&request.method==='GET'){if(!config)return json({connected:false});try{await tokenFor(env,user,config);return json({connected:true})}catch{return json({connected:false})}}
 if(!config)throw failure(409,'Google接続設定が必要です');
 if(p==='/auth/google/start'&&request.method==='POST'){
 const nonce=random(), verifier=random();await writeSecret(env,user+'/pending',{nonce,verifier,revision:config.revision,expiresAt:Date.now()+600000});
 const q=new URLSearchParams({client_id:config.clientId,redirect_uri:callback,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state:nonce,code_challenge:await hash(verifier),code_challenge_method:'S256'});
 const res=json({authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?'+q});res.headers.set('Set-Cookie',cookie(nonce));return res;
 }
 if(p==='/auth/google/callback'&&request.method==='GET'){
 const pending=await readSecret(env,user+'/pending');const nonce=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-leaf-filer='))?.slice('__Host-leaf-filer='.length);
 if(!pending||pending.expiresAt<Date.now()||pending.revision!==config.revision||pending.nonce!==nonce||pending.nonce!==url.searchParams.get('state'))throw failure(403,'認証の確認に失敗');
 await env.BUCKET.delete(user+'/pending');if(!url.searchParams.get('code'))return redirect('/drive-settings',cookie(''));
 const t=await exchange({client_id:config.clientId,client_secret:config.clientSecret,code:url.searchParams.get('code'),code_verifier:pending.verifier,redirect_uri:callback,grant_type:'authorization_code'});
 if(!t.refresh_token||!t.scope?.split(' ').includes('https://www.googleapis.com/auth/drive'))throw failure(403,'必要な権限がありません');
 await writeSecret(env,user+'/tokens-'+config.revision,{accessToken:t.access_token,refreshToken:t.refresh_token,expiresAt:Date.now()+Number(t.expires_in)*1000});return redirect('/',cookie(''));
 }
 if(p==='/api/drive/request'&&request.method==='POST'){
 const method=request.headers.get('X-Leaf-Method'),target=driveTarget(request.headers.get('X-Leaf-URL'),method);
 const headers=new Headers({Authorization:'Bearer '+await tokenFor(env,user,config)});
 for(const h of ['Content-Type','Range','Content-Range','X-Upload-Content-Type','X-Upload-Content-Length'])if(request.headers.has(h))headers.set(h,request.headers.get(h));
 const res=await fetch(target,{method,headers,body:method==='GET'?undefined:request.body,redirect:'manual'});
 const out=new Headers({'Cache-Control':'no-store'});for(const h of ['Content-Type','Content-Range','Range','Location'])if(res.headers.has(h))out.set(h,res.headers.get(h));
 return new Response(res.body,{status:res.status,headers:out});
 }
 return json({error:'未対応'},404);
 }catch(e){return json({error:e.status?e.message:'処理に失敗しました'},e.status||500)}
}};
