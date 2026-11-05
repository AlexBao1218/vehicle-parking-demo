import type {Request} from './store';
export function requestTitle(r:Request){
 if(!r.uber)return r.vehicleLicense;
 const name=r.vehicleLicense.split(' · ')[0].trim()||'Uber request';
 return `${name} · ${r.uber.company==='Company B'?'Company B':r.uber.company}`;
}
export function requestType(r:Request){return r.uber?(r.uber.kind==='new'?'New account':'Change information'):r.changeType;}
export function requestRemarks(r:Request){
 const remark=r.remark?.trim()??'';
 if((r.id==='sample-uber'&&remark==='Sample request for review')||(r.id==='sample-uber-change-info-v1'&&remark==='Design preview only. Proposed cost centre, position, G/L charge and mobile removal are fictional demo changes, not an instruction from the account holder. Current Base data is unchanged.'))return '';
 return remark;
}
