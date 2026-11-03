import {buildFeatures,METHODS,ruleLabel} from './features';
import {predictModel} from './predict';
import type {MeasurementRow,Method,RecommendationResult} from './types';
export type {MeasurementRow, Method, RecommendationResult} from './types';
export const HISTORY_DECAY = 0.5;
const HISTORY_LIMIT = 10;

function group(rows: MeasurementRow[]): Map<string,MeasurementRow[]> {
  const map = new Map<string,Map<Method,MeasurementRow>>();
  for(const r of rows) {
    if (!r.calibrationId || !METHODS.includes(r.inputMethod) || !Number.isFinite(Date.parse(r.sessionAt))) continue;
    if (!map.has(r.calibrationId)) map.set(r.calibrationId,new Map());
    const methods=map.get(r.calibrationId)!;
    const prev=methods.get(r.inputMethod);
    if (!prev || Date.parse(r.sessionAt)>=Date.parse(prev.sessionAt)) methods.set(r.inputMethod,r);
  }
  return new Map([...map].map(([key,methods])=>[key,[...methods.values()]]));
}
function measurementTime(rows: MeasurementRow[]): number {
  return Math.max(...rows.map(r=>Date.parse(r.sessionAt)));
}
function rounded(scores:number[]):number[] {
  // Largest-remainder: integer percentages always sum to 100.
  const raw=scores.map(p=>Math.max(0,p)*100);
  const whole=raw.map(Math.floor);
  const remaining=100-whole.reduce((a,b)=>a+b,0);
  const order=[0,1,2].sort((a,b)=>(raw[b]-whole[b])-(raw[a]-whole[a]) || a-b);
  for(let i=0;i<remaining;i++) whole[order[i%3]]++;
  return whole;
}
export function recommend(history:MeasurementRow[], current:MeasurementRow[]=[]):RecommendationResult {
  const groups=group(history);
  const currentGroups=group(current);
  // Current rows supersede overlapping saved rows for the same calibration.
  for (const [key,rows] of currentGroups) groups.set(key,rows);
  const measurements=[...groups.values()].filter(rows=>rows.length>0)
    .sort((a,b)=>measurementTime(b)-measurementTime(a)).slice(0,HISTORY_LIMIT);
  const latest=measurements[0]??[];
  let engine:'model'|'rule-fallback'='model';
  let scores=[0,0,0];
  let best:Method|null=null;
  if(latest.length){
    try {
      let sumWeight=0;
      for (let i=0;i<measurements.length;i++) {
        const features=buildFeatures(measurements[i]);
        if(!features) continue;
        const probs=predictModel(features);
        const weight=HISTORY_DECAY**i;
        for(let k=0;k<3;k++) scores[k]+=weight*probs[k];
        sumWeight+=weight;
      }
      if(!sumWeight) throw new Error('No valid measurements');
      scores=scores.map(v=>v/sumWeight);
      const allowed = new Set(latest.map(r=>r.inputMethod));
      best=METHODS.reduce<Method|null>((picked,m)=>allowed.has(m) && (!picked || scores[METHODS.indexOf(m)]>scores[METHODS.indexOf(picked)]) ? m : picked,null);
    } catch {
      engine='rule-fallback';
      best=ruleLabel(latest);
      // Documented fallback: latest measurement alone, one-hot ranking.
      scores=METHODS.map(m=>m===best?1:0);
    }
  }
  const latestByMethod=new Map(latest.map(r=>[r.inputMethod,r]));
  const fastest=latest.length?Math.max(...latest.map(r=>r.inputSpeed)):0;
  const integers=latest.length?rounded(scores):[0,0,0];
  const methods=METHODS.map((method,i)=>{
    const row=latestByMethod.get(method);
    return {method,score:integers[i],present:!!row,
      typoRatePercent:row ? row.typoRate*100 : null,
      speedPercent:row && fastest>0 ? row.inputSpeed/fastest*100 : null};
  });
  const measuredAt=latest.length ? new Date(measurementTime(latest)).toISOString() : null;
  return {recommendedMethod:best,measuredAt,engine,methods};
}
