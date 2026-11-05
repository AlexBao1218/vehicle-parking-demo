import { useSyncExternalStore } from 'react';
import type { ApprovalRecord } from '@shared/api.interface';
import schema from '../../../source-schema.json';
export const companies = ['Company A', 'Company B'] as const;
export type Company = typeof companies[number];
export const fields = ['First Name','Last Name','Email Address','Employee ID','Cost Centres','Section Cost Center2','Section Head email address','Status','Mobile Country Code','Mobile Number','Section','Department','Position','G/L charge'];
export type User = {key:string; company:Company; values:string[]; rows:string[][]; source?:{file:string;sheet:string;rows:number[]}};
export type UberRequest = {company:Company; kind:'new'|'change'; userKey:string; before:string[]; after:string[]; selected:number[]; lookupEmail?:string; baseVersion?:string};
export type DemoPerson = {id?:string;name:string};
export const demoPeople:DemoPerson[] = [{id:'demo-self',name:'Demo Requester'}];
export type BatchRequestRow = {rowId:string;company:Company;email:string;values:string[];person:DemoPerson|null;notifyPerson?:DemoPerson|null;expectedKind?:'new'|'change';remarks?:string;checkToken?:string};
export type NotificationJob = {id:string;requestId:string;recipient:DemoPerson;recipientResolution:'needs_resolution';status:'simulated';createdAt:string;message:string};
export type BatchSubmission = {fingerprint:string;requestIds:string[];notificationIds:string[]};
export type Request = ApprovalRecord & {uber?:UberRequest;representedPerson?:DemoPerson;notifyPerson?:DemoPerson;submissionId?:string;submissionRowId?:string};
export type History = {id:string; requestId:string; company:Company; dataset:'main'|'group'|'expense'; time:string; action:string; before:string[][]; after:string[][]};
export type State = {notificationOutbox?:NotificationJob[];batchSubmissions?:Record<string,BatchSubmission>;demoMigrations?:string[]; users:User[]; requests:Request[]; group:Record<Company,string[][]>; expense:Record<Company,string[][]>; history:History[]; notes:Record<string,{text:string;time:string}>};
export const costs = (s:string) => [...new Set(s.split(',').map(v=>v.trim()).filter(Boolean))];
export function expand(v:string[]) {return costs(v[4]).map(c=>v.map((s,i)=>i===4?c:s));}
export function seed():State {
 const values=['Example','User','example.user@example.com','DEMO001','CC01','','reviewer@example.com','Active','','','Section A','Department A','Role A','GL01'];
 const after=[...values];after[4]='CC02';after[12]='Role B';
 const base={vehicleId:'',vehicleLicense:'Example User · Company A',changeType:'Uber · Change information',logFrom:'',logTo:'',effectiveDate:null,effectiveDateTs:null,remark:'',status:'待审批',applyTime:new Date().toISOString(),attachments:[],applicantName:'Demo Requester',editHistory:[],representedPerson:{name:'Example Representative'},notifyPerson:{name:'Example Reviewer'}};
 return {users:[{key:'example-a',company:'Company A',values,rows:expand(values)}],requests:[{...base,id:'example-change',uber:{company:'Company A',kind:'change',userKey:'example-a',before:[...values],after,selected:[4,12],baseVersion:JSON.stringify(values),lookupEmail:values[2]}}],group:{'Company A':[],'Company B':[]},expense:{'Company A':[],'Company B':[]},history:[],notes:{}};
}
const KEY='demo:uber-v1';
let current:State;
try {current=JSON.parse(localStorage.getItem(KEY)||'null')||seed();} catch {current=seed();}
const listeners=new Set<()=>void>();
export const getState=()=>current;
export function save(next:State) {if(typeof localStorage!=='undefined') localStorage.setItem(KEY,JSON.stringify(next));current=next;listeners.forEach(f=>f());}
export function mutate(fn:(s:State)=>void) {const next=structuredClone(current);fn(next);save(next);}
export function useDemo(){return useSyncExternalStore(f=>{listeners.add(f);return()=>{listeners.delete(f)}},getState);}
export function validate(v:string[],checkHead=true) {
 if([0,1,2,3,4].some(i=>!v[i]?.trim())) throw Error('Complete First Name, Last Name, Email Address, Employee ID and Cost Centres.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v[2])) throw Error('Enter a valid email address.');
 if(checkHead&&v[6]&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v[6])) throw Error('Enter a valid section head email address or leave it blank.');
 if(!costs(v[4]).length || /[，;；\t\n]/.test(v[4])) throw Error('Separate cost centres with English commas.');
}
export function submitUber(u:UberRequest) {u=structuredClone(u);u.after[3]=u.after[3].trim();u.selected=u.selected.filter(i=>i!==7);if(u.kind==='new')u.after[7]='';validate(u.after,u.kind==='new'||u.selected.includes(6));if(u.kind==='change'&&!u.selected.some(i=>u.before[i]!==u.after[i]))throw Error('Select at least one field and enter a changed value.');mutate(s=>{if(s.users.some(x=>x.company===u.company&&x.key!==u.userKey&&normalizeEmail(x.values[2])===normalizeEmail(u.after[2])))throw Error('This email already has an account in the selected company.');if(s.users.some(x=>x.company===u.company&&x.key!==u.userKey&&x.values[3].trim()===u.after[3]))throw Error('This employee ID already exists in the selected company.');s.requests.unshift({id:crypto.randomUUID(),vehicleId:'',vehicleLicense:`${u.after[0]} ${u.after[1]} · ${u.company}`,changeType:`Uber · ${u.kind==='new'?'New account':'Change user information'}`,logFrom:'',logTo:'',effectiveDate:null,effectiveDateTs:null,remark:'',status:'待审批',applyTime:new Date().toISOString(),attachments:[],applicantName:'Demo Requester',editHistory:[],uber:structuredClone(u)});});}
export function decide(s:State,id:string,approve:boolean,comment='') {
 const r=s.requests.find(r=>r.id===id);if(!r||r.status!=='待审批')throw Error('This request is no longer pending.');
 const time=new Date().toISOString();
 if(approve&&r.uber){const u=r.uber;u.after[3]=u.after[3].trim();u.selected=u.selected.filter(i=>i!==7);if(u.kind==='new')u.after[7]='';validate(u.after,u.kind==='new'||u.selected.includes(6));if(s.users.some(x=>x.company===u.company&&x.key!==u.userKey&&normalizeEmail(x.values[2])===normalizeEmail(u.after[2])))throw Error('This email already has an account in the selected company.');if(s.users.some(x=>x.company===u.company&&x.key!==u.userKey&&x.values[3].trim()===u.after[3]))throw Error('Employee ID already exists in this company.');
 const log=(dataset:History['dataset'],action:string,before:string[][],after:string[][])=>s.history.unshift({id:crypto.randomUUID(),requestId:id,company:u.company,dataset,time,action,before:structuredClone(before),after:structuredClone(after)});
 if(u.kind==='new'){
  if(s.users.some(x=>x.key===u.userKey))throw Error('User already created.');
  const rows=expand(u.after);s.users.push({key:u.userKey,company:u.company,values:[...u.after],rows});log('main','Add user',[],rows);
  // Preview mapping only: one group row per cost centre; Reviewer Email left blank pending confirmation.
  const groups=costs(u.after[4]).map(c=>[u.after[0],u.after[1],u.after[2],u.after[3],c,'',u.after[8],u.after[9]]);
  s.group[u.company].push(...groups);log('group','Append group rows',[],groups);
  const expenses=costs(u.after[4]).map(c=>[c,'',u.after[2]]);s.expense[u.company].push(...expenses);log('expense','Append expense rows',[],expenses);
 }else{
  const target=s.users.find(x=>x.key===u.userKey&&x.company===u.company);if(!target)throw Error('Original user record was not found.');
  if((u.baseVersion&&u.baseVersion!==JSON.stringify(target.values))||u.selected.some(i=>target.values[i]!==u.before[i]))throw Error('Current Base data changed since submission. Review and resubmit the request before approving.');
  const before=structuredClone(target.rows);u.selected.forEach(i=>target.values[i]=u.after[i]);target.rows=expand(target.values);log('main','Change user information',before,target.rows);
 }
 }
 r.status=approve?'已批准':'已拒絕';r.approvalTime=time;r.approvalComment=comment;r.approverName='Demo Admin';
}
export function tableData(s:State,c:Company,d:History['dataset']) {return {headers:d==='main'?schema[c].mainHeaders:d==='group'?schema[c].groupHeaders:schema[c].expenseHeaders,rows:d==='main'?s.users.filter(u=>u.company===c).flatMap(u=>u.rows):s[d][c]};}
export function tsv(rows:string[][]) {return rows.map(row=>row.map(v=>/["\t\r\n]/.test(v)?`"${v.replaceAll('"','""')}"`:v).join('\t')).join('\n');}

export function editUberRequest(id:string,proposed:string[]) {
 let updated:Request|undefined;
 mutate(s=>{
  const r=s.requests.find(r=>r.id===id);
  if(!r?.uber||r.status!=='待审批')throw Error('Only pending Uber requests can be edited.');
  const u=r.uber;const after=[...u.after];
  fields.forEach((_,i)=>{if(i!==5&&i!==7)after[i]=proposed[i]??''});after[3]=after[3].trim();
  validate(after,u.kind==='new'||after[6]!==u.before[6]);
  if(s.users.some(x=>x.company===u.company&&x.key!==u.userKey&&normalizeEmail(x.values[2])===normalizeEmail(after[2])))throw Error('This email already has an account in the selected company.');if(s.users.some(x=>x.company===u.company&&x.key!==u.userKey&&x.values[3].trim()===after[3]))throw Error('This employee ID already exists in the selected company.');
  const changes=fields.flatMap((_,i)=>after[i]===u.after[i]?[]:[{field:`uber.${i}` as `uber.${number}`,from:u.after[i],to:after[i]}]);
  if(changes.length){r.editHistory.push({editedAt:new Date().toISOString(),editedBy:'Demo Admin',changes});u.after=after;u.selected=[...new Set([...u.selected,...changes.map(ch=>Number(ch.field.slice(5)))])].filter(i=>i!==5&&i!==7);r.vehicleLicense=`${after[0]} ${after[1]} · ${u.company}`;}
  updated=r;
 });
 return updated!;
}

// Local mock boundary. Production must perform lookup, identity checks and mutation
// server-side; only this minimal response may reach an ordinary user's client.
export const normalizeEmail=(email:string)=>email.trim().toLowerCase();
export type AccountCheck={token:string;company:Company;email:string;exists:boolean};
type CheckSnapshot=AccountCheck & {userKey?:string;before?:string[];ambiguous:boolean};
const accountChecks=new Map<string,CheckSnapshot>();
export function checkAccountEmail(company:Company,email:string):AccountCheck {
 const normalized=normalizeEmail(email);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw Error('Enter a valid email address.');
 const matches=current.users.filter(u=>u.company===company&&normalizeEmail(u.values[2])===normalized);
 const check={token:crypto.randomUUID(),company,email:normalized,exists:matches.length>0};
 accountChecks.set(check.token,{...check,userKey:matches.length===1?matches[0].key:undefined,before:matches.length===1?[...matches[0].values]:undefined,ambiguous:matches.length>1});
 return check;
}
// Local demo only: production must enforce this check on the server.
export function publicRequest(record:Request):Request {
 if(!record.uber)return structuredClone(record);
 const u=record.uber;
 return {...structuredClone(record),vehicleLicense:`Uber request · ${u.company}`,editHistory:[],uber:{company:u.company,kind:u.kind,userKey:'',before:[],after:fields.map((_,i)=>u.selected.includes(i)?u.after[i]:''),selected:[...u.selected],lookupEmail:u.lookupEmail}};
}
export function changeSignal(currentValue:string,requested:string,selected:boolean){if(!selected)return 'Not requested';if(currentValue===requested)return 'Unchanged';if(!currentValue&&requested)return 'Added';if(currentValue&&!requested)return 'Removed';return 'Changed';}

/** Atomic local batch submission. The outbox is a preview; it never sends Feishu messages. */
export function submitAccountBatch(rows:BatchRequestRow[],submissionId:string):{requests:Request[];notifications:NotificationJob[]} {
 if(!submissionId.trim())throw Error('A submission identifier is required.');
 const populated=rows.map((row,index)=>({row,index})).filter(({row})=>!!(row.email.trim()||row.person||row.notifyPerson||row.remarks?.trim()||row.values.some(v=>v.trim())));
 if(!populated.length)throw Error('Complete at least one request row.');
 // Tokens are transient; durable replay identity is based on submitted values and selected people.
 const fingerprint=JSON.stringify(populated.map(({row})=>({rowId:row.rowId,company:row.company,email:normalizeEmail(row.email),values:row.values,person:row.person,notifyPerson:row.notifyPerson,expectedKind:row.expectedKind,remarks:row.remarks??''})));
 const prior=current.batchSubmissions?.[submissionId];
 if(prior){
  if(prior.fingerprint!==fingerprint)throw Error('This submission identifier was already used for different rows. Start a new submission.');
  return {requests:structuredClone(prior.requestIds.map(id=>current.requests.find(r=>r.id===id)).filter((r):r is Request=>!!r)),notifications:structuredClone((current.notificationOutbox??[]).filter(j=>prior.notificationIds.includes(j.id)))};
 }
 const prepared:Request[]=[];const checkedAccounts=new Set<string>();const rowIds=new Set<string>();
 const time=new Date().toISOString();
 for(const {row,index} of populated){
  try {
   if(!row.rowId||rowIds.has(row.rowId))throw Error('Each request row must have a unique identifier.');
   rowIds.add(row.rowId);
   if(!companies.includes(row.company))throw Error('Select a valid company.');
   const email=normalizeEmail(row.email);
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid account email address.');
   const name=row.person?.name.trim();
   if(!name)throw Error('Enter the name of the person represented by this request.');
   // A typed name is not a verified Feishu recipient ID. Resolve separately before real delivery.
   const person:DemoPerson={name};
   const notifyName=row.notifyPerson?.name.trim();
   if(!notifyName)throw Error('Enter the name of the person to notify.');
   const notifyPerson:DemoPerson={name:notifyName};
   const accountKey=`${row.company}\n${email}`;
   if(checkedAccounts.has(accountKey))throw Error('This account already appears in this batch.');
   checkedAccounts.add(accountKey);
   const matches=current.users.filter(u=>u.company===row.company&&normalizeEmail(u.values[2])===email);
   if(matches.length>1)throw Error('This account needs administrator review before a request can be submitted.');
   const target=matches[0];
   if(row.expectedKind==='new'&&target)throw Error('This email already has an account. Use Change information.');
   if(row.expectedKind==='change'&&!target)throw Error('No account was found for this email. Use New account.');
   if(row.checkToken){
    const check=accountChecks.get(row.checkToken);
    if(!check||check.company!==row.company||check.email!==email)throw Error('Check this row again before submitting.');
    if(check.ambiguous||check.exists!==!!target||(target&&(check.userKey!==target.key||JSON.stringify(check.before)!==JSON.stringify(target.values))))throw Error('Account information changed. Check this row again before submitting.');
   }
   const values=Array.from({length:14},(_,i)=>row.values[i]??'');
   let uber:UberRequest;
   if(target){
    const before=[...target.values],after=[...before],selected:number[]=[];
    fields.forEach((_,i)=>{if(i!==5&&i!==7&&values[i].trim()){after[i]=(i===2||i===3)?values[i].trim():values[i];selected.push(i)}});
    if(!selected.some(i=>before[i]!==after[i]))throw Error('Enter at least one changed value. Blank fields keep the current information.');
    validate(after,selected.includes(6));
    uber={company:row.company,kind:'change',userKey:target.key,before,after,selected,lookupEmail:email,baseVersion:JSON.stringify(before)};
   }else{
    if(values[2].trim()&&normalizeEmail(values[2])!==email)throw Error('A replacement email is only available for an existing account. Use Account email for a new account.');
    values[2]=email;values[3]=values[3].trim();values[5]='';values[7]='';validate(values);
    uber={company:row.company,kind:'new',userKey:crypto.randomUUID(),before:[],after:values,selected:fields.map((_,i)=>i).filter(i=>i!==5&&i!==7),lookupEmail:email};
   }
   if(current.users.some(u=>u.company===row.company&&u.key!==uber.userKey&&normalizeEmail(u.values[2])===normalizeEmail(uber.after[2]))||prepared.some(r=>r.uber!.company===row.company&&normalizeEmail(r.uber!.after[2])===normalizeEmail(uber.after[2])))throw Error('The requested email already belongs to another account or batch row.');
   if(current.users.some(u=>u.company===row.company&&u.key!==uber.userKey&&u.values[3].trim()===uber.after[3].trim())||prepared.some(r=>r.uber!.company===row.company&&r.uber!.after[3].trim()===uber.after[3].trim()))throw Error('The employee ID already belongs to another account or batch row.');
   prepared.push({id:crypto.randomUUID(),vehicleId:'',vehicleLicense:`${uber.after[0]} ${uber.after[1]} · ${row.company}`,changeType:`Uber · ${uber.kind==='new'?'New account':'Change user information'}`,logFrom:'',logTo:'',effectiveDate:null,effectiveDateTs:null,remark:row.remarks?.trim()??'',status:'待审批',applyTime:time,attachments:[],applicantName:'Demo Requester',editHistory:[],uber,representedPerson:{...person},notifyPerson,submissionId,submissionRowId:row.rowId});
  }catch(error){throw Error(`Row ${index+1}: ${(error as Error).message}`)}
 }
 const notifications:NotificationJob[]=prepared.map(r=>({id:`${r.id}:submitted`,requestId:r.id,recipient:{...r.notifyPerson!},recipientResolution:'needs_resolution',status:'simulated',createdAt:time,message:`${r.representedPerson!.name} submitted an Uber ${r.uber!.kind==='new'?'new account':'information change'} request. Company: ${r.uber!.company}. Request: ${r.id}. Status: Pending approval.`}));
 const next=structuredClone(current);
 next.requests.unshift(...prepared);
 next.notificationOutbox=[...(next.notificationOutbox??[]),...notifications];
 next.batchSubmissions={...(next.batchSubmissions??{}),[submissionId]:{fingerprint,requestIds:prepared.map(r=>r.id),notificationIds:notifications.map(j=>j.id)}};
 save(next);
 populated.forEach(({row})=>{if(row.checkToken)accountChecks.delete(row.checkToken)});
 return {requests:structuredClone(prepared),notifications:structuredClone(notifications)};
}
