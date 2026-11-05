import {requestTitle,requestType} from '@/preview/request-display';
import React, {useState,useMemo,useEffect} from 'react';
import type {Request} from '@/preview/store';
import type { ApprovalRecord } from '@shared/api.interface';
import { getChangeType } from '@shared/change-types';

interface ApprovalListPanelProps {
  requests: ApprovalRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

const ApprovalListPanel: React.FC<ApprovalListPanelProps> = ({
  requests,
  selectedId,
  onSelect,
  loading = false,
}) => {
  const [filter,setFilter]=useState('Uber');
  const visible=useMemo(()=>requests.filter(r=>(filter==='Uber')===!!(r as Request).uber),[requests,filter]);
  useEffect(()=>{if(!loading&&!visible.some(r=>r.id===selectedId)&&selectedId!==(visible[0]?.id??''))onSelect(visible[0]?.id??'');},[visible,selectedId,onSelect,loading]);
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-[41px] shrink-0 items-center gap-1.5 border-b border-border px-3">
        <div role="group" aria-label="Filter request category" className="flex w-full gap-1">{['Vehicle','Uber'].map(category=><button key={category} type="button" aria-pressed={filter===category} onClick={()=>setFilter(category)} className={`flex-1 rounded-md px-2 py-1 text-[12px] font-medium ${filter===category?'bg-primary/10 text-primary':'text-muted-foreground hover:bg-accent'}`}>{category}</button>)}</div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">
            No pending requests in this category.
          </div>
        ) : (
          <ul className="py-1">
            {visible.map((r) => {
              const selected = r.id === selectedId;
              const changeLabel =
                getChangeType(r.changeType)?.label ?? r.changeType;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className={[
                      'flex w-full flex-col gap-0.5 border-l-2 px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-l-primary bg-accent/50'
                        : 'border-l-transparent hover:bg-accent/40',
                    ].join(' ')}
                  >
                    <span className="text-[13px] font-medium text-foreground">
                      {requestTitle(r as Request)}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {(r as Request).uber?requestType(r as Request):changeLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ApprovalListPanel;
