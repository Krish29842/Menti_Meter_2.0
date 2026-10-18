import { io } from 'socket.io-client';
const BASE='http://localhost:4000';
async function api(method,path,{token,body}={}){const res=await fetch(`${BASE}/api${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:res.status,data:await res.json().catch(()=>null)};}
function connect(token){return io(BASE,{auth:{token},transports:['websocket']});}
function waitFor(s,ev,t=8000){return new Promise((res,rej)=>{const tm=setTimeout(()=>rej(new Error('timeout '+ev)),t);s.once(ev,(p)=>{clearTimeout(tm);res(p);});});}
function ack(s,ev,p,t=8000){return new Promise((res,rej)=>{const tm=setTimeout(()=>rej(new Error('ack timeout')),t);s.emit(ev,p,(r)=>{clearTimeout(tm);r?.ok?res(r.data):rej(new Error(r?.error||'fail'));});});}
const demo=await api('POST','/auth/demo');const hostToken=demo.data.token;
const q=await api('POST','/quizzes',{token:hostToken,body:{title:'Dbg',questions:[{prompt:'Secret prompt that hosts must not see live',timeLimitSec:10,options:[{text:'Alpha',isCorrect:true},{text:'Beta',isCorrect:false}]}]}});
const host=connect(hostToken);await waitFor(host,'connect');
const {session}=await ack(host,'session:create',{quizId:q.data.quiz.id});
const student=connect(null);await waitFor(student,'connect');
const jd=await ack(student,'session:join',{code:session.code,name:'x',displayName:'DbgStudent',avatar:'??'});
const s2=connect(jd.token);await waitFor(s2,'connect');await ack(s2,'session:bind-student',{sessionId:session.id});
const closedP=waitFor(host,'question:closed');
const openP=waitFor(s2,'question:open');
await ack(host,'session:start',{sessionId:session.id});
const open=await openP;
await ack(s2,'answer:submit',{sessionId:session.id,questionId:open.studentDTO.questionId,optionId:open.studentDTO.options[0].id});
const closed=await closedP;
console.log(JSON.stringify(closed,null,2).slice(0,3000));
const endP=waitFor(s2,'session:ended');
await ack(host,'session:end',{sessionId:session.id});
console.log('STUDENT END:',JSON.stringify(await endP).slice(0,800));
process.exit(0);
