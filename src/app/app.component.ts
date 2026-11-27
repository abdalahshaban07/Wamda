import { Component, OnInit, HostListener, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import {SocialService,SocialPost} from './social.service';
@Component({standalone:false,changeDetection:ChangeDetectionStrategy.Default,selector:'app-root',templateUrl:'./app.component.html',styleUrls:['./app.component.scss']})
export class AppComponent implements OnInit {
 constructor(public s:SocialService,private cd:ChangeDetectorRef){} view='auth';lang='ar';q='';category='all';selected:SocialPost|null=null;profileId='';
 newPassword='';image='';mediaId='';uploading=false;notice='';busy=false;fatal='';email='';password='';name='';signup=false;bio='';title='';body='';link='';postCategory='design';comment='';newCollection='';destination='inbox';filterCollection='all';reportReason='spam';reportDone=false;confirmDelete='';
 theme='dark';
 applyTheme(){document.documentElement.dataset['theme']=this.theme}
 toggleTheme(){this.theme=this.theme==='dark'?'light':'dark';this.applyTheme();try{localStorage.setItem('wamda-theme',this.theme)}catch{}}
 async ngOnInit(){try{const saved=localStorage.getItem('wamda-theme');this.theme=saved==='light'||saved==='dark'?saved:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch{}this.applyTheme();document.title='ومضة | Wamda';this.applyLang();try{await this.s.init()}catch(e){this.fatal=this.message(e)}}
 t(ar:string,en:string){return this.lang==='ar'?ar:en} applyLang(){document.documentElement.lang=this.lang;document.documentElement.dir=this.lang==='ar'?'rtl':'ltr'}
 language(){this.lang=this.lang==='ar'?'en':'ar';this.notice='';this.applyLang()}
 reload(){window.location.reload()}
 message(e:any){return String(e?.code||e?.message||'Unknown error')}
 async act(fn:()=>Promise<any>,success=''){if(this.busy)return;this.busy=true;this.notice='';try{await fn();this.notice=success}catch(e){this.notice=this.t('ما اتحفظش. ','Not saved. ')+this.message(e)}finally{this.busy=false;this.cd.detectChanges()}}
 go(view:string){this.close();this.view=this.s.user?view:'auth';this.notice='';this.q='';this.category='all';this.confirmDelete='';window.scrollTo(0,0);if(view==='profile'&&this.s.user){this.name=this.s.profiles[this.s.user.uid]?.name||'';this.bio=this.s.profiles[this.s.user.uid]?.bio||''}}
 get visible(){return (this.view==='saved'?this.s.savedPosts:this.s.posts).filter(p=>(this.view!=='saved'||!!this.s.saved[p.id])&&(this.view!=='person'||p.authorId===this.profileId)&&(this.view!=='saved'||this.filterCollection==='all'||this.s.saved[p.id]===this.filterCollection)&&(this.category==='all'||p.category===this.category)&&(!this.q||[p.title,p.body,this.s.name(p.authorId)].join(' ').toLowerCase().includes(this.q.toLowerCase())))}
 get collectionList(){return Object.entries(this.s.collections).map(([id,name])=>({id,name}))}
 get savedCount(){return Object.keys(this.s.saved).length}
 label(cat:string){return ({all:this.t('الكل','All'),design:this.t('تصميم','Design'),architecture:this.t('عمارة','Architecture'),stories:this.t('حكايات','Stories')} as any)[cat]||cat}
 async login(){if(this.signup&&(!this.name.trim()||this.name.length>60)){this.notice=this.t('اكتب اسمك، بحد أقصى ٦٠ حرف.','Enter a name up to 60 characters.');return}await this.act(async()=>{await this.s.login(this.email,this.password,this.name,this.signup);this.password='';this.go('discover')},this.t('أهلًا بيك.','Welcome.'))}
 async changePassword(){await this.act(async()=>{await this.s.changePassword(this.newPassword);this.newPassword=''},this.t('كلمة المرور اتغيرت.','Password changed.'))}
 async publish(){if(!this.title.trim()||!this.body.trim()){this.notice=this.t('اكتب عنوانًا وفكرتك.','Add a title and your idea.');return}if(this.link&&!/^https:\/\//i.test(this.link)){this.notice=this.t('الرابط لازم يبدأ بـhttps://','Use an https:// link.');return}await this.act(async()=>{await this.s.publish(this.title,this.body,this.postCategory,this.link,this.image,this.mediaId);this.image='';this.mediaId='';this.title='';this.body='';this.link='';this.go('discover')},this.t('الفكرة اتنشرت.','Published.'))}
 async chooseImage(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8_000_000){this.notice=this.t('اختار صورة JPG أو PNG أو WebP أقل من ٨ ميجابايت.','Choose a JPG, PNG or WebP below 8MB.');return}this.uploading=true;await this.act(async()=>{const bitmap=await createImageBitmap(file);let edge=1200,quality=.82,blob:Blob|null=null;const canvas=document.createElement('canvas');
 for(let attempt=0;attempt<10;attempt++){const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(Error('Image processing failed')),'image/jpeg',quality));if(blob.size<=150000)break;quality=Math.max(.40,quality-.12);edge=Math.round(edge*.85);}bitmap.close();if(!blob||blob.size>150000)throw Error('Image too detailed. Choose a smaller image.');const media=await this.s.upload(blob);this.image=media.url;this.mediaId=media.publicId},this.t('الصورة جاهزة، هتتحفظ مع نشر البوست.','Image ready. It will be saved when you publish.'));this.uploading=false;this.cd.detectChanges()}
 open(p:SocialPost){this.selected=p;this.reportDone=false;this.reportReason='spam';this.confirmDelete='';this.destination=this.s.saved[p.id]||'inbox';this.s.watch(p.id);setTimeout(()=>{(document.getElementById('reader') as HTMLDialogElement)?.showModal()})}
 close(){(document.getElementById('reader') as HTMLDialogElement)?.close();this.selected=null;this.s.unwatch()}
 @HostListener('window:wamda-auth',['$event']) authChanged(event:any){this.close();this.view=event.detail?'discover':'auth';this.cd.detectChanges()}
 @HostListener('document:keydown.escape') escape(){this.close()}
 person(uid:string){this.profileId=uid;this.go('person')}
 async remove(p:SocialPost){await this.act(async()=>{await this.s.remove(p);this.close()},this.t('المنشور اتحذف.','Post deleted.'))}
 async addComment(){if(!this.selected||!this.comment.trim())return;await this.act(async()=>{await this.s.comment(this.selected!.id,this.comment);this.comment=''},this.t('التعليق اتضاف.','Comment added.'))}
 async addCollection(){if(!this.newCollection.trim())return;await this.act(async()=>{await this.s.createCollection(this.newCollection);this.newCollection=''},this.t('المجموعة اتعملت.','Collection created.'))}
 async report(){if(!this.selected)return;await this.act(async()=>{await this.s.report(this.selected!.id,this.reportReason);this.reportDone=true},this.t('البلاغ وصل لقائمة المراجعة في الاختبار.','Report sent to the test moderation queue.'))}
 count(id:string){return Object.values(this.s.saved).filter(x=>x===id).length}
}
