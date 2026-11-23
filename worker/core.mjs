// Server-side Cloudinary request core. Deployment and real-provider validation are separate.
// The required gate and registry adapters must be durable, trusted server bindings.
// An in-memory Map is intentionally not accepted as a production quota/ownership store.
export async function sign(params,secret){
 const serialized=Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join('&');
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized+secret));
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export function createHandler({fetcher=fetch,now=()=>Date.now(),uuid=()=>crypto.randomUUID()}={}){
 return async function handle(request,env){
  const origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(!origin||origin!==env.ALLOWED_ORIGIN)return reply(403,{error:'ORIGIN_DENIED'});
  headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='Authorization,Content-Type';
  headers['Access-Control-Allow-Methods']='POST,DELETE,OPTIONS';
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!env.CLOUDINARY_CLOUD||!env.CLOUDINARY_KEY||!env.CLOUDINARY_SECRET||!env.FIREBASE_WEB_KEY||!env.GATE?.take||!env.REGISTRY?.put||!env.REGISTRY?.get||!env.REGISTRY?.remove||!env.REGISTRY?.postDeleted)return reply(503,{error:'ADAPTER_NOT_CONFIGURED'});
  const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return reply(401,{error:'AUTH_REQUIRED'});
  try{
   const auth=await fetcher('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(env.FIREBASE_WEB_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
   if(!auth.ok)return reply(401,{error:'AUTH_INVALID'});
   const user=(await auth.json()).users?.[0];
   if(!user?.localId||user.disabled||!user.emailVerified)return reply(403,{error:'VERIFIED_ACCOUNT_REQUIRED'});
   const uid=user.localId,path=new URL(request.url).pathname;
   if(request.method==='POST'&&path==='/upload'){
    if(!(await env.GATE.take(uid,'upload')))return reply(429,{error:'UPLOAD_LIMIT'});
    if(request.headers.get('Content-Type')!=='image/jpeg')return reply(415,{error:'JPEG_REQUIRED'});
    const reader=request.body?.getReader();if(!reader)return reply(400,{error:'EMPTY_IMAGE'});
    const chunks=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader.cancel();return reply(413,{error:'IMAGE_TOO_LARGE'})}chunks.push(value)}
    const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length}
    if(size<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return reply(415,{error:'JPEG_REQUIRED'});
    const id=uuid(),publicId='wamda/'+id;
    // No client-supplied public ID, fetch URL, transformations, folder or overwrite.
    const params={public_id:publicId,timestamp:Math.floor(now()/1000),overwrite:'false',moderation:'aws_rek'};
    const form=new FormData();for(const [k,v]of Object.entries(params))form.set(k,String(v));form.set('api_key',env.CLOUDINARY_KEY);form.set('signature',await sign(params,env.CLOUDINARY_SECRET));form.set('file',new Blob([bytes],{type:'image/jpeg'}),'image.jpg');
    const uploaded=await fetcher(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD)}/image/upload`,{method:'POST',body:form});
    if(!uploaded.ok)return reply(502,{error:'MEDIA_PROVIDER_FAILED'});
    const image=await uploaded.json();
    // Never release an image until this provider explicitly approves this screening.
    const moderation=image.moderation;
    if(!Array.isArray(moderation)||!moderation.some(x=>x.kind==='aws_rek'&&x.status==='approved')||moderation.some(x=>x.status!=='approved')){
     await destroy(publicId);return reply(422,{error:'IMAGE_NOT_APPROVED'});
    }
    const url=new URL(image.secure_url);
    if(image.public_id!==publicId||image.resource_type!=='image'||image.format!=='jpg'||image.bytes>2_000_000||image.width>1600||image.height>1600||url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||!url.pathname.startsWith('/'+env.CLOUDINARY_CLOUD+'/')){
     await destroy(publicId);return reply(502,{error:'MEDIA_RESULT_REJECTED'});
    }
    try{await env.REGISTRY.put(id,{ownerId:uid,url:image.secure_url,providerId:publicId,postId:'',createdAt:now()})}catch{await destroy(publicId);return reply(503,{error:'MEDIA_REGISTRATION_FAILED'})}
    return reply(201,{publicId:id,url:image.secure_url});
   }
   if(request.method==='DELETE'&&/^\/image\/[a-zA-Z0-9-]{1,64}$/.test(path)){
    const id=path.slice(7),item=await env.REGISTRY.get(id);
    if(!item||item.ownerId!==uid)return reply(404,{error:'MEDIA_NOT_FOUND'});
    if(item.postId&&!(await env.REGISTRY.postDeleted(item.postId,uid)))return reply(409,{error:'DELETE_POST_FIRST'});
    await destroy(item.providerId);await env.REGISTRY.remove(id);return reply(200,{deleted:true});
   }
   return reply(404,{error:'NOT_FOUND'});
   async function destroy(publicId){const params={invalidate:'true',public_id:publicId,timestamp:Math.floor(now()/1000)};const body=new URLSearchParams({...params,timestamp:String(params.timestamp),api_key:env.CLOUDINARY_KEY,signature:await sign(params,env.CLOUDINARY_SECRET)});const r=await fetcher(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD)}/image/destroy`,{method:'POST',body});if(!r.ok)throw Error('CLEANUP_FAILED');const result=await r.json();if(!['ok','not found'].includes(result.result))throw Error('CLEANUP_FAILED')}
  }catch{return reply(503,{error:'MEDIA_UNAVAILABLE_RETRY'})}
 };
}
export default {fetch:createHandler()};
