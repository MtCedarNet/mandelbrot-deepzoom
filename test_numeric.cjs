const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const numeric=html.slice(html.indexOf('function parseDecimal'),html.indexOf('const camera='));
const workerCode=html.slice(html.indexOf('function referenceWorker(){'),html.indexOf('const workerURL='));
let reply;
const ctx=vm.createContext({performance,console,self:{postMessage(d){if(d.buffer)reply=d;else if(d.error)throw Error(d.error);}},CAM_BITS:4096,UNIT:1n<<4096n,LOG2_SPAN:Math.log2(3.5)});
vm.runInContext(numeric+'\n'+workerCode+'\nreferenceWorker();',ctx);
const parse=s=>vm.runInContext(`parseDecimal(${JSON.stringify(s)})`,ctx);
const scaled=(x,e)=>vm.runInContext(`scaledBig(${x},${e})`,ctx);
const parts=z=>{const a=Math.log2(3.5)-z,e=Math.floor(a);return{m:2**(a-e),e};};
const F=Math.fround;
function twoSum(a,b){const s=F(a+b),v=F(s-a);return[s,F(F(a-F(s-v))+F(b-v))];}
function dsAdd(a,b){const s=twoSum(a[0],b[0]);return twoSum(s[0],F(F(s[1]+a[1])+b[1]));}
function dsMul(a,b){const p=F(a[0]*b[0]),ca=F(4097*a[0]),ah=F(ca-F(ca-a[0])),al=F(a[0]-ah),cb=F(4097*b[0]),bh=F(cb-F(cb-b[0])),bl=F(b[0]-bh);const residual=F(F(F(F(ah*bh)-p)+F(ah*bl))+F(al*bh))+F(al*bl);return twoSum(p,F(F(F(F(residual)+F(a[0]*b[1]))+F(a[1]*b[0]))+F(a[1]*b[1])));}
function normPair(x,y,lx,ly,e){const a=Math.max(Math.abs(x),Math.abs(y));if(!a)return{x:0,y:0,lx:0,ly:0,e:0};const k=Math.floor(Math.log2(a))+1;return{x:F(x*2**-k),y:F(y*2**-k),lx:F(lx*2**-k),ly:F(ly*2**-k),e:e+k};}
function norm(x,y,e){return normPair(F(x),F(y),F(x-F(x)),F(y-F(y)),e);}
function mul(a,b){const ax=[a.x,a.lx||0],ay=[a.y,a.ly||0],bx=[b.x,b.lx||0],by=[b.y,b.ly||0],p=dsMul(ay,by),x=dsAdd(dsMul(ax,bx),[-p[0],-p[1]]),y=dsAdd(dsMul(ax,by),dsMul(ay,bx));return normPair(x[0],y[0],x[1],y[1],a.e+b.e);}
function add(a,b){if(a.x===0&&a.y===0)return b;if(b.x===0&&b.y===0)return a;const e=Math.max(a.e,b.e),sa=a.e-e>=-120?2**(a.e-e):0,sb=b.e-e>=-120?2**(b.e-e):0;const x=dsAdd([F(a.x*sa),F((a.lx||0)*sa)],[F(b.x*sb),F((b.lx||0)*sb)]),y=dsAdd([F(a.y*sa),F((a.ly||0)*sa)],[F(b.y*sb),F((b.ly||0)*sb)]);return normPair(x[0],y[0],x[1],y[1],e);}
function normLess(a,b){if(a.x===0&&a.y===0)return b.x!==0||b.y!==0;if(b.x===0&&b.y===0)return false;const d=a.e-b.e;if(d< -1)return true;if(d>1)return false;return F(F(a.x*a.x)+F(a.y*a.y))*2**(2*d)<F(F(b.x*b.x)+F(b.y*b.y));}
function escape(a){return a.e>5||(a.e>=4&&(a.x*a.x+a.y*a.y)*2**(2*a.e)>256);}
function makeReference(r,i,z,maxIter,aspect,skip=true){const p=parts(z),bits=Math.max(160,Math.ceil(z+160));ctx.self.onmessage({data:{r:parse(r).toString(),i:parse(i).toString(),bits,maxIter,spanExp:p.e,radius:p.m*.5*Math.hypot(1,aspect)*1.01,skip,id:1}});const f=new Float32Array(reply.buffer),ints=new Int32Array(reply.buffer);return{...reply,refs:Array.from({length:reply.length},(_,n)=>({x:f[n*6],y:f[n*6+1],lx:f[n*6+2],ly:f[n*6+3],e:ints[n*6+4]})),parts:p,bits};}
function simulated(ref,tx,ty,maxIter,useSkip=true){const dc=norm(tx,ty,ref.parts.e),b=useSkip?ref.skip:{n:0,x:0,y:0,e:0};let d=mul({x:F(b.x),y:F(b.y),lx:F(b.x-F(b.x)),ly:F(b.y-F(b.y)),e:b.e},{x:tx,y:ty,e:0}),n=b.n,r=b.n,total;
 for(;n<maxIter;){let lin=mul(ref.refs[r],d);lin.e++;d=add(add(lin,mul(d,d)),dc);n++;r++;total=add(ref.refs[r],d);if(escape(total))return{n,mu:n+1-Math.log2(total.e+.5*Math.log2(total.x*total.x+total.y*total.y))};if(normLess(total,d)||r+1>=ref.length){d=total;r=0;}}
 return{n:maxIter,mu:-1};}
function directBig(cr,ci,P,maxIter){const B=BigInt(P),xx=cr>>BigInt(4096-P),yy=ci>>BigInt(4096-P),limit=256n<<(2n*B);let x=0n,y=0n;for(let n=1;n<=maxIter;n++){const a=((x*x-y*y)>>B)+xx;y=((2n*x*y)>>B)+yy;x=a;if(x*x+y*y>limit)return n;}return maxIter;}
const specs=[{name:'home',r:'-0.5',i:'0',z:0,it:1024},{name:'seahorse',r:'-0.7435',i:'0.1314',z:Math.log2(3.5/.008),it:2048},{name:'deep-seahorse',r:'-0.743643887037151',i:'0.13182590420533',z:Math.log2(3.5/4e-11),it:4096},{name:'tip80',r:'-2',i:'0',z:80*Math.log2(10),it:1024},{name:'tip1000',r:'-2',i:'0',z:1000*Math.log2(10),it:4096}];
const report=[];
for(const s of specs){const ref=makeReference(s.r,s.i,s.z,s.it,.75),p=ref.parts,cr=parse(s.r),ci=parse(s.i);let bad=0,worst=0,skipDiff=0;const rows=[];
 for(let iy=0;iy<6;iy++)for(let ix=0;ix<8;ix++){const tx=F(F(F((ix+.5)/8)-.5)*F(p.m)),ty=F(F(F(.5-F((iy+.5)/6))*.75)*F(p.m));const sim=simulated(ref,tx,ty,s.it),unskipped=simulated(ref,tx,ty,s.it,false);const exact=directBig(cr+scaled(tx,p.e),ci+scaled(ty,p.e),ref.bits,s.it);const err=Math.abs(sim.n-exact);if(err>2)bad++;worst=Math.max(worst,err);if(Math.abs(sim.n-unskipped.n)>2)skipDiff++;rows.push({ix,iy,computed:sim.n,exact});}
 const result={name:s.name,bits:ref.bits,skip:ref.skip.n,refLength:ref.length,samples:48,wrongByMoreThan2:bad,worst,skipDifferences:skipDiff};console.log(result);report.push({...result,rows});
 if(s.name==='tip80'||s.name==='tip1000')assert.equal(bad,0,'Exponent-extended tip validation');
 fs.writeFileSync(__dirname+'/reference-'+s.name+'.bin',Buffer.from(ref.buffer,0,ref.length*24));
}
// Deep camera offsets must survive addition to an order-one center.
const c=parse('-0.743643887037151'),tiny=scaled(.6,-3400);assert(tiny!==0n);assert(c+tiny!==c);assert.equal(Number(c+tiny),Number(c));
assert.equal(parse('-2'),-2n*(1n<<4096n));
fs.writeFileSync(__dirname+'/numeric-validation.json',JSON.stringify(report,null,2));
console.log('Numeric checks complete.');
