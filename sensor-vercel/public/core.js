export const thresholds=s=>({a:7-Number(s)*0.05,j:65-Number(s)*0.5});
export class Detector{
 constructor(){this.reset();}
 reset(){this.prev=null;this.active=null;this.until=0;}
 update(v,t,s){
 const a=Math.hypot(...v),dt=this.prev?(t-this.prev.t)/1000:0;
 const j=dt>0&&dt<0.5?Math.hypot(...v.map((n,i)=>n-this.prev.v[i]))/dt:0;
 this.prev={t,v};const th=thresholds(s),hit=a>=th.a&&j>=th.j;
 if(hit&&!this.active&&t>=this.until)this.active={t,peak:a,jerk:j,last:t,thresholdA:th.a,thresholdJ:th.j,sensitivity:Number(s)};
 if(this.active){this.active.peak=Math.max(this.active.peak,a);this.active.jerk=Math.max(this.active.jerk,j);if(a>=th.a*0.6)this.active.last=t;
 if(t-this.active.last>=400){return {a,j,event:this.finish()};}}
 return {a,j,event:null};}
 finish(){if(!this.active)return null;const e={...this.active,duration:Math.max(0,this.active.last-this.active.t)};this.until=this.active.last+1500;this.active=null;return e;}
}
