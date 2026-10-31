import {createClient} from 'npm:@supabase/supabase-js@2.100.0';
import {collectSupport} from '../_shared/parenting-support.mjs';
Deno.serve(async(request: Request)=>{
 if(request.method!=='POST')return new Response(null,{status:405});
 const token=request.headers.get('x-podoong-support-token');
 const expected=Deno.env.get('SUPPORT_WORKER_TOKEN');
 if(!expected||!token||token.length!==64||token!==expected)return new Response(null,{status:401});
 const key=Deno.env.get('GOV24_SERVICE_KEY');
 if(!key)return new Response(null,{status:503});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const begin=await db.rpc('begin_parenting_support_sync');
 if(begin.error)return new Response(null,{status:503});
 const runId=begin.data;
 if(!runId)return new Response(null,{status:202});
 try {
  // Only coarse public administrative names; no family data is sent to Gov24.
  const areas=new Set<string>();
  for(let offset=0;;offset+=1000){
   const {data,error}=await db.from('residence_regions').select('city_name,locality_name').eq('country_code','KR').eq('selectable',true).order('code').range(offset,offset+999);
   if(error)throw new Error('regions-unavailable');
   for(const row of data){
    const parts=row.city_name.split(' ');
    for(let i=1;i<=parts.length;i++)areas.add(parts.slice(0,i).join(' '));
    areas.add(`${row.city_name} ${row.locality_name}`);
   }
   if(data.length<1000)break;
  }
  const records=await collectSupport({key,areas:[...areas],runId});
  const published=await db.rpc('publish_parenting_support',{p_run:runId,p_rows:records});
  if(published.error)throw new Error('publish-failed');
  return Response.json({collected:records.length});
 }catch{
  await db.from('parenting_support_sync').update({status:'failed',finished_at:new Date().toISOString()}).eq('id',runId).eq('status','running');
  // Never return provider payloads, URLs containing keys or raw errors.
  return new Response(null,{status:503});
 }
});
