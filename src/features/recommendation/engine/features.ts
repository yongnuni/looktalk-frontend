import type { MeasurementRow, Method } from './types';
export const METHODS: Method[] = ['EYE_TRACKING','BLINK','MOUTH'];
export const PREFIX: Record<Method,string> = {EYE_TRACKING:'eye_tracking',BLINK:'blink',MOUTH:'mouth'};
export const FEATURE_COLUMNS = METHODS.flatMap(method => {
  const p = PREFIX[method];
  return [`${p}_present`,`${p}_input_speed`,`${p}_typo_rate`,`${p}_speed_ratio`,`${p}_typo_gap`];
});
export function durationToInputSpeed(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('durationMs must be positive');
  return 60000 / durationMs;
}
export function buildFeatures(rows: MeasurementRow[]): number[] | null {
  const by = new Map<Method,MeasurementRow>();
  for (const r of rows) if (METHODS.includes(r.inputMethod)) by.set(r.inputMethod,r);
  const present = METHODS.filter(m=>by.has(m));
  if (!present.length) return null;
  for (const m of present) {
    const r = by.get(m)!;
    if (!Number.isFinite(r.inputSpeed) || r.inputSpeed <= 0 || !Number.isFinite(r.typoRate) || r.typoRate < 0 || r.typoRate > 1)
      throw new Error(`Invalid inputSpeed or typoRate for ${m}`);
  }
  const minTypo = Math.min(...present.map(m=>by.get(m)!.typoRate));
  const maxSpeed = Math.max(...present.filter(m=>by.get(m)!.typoRate===minTypo).map(m=>by.get(m)!.inputSpeed));
  return METHODS.flatMap(m=>{
    const r=by.get(m);
    if (!r) return [0,NaN,NaN,NaN,NaN];
    return [1,r.inputSpeed,r.typoRate,r.inputSpeed/maxSpeed,r.typoRate-minTypo];
  });
}
export function ruleLabel(rows: MeasurementRow[]): Method | null {
  const sorted = rows.filter(r=>METHODS.includes(r.inputMethod)).sort((a,b)=>
    a.typoRate-b.typoRate || b.inputSpeed-a.inputSpeed || METHODS.indexOf(a.inputMethod)-METHODS.indexOf(b.inputMethod));
  return sorted[0]?.inputMethod ?? null;
}
