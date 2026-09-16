/**
 * Measure the SEATED ground-truth assembly (turret-assembly-clean.glb) to
 * recover, frame-invariantly, how the 3X block sits on the drum's outer flat:
 *   - drum axis/center/front-face (PCA over turret verts),
 *   - per-node classification block vs turret (by node/mesh name),
 *   - block mounting-flange radius vs drum outer-flat radius (the "flush" datum),
 *   - block axial span vs front face (tool cantilever).
 * Read-only. Usage: node scripts/measure-assembly-groundtruth.mjs
 */
import fs from "node:fs";
const GLB = new URL("../public/turret-assembly-clean.glb", import.meta.url);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const scv=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>{const m=Math.hypot(...a)||1;return[a[0]/m,a[1]/m,a[2]/m];};
function parseGlb(url){const buf=fs.readFileSync(url);const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);const total=dv.getUint32(8,true);let off=12,json=null,bin=null;while(off<total){const len=dv.getUint32(off,true);const t=dv.getUint32(off+4,true);off+=8;const c=buf.subarray(off,off+len);if(t===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(c));else if(t===0x004e4942)bin=c;off+=len;}return{json,bin};}
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];r[i*4+j]=s;}return r;}
function trs(n){if(n.matrix)return n.matrix;const t=n.translation??[0,0,0],r=n.rotation??[0,0,0,1],s=n.scale??[1,1,1];const[x,y,z,w]=r;const x2=x+x,y2=y+y,z2=z+z;const xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;return[(1-(yy+zz))*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-(xx+zz))*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-(xx+yy))*s[2],0,t[0],t[1],t[2],1];}
function app(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
const {json,bin}=parseGlb(GLB);
const d=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
function primVerts(pr){const a=json.accessors[pr.attributes.POSITION];const bv=json.bufferViews[a.bufferView];const stride=bv.byteStride??12;const base=(bv.byteOffset??0)+(a.byteOffset??0);const out=[];for(let i=0;i<a.count;i++){const o=base+i*stride;out.push([d.getFloat32(o,true),d.getFloat32(o+4,true),d.getFloat32(o+8,true)]);}return out;}
// collect nodes with world matrices + names
const world={};const nodeName={};
const visit=(i,par)=>{const n=json.nodes[i];const m=mul(par,trs(n));world[i]=m;nodeName[i]=n.name??`node${i}`;(n.children??[]).forEach(c=>visit(c,m));};
(json.scenes[json.scene??0].nodes??[]).forEach(r=>visit(r,I));
// classify by primitive MATERIAL name (turret / block / tool)
const matName=(mi)=>mi===undefined?"":(json.materials?.[mi]?.name??"").toLowerCase();
let turretV=[],blockV=[],toolV=[];
json.nodes.forEach((n,idx)=>{if(n.mesh===undefined)return;const wm=world[idx]??I;for(const pr of json.meshes[n.mesh].primitives){const mn=matName(pr.material);const vs=primVerts(pr).map(p=>app(wm,p));if(/turret/.test(mn))turretV.push(...vs);else if(/tool/.test(mn))toolV.push(...vs);else blockV.push(...vs);}});
console.log(`verts: turret=${turretV.length} block(body)=${blockV.length} tool=${toolV.length}`);
const blockAll=blockV.concat(toolV); // block body + tools for span, body-only for flange
// drum frame via PCA over turret verts
const C=turretV.reduce((a,p)=>[a[0]+p[0],a[1]+p[1],a[2]+p[2]],[0,0,0]).map(x=>x/turretV.length);
const cov=[[0,0,0],[0,0,0],[0,0,0]];for(const p of turretV){const q=sub(p,C);for(let i=0;i<3;i++)for(let j=0;j<3;j++)cov[i][j]+=q[i]*q[j];}
// power-iteration for smallest eigenvector = axis: use jacobi-lite via deflation; simpler: find axis as direction minimizing variance -> use inverse power iter approx by iterating (trace*I - cov)
function matvec(M,v){return[M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];}
const tr=cov[0][0]+cov[1][1]+cov[2][2];const B=[[tr-cov[0][0],-cov[0][1],-cov[0][2]],[-cov[1][0],tr-cov[1][1],-cov[1][2]],[-cov[2][0],-cov[2][1],tr-cov[2][2]]];
let ax=[0.3,0.4,0.85];for(let k=0;k<200;k++){ax=nrm(matvec(B,ax));}
let axis=nrm(ax);
// orient axis toward block (front)
const bc=blockV.reduce((a,p)=>[a[0]+p[0],a[1]+p[1],a[2]+p[2]],[0,0,0]).map(x=>x/blockV.length);
if(dot(sub(bc,C),axis)<0)axis=scv(axis,-1);
const axials=turretV.map(p=>dot(sub(p,C),axis));const front=Math.max(...axials);
console.log(`\ndrum: center=[${C.map(x=>x.toFixed(2))}] axis=[${axis.map(x=>x.toFixed(4))}] frontAxial=${front.toFixed(2)}`);
// radial dir toward block
const bcv=sub(bc,C);const bax=dot(bcv,axis);const radialOut=nrm(sub(bcv,scv(axis,bax)));
const tangent=nrm(cross(axis,radialOut));
// turret outer flat radius in the block's angular sector (+-14deg), radius at ang~0
const sector=[];for(const p of turretV){const q=sub(p,C);const a=dot(q,axis);const rv=sub(q,scv(axis,a));const r=Math.hypot(...rv);const ang=Math.atan2(dot(rv,tangent),dot(rv,radialOut))*180/Math.PI;if(Math.abs(ang)<14&&r>10)sector.push({a,r,ang});}
const near0=sector.filter(v=>Math.abs(v.ang)<3).sort((x,y)=>y.r-x.r);const flatR=near0.slice(0,Math.max(1,Math.floor(near0.length*0.1))).reduce((s,v)=>s+v.r,0)/Math.max(1,Math.floor(near0.length*0.1));
console.log(`turret outer flat radius (block sector, ang~0): ${flatR.toFixed(3)}  (sector pts=${sector.length})`);
// block metrics in drum frame
const bm=blockV.map(p=>{const q=sub(p,C);const a=dot(q,axis);const rv=sub(q,scv(axis,a));return{a,r:Math.hypot(...rv),rr:dot(rv,radialOut),t:dot(rv,tangent)};});
const rr=bm.map(x=>x.rr),aa=bm.map(x=>x.a),tt=bm.map(x=>x.t);
console.log(`block MCS origin (mean of block nodes) radial=${dot(bcv,radialOut).toFixed(2)}  (this is body centroid, not MCS)`);
console.log(`block radial(rr) span: [${Math.min(...rr).toFixed(2)}, ${Math.max(...rr).toFixed(2)}]  -> flange(outer) radius=${Math.max(...rr).toFixed(2)} vs flatR=${flatR.toFixed(2)}  gap=${((Math.max(...rr)-flatR)*10).toFixed(1)}mm`);
console.log(`block axial span: [${Math.min(...aa).toFixed(2)}, ${Math.max(...aa).toFixed(2)}]  front=${front.toFixed(2)}  tool overhang past front=${(Math.max(...aa)-front).toFixed(2)}`);
console.log(`block tangential span: [${Math.min(...tt).toFixed(2)}, ${Math.max(...tt).toFixed(2)}]  (center offset=${((Math.min(...tt)+Math.max(...tt))/2).toFixed(2)})`);
