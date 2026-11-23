// Local-only image test adapter. Never connects to Cloudinary or any remote production service.
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
const store=new Map(),counts=new Map();
const registry='http://127.0.0.1:8188/v1/projects/demo-wamda/databases/(default)/documents/';
const admin={Authorization:'Bearer owner'};
export function startMedia(port=8788){return new Promise(resolve=>{const server=createServer(async(req,res)=>{
 const origin=req.headers.origin||'';if(origin&&!/^http:\/\/(127\.0\.0\.1|localhost):4319$/.test(origin)){res.writeHead(403);res.end();return}
 res.setHeader('Access-Control-Allow-Origin',origin||'http://127.0.0.1:4319');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','POST,GET,DELETE,OPTIONS');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 const path=new URL(req.url,'http://local').pathname;
 if(req.method==='GET'&&path.startsWith('/image/')){const item=store.get(path.slice(7));if(!item){res.writeHead(404);res.end();return}res.setHeader('Content-Type','image/jpeg');res.end(item.bytes);return}
 try{
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');if(!token)throw Error('AUTH_REQUIRED');
 const r=await fetch('http://127.0.0.1:9198/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-only-not-a-production-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});const auth=await r.json();const uid=auth.users?.[0]?.localId;if(!uid)throw Error('AUTH_INVALID');
 if(req.method==='DELETE'){const id=path.slice(7),item=store.get(id);const reg=await fetch(registry+'uploads/'+id,{headers:admin});if(reg.status===404&&!item){res.end(JSON.stringify({deleted:true}));return}if(!reg.ok)throw Error('REGISTRY_UNAVAILABLE');const fields=(await reg.json()).fields;if(fields?.ownerId?.stringValue!==uid||(item&&item.uid!==uid))throw Error('OWNER_REQUIRED');const pid=fields?.postId?.stringValue;if(pid){const post=await fetch(registry+'posts/'+pid,{headers:admin});const p=(await post.json()).fields;if(p?.authorId?.stringValue!==uid||p?.status?.stringValue!=='deleted')throw Error('DELETE_POST_FIRST')}const removed=await fetch(registry+'uploads/'+id,{method:'DELETE',headers:admin});if(!removed.ok)throw Error('REGISTRY_DELETE_FAILED');store.delete(id);res.end(JSON.stringify({deleted:true}));return}
 if(req.method!=='POST'||path!=='/upload')throw Error('NOT_FOUND');
 const key=uid+':'+Math.floor(Date.now()/60000);if((counts.get(key)||0)>=5)throw Error('RATE_LIMIT');
 const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>2_800_000)throw Error('IMAGE_TOO_LARGE');chunks.push(c)}
 const data=JSON.parse(Buffer.concat(chunks));const bytes=Buffer.from(data.base64||'','base64');if(bytes.length>2_000_000||bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('JPEG_REQUIRED');
 counts.set(key,(counts.get(key)||0)+1);const id=randomUUID();store.set(id,{uid,bytes});const url=`http://127.0.0.1:${port}/image/${id}`;const saved=await fetch(`http://127.0.0.1:8188/v1/projects/demo-wamda/databases/(default)/documents/uploads/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer owner'},body:JSON.stringify({fields:{ownerId:{stringValue:uid},url:{stringValue:url},postId:{stringValue:''}}})});if(!saved.ok){store.delete(id);throw Error('REGISTER_FAILED')}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:`http://127.0.0.1:${port}/image/${id}`,publicId:id,mode:'local-test'}));
 }catch(e){res.writeHead(String(e.message).includes('RATE')?429:400);res.end(JSON.stringify({error:e.message}))}
 }).listen(port,'127.0.0.1',()=>resolve(server))})}
