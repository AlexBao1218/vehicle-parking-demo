import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { companies } from './store';
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs';
import ApplicationPage from '@/pages/ApplicationPage/ApplicationPage';
import { UberApplication, type UberLookupContext } from './Uber';
export default function RequestPage(){
 const location=useLocation();
 const context=location.state?.uberLookup;
 const initialLookup:UberLookupContext|undefined=context&&companies.includes(context.company)&&typeof context.email==='string'?{company:context.company,email:context.email}:undefined;
 const [tab,setTab]=useState(initialLookup?'uber':'vehicle');return <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12 space-y-8"><Tabs value={tab} onValueChange={setTab}><TabsList className="h-11 w-full max-w-md mx-auto rounded-xl p-1"><TabsTrigger value="vehicle" className="text-sm">Vehicle</TabsTrigger><TabsTrigger value="uber" className="text-sm">Uber</TabsTrigger></TabsList></Tabs>{tab==='vehicle'?<ApplicationPage embedded/>:<UberApplication key={location.key} initialLookup={initialLookup}/>}</div>;}
