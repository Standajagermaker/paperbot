import {createHmac,timingSafeEqual} from 'node:crypto';
const COOKIE='paperbot_admin';
function secret(){return process.env.PAPERBOT_ADMIN_PASSWORD||'';}
function mac(s){return createHmac('sha256',secret()).update(s).digest('hex');}
export function isAdmin(req){
 if(secret().length<12)return false;
 const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!token)return false;
 const [expiry,signature]=token.split('.');
 if(!/^\d+$/.test(expiry||'')||!signature||Date.now()>Number(expiry))return false;
 const expected=Buffer.from(mac(expiry),'hex'),actual=Buffer.from(signature,'hex');
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export function sameOrigin(req){
 const origin=req.headers.origin;
 if(!origin)return false;
 try{return new URL(origin).host===req.headers.host&&new URL(origin).protocol==='https:';}catch{return false;}
}
export function issueCookie(res){
 const expiry=String(Date.now()+12*60*60*1000);
 res.setHeader('Set-Cookie',COOKIE+'='+expiry+'.'+mac(expiry)+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200');
}
export function clearCookie(res){res.setHeader('Set-Cookie',COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');}
export function checkPassword(value){
 const a=Buffer.from(String(value||'')),b=Buffer.from(secret());
 return b.length>=12&&a.length===b.length&&timingSafeEqual(a,b);
}
