import {isAdmin,sameOrigin,issueCookie,clearCookie,checkPassword} from '../../lib/paperbot-admin';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET')return res.status(200).json({ok:true,authenticated:isAdmin(req),configured:Boolean(process.env.PAPERBOT_ADMIN_PASSWORD&&process.env.PAPERBOT_ADMIN_PASSWORD.length>=12)});
 if(req.method!=='POST'||!sameOrigin(req))return res.status(403).json({ok:false,error:'Forbidden'});
 if(req.body?.action==='logout'){clearCookie(res);return res.status(200).json({ok:true,authenticated:false});}
 if(!checkPassword(req.body?.password))return res.status(401).json({ok:false,error:'Incorrect administrator password'});
 issueCookie(res);return res.status(200).json({ok:true,authenticated:true});
}
