const SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER = 'application/vnd.google-apps.folder';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const base64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unbase64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));
const random = () => base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const failure = (status, message) => Object.assign(new Error(message), {status});
const connectionFailure = code => Object.assign(failure(401,'Googleとの接続を完了できませんでした。接続設定を確認してください。'),{connectionCode:code});
const json = (body, status = 200) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const redirect = (path, cookie) => new Response(null,{status:303,headers:{Location:path,...(cookie ? {'Set-Cookie':cookie} : {})}});
const cookie = value => '__Host-leaf-filer=' + value + '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=' + (value ? '600' : '0');
async function hash(text) { return base64(await crypto.subtle.digest('SHA-256',encoder.encode(text))).replaceAll('/','_').replaceAll('+','-').replaceAll('=',''); }

// 追加: 保存先と利用者を暗号文に結び付け、鍵はサーバーの秘密設定から取得。
async function cryptKey(env) {
  if (!env.LEAF_SECRET_KEY || !env.BUCKET) throw failure(503,'安全な保存先の準備が完了していません。');
  return crypto.subtle.importKey('raw', unbase64(env.LEAF_SECRET_KEY), 'AES-GCM', false, ['encrypt','decrypt']);
}
async function writeSecret(env, path, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(path)},await cryptKey(env),encoder.encode(JSON.stringify(value)));
  await env.BUCKET.put(path, JSON.stringify({iv:base64(iv),data:base64(encrypted)}));
}
async function readSecret(env, path) {
  const key = await cryptKey(env);
  const object = await env.BUCKET.get(path);
  if (!object) return null;
  const blob = await object.json();
  return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(blob.iv),additionalData:encoder.encode(path)},key,unbase64(blob.data))));
}
function identity(request, env) {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (!id || !env.LEAF_OWNER_EMAIL || email?.toLowerCase() !== env.LEAF_OWNER_EMAIL.toLowerCase()) throw failure(403,'リーフファイラの所有者としてログインしてください。');
  return id;
}
async function readBody(request, maximum = 8192) {
  const reader = request.body?.getReader();
  if (!reader) throw failure(400,'入力内容がありません。');
  let size = 0; const chunks = [];
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    size += value.length;
    if (size > maximum) { await reader.cancel(); throw failure(413,'送信内容が大きすぎます。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  try { return JSON.parse(decoder.decode(bytes)); } catch { throw failure(400,'入力形式を確認してください。'); }
}
async function exchange(values) {
  let response, data;
  try {
    // Workers supports manual redirects; never forward credentials to a redirect target.
    response = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values),redirect:'manual'});
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw connectionFailure('google_unavailable');
    }
    data = await response.json();
  } catch (error) { throw error.connectionCode ? error : connectionFailure('network'); }
  if (!response.ok) {
    const known = ['invalid_client','invalid_grant','redirect_uri_mismatch','unauthorized_client','invalid_request'];
    throw connectionFailure(known.includes(data.error) ? data.error : 'google_unavailable');
  }
  if (!data.access_token || !Number.isFinite(Number(data.expires_in))) throw connectionFailure('invalid_response');
  return data;
}
async function tokenFor(env, user, config, renew = false) {
  const path = user + '/tokens-' + config.revision;
  const tokens = await readSecret(env,path);
  if (!tokens?.refreshToken) throw failure(401,'接続設定からGoogleドライブへ接続してください。');
  if (!renew && tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
  const next = await exchange({client_id:config.clientId,client_secret:config.clientSecret,refresh_token:tokens.refreshToken,grant_type:'refresh_token'});
  await writeSecret(env,path,{accessToken:next.access_token,refreshToken:next.refresh_token || tokens.refreshToken,expiresAt:Date.now()+Number(next.expires_in)*1000});
  return next.access_token;
}
export {identity, readSecret, writeSecret, exchange, tokenFor, random, hash, readBody, cookie, json, redirect, failure};
