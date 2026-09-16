/**
 * Inspect turret GLB geometry around a station's joint-origin datum to decide
 * whether it lies on the OUTER radial mounting flat or the FRONT annulus face.
 * Usage: node scripts/inspect-hole-datum.mjs [station]
 */
import fs from "node:fs";
const joints = JSON.parse(fs.readFileSync(new URL("../src/data/turretJoints.json", import.meta.url), "utf8"));
const TURRET = new URL("../src/assets/models/turret-haas-st20y.glb", import.meta.url);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sc=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const norm=(a)=>{const m=Math.hypot(...a)||1;return[a[0]/m,a[1]/m,a[2]/m];};
function parseGlb(url){const buf=fs.readFileSync(url);const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);const total=dv.getUint32(8,true);let off=12,json=null,bin=null;while(off<total){const len=dv.getUint32(off,true);const t=dv.getUint32(off+4,true);off+=8;const c=buf.subarray(off,off+len);if(t===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(c));else if(t===0x004e4942)bin=c;off+=len;}return{json,bin};}
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];r[i*4+j]=s;}return r;}
function app(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
function verts({json,bin}){const world={};const visit=(i,p)=>{const n=json.nodes[i];const m=mul(p,n.matrix??I);world[i]=m;(n.children??[]).forEach(c=>visit(c,m));};const s0=json.scenes[json.scene??0];(s0.nodes??[]).forEach(r=>visit(r,I));const out=[];json.nodes.forEach((n,idx)=>{if(n.mesh===undefined)return;const wm=world[idx]??I;for(const pr of json.meshes[n.mesh].primitives){const a=json.accessors[pr.attributes.POSITION];const bv=json.bufferViews[a.bufferView];const stride=bv.byteStride??12;const base=(bv.byteOffset??0)+(a.byteOffset??0);const d=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);for(let i=0;i<a.count;i++){const o=base+i*stride;out.push(app(wm,[d.getFloat32(o,true),d.getFloat32(o+4,true),d.getFloat32(o+8,true)]));}}});return out;}

const center=joints.ringCenterGlb, axis=norm(joints.ringAxisGlb);
const stn=Number(process.argv[2]??1);
const P=joints.stations.find(s=>s.station===stn).origin;
const V=verts(parseGlb(TURRET));

// nearest vertices in 3D to the datum P
let near=V.map(p=>({p,d:Math.hypot(...sub(p,P))})).sort((a,b)=>a.d-b.d).slice(0,400);
console.log(`station ${stn} datum P=[${P.map(x=>x.toFixed(2))}]`);
console.log(`nearest turret vertex is ${near[0].d.toFixed(3)} cm from the datum (0 = datum lies on geometry)`);
// decompose the near patch in drum frame
const dP=sub(P,center); const axP=dot(dP,axis); const radDirP=norm(sub(dP,sc(axis,axP)));
const stats=(arr)=>({min:Math.min(...arr).toFixed(2),max:Math.max(...arr).toFixed(2)});
const patch=near.slice(0,200).map(({p})=>{const d=sub(p,center);const ax=dot(d,axis);const rad=dot(sub(d,sc(axis,ax)),radDirP);return{ax,rad};});
console.log(`nearest-200 patch: axial ${JSON.stringify(stats(patch.map(x=>x.ax)))}  radial ${JSON.stringify(stats(patch.map(x=>x.rad)))}`);
console.log(`  datum axial=${axP.toFixed(3)}  datum radius=${Math.hypot(...sub(dP,sc(axis,axP))).toFixed(3)}`);
// Is the local surface radial-facing (axial spread large, radius ~const) or axial-facing (radius spread large, axial ~const)?
const axSpread=Math.max(...patch.map(x=>x.ax))-Math.min(...patch.map(x=>x.ax));
const radSpread=Math.max(...patch.map(x=>x.rad))-Math.min(...patch.map(x=>x.rad));
console.log(`  patch axial spread=${axSpread.toFixed(2)}  radial spread=${radSpread.toFixed(2)}  -> ${axSpread>radSpread?"AXIAL-facing (front-face-like: radius varies, axial ~flat)":"RADIAL-facing (outer-flat-like: axial varies, radius ~flat)"}`);
// Also: how much turret material is OUTBOARD of the datum radius along its radial line & axial band?
const dband=V.map(p=>{const d=sub(p,center);const ax=dot(d,axis);const rv=sub(d,sc(axis,ax));const rad=Math.hypot(...rv);const along=dot(rv,radDirP)/(rad||1);return{ax,rad,along};}).filter(x=>x.along>0.985 && Math.abs(x.ax-axP)<1.5);
if(dband.length){console.log(`  along datum radial ray (±1.5cm axial): turret radius spans [${Math.min(...dband.map(x=>x.rad)).toFixed(2)}, ${Math.max(...dband.map(x=>x.rad)).toFixed(2)}]  (datum r=${Math.hypot(...sub(dP,sc(axis,axP))).toFixed(2)})`);}
