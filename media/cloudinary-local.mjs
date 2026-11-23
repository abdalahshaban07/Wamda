// Explicit opt-in, loopback-only integration. Uses real Cloudinary, demo Firebase only.
// Credential stays in a private external file. No secret is served to the browser.
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../worker/core.mjs';
const base='http://127.0.0.1:8188/v1/projects/demo-wamda/databases/(default)/documents/';
const headers={Authorization:'Bearer owner','Content-Type':'application/json'};
export async function startCloudinary({credentialPath,stateDir,port=8788,maxUploads=1}){
 if(!credentialPath||!stateDir||maxUploads!==1)throw Error('EXPLICIT_ONE_IMAGE_TEST_ONLY');
 const credential=new URL(readFileSync(credentialPath,'utf8').trim());
 if(credential.protocol!=='cloudinary:'||!credential.username||!credential.password||!credential.hostname)throw Error('INVALID_CREDENTIAL_FORMAT');
 // Refuse to start unless both intended emulators are running.
 for(const url of ['http://127.0.0.1:9198/emulator/v1/projects/demo-wamda/accounts',base+'uploads']){
  const r=await fetch(url,{headers});if(!r.ok)throw Error('DEMO_EMULATORS_REQUIRED');
 }
 mkdirSync(stateDir,{recursive:true,mode:0o700});
 const db=new DatabaseSync(stateDir+'/quota.sqlite');db.exec('CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY, uid TEXT, created INTEGER)');
 const insert=db.prepare('INSERT INTO attempts(uid,created) SELECT ?,? WHERE (SELECT count(*) FROM attempts)<1');
 const readDoc=async(path)=>{const r=await fetch(base+path,{headers});if(r.status===404)return null;if(!r.ok)throw Error('REGISTRY_UNAVAILABLE');return (await r.json()).fields};
 const env={ALLOWED_ORIGIN:'http://127.0.0.1:4319',CLOUDINARY_CLOUD:credential.hostname,CLOUDINARY_KEY:decodeURIComponent(credential.username),CLOUDINARY_SECRET:decodeURIComponent(credential.password),FIREBASE_WEB_KEY:'demo-only-not-a-production-key',
 GATE:{take:async uid=>Number(insert.run(uid,Date.now()).changes)===1},
 REGISTRY:{put:async(id,item)=>{const r=await fetch(base+'uploads/'+id,{method:'PATCH',headers,body:JSON.stringify({fields:Object.fromEntries(Object.entries(item).map(([k,v])=>[k,typeof v==='number'?{integerValue:String(v)}:{stringValue:v}]))})});if(!r.ok)throw Error('REGISTER_FAILED')},
 get:async id=>{const f=await readDoc('uploads/'+id);return f?Object.fromEntries(Object.entries(f).map(([k,v])=>[k,v.stringValue??Number(v.integerValue)])):null},
 remove:async id=>{const r=await fetch(base+'uploads/'+id,{method:'DELETE',headers});if(!r.ok&&r.status!==404)throw Error('REGISTRY_DELETE_FAILED')},
 postDeleted:async(id,uid)=>{const p=await readDoc('posts/'+id);return p?.authorId?.stringValue===uid&&p?.status?.stringValue==='deleted'}}};
 const handle=createHandler({fetcher:(url,opts)=>fetch(url.startsWith('https://identitytoolkit.googleapis.com/')?'http://127.0.0.1:9198/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-only-not-a-production-key':url,opts)});
 const server=createServer(async(req,res)=>{try{
  const origin=req.headers.origin||'';
  const requestHeaders={'Origin':origin,'Authorization':req.headers.authorization||'','Content-Type':'image/jpeg'};
  let body;
  if(req.method==='POST'){
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>2_800_000)throw Error('IMAGE_TOO_LARGE');chunks.push(c)}
   const data=JSON.parse(Buffer.concat(chunks));body=Buffer.from(data.base64||'','base64');
  }
  const r=await handle(new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:requestHeaders,...(body?{body}: {})}),env);
  res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'LOCAL_ADAPTER_REQUEST_FAILED'}))}});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));return server;
}
if(import.meta.url===new URL('file:'+process.argv[1]).href){
 await startCloudinary({credentialPath:process.env.WAMDA_CLOUDINARY_CREDENTIAL_FILE,stateDir:process.env.WAMDA_PRIVATE_STATE_DIR});
 console.log('One-image Cloudinary test adapter listening on loopback8788. Demo Firebase only.');
}
