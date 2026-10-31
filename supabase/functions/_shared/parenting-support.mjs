// Gov24 serviceList schema: https://www.data.go.kr/data/15113968/openapi.do
const parenting = /육아|영유아|영아|유아|아동|어린이|어린이집|보육|돌봄|출산|출생|산후|임신|임산부|양육|부모급여|첫만남|아이돌봄|다자녀/;
export function supportRecord(row, areas, runId, collectedAt) {
  const text = key => typeof row[key] === 'string' ? row[key].trim() : '';
  const title=text('서비스명'), id=text('서비스ID'),agency=text('소관기관명');
  if(!parenting.test([title,text('서비스목적요약'),text('지원대상')].join(' '))) return null;
  if(!id || !title || !agency) throw new Error('invalid-service');
  let url; try { url=new URL(text('상세조회URL')); } catch { throw new Error('invalid-source-url'); }
  if(url.protocol!=='https:' || !(url.hostname==='gov.kr'||url.hostname.endsWith('.gov.kr'))) throw new Error('invalid-source-url');
  const agencyType=text('소관기관유형');
  const national=agencyType==='중앙행정기관';
  // Match full hierarchical names, never an ambiguous 동 or 구 alone.
  const areaSet=areas instanceof Set?areas:new Set(areas);
  const parts=agency.replace(/청$/, '').split(/\s+/);
  const regionTerms=parts.map((_,i)=>parts.slice(0,i+1).join(' ')).filter(area=>areaSet.has(area));
  if(!national && !regionTerms.length) return null;
  // Keep the most specific agency jurisdiction; do not broaden district-only benefits to an entire city.
  const region=regionTerms.sort((a,b)=>b.length-a.length)[0];
  return {id,title,agency,agency_type:agencyType,national,region_terms:national?[]:[region],
    summary:text('서비스목적요약'),eligibility:text('지원대상'),benefit:text('지원내용'),
    application_period:text('신청기한'),url:url.href,source_updated:text('수정일시'),
    collected_at:collectedAt,run_id:runId,active:true};
}
export async function collectSupport({key,areas,runId,fetcher=fetch,now=new Date()}) {
  const result=new Map(); const areaSet=new Set(areas); let received=0,total;
  for(let page=1;page<=100;page++) {
    const url=new URL('https://api.odcloud.kr/api/gov24/v3/serviceList');
    url.searchParams.set('serviceKey',key);url.searchParams.set('page',String(page));url.searchParams.set('perPage','500');
    const response=await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok) throw new Error('source-unavailable');
    const payload=await response.json();
    if(!Array.isArray(payload.data)||!Number.isInteger(payload.totalCount)||payload.totalCount<=0||payload.totalCount>50000) throw new Error('invalid-response');
    if(total!==undefined&&total!==payload.totalCount) throw new Error('source-changed');
    total=payload.totalCount;
    if(!payload.data.length) throw new Error('incomplete-source');
    received+=payload.data.length;
    for(const row of payload.data) {
      const record=supportRecord(row,areaSet,runId,now.toISOString());
      if(record) result.set(record.id,record);
    }
    if(received>=total) {
      if(received!==total||!result.size) throw new Error('incomplete-source');
      return [...result.values()];
    }
  }
  throw new Error('page-limit');
}
