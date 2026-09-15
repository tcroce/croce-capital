const UA='CroceCapital/1.0 business-discovery';
const json=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');res.end(JSON.stringify(body));};
const clean=s=>String(s||'').trim();
function score(t){let s=45;if(t.phone||t['contact:phone'])s+=18;if(t.website||t['contact:website'])s+=14;if(t.email||t['contact:email'])s+=14;if(t['addr:housenumber']&&t['addr:street'])s+=5;if(t.opening_hours)s+=4;return Math.min(99,s)}
function categoryRegex(q){q=String(q||'').toLowerCase();const map={hvac:'hvac|heating|air_conditioning|air conditioning',roofing:'roof|roofer',plumbing:'plumb|plumber',construction:'construction|contractor|builder|concrete',electrician:'electric|electrician',landscaping:'landscap|lawn|garden',restaurant:'restaurant|fast_food|cafe'};return map[q]||q.replace(/[^a-z0-9 _-]/g,'').replace(/\s+/g,'.*')||'.*'}
export default async function handler(req,res){
 if(req.method!=='GET')return json(res,405,{error:'GET only'});
 const market=clean(req.query.market)||'Louisville, KY'; const industry=clean(req.query.industry)||'HVAC';
 try{
  const geoUrl='https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q='+encodeURIComponent(market);
  const gr=await fetch(geoUrl,{headers:{'User-Agent':UA,'Accept-Language':'en'}}); if(!gr.ok)throw new Error('Location lookup failed'); const gj=await gr.json(); if(!gj[0])return json(res,404,{error:'Market not found'});
  const lat=Number(gj[0].lat),lon=Number(gj[0].lon),rx=categoryRegex(industry),radius=30000;
  const q=`[out:json][timeout:20];(nwr(around:${radius},${lat},${lon})[name][office~"${rx}",i];nwr(around:${radius},${lat},${lon})[name][craft~"${rx}",i];nwr(around:${radius},${lat},${lon})[name][shop~"${rx}",i];nwr(around:${radius},${lat},${lon})[name][amenity~"${rx}",i];nwr(around:${radius},${lat},${lon})[name][description~"${rx}",i];);out center tags 60;`;
  const or=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'User-Agent':UA,'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)}); if(!or.ok)throw new Error('Public business source unavailable'); const oj=await or.json();
  const seen=new Set(), leads=[];
  for(const e of oj.elements||[]){const t=e.tags||{},name=clean(t.name);if(!name||seen.has(name.toLowerCase()))continue;seen.add(name.toLowerCase());const phone=clean(t.phone||t['contact:phone']),email=clean(t.email||t['contact:email']),website=clean(t.website||t['contact:website']);leads.push({id:'osm-'+e.type+'-'+e.id,business:name,first:'',last:'',industry,city:clean(t['addr:city'])||market.split(',')[0],state:clean(t['addr:state'])||clean(market.split(',')[1]),zip:clean(t['addr:postcode']),phone,email,website,tib:'Unknown',revenue:'Unknown',fico:'Unknown',fundingNeed:'Unknown',urgency:'Unknown',debt:'Unknown',score:score(t),status:'New',source:'OpenStreetMap public business data'});if(leads.length>=40)break;}
  return json(res,200,{market,industry,count:leads.length,leads,notice:'Public business records. Revenue, FICO, funding need, urgency and TIB are not inferred without evidence.'});
 }catch(e){return json(res,502,{error:e.message||'Discovery failed'});}
}