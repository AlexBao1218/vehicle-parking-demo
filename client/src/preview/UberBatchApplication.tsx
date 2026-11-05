import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Plus,Trash2,CheckCircle,ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Input} from '@/components/ui/input';
import {useAdmin} from '@/contexts/AdminContext';

import {companies,fields,checkAccountEmail,submitAccountBatch,type BatchRequestRow,type AccountCheck,type Company} from './store';
import type {UberLookupContext} from './Uber';

type Row=BatchRequestRow & {check?:AccountCheck;error?:string};
const blank=(company:Company='Company A'):Row=>({rowId:crypto.randomUUID(),company,email:'',values:Array(14).fill(''),person:null,notifyPerson:null});
const populated=(r:Row)=>!!(r.email.trim()||r.person||r.notifyPerson||r.remarks?.trim()||r.values.some(v=>v.trim()));
// Parse Excel clipboard cells, including quoted tabs, line breaks and escaped quotes.
export function parseCells(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else if(quoted||!cell)quoted=!quoted;else cell+=c}else if(!quoted&&(c==='\t'||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!=='\t'){rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++}}else cell+=c}
 row.push(cell);if(row.some(v=>v!=='')||!rows.length)rows.push(row);return rows;
}
type Mode='new'|'change';
type Col=number|'company'|'rep'|'notify'|'remarks';
export function UberBatchApplication({initialLookup}:{initialLookup?:UberLookupContext}){
 const {isAdmin,viewAsUser}=useAdmin();
 const [initial]=useState(()=>{const row=blank(initialLookup?.company);if(initialLookup){row.email=initialLookup.email;try{row.check=checkAccountEmail(row.company,row.email);row.checkToken=row.check.token;row.email=row.check.email}catch(e){row.error=(e as Error).message}}return row});
 const initialMode:Mode=initial.check?.exists?'change':'new';
 const [mode,setMode]=useState<Mode>(initialMode);
 const [drafts,setDrafts]=useState<Record<Mode,Row[]>>(()=>({new:initialMode==='new'?[initial]:[blank()],change:initialMode==='change'?[initial]:[blank()]}));
 const rows=drafts[mode];
 function setRows(update:Row[]|((old:Row[])=>Row[])){setDrafts(old=>({...old,[mode]:typeof update==='function'?update(old[mode]):update}))}
 const [ids,setIds]=useState(()=>({new:crypto.randomUUID(),change:crypto.randomUUID()}));
 const [representative,setRepresentative]=useState('');const [notify,setNotify]=useState('');const [overrides,setOverrides]=useState(false);
 const [result,setResult]=useState<ReturnType<typeof submitAccountBatch>|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const columns:Col[]=mode==='change'?[2,'company',0,1,3,4,6,8,9,10,11,12,13,'remarks']:['company',0,1,2,3,4,6,8,9,10,11,12,13,'remarks'];
 if(overrides)columns.push('rep','notify');
 const label=(c:Col)=>typeof c==='number'?(c===2?'Account email':fields[c]):({company:'Company',rep:'Representative override',notify:'Person to notify override',remarks:'Remarks'}[c]);
 const required=(c:Col)=>c==='company'||c===2||(mode==='new'&&typeof c==='number'&&[0,1,3,4].includes(c));
 function patch(n:number,fn:(r:Row)=>Row){setRows(old=>old.map((r,i)=>i===n?fn({...r,values:[...r.values],error:undefined}):r));setError('')}
 function identify(r:Row):Row{try{const check=checkAccountEmail(r.company,r.email);const mismatch=mode==='new'?check.exists:!check.exists;return {...r,email:check.email,check,checkToken:check.token,error:mismatch?(mode==='new'?'Account exists — use Change information.':'Account not found — use New account.'):undefined}}catch(e){return {...r,check:undefined,checkToken:undefined,error:(e as Error).message}}}
 function setCell(r:Row,col:Col,value:string){if(col==='company'){if(companies.includes(value as Company))r.company=value as Company;else r.error='Select a valid company.';r.check=undefined;r.checkToken=undefined}else if(col==='rep')r.person=value?{name:value}:null;else if(col==='notify')r.notifyPerson=value?{name:value}:null;else if(col==='remarks')r.remarks=value;else if(col===2){r.email=value;r.check=undefined;r.checkToken=undefined}else r.values[col]=value;}
 function paste(e:React.ClipboardEvent<HTMLInputElement>,n:number,col:Col){const text=e.clipboardData.getData('text');if(!/[\t\r\n]/.test(text))return;e.preventDefault();const matrix=parseCells(text),start=columns.indexOf(col);setRows(old=>{const next=old.map(r=>({...r,values:[...r.values]}));matrix.forEach((line,dy)=>{while(next.length<=n+dy)next.push(blank(old[n].company));line.forEach((value,dx)=>{const c=columns[start+dx];if(c!==undefined)setCell(next[n+dy],c,value)})});return next});setError('')}
 function submit(){if(busy)return;setBusy(true);setError('');try{const prepared=rows.filter(populated).map(r=>({...r,expectedKind:mode,person:overrides&&r.person?.name.trim()?r.person:{name:representative.trim()},notifyPerson:overrides&&r.notifyPerson?.name.trim()?r.notifyPerson:{name:notify.trim()}}));setResult(submitAccountBatch(prepared,ids[mode]));}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function restart(){setRows([blank()]);setIds(old=>({...old,[mode]:crypto.randomUUID()}));setResult(null);setError('')}
 if(result)return <div className="space-y-5"><div className="rounded-xl border border-border bg-card p-6 space-y-3"><CheckCircle className="size-8 text-green-600"/><h2 className="text-2xl font-bold">{result.requests.length} requests submitted</h2><p className="text-sm text-muted-foreground">Each row is now a separate pending request.</p><div className="flex gap-3"><Button asChild><Link to={isAdmin&&!viewAsUser?'/admin':'/approval-history'}>{isAdmin&&!viewAsUser?'Review in Approvals':'My Requests'} <ArrowRight className="size-4"/></Link></Button><Button variant="outline" onClick={restart}>Create another batch</Button></div></div><div className="rounded-xl border border-border bg-card p-5 space-y-4"><h3 className="font-semibold">Feishu message previews</h3><p className="text-sm text-muted-foreground">Local demo only. No Feishu messages have been sent. Recipient names still need to be matched to Feishu accounts before delivery.</p>{result.notifications.map(n=><div key={n.id} className="border border-border rounded-lg p-4 space-y-2"><p className="text-sm font-medium">To: {n.recipient.name}</p><p className="text-sm whitespace-pre-wrap">{n.message}</p><span className="text-xs text-muted-foreground">Preview · not sent</span></div>)}</div></div>;
 return <div className="space-y-5"><h2 className="text-2xl font-bold">Uber Requests</h2>
 <Tabs value={mode} onValueChange={v=>{setMode(v as Mode);setError('')}}><TabsList><TabsTrigger value="new">New account</TabsTrigger><TabsTrigger value="change">Change information</TabsTrigger></TabsList></Tabs>
 <div className="rounded-xl border border-border bg-card p-4 grid sm:grid-cols-2 gap-4"><label className="text-sm font-medium">Representative<Input aria-label="Batch Representative" className="mt-2" value={representative} placeholder="Enter full name" onChange={e=>setRepresentative(e.target.value)}/></label><label className="text-sm font-medium">Person to notify<Input aria-label="Batch Person to notify" className="mt-2" value={notify} placeholder="Enter full name" onChange={e=>setNotify(e.target.value)}/></label><label className="sm:col-span-2 text-xs text-muted-foreground flex items-center gap-2"><input type="checkbox" checked={overrides} onChange={e=>setOverrides(e.target.checked)}/>Use different people for individual rows</label></div>
 <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{mode==='new'?'Enter the new account details. Fields marked * are required.':'Enter the account email and only the fields to change. Blank fields keep current values.'}</p><Button variant="outline" onClick={()=>setRows(old=>[...old,blank(old.at(-1)?.company)])}><Plus className="size-4"/>Add row</Button></div>
 <div className="rounded-xl border border-border bg-card overflow-hidden"><div className="overflow-auto max-h-[520px]"><table aria-label="Uber request spreadsheet" className="w-full text-xs border-collapse"><thead className="sticky top-0 z-20 bg-accent"><tr><th className="p-3 min-w-12 border-r border-border">#</th>{columns.map(c=><th key={c} className="p-3 min-w-44 text-left border-r border-border">{label(c)}{required(c)?' *':''}</th>)}<th className="p-3"><span className="sr-only">Remove row</span></th></tr></thead><tbody>{rows.map((r,n)=><tr key={r.rowId} className="border-t border-border"><th className="p-3 bg-muted/30 text-muted-foreground">{n+1}</th>{columns.map(c=><td key={c} className="border-r border-border align-top">{c==='company'?<select aria-label={`Row ${n+1} Company`} className="w-full p-3 bg-transparent" value={r.company} onChange={e=>patch(n,row=>{setCell(row,c,e.target.value);return row})}>{companies.map(company=><option key={company}>{company}</option>)}</select>:<input aria-label={`Row ${n+1} ${label(c)}`} className="w-full min-w-44 bg-transparent p-3 outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40" placeholder={c==='rep'?representative||'Use batch name':c==='notify'?notify||'Use batch name':undefined} value={c==='rep'?r.person?.name??'':c==='notify'?r.notifyPerson?.name??'':c==='remarks'?r.remarks??'':c===2?r.email:r.values[c]} onChange={e=>patch(n,row=>{setCell(row,c,e.target.value);return row})} onPaste={e=>paste(e,n,c)} onBlur={()=>{if(c===2&&r.email.trim())patch(n,identify)}}/>}{c===2&&r.error&&<p className="px-3 pb-2 text-destructive">{r.error}</p>}</td>)}<td className="p-1"><Button aria-label={`Remove row ${n+1}`} size="icon" variant="ghost" onClick={()=>setRows(old=>old.length===1?[blank(r.company)]:old.filter((_,i)=>i!==n))}><Trash2 className="size-4"/></Button></td></tr>)}</tbody></table></div></div>
 <p className="text-xs text-muted-foreground">Cost Centres: use a comma (,) between codes, e.g. 600, 610.</p>
 {error&&<p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}<div className="flex justify-end"><Button onClick={submit} disabled={busy||!rows.some(populated)}>{busy?'Submitting…':'Submit requests'}</Button></div></div>;
}
