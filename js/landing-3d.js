(function(){
"use strict";
var $=function(i){return document.getElementById(i)},root=document.body;
function fail(){if($("err"))$("err").style.display="flex";if($("veil"))$("veil").style.display="none"}
if(!window.THREE){fail();return}
var R;var canvasElement = $("hero-3d-canvas") || $("c"); try{R=new THREE.WebGLRenderer({canvas:canvasElement,antialias:true,alpha:true,powerPreference:"high-performance"})}catch(e){fail();return}
R.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.14;
if('outputColorSpace' in R){R.outputColorSpace=THREE.SRGBColorSpace}else if('outputEncoding' in R){R.outputEncoding=THREE.sRGBEncoding}

var acts=[],V=function(x,y,z){return new THREE.Vector3(x,y,z)},S=new THREE.Scene(),cam=new THREE.PerspectiveCamera(66,1,.1,450);
S.fog=new THREE.FogExp2(0xb5d8f3,.0022);

/* ---------- sky dome (gradient, haze, hills, sun disc) + low golden sun ---------- */
var SUND=V(.331,.469,-.819).normalize();
var SKYFS=["uniform vec3 sd;uniform float si;uniform float gm;varying vec3 vD;",
"void main(){vec3 d=normalize(vD);float y=d.y,h=max(y,0.);vec3 hor=vec3(.69,.83,.945),mid=vec3(.2,.44,.86),zen=vec3(.035,.14,.52);",
"vec3 c=mix(hor,mid,smoothstep(0.,.32,h));c=mix(c,zen,smoothstep(.25,.95,h));float s=max(dot(d,sd),0.);",
"c+=vec3(1.,.78,.5)*pow(s,6.)*.22+vec3(1.,.86,.62)*pow(s,40.)*.5+vec3(1.,.93,.8)*pow(s,500.)*1.6;",
"c=mix(c,vec3(1.,.96,.86)*si,smoothstep(.99955,.99978,s));float az=atan(d.x,-d.z);",
"float r1=.02+.022*sin(az*2.+.7)+.012*sin(az*5.+2.1)+.006*sin(az*11.+.3),r2=.006+.012*sin(az*3.+1.9)+.008*sin(az*7.+.4)+.003*sin(az*37.+1.)+.002*sin(az*83.);",
"c=mix(c,mix(hor,vec3(.45,.54,.66),.5),1.-smoothstep(r1-.002,r1+.004,y));c=mix(c,mix(hor,vec3(.3,.4,.4),.6),1.-smoothstep(r2-.002,r2+.003,y));",
"if(gm>.5)c=mix(c,vec3(.42,.46,.45),1.-smoothstep(-.12,0.,y));gl_FragColor=vec4(c,1.);",
"#include <tonemapping_fragment>","#include <encodings_fragment>","}"].join("\n");
function skyMat(si,gm){return new THREE.ShaderMaterial({uniforms:{sd:{value:SUND},si:{value:si},gm:{value:gm}},vertexShader:"varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:SKYFS,side:THREE.BackSide,depthTest:false,depthWrite:false})}
var skyDome=new THREE.Mesh(new THREE.SphereGeometry(400,48,24),skyMat(7,0));skyDome.renderOrder=-1000;skyDome.frustumCulled=false;S.add(skyDome);
S.add(new THREE.AmbientLight(0xe4edfa,.65));
S.add(new THREE.HemisphereLight(0xd8ecff,0x9fb0a2,1.25));
var sun=new THREE.DirectionalLight(0xfff5e6,2.0);sun.position.copy(SUND).multiplyScalar(80);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
var sc=sun.shadow.camera;sc.left=-55;sc.right=55;sc.top=55;sc.bottom=-55;sc.near=1;sc.far=220;sun.shadow.bias=-.0002;sun.shadow.normalBias=.02;S.add(sun);
var fill=new THREE.DirectionalLight(0xd2e7fc,1.15);fill.position.set(-45,32,45);S.add(fill);
var fill2=new THREE.DirectionalLight(0xc4d8ec,.65);fill2.position.set(45,26,-45);S.add(fill2);
var fillLeft=new THREE.DirectionalLight(0xdaf0ff,.55);fillLeft.position.set(-50,16,-15);S.add(fillLeft);
(function(){var sk=new THREE.Scene(),m=new THREE.Mesh(new THREE.SphereGeometry(100,48,24),skyMat(3,1));m.frustumCulled=false;sk.add(m);
 var pm=new THREE.PMREMGenerator(R);S.environment=pm.fromScene(sk,.02).texture;pm.dispose()})();

function rng(a){return function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function nGrid(n,r){var a=new Float32Array(n*n);for(var i=0;i<a.length;i++)a[i]=r();return a}
function nSamp(a,n,u,v){u*=n;v*=n;var x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);var x1=(x0+1)%n,y1=(y0+1)%n;x0%=n;y0%=n;
 return(a[y0*n+x0]*(1-fx)+a[y0*n+x1]*fx)*(1-fy)+(a[y1*n+x0]*(1-fx)+a[y1*n+x1]*fx)*fy}
function soilTex(size,seed,c0,c1,rep,peb){var r=rng(seed),c=document.createElement("canvas");c.width=c.height=size;var x=c.getContext("2d"),id=x.createImageData(size,size),d=id.data,
 g1=nGrid(5,r),g2=nGrid(14,r),g3=nGrid(44,r),g4=nGrid(9,r);
 for(var j=0;j<size;j++)for(var i=0;i<size;i++){var u=i/size,v=j/size,n=nSamp(g1,5,u,v)*.34+nSamp(g2,14,u,v)*.3+nSamp(g3,44,u,v)*.22+r()*.14,t=nSamp(g4,9,u,v),k=(j*size+i)*4;
  d[k]=c0[0]+(c1[0]-c0[0])*n+t*10-5;d[k+1]=c0[1]+(c1[1]-c0[1])*n+t*6-3;d[k+2]=c0[2]+(c1[2]-c0[2])*n-t*8+4;d[k+3]=255}
 x.putImageData(id,0,0);
 for(var q=0;q<peb;q++){var px=r()*size,py=r()*size,rw=1.2+r()*r()*5*size/1024*2,rh=rw*(.6+r()*.4),a=r()*3.14,lv=95+r()*95|0;
  x.fillStyle="rgba(20,14,8,.32)";x.beginPath();x.ellipse(px+rw*.35,py+rh*.45,rw,rh,a,0,6.2832);x.fill();
  x.fillStyle="rgb("+lv+","+(lv-8)+","+(lv-18)+")";x.beginPath();x.ellipse(px,py,rw,rh,a,0,6.2832);x.fill()}
 var T=new THREE.CanvasTexture(c);T.wrapS=T.wrapT=THREE.RepeatWrapping;T.repeat.set(rep[0],rep[1]);T.anisotropy=8;T.encoding=THREE.sRGBEncoding;return T}
var gt=soilTex(1024,11,[88,62,42],[160,124,88],[59,59],900);

var mc={};function M(c,r,m){var k=c+"_"+r+"_"+m;return mc[k]||(mc[k]=new THREE.MeshStandardMaterial({color:c,roughness:r==null?.7:r,metalness:m||0}))}
var YEL=WEA("#f2b21a"),CON=CONM(),STL=M(0x6c7480,.45,.7),DRK=M(0x23262b,.8,.2),GLS=M(0x1b2a3a,.1,.8),WOD=M(0xb08a55,.9),BRK=M(0xa4553a,.9),SIL=M(0xd9dde3,.3,.6),ORG=M(0xff6a00,.6);
var TRKM=(function(){var c=document.createElement("canvas");c.width=c.height=64;var x=c.getContext("2d"),i;x.fillStyle="#2a2c30";x.fillRect(0,0,64,64);
 for(i=0;i<64;i+=8){x.fillStyle="#17181b";x.fillRect(i,0,2,64);x.fillStyle="#3b3e44";x.fillRect(i+3,0,3,64)}
 for(i=0;i<500;i++){x.fillStyle="rgba(110,85,55,"+Math.random()*.16+")";x.fillRect(Math.random()*64,Math.random()*64,2,2)}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,1);t.anisotropy=8;t.encoding=THREE.sRGBEncoding;
 return new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:1.2,roughness:.85,metalness:.35})})();
function WEA(base){var r=rng(5),c=document.createElement("canvas");c.width=c.height=256;var x=c.getContext("2d"),i,g;x.fillStyle=base;x.fillRect(0,0,256,256);
 for(i=0;i<3000;i++){x.fillStyle=r()<.5?"rgba(70,50,15,"+(.03+r()*.08)+")":"rgba(255,240,180,"+(.03+r()*.07)+")";x.fillRect(r()*256,r()*256,1+r()*3,1+r()*3)}
 for(i=0;i<46;i++){var sx=r()*256,sy=r()*170;g=x.createLinearGradient(0,sy,0,sy+110);g.addColorStop(0,"rgba(60,40,20,0)");g.addColorStop(.3,"rgba(60,40,20,"+(.1+r()*.12)+")");g.addColorStop(1,"rgba(60,40,20,0)");x.fillStyle=g;x.fillRect(sx,sy,1+r()*3,110)}
 g=x.createLinearGradient(0,256,0,150);g.addColorStop(0,"rgba(88,64,38,.72)");g.addColorStop(1,"rgba(88,64,38,0)");x.fillStyle=g;x.fillRect(0,150,256,106);
 for(i=0;i<14;i++){x.fillStyle="rgba(20,16,10,"+(.15+r()*.2)+")";x.beginPath();x.ellipse(r()*256,r()*256,4+r()*14,3+r()*8,r()*3,0,6.3);x.fill()}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=8;
 return new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:.5,roughness:.62,metalness:.2})}
function P(g,m,x,y,z,par){var o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;(par||S).add(o);return o}
function B(w,h,d,m,x,y,z,par){return P(new THREE.BoxGeometry(w,h,d),m,x,y,z,par)}
function Cy(r,h,m,x,y,z,par,s){return P(new THREE.CylinderGeometry(r,r,h,s||16),m,x,y,z,par)}
var UP=V(0,1,0);
function beam(a,b,r,m,par){var d=new THREE.Vector3().subVectors(b,a),l=d.length(),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,6),m);
 o.position.copy(a).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(UP,d.normalize());o.castShadow=true;(par||S).add(o);return o}

/* ---------- realism helpers ---------- */
var TIRE=M(0x15161a,.95),AMBM=new THREE.MeshStandardMaterial({color:0xffb020,emissive:0xff8a00,emissiveIntensity:1,roughness:.3});
var STRIPE=(function(){var c=document.createElement("canvas");c.width=c.height=64;var x=c.getContext("2d");x.fillStyle="#f4f4f4";x.fillRect(0,0,64,64);x.fillStyle="#ff6a00";
 for(var i=-64;i<128;i+=32){x.beginPath();x.moveTo(i,64);x.lineTo(i+16,64);x.lineTo(i+80,0);x.lineTo(i+64,0);x.fill()}
 var t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return new THREE.MeshStandardMaterial({map:t,roughness:.8})})();
function CONM(){var c=document.createElement("canvas");c.width=c.height=256;var x=c.getContext("2d");x.fillStyle="#9c9a94";x.fillRect(0,0,256,256);
 for(var i=0;i<5000;i++){var v=130+Math.random()*50|0;x.fillStyle="rgb("+v+","+(v-2)+","+(v-8)+")";x.fillRect(Math.random()*256,Math.random()*256,2,2)}
 x.strokeStyle="rgba(60,60,55,.35)";x.lineWidth=2;for(var j=0;j<256;j+=64){x.beginPath();x.moveTo(0,j);x.lineTo(256,j);x.stroke()}
 x.strokeStyle="rgba(50,50,45,.2)";x.lineWidth=1;for(var k=0;k<256;k+=21){x.beginPath();x.moveTo(k,0);x.lineTo(k,256);x.stroke()}
 for(var a=32;a<256;a+=64)for(var b=32;b<256;b+=64){x.fillStyle="rgba(38,38,34,.6)";x.beginPath();x.arc(a,b,3,0,6.3);x.fill()}
 for(var m=0;m<30;m++){var gx=x.createLinearGradient(0,0,0,90);var sx2=Math.random()*256,sy2=Math.random()*180;gx.addColorStop(0,"rgba(70,62,50,0)");gx.addColorStop(.4,"rgba(70,62,50,.16)");gx.addColorStop(1,"rgba(70,62,50,0)");x.save();x.translate(sx2,sy2);x.fillStyle=gx;x.fillRect(0,0,2+Math.random()*4,90);x.restore()}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;return new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:.6,roughness:.95})}
function wheel(par,x,y,z,r,w){var g=new THREE.Group();g.position.set(x,y,z);par.add(g);
 P(new THREE.CylinderGeometry(r,r,w,28),TIRE,0,0,0,g).rotation.z=Math.PI/2;
 [-1,1].forEach(function(s){P(new THREE.TorusGeometry(r*.88,r*.13,8,28),TIRE,s*w*.5,0,0,g).rotation.y=Math.PI/2});
 P(new THREE.CylinderGeometry(r*.55,r*.55,w*1.06,18),M(0xd8a21a,.4,.6),0,0,0,g).rotation.z=Math.PI/2;
 P(new THREE.CylinderGeometry(r*.2,r*.2,w*1.14,10),SIL,0,0,0,g).rotation.z=Math.PI/2;return g}
function cab(par,w,h,d,x,y,z,col){var g=new THREE.Group();g.position.set(x,y,z);par.add(g);B(w,h,d,col||YEL,0,0,0,g);
 B(w*.84,h*.62,.05,GLS,0,h*.06,d/2+.02,g);B(w*.84,h*.62,.05,GLS,0,h*.06,-d/2-.02,g);B(.05,h*.62,d*.78,GLS,w/2+.02,h*.06,0,g);B(.05,h*.62,d*.78,GLS,-w/2-.02,h*.06,0,g);B(w*1.08,.1,d*1.08,STL,0,h/2+.05,0,g);return g}
function beacon(par,x,y,z){P(new THREE.SphereGeometry(.16,10,8),AMBM,x,y,z,par);Cy(.18,.1,DRK,x,y-.14,z,par,10)}

var gg=soilTex(1024,71,[46,70,28],[106,138,64],[70,70],0),gnd=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.MeshStandardMaterial({map:gg,bumpMap:gg,bumpScale:1.2,roughness:1}));gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;S.add(gnd);
var rt=gt.clone();rt.needsUpdate=true;rt.repeat.set(10,1);var road=new THREE.Mesh(new THREE.PlaneGeometry(120,7.5),new THREE.MeshStandardMaterial({map:rt,color:0x8c8c8c,roughness:1}));road.rotation.x=-Math.PI/2;road.position.set(0,.02,13);road.receiveShadow=true;S.add(road);
var walk=new THREE.Mesh(new THREE.PlaneGeometry(1.8,40),new THREE.MeshStandardMaterial({color:0x2f9e6a,roughness:.8}));walk.rotation.x=-Math.PI/2;walk.position.set(7.2,.03,0);walk.receiveShadow=true;S.add(walk);
function heap(cx,cz,R0,h,seed,tex){var pts=[],n=18,i,mat=new THREE.MeshStandardMaterial({map:tex,bumpMap:tex,bumpScale:1.2,roughness:1,side:THREE.DoubleSide});
 for(i=0;i<=n;i++){var t=i/n;pts.push(new THREE.Vector2(i===n?.002:R0*Math.pow(1-t,.85),h*t))}
 var g=new THREE.LatheGeometry(pts,64),p=g.attributes.position,r=rng(seed),a=r()*6,b=r()*6;
 for(i=0;i<p.count;i++){var x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=Math.sin(x*2.3+a)*Math.cos(z*2.1+b)*.5+Math.sin(x*5.7+z*4.9+b)*.3+Math.sin(z*9.1-x*7.3+a)*.2,f=1+.1*k*(1-y/h*.6);
  p.setXYZ(i,x*f,y>.001?Math.max(.001,y+k*.07):0,z*f)}
 g.computeVertexNormals();return P(g,mat,cx,0,cz)}
var htS=soilTex(512,23,[62,44,30],[118,86,58],[5,2],260),htA=soilTex(512,31,[190,160,112],[232,206,156],[5,2],160),htG=soilTex(512,47,[98,98,96],[168,164,156],[5,2],900);
heap(-18.6,7.2,2.3,1.5,3,htS);heap(-10.5,3,1.8,1.15,8,htS);heap(33,-6,3.3,2.1,13,htA);heap(-36,-4,2.7,1.7,19,htG);

/* ---------- site surroundings: tree line only (neighbourhood houses removed) ---------- */
var WHT=M(0xf2f0ea,.6),GLH=M(0x8fb4d0,.08,.6),DOOR=M(0x6b3b24,.7),LAWN=M(0x5f8a3c,1);
var BARK=(function(){var r=rng(81),c=document.createElement("canvas");c.width=64;c.height=128;var x=c.getContext("2d"),i;x.fillStyle="#4a3524";x.fillRect(0,0,64,128);
 for(i=0;i<260;i++){var v=45+r()*50|0;x.fillStyle="rgba("+v+","+(v*.74|0)+","+(v*.5|0)+","+(.25+r()*.4)+")";x.fillRect(r()*64,r()*128,1+r()*3,6+r()*26)}
 for(i=0;i<14;i++){x.strokeStyle="rgba(20,12,6,.55)";x.lineWidth=1.5;x.beginPath();var bx=r()*64;x.moveTo(bx,0);for(var q=1;q<=8;q++)x.lineTo(bx+(r()-.5)*5,q*16);x.stroke()}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t})();
var LEAF=(function(){var r=rng(83),c=document.createElement("canvas");c.width=c.height=128;var x=c.getContext("2d"),i;x.fillStyle="#3e6e2c";x.fillRect(0,0,128,128);
 for(i=0;i<900;i++){var g=60+r()*80|0,a=r()*6.28;x.fillStyle="rgba("+(g*.55|0)+","+g+","+(g*.3|0)+","+(.35+r()*.4)+")";x.beginPath();x.ellipse(r()*128,r()*128,2+r()*3.5,1+r()*1.6,a,0,6.28);x.fill()}
 for(i=0;i<160;i++){x.fillStyle="rgba(14,34,10,"+(.25+r()*.3)+")";x.fillRect(r()*128,r()*128,2+r()*3,2+r()*3)}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t})();
function puffGeo(seed){var g=new THREE.SphereGeometry(1,18,13),p=g.attributes.position,r=rng(seed),a=r()*6,b=r()*6,i;
 for(i=0;i<p.count;i++){var x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+.26*(Math.sin(x*3.1+a)*Math.cos(z*2.7+b)+.6*Math.sin(y*5.3+x*4.1+b)+.4*Math.sin(z*8.1-x*6.3+a));p.setXYZ(i,x*k,y*k*.82,z*k)}
 g.computeVertexNormals();return g}
var PG=[puffGeo(1),puffGeo(2),puffGeo(3)],LM=[0x4f8a38,0x3f7a35,0x5c9a3f,0x6aa347].map(function(c){return new THREE.MeshStandardMaterial({color:c,map:LEAF,bumpMap:LEAF,bumpScale:1.5,roughness:.92})}),
 CONIFER=new THREE.MeshStandardMaterial({color:0x2f5f33,map:LEAF,bumpMap:LEAF,bumpScale:1.5,roughness:.95}),BM=new THREE.MeshStandardMaterial({color:0xffffff,map:BARK,bumpMap:BARK,bumpScale:1.2,roughness:1}),treeSway=[],tcount=0;
function tree(x,z,s){var r=rng(Math.round(x*13+z*7)+101),lite=s<.8,g=new THREE.Group(),i,th=2.3*s;g.position.set(x,0,z);g.rotation.y=r()*6.28;S.add(g);tcount++;
 if(tcount%5===0&&!lite){P(new THREE.CylinderGeometry(.1*s,.2*s,1.4*s,8),BM,0,.7*s,0,g);
  for(i=0;i<5;i++){var cn=P(new THREE.ConeGeometry((1.55-i*.27)*s,1.5*s,12),CONIFER,0,(1.3+i*.85)*s,0,g);cn.rotation.y=i}return g}
 P(new THREE.CylinderGeometry(.13*s,.24*s,th,10),BM,0,th/2,0,g);P(new THREE.CylinderGeometry(.24*s,.34*s,.35*s,10),BM,0,.17*s,0,g);
 var cr=new THREE.Group();cr.position.y=th;g.add(cr);treeSway.push({c:cr,ph:r()*6.28});
 var n=lite?4:9,mat=LM[Math.floor(r()*4)];
 for(i=0;i<n;i++){var a=i/n*6.28+r(),d=(lite?.55:.9)*s*(.6+r()*.7),h=(lite?.6:.5+r()*1.2)*s,rad=(lite?1:1.15)*s*(.8+r()*.5);
  if(!lite&&i<5)beam(V(0,-.2*s,0),V(Math.cos(a)*d,h,Math.sin(a)*d),.05*s,BM,cr);
  var pf=P(PG[i%3],mat,Math.cos(a)*d,h+.5*s,Math.sin(a)*d,cr);pf.scale.set(rad,rad*.9,rad);pf.rotation.y=r()*6}
 P(PG[0],mat,0,1.2*s,0,cr).scale.setScalar(1.25*s);return g}
[[-25,-36],[-8,-37],[11,-36],[29,-37],[-42,-37],[46,-36],[-34,-41],[2,-42],[20,-41],[38,-42],[-54,-24],[54,-26],[-54,-4],[55,-6]].forEach(function(p,i){tree(p[0],p[1],.9+(i%3)*.2)});

/* ---------- urban area: city road, towers, apartments, cars, streetlights ---------- */
var winB=[[0xb9bfc7,3],[0x8f9aa8,5],[0xc9b99f,7],[0x6f7c8c,9]].map(function(c){var r=rng(c[1]),cv=document.createElement("canvas");cv.width=64;cv.height=128;var x=cv.getContext("2d"),i,j;
 x.fillStyle="#"+("000000"+c[0].toString(16)).slice(-6);x.fillRect(0,0,64,128);
 for(j=0;j<8;j++)for(i=0;i<4;i++){x.fillStyle=r()<.14?"#f5d68a":"#2b3a4d";x.fillRect(i*16+3,j*16+3,10,10)}
 var t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t});
function tower(x,z,w,d,h,k){var gl=Math.abs(k|0)%3===0,rf=M(0x55595f,.9),mats=function(ww,hh,kk){var t=winB[Math.abs(kk|0)%4].clone();t.needsUpdate=true;t.repeat.set(Math.max(1,Math.round(ww/6)),Math.max(1,Math.round(hh/28)));
  var m=new THREE.MeshStandardMaterial({map:t,roughness:gl?.12:.6,metalness:gl?.75:.1,envMapIntensity:gl?1.6:.6});return[m,m,rf,rf,m,m]},hb=h>38?h*.3:h,hu=h-hb;
 P(new THREE.BoxGeometry(w,hb,d),mats(w,hb,k),x,hb/2,z);B(w+.6,.5,d+.6,CON,x,hb+.25,z,S);
 if(hu>0){P(new THREE.BoxGeometry(w*.78,hu,d*.78),mats(w*.78,hu,k+1),x,hb+hu/2,z)}
 var tw_=w*(hu>0?.78:1),td=d*(hu>0?.78:1);B(tw_*.5,2,td*.5,rf,x,h+1,z,S);B(1.6,1,1.2,STL,x-tw_*.25,h+.5+2,z+td*.2,S);B(1.2,.9,1.6,STL,x+tw_*.2,h+.45+2,z-td*.15,S);
 Cy(.12,h*.08+3,STL,x+tw_*.2,h+2+h*.04,z,S,6);if(h>50)P(new THREE.SphereGeometry(.25,8,6),AMBM,x+tw_*.2,h+3+h*.08,z)}
var cr_=rng(909),i_;
for(i_=-150;i_<=150;i_+=26){tower(i_+cr_()*6,-88,16+cr_()*8,16+cr_()*6,26+cr_()*44,i_/26+9|0);tower(i_+13,-122,18+cr_()*8,18,60+cr_()*60,(i_/26+12)|0)}
for(i_=0;i_<5;i_++){tower(-78-i_%2*20,-50+i_*-2-(i_>2?0:-i_*10),14,18,14+cr_()*14,i_);tower(78+i_%2*20,-45-i_*8,14,18,14+cr_()*14,i_+1)}
var asT=(function(){var r=rng(66),c=document.createElement("canvas");c.width=c.height=256;var x=c.getContext("2d"),i;x.fillStyle="#3a3b3f";x.fillRect(0,0,256,256);
 for(i=0;i<9000;i++){var v=40+r()*50|0;x.fillStyle="rgb("+v+","+v+","+(v+3)+")";x.fillRect(r()*256,r()*256,1+r()*2,1+r()*2)}
 for(i=0;i<14;i++){x.strokeStyle="rgba(15,15,17,"+(.25+r()*.3)+")";x.lineWidth=1;x.beginPath();var px=r()*256,py=r()*256;x.moveTo(px,py);for(var q=0;q<6;q++){px+=r()*40-20;py+=r()*40-20;x.lineTo(px,py)}x.stroke()}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t})();
function roadMat(w,l){var t=asT.clone();t.needsUpdate=true;t.repeat.set(w/6,l/6);return new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:.6,roughness:.85})}
var cityR=new THREE.Mesh(new THREE.PlaneGeometry(420,11),roadMat(420,11));cityR.rotation.x=-Math.PI/2;cityR.position.set(0,.03,-66);cityR.receiveShadow=true;S.add(cityR);
for(i_=-200;i_<200;i_+=8)B(3.5,.02,.18,WHT,i_,.05,-66,S);
[-60.2,-71.8].forEach(function(z){B(420,.12,2.2,CON,0,.06,z,S)});
var LAMP=new THREE.MeshStandardMaterial({color:0xfff2c0,emissive:0xffd98a,emissiveIntensity:1.2});
for(i_=-196;i_<=196;i_+=16){var lz=-59.8;Cy(.1,7,STL,i_,3.5,lz,S,8);B(.12,.12,1.8,STL,i_,7,lz-.9,S);B(.5,.1,.3,LAMP,i_,6.92,lz-1.7,S)}
var HL=new THREE.MeshStandardMaterial({color:0xfff6dc,emissive:0xfff0c0,emissiveIntensity:1.5}),TL=new THREE.MeshStandardMaterial({color:0xaa0000,emissive:0xff1010,emissiveIntensity:1.2}),CGL=M(0x1c2630,.05,.8);
var CBODY=(function(){var s=new THREE.Shape();[[-2.2,.38],[-2.2,.88],[-1.7,.98],[-1.25,1.0],[-.85,1.42],[.35,1.46],[1.0,1.02],[1.55,.95],[2.05,.82],[2.2,.62],[2.2,.38]].forEach(function(q,i){i?s.lineTo(q[0],q[1]):s.moveTo(q[0],q[1])});
 var g=new THREE.ExtrudeGeometry(s,{depth:1.64,bevelEnabled:true,bevelSize:.05,bevelThickness:.05,bevelSegments:3,curveSegments:6});g.translate(0,0,-.82);return g})(),
 CGLASS=(function(){var s=new THREE.Shape();[[-.82,1.04],[-.52,1.39],[.3,1.41],[.86,1.05]].forEach(function(q,i){i?s.lineTo(q[0],q[1]):s.moveTo(q[0],q[1])});
 var g=new THREE.ExtrudeGeometry(s,{depth:1.8,bevelEnabled:false});g.translate(0,0,-.9);return g})(),
 CARC={},PLT=M(0xf2f2f2,.5),ARCH=new THREE.RingGeometry(.37,.48,20);
var cars=[];[0xc0392b,0x2c3e50,0xecf0f1,0xf1c40f,0x27ae60,0x7f8c8d,0x2980b9,0xd35400,0x111111,0xbdc3c7].forEach(function(c,i){var dir=i%2?-1:1,g=car2(c,-150+i*30,dir>0?-64.2:-67.8,dir>0?0:Math.PI);cars.push({g:g,s:(.12+i%3*.05)*dir})});

/* ---------- all four sides: front + left + right city roads, buildings behind each ---------- */
function cRoad(x,z,vert,len){var m=new THREE.Mesh(new THREE.PlaneGeometry(vert?11:len,vert?len:11),roadMat(vert?11:len,vert?len:11));m.rotation.x=-Math.PI/2;m.position.set(x,vert?.035:.03,z);m.receiveShadow=true;S.add(m);
 for(var q=-len/2+2;q<len/2;q+=8)B(vert?.18:3.5,.02,vert?3.5:.18,WHT,vert?x:x+q,.06,vert?z+q:z,S);
 [-6.6,6.6].forEach(function(o){if(vert)B(2.2,.12,len,CON,x+o,.06,z,S);else B(len,.12,2.2,CON,x,.06,z+o,S)});
 for(var q=-len/2+8;q<len/2;q+=16){var o=vert?x-6.2:z-6.2;if(vert){Cy(.1,7,STL,o,3.5,z+q,S,8);B(1.8,.12,.12,STL,o+.9,7,z+q,S);B(.3,.1,.5,LAMP,o+1.7,6.92,z+q,S)}else{Cy(.1,7,STL,x+q,3.5,o+12.4,S,8);B(.12,.12,1.8,STL,x+q,7,o+11.5,S);B(.5,.1,.3,LAMP,x+q,6.92,o+10.7,S)}}}
cRoad(0,70,false,420);cRoad(-64,2,true,136);cRoad(64,2,true,136);
for(i_=-156;i_<=156;i_+=26){tower(i_+cr_()*6,86,16+cr_()*8,16,22+cr_()*36,(i_/26+8)|0);tower(i_+13,112,18+cr_()*6,18,50+cr_()*60,(i_/26+11)|0)}
for(i_=-10;i_<=62;i_+=22){[-1,1].forEach(function(sd,j){tower(sd*(86+cr_()*3),i_+cr_()*4,14+cr_()*4,16,16+cr_()*26,i_+j+9|0);tower(sd*114,i_+8,18,18,40+cr_()*50,i_+j+12|0)})}


function car2(c,x,z,ry){var g=new THREE.Group(),k=Math.abs(x*7+z*3|0)%3,pm=CARC[c]||(CARC[c]=new THREE.MeshPhysicalMaterial({color:c,metalness:.55,roughness:.28,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:1.3}));
 var bd=P(CBODY,pm,0,0,0,g),gl=P(CGLASS,CGL,0,0,0,g);bd.scale.set(k===2?.94:1,k===1?1.14:1,1);gl.scale.set(k===2?.94:1,k===1?1.14:1,1);
 B(1.0,.04,1.5,pm,-.1,1.46*(k===1?1.14:1),0,g);B(4.4,.1,1.7,DRK,0,.32,0,g);
 B(.06,.15,.38,HL,2.22,.72,.6,g);B(.06,.15,.38,HL,2.22,.72,-.6,g);B(.06,.14,.4,TL,-2.22,.78,.62,g);B(.06,.14,.4,TL,-2.22,.78,-.62,g);
 B(.05,.18,.7,DRK,2.22,.55,0,g);B(.2,.16,1.76,DRK,2.17,.42,0,g);B(.2,.16,1.76,DRK,-2.17,.42,0,g);B(.02,.14,.34,PLT,2.24,.42,0,g);B(.02,.14,.34,PLT,-2.24,.45,0,g);
 [-1,1].forEach(function(sd){B(.1,.1,.2,pm,.6,1.08,sd*.98,g);[-.15,.55].forEach(function(dx){B(.02,.5,.01,DRK,dx,.78,sd*.875,g)});B(.12,.03,.01,SIL,.38,.9,sd*.88,g);
  [[1.4,.74],[-1.4,.74]].forEach(function(w){var a=P(ARCH,DRK,w[0],.38,sd*.875,g);a.material.side;a.castShadow=false;if(sd<0)a.rotation.y=Math.PI;
   Cy(.36,.24,TIRE,w[0],.36,sd*w[1],g,20).rotation.x=Math.PI/2;Cy(.25,.26,SIL,w[0],.36,sd*w[1],g,12).rotation.x=Math.PI/2;Cy(.07,.28,DRK,w[0],.36,sd*w[1],g,8).rotation.x=Math.PI/2})});
 g.position.set(x,0,z);g.rotation.y=ry;S.add(g);return g}
var carsZ=[];[[-64,1],[64,1]].forEach(function(r,ri){for(var q=0;q<4;q++){var d=q%2?-1:1;carsZ.push({g:car2([0xc0392b,0x2c3e50,0xecf0f1,0xf1c40f,0x27ae60,0x7f8c8d,0x2980b9,0xd35400][ri*4+q],r[0]+(d>0?-1.6:1.6),-60+q*32,d>0?-Math.PI/2:Math.PI/2),s:.13*d})}});
for(i_=0;i_<5;i_++){var dd=i_%2?-1:1;cars.push({g:car2([0xbdc3c7,0x111111,0xe67e22,0x16a085,0x8e44ad][i_],-120+i_*55,dd>0?67.8:72.2,dd>0?0:Math.PI),s:.14*dd})}
[-64,64].forEach(function(cx){[-52,58,22].forEach(function(cz){for(var q=-4;q<=4;q++)B(.7,.02,3,WHT,cx+q*1.15,.075,cz,S)})});
[-40,0,40].forEach(function(cx){for(var q=-4;q<=4;q++)B(.7,.02,8,WHT,cx+q*1.15,.07,70,S)});
[-64,64].forEach(function(cx){for(var q=-50;q<66;q+=14){tree(cx-9.2,q,.7);tree(cx+9.2,q+7,.7)}});for(i_=-190;i_<190;i_+=18){tree(i_,-75.5,.7);tree(i_+9,66.2,.7)}

/* ---------- concrete building + scaffolding ---------- */
var bld=new THREE.Group();bld.position.set(-7,0,-8.5);S.add(bld);
[-7.5,0,7.5].forEach(function(x){[-4.5,4.5].forEach(function(z){B(.7,12.4,.7,CON,x,6.2,z,bld)})});
[0,4,8,12].forEach(function(y,i){B(16,.4,10,CON,0,y+.2,0,bld);if(i>0&&i<3)B(16,.3,.3,CON,0,y+.5,4.8,bld)});
var scf=new THREE.Group();scf.position.set(2.8,0,-8.5);S.add(scf);
[-1.1,1.1].forEach(function(x){[-4.5,-1.5,1.5,4.5].forEach(function(z){Cy(.05,13,STL,x,6.5,z,scf,8)});
 [4,8,12].forEach(function(y){beam(V(x,y,-4.5),V(x,y,4.5),.04,STL,scf);beam(V(x,y+1,-4.5),V(x,y+1,4.5),.03,STL,scf)})});
[4,8,12].forEach(function(y){B(2.3,.12,9.2,WOD,0,y+.05,0,scf);[-4.5,-1.5,1.5,4.5].forEach(function(z){beam(V(-1.1,y,z),V(1.1,y,z),.035,STL,scf)})});
for(var y=0;y<12;y+=4){beam(V(1.1,y,-4.5),V(1.1,y+4,-1.5),.03,STL,scf);beam(V(1.1,y,4.5),V(1.1,y+4,1.5),.03,STL,scf)}

/* ---------- realistic construction detail: blockwork, formwork, rebar, edge protection, netting ---------- */
(function(){
var G=bld,PLY=M(0xc99a5b,.85),REB=M(0x6b3f2a,.55,.6),BLU=M(0x2f6fd0,.5,.4),T=.25;
var BT=(function(){var r=rng(7),c=document.createElement("canvas");c.width=c.height=128;var x=c.getContext("2d"),i,j;x.fillStyle="#9a948a";x.fillRect(0,0,128,128);
 for(j=0;j<16;j++)for(i=-1;i<8;i++){var v=140+r()*55|0,ox=j%2?8:0;x.fillStyle="rgb("+v+","+(v*.46|0)+","+(v*.33|0)+")";x.fillRect(i*16+ox+1,j*8+1,14,6)}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t})(),bmc={};
function brkMat(len,h){var k=Math.round(len*2)+"_"+Math.round(h*2);if(bmc[k])return bmc[k];var t=BT.clone();t.needsUpdate=true;t.repeat.set(Math.max(.5,len/1.8),Math.max(.5,h/1.2));
 return bmc[k]=new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:.7,roughness:.93})}
function seg(xa,za,xb,zb,y,h,th){var w=Math.abs(xb-xa),d=Math.abs(zb-za);if(h<.02||(w<.02&&d<.02))return;var ww=w<.02?th:w,dd=d<.02?th:d;
 B(ww,h,dd,brkMat(Math.max(ww,dd),h),(xa+xb)/2,y+h/2,(za+zb)/2,G)}
function opening(xa,za,xb,zb,y,h,th,o){var al=Math.abs(xb-xa)>Math.abs(zb-za),len=al?Math.abs(xb-xa):Math.abs(zb-za),cx=(xa+xb)/2,cz=(za+zb)/2;
 if(o.sill>0){seg(xa,za,xb,zb,y,o.sill,th);B(al?len+.2:th+.16,.06,al?th+.16:len+.2,CON,cx,y+o.sill-.03,cz,G)}
 if(o.top<h){seg(xa,za,xb,zb,y+o.top,h-o.top,th);B(al?len+.5:th+.1,.18,al?th+.1:len+.5,CON,cx,y+o.top-.09,cz,G)}
 if(o.glass){B(al?len-.1:.04,o.top-o.sill-.1,al?.04:len-.1,GLH,cx,y+(o.sill+o.top)/2,cz,G);B(al?.05:.06,o.top-o.sill-.1,al?.06:.05,WHT,cx,y+(o.sill+o.top)/2,cz,G)}}
function wallX(x0,x1,z,y,h,th,ops){var cur=x0;(ops||[]).forEach(function(o){seg(cur,z,o.a,z,y,h,th);opening(o.a,z,o.b,z,y,h,th,o);cur=o.b});seg(cur,z,x1,z,y,h,th)}
function wallZ(z0,z1,x,y,h,th,ops){var cur=z0;(ops||[]).forEach(function(o){seg(x,cur,x,o.a,y,h,th);opening(x,o.a,x,o.b,y,h,th,o);cur=o.b});seg(x,cur,x,z1,y,h,th)}

/* ground floor: finished blockwork with windows and doors */
wallX(-7.85,7.85,-4.75,.4,3.6,T,[{a:-5.6,b:-3.8,sill:1,top:2.6,glass:1},{a:1.4,b:3.2,sill:1,top:2.6,glass:1}]);
wallZ(-4.75,4.75,-7.85,.4,3.6,T,[{a:-3.8,b:-2.2,sill:1,top:2.6,glass:1},{a:-.9,b:.9,sill:0,top:2.3}]);
B(.05,2.2,1.7,DOOR,-7.85,1.5,0,G);
wallX(-7.85,7.85,4.75,.4,3.6,T,[{a:-6.6,b:-5,sill:1,top:2.6,glass:1},{a:-2.5,b:2.5,sill:0,top:3.2},{a:4.8,b:6.4,sill:1,top:2.6,glass:1}]);
wallZ(-4.75,0,7.85,.4,3.6,T,[{a:-1.6,b:-.2,sill:0,top:2.3}]);
wallZ(0,4.75,7.85,.4,1.5,T,[]);
/* first floor: blockwork still going up */
wallX(-7.85,3,-4.75,4.4,2.0,T,[]);wallZ(-4.75,-.5,-7.85,4.4,1.2,T,[]);wallX(-7.85,-3.8,4.75,4.4,1.7,T,[]);
B(1.2,.7,1,brkMat(1.2,.7),-2,4.75,2,G);B(1.2,.7,1,brkMat(1.2,.7),-.6,4.75,2.3,G);B(.8,.35,.55,M(0x4a4a4a,.7),-3.2,4.6,3.2,G);

/* concrete lift / stair core, climbing above the top deck */
B(2.6,13.2,3,CON,5.8,7,-3.2,G);
[.4,4.4,8.4].forEach(function(f){B(1.1,2.2,.06,DRK,5.8,f+1.1,-1.7,G)});
[4.7,5.4,6.1,6.8].forEach(function(x){[-4.5,-1.9].forEach(function(z){Cy(.02,1.6,REB,x,14.4,z,G,6);Cy(.05,.08,ORG,x,15.24,z,G,8)})});

/* column starter bars and ties on the top deck, column formwork on the front row */
function ring(x,y,z){[-.22,.22].forEach(function(o){B(.5,.015,.015,REB,x,y,z+o,G);B(.015,.015,.5,REB,x+o,y,z,G)})}
[[-7.5,-4.5],[7.5,-4.5],[7.5,4.5],[0,-4.5]].forEach(function(c){[[-.22,-.22],[.22,-.22],[.22,.22],[-.22,.22]].forEach(function(o){Cy(.018,1.5,REB,c[0]+o[0],13.15,c[1]+o[1],G,6)});[12.7,13.1,13.5].forEach(function(y){ring(c[0],y,c[1])})});
[-7.5,0].forEach(function(x){B(.95,1.5,.95,PLY,x,13.15,4.5,G);[12.75,13.5].forEach(function(y){B(1.08,.07,1.08,STL,x,y,4.5,G)});beam(V(x+.45,13.7,4.95),V(x+1.3,12.4,6),.025,STL,G)});

/* slab reinforcement mesh waiting for the pour */
var q;for(q=-1.2;q<=4.21;q+=.3)B(4,.02,.02,REB,5.2,12.55,q,G);for(q=3.2;q<=7.21;q+=.3)B(.02,.02,5.4,REB,q,12.58,1.5,G);
B(.1,.25,5.6,PLY,3.1,12.52,1.5,G);[3.4,5.2,7].forEach(function(x){[-1,4.1].forEach(function(z){B(.12,.14,.12,CON,x,12.47,z,G)})});

/* slab props and bearers under the top deck */
var zs=[-1,1.8];
[-6,-3.6,-1.3,1.3,3.6,6].forEach(function(x){zs.forEach(function(z){Cy(.04,3.55,BLU,x,10.18,z,G,8);B(.22,.03,.22,STL,x,8.42,z,G);B(.25,.04,.25,STL,x,11.98,z,G);Cy(.065,.35,BLU,x,9.2,z,G,8)})});
zs.forEach(function(z){B(15.6,.12,.14,WOD,0,11.9,z,G)});[-3,0,3].forEach(function(x){B(.12,.1,5,WOD,x,11.83,.4,G)});

/* edge protection */
var YR=M(0xf2b21a,.55,.2);
function rail(ax,az,bx,bz,y){var dx=bx-ax,dz=bz-az,L=Math.sqrt(dx*dx+dz*dz),n=Math.max(1,Math.round(L/2.4)),i;
 for(i=0;i<=n;i++)Cy(.03,1.1,YR,ax+dx*i/n,y+.55,az+dz*i/n,G,6);
 beam(V(ax,y+1.05,az),V(bx,y+1.05,bz),.022,YR,G);beam(V(ax,y+.55,az),V(bx,y+.55,bz),.022,YR,G);
 if(Math.abs(dz)<.01)B(L,.15,.03,WOD,(ax+bx)/2,y+.1,az,G);else B(.03,.15,L,WOD,ax,y+.1,(az+bz)/2,G)}
rail(-7.8,4.8,7.8,4.8,12.4);rail(-7.8,-4.8,7.8,-4.8,12.4);rail(-7.8,-4.8,-7.8,4.8,12.4);
rail(-7.8,4.8,7.8,4.8,8.4);rail(-7.8,-4.8,7.8,-4.8,8.4);rail(-7.8,-4.8,-7.8,4.8,8.4);
rail(-3.8,4.8,7.8,4.8,4.4);rail(-7.8,-.5,-7.8,4.8,4.4);rail(3,-4.8,4.5,-4.8,4.4);

/* scaffold: base plates, toe boards, ties, access ladders, debris netting */
[-1.1,1.1].forEach(function(x){[-4.5,-1.5,1.5,4.5].forEach(function(z){B(.3,.04,.3,STL,x,.02,z,scf);B(.5,.05,.5,WOD,x,.0,z,scf)})
 ;[4,8,12].forEach(function(y){B(.04,.15,9.2,WOD,x,y+.19,0,scf)})});
[3,7,11].forEach(function(y){[-3,0,3].forEach(function(z){beam(V(-1.1,y,z),V(-1.75,y,z),.03,STL,scf)})});
function ladder(y0,y1,zb,zt){var i,n=Math.round((y1-y0)/.3);[-.22,.22].forEach(function(x){beam(V(x,y0,zb),V(x,y1,zt),.025,SIL,scf)});
 for(i=1;i<n;i++){var t=i/n;B(.44,.03,.03,SIL,0,y0+(y1-y0)*t,zb+(zt-zb)*t,scf)}}
ladder(0,4.2,6,4.5);ladder(4,8.2,-6,-4.5);ladder(8,12.2,6,4.5);
var NT=(function(){var c=document.createElement("canvas");c.width=c.height=64;var x=c.getContext("2d");x.strokeStyle="rgba(46,125,79,.95)";x.lineWidth=3;
 x.beginPath();x.moveTo(0,0);x.lineTo(64,64);x.moveTo(0,64);x.lineTo(64,0);x.moveTo(-32,32);x.lineTo(32,96);x.moveTo(32,-32);x.lineTo(96,32);x.moveTo(-32,32);x.lineTo(32,-32);x.moveTo(32,96);x.lineTo(96,32);x.stroke();
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(24,34);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t})();
var net=new THREE.Mesh(new THREE.PlaneGeometry(9.4,13.4),new THREE.MeshBasicMaterial({map:NT,transparent:true,side:THREE.DoubleSide,depthWrite:false,color:0xbfe8cc}));
net.position.set(1.25,6.7,0);net.rotation.y=Math.PI/2;scf.add(net);

/* ---------- site infrastructure: gravel pad, perimeter fencing, gate, signage, cabins, material stores ---------- */
function dk(c,f){return(((c>>16&255)*f|0)<<16)|(((c>>8&255)*f|0)<<8)|((c&255)*f|0)}
var PIPE=M(0xd9792b,.6),RUB=M(0x7d7062,1);
var gp=htG.clone();gp.needsUpdate=true;gp.repeat.set(6,5);
var pad=new THREE.Mesh(new THREE.PlaneGeometry(30,22),new THREE.MeshStandardMaterial({map:gp,bumpMap:gp,bumpScale:1,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
pad.rotation.x=-Math.PI/2;pad.position.set(-5,.012,-8.5);pad.receiveShadow=true;S.add(pad);
var ap2=rt.clone();ap2.needsUpdate=true;ap2.repeat.set(2,2);
var acc=new THREE.Mesh(new THREE.PlaneGeometry(7.5,12),new THREE.MeshStandardMaterial({map:ap2,color:0x8c8c8c,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
acc.rotation.x=-Math.PI/2;acc.position.set(0,.024,18.5);acc.receiveShadow=true;S.add(acc);

var HM=(function(){var c=document.createElement("canvas");c.width=c.height=64;var x=c.getContext("2d"),i;x.strokeStyle="rgba(178,188,198,1)";x.lineWidth=2.5;
 for(i=4;i<64;i+=8){x.beginPath();x.moveTo(i,0);x.lineTo(i,64);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(64,i);x.stroke()}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t})();
function fenceRun(x0,z0,x1,z1,screen){var dx=x1-x0,dz=z1-z0,L=Math.sqrt(dx*dx+dz*dz),g=new THREE.Group(),n=Math.max(1,Math.round(L/3.5)),i;
 g.position.set(x0,0,z0);g.rotation.y=Math.atan2(-dz,dx);S.add(g);
 var t=HM.clone();t.needsUpdate=true;t.repeat.set(L/.8,2/.8);
 var mm=new THREE.Mesh(new THREE.PlaneGeometry(L,2),new THREE.MeshStandardMaterial({map:t,transparent:true,alphaTest:.3,side:THREE.DoubleSide,roughness:.5,metalness:.6}));mm.position.set(L/2,1.15,0);g.add(mm);
 for(i=0;i<=n;i++){var px=L*i/n;Cy(.03,2.2,STL,px,1.1,0,g,6).castShadow=false;B(.14,.2,.7,CON,px,.1,0,g).castShadow=false}
 B(L,.05,.05,STL,L/2,2.15,0,g).castShadow=false;B(L,.05,.05,STL,L/2,.2,0,g).castShadow=false;
 if(screen){var sm=new THREE.Mesh(new THREE.PlaneGeometry(L,1.9),new THREE.MeshStandardMaterial({color:0x1d3f5e,roughness:.85,side:THREE.DoubleSide}));sm.position.set(L/2,1.15,.02);g.add(sm)}
 return g}
fenceRun(-48,24,-4,24,1);fenceRun(4,24,48,24,1);fenceRun(-4,24,-3.1,21,0);fenceRun(4,24,3.1,21,0);
fenceRun(48,24,48,17);fenceRun(48,9,48,-30);fenceRun(48,-30,-48,-30);fenceRun(-48,-30,-48,9);fenceRun(-48,17,-48,24);
[-4.1,4.1].forEach(function(x){B(.2,2.6,.2,STL,x,1.3,24,S)});

function sign(lines,bg,fg,w,h,x,y,z,ry){var W=w>8?1024:512,H=Math.round(W*h/w),c=document.createElement("canvas");c.width=W;c.height=H;var cx=c.getContext("2d");
 cx.fillStyle=bg;cx.fillRect(0,0,W,H);cx.strokeStyle=fg;cx.lineWidth=W/50;cx.strokeRect(W/40,W/40,W-W/20,H-W/20);cx.fillStyle=fg;cx.textAlign="center";cx.textBaseline="middle";
 var n=lines.length,lh=(H-W/10)/n;lines.forEach(function(l,i){var fs=Math.min(lh*.78,(W-W/8)/(l.length*.62));cx.font="800 "+fs+"px system-ui,Arial,sans-serif";cx.fillText(l,W/2,W/20+lh*(i+.5))});
 var t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;
 var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.6}));m.position.set(x,y,z);m.rotation.y=ry||0;S.add(m);return m}
sign(["DANGER","CONSTRUCTION SITE","AUTHORISED PERSONNEL ONLY"],"#f2b21a","#111111",3.2,1.7,10,1.1,24.06);
sign(["HARD HATS","HI-VIS & SAFETY BOOTS","MUST BE WORN"],"#1f5fbf","#ffffff",3.2,1.7,14,1.1,24.06);
sign(["ALL VISITORS","REPORT TO","SITE OFFICE"],"#1a7f4b","#ffffff",3.2,1.7,18,1.1,24.06);
sign(["BUILDING THE FUTURE. PROTECTING EVERY WORKER."],"#0f2a43","#ffd166",16,1.1,-24,1.1,24.06);
sign(["SAFETY FIRST. ALWAYS."],"#0f2a43","#ffd166",12,1.1,33,1.1,24.06);
sign(["SITE ENTRANCE","ALL VEHICLES SLOW - 10 KM/H"],"#f2b21a","#111111",5,1.2,0,3.2,24.1);
Cy(.06,1.4,STL,0,.7+2.6,24.05,S,8);

var CT=(function(){var c=document.createElement("canvas");c.width=c.height=64;var x=c.getContext("2d"),i;x.fillStyle="#ffffff";x.fillRect(0,0,64,64);
 for(i=0;i<64;i+=16){x.fillStyle="#b9b9b9";x.fillRect(i,0,6,64);x.fillStyle="#dcdcdc";x.fillRect(i+6,0,4,64)}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(15,1);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t})();
function cont(x,z,ry,col,lvl,fit,endDoor){var g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:col,map:CT,roughness:.55,metalness:.35}),m2=M(dk(col,.7),.6,.4);
 g.position.set(x,lvl||0,z);g.rotation.y=ry||0;S.add(g);
 B(6,2.6,2.4,m,0,1.3,0,g);B(6.12,.1,2.52,m2,0,2.65,0,g);B(6.12,.1,2.52,m2,0,.05,0,g);[-2.95,2.95].forEach(function(px){[-1.2,1.2].forEach(function(pz){B(.12,2.6,.12,m2,px,1.3,pz,g)})});
 if(fit){[-1.8,.2].forEach(function(wx){B(1.2,.9,.07,GLS,wx,1.6,1.22,g);B(1.3,.07,.12,SIL,wx,1.12,1.25,g)});
  if(!endDoor){B(.9,2,.07,DOOR,2.1,1.05,1.22,g);B(1.4,.12,.9,STL,2.1,.45,1.7,g);B(1.4,.12,.5,STL,2.1,.22,2.1,g)}
  else B(.07,2,.9,DOOR,-3.04,1.05,0,g);
  B(.9,.5,.6,SIL,-2,2.95,0,g)}
 return g}
cont(30,-22,0,0x2c5f8a,0,1);cont(30,-22,0,0xd9dad4,2.6,1,1);cont(36.2,-22,0,0x6b7f4a,0,1);cont(-38,-24,.3,0x8a9a6c,0,1);
(function(){var i;for(i=0;i<13;i++)B(.3,.05,1,STL,23.9+i*.26,.2*(i+1)-.02,-22,S);
 [-.55,.55].forEach(function(o){beam(V(23.8,0,-22+o),V(27,2.6,-22+o),.04,STL,S);beam(V(23.8,1,-22+o),V(27,3.6,-22+o),.025,YEL,S)});B(1.6,.08,1.4,STL,26.6,2.62,-22,S)})();
[0,1,2,3].forEach(function(i){B(1.1,2.3,1.1,M([0x2e8bc0,0x2e8bc0,0x3c9d5c,0x2e8bc0][i],.5),42+i*1.3,1.15,-20,S);B(.7,1.6,.04,M(0xeaeaea,.5),42+i*1.3,1.2,-19.43,S)});
B(1.8,1,.8,YEL,24.5,.6,-18,S);Cy(.06,.9,STL,25.2,1.5,-18.2,S,8);
(function(){var lx=-40,lz=-6;B(1.8,.4,2.8,ORG,lx,.35,lz,S);Cy(.12,8,STL,lx,4.4,lz,S,8);B(2,.9,.18,STL,lx,8.6,lz,S);[-.7,0,.7].forEach(function(o){B(.5,.35,.1,LAMP,lx+o,8.6,lz+.12,S)});
 [-1,1].forEach(function(s){B(.12,.3,1.5,STL,lx+s*1.1,.2,lz+1.6,S)})})();

/* material stores */
function pal(x,z,ry,mat,pw,ph,pd,stack){var g=new THREE.Group(),i;g.position.set(x,0,z);g.rotation.y=ry;S.add(g);B(pw+.1,.14,pd+.1,WOD,0,.07,0,g);
 for(i=0;i<stack;i++)B(pw,ph,pd,mat,0,.15+ph*(i+.5),0,g);return g}
pal(-20.8,-6,.15,brkMat(1.2,.8),1.2,.8,1,2);pal(-20.6,-7.4,.05,brkMat(1.2,.8),1.2,.8,1,2);pal(-20.5,-9,-.1,M(0x9b9a95,.95),1.2,.9,1,2);
pal(-11,-17,.2,PLY,2.4,.45,1.2,1);pal(-8.5,-16,.1,M(0xd2b07a,.85),3,.4,.9,3);
function rack(x,z,ry){var g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;S.add(g);[-2,0,2].forEach(function(bx){B(.14,.14,.8,WOD,bx,.07,0,g)});
 [[0,0],[0,.09],[0,-.09],[.08,.045],[.08,-.045],[-.08,.045],[-.08,-.045]].forEach(function(p){Cy(.04,6,REB,0,.28+p[0],p[1],g,8).rotation.z=Math.PI/2});[-2,0,2].forEach(function(bx){B(.03,.24,.24,SIL,bx,.28,0,g)})}
rack(13,-15.5,0);rack(13,-14.2,0);
function pipes(x,z,ry){var g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;S.add(g);[[-.25,.12],[0,.12],[.25,.12],[-.125,.33],[.125,.33],[0,.54]].forEach(function(p){Cy(.12,3,PIPE,0,p[1],p[0],g,12).rotation.z=Math.PI/2});[-1,1].forEach(function(bx){B(.12,.12,.9,WOD,bx,.04,0,g)})}
pipes(15,-18,.05);
function skip(x,z,ry){var g=new THREE.Group(),sm=M(0x2a7a3a,.6,.15),i;g.position.set(x,0,z);g.rotation.y=ry;S.add(g);B(3.2,.08,1.5,sm,0,.3,0,g);[-.75,.75].forEach(function(o){B(3.2,.9,.08,sm,0,.75,o,g)});[-1.6,1.6].forEach(function(o){B(.08,.9,1.5,sm,o,.75,0,g)});
 B(2.8,.4,1.3,RUB,0,.55,0,g);for(i=0;i<5;i++){var r=rng(40+i),b=B(.4+r()*.5,.25,.3+r()*.4,RUB,-1.1+i*.55,.85,r()*.6-.3,g);b.rotation.y=r()*3}
 [-1.4,1.4].forEach(function(o){B(.12,.12,1.7,STL,o,.12,0,g)})}
skip(-14,-23,.2);skip(40,-12,-.4);
})();


/* ---------- building finishes: edge beams, render, shutter, stud partitions, services ---------- */
(function(){var G=bld,RND=M(0xd9d2c0,.95),SHT=M(0x8d939c,.4,.6),PB=M(0xe8e6df,.9);
[4,8,12].forEach(function(y){B(16.3,.5,.4,CON,0,y-.25,4.85,G);B(16.3,.5,.4,CON,0,y-.25,-4.85,G);B(.4,.5,9.4,CON,-7.85,y-.25,0,G);B(.4,.5,9.4,CON,7.85,y-.25,0,G)});
B(2.5,3.1,.04,RND,-3.75,1.95,4.9,G);B(2.3,3.1,.04,RND,3.65,1.95,4.9,G);B(5.2,3.1,.04,RND,-1.2,1.95,-4.9,G);
B(5.3,.4,.3,SHT,0,3.4,4.86,G);B(5,.9,.05,M(0xaab0b8,.45,.7),0,2.95,4.8,G);for(var y=2.55;y<3.4;y+=.1)B(5,.02,.06,DRK,0,y,4.83,G);
Cy(.05,3.5,M(0x333333,.6),-7.95,2.15,5.1,G,8);B(.25,.8,.6,M(0x3a6ea8,.5,.4),-8.1,1.6,2.8,G);beam(V(-8.1,1.2,2.8),V(-10,.05,3.6),.03,DRK,G);
function stud(x0,x1,z,y,h,bt){var x;B(x1-x0,.05,.1,STL,(x0+x1)/2,y+.03,z,G);B(x1-x0,.05,.1,STL,(x0+x1)/2,y+h,z,G);for(x=x0;x<=x1+.01;x+=.6)B(.05,h,.1,STL,x,y+h/2,z,G);if(bt>x0)B(bt-x0,h-.1,.02,PB,(x0+bt)/2,y+h/2,z+.07,G)}
stud(-2.2,2.2,2.5,.4,3.5,0);stud(-6,-1,1,4.4,3.5,-3.4);
B(2.4,.45,1.2,PB,2,4.62,2.6,G);B(1.4,.3,.9,M(0x8a8f96,.5,.5),-5.5,4.55,3.4,G);
})();
/* ---------- tower crane ---------- */
var crane=new THREE.Group();crane.position.set(9,0,-4.5);S.add(crane);
B(4.4,.8,4.4,CON,0,.4,0,crane);
var c4=[[-.8,-.8],[.8,-.8],[.8,.8],[-.8,.8]],MH=28;
c4.forEach(function(p){beam(V(p[0],.8,p[1]),V(p[0],MH,p[1]),.07,YEL,crane)});
for(var y=.8;y+1.6<=MH+.001;y+=1.6){for(var i=0;i<4;i++){var a=c4[i],b=c4[(i+1)%4];
 beam(V(a[0],y+1.6,a[1]),V(b[0],y+1.6,b[1]),.035,YEL,crane);beam(V(a[0],y,a[1]),V(b[0],y+1.6,b[1]),.035,YEL,crane)}}
var top=new THREE.Group();top.position.y=MH;crane.add(top);
Cy(1.1,.6,STL,0,.3,0,top,20);B(1.2,1.4,1.6,M(0xeeeeee,.5),-.3,1.3,-1.4,top);B(1.22,.7,.1,GLS,-.3,1.5,-2.22,top);
var apex=V(0,7,0);[[-.7,-.7],[.7,-.7],[.7,.7],[-.7,.7]].forEach(function(p){beam(V(p[0],.6,p[1]),apex,.06,YEL,top)});
function ty(x){return 1.9-x*.033}
for(var x=0;x<30;x+=2){[.55,-.55].forEach(function(z){beam(V(x,.6,z),V(x+2,.6,z),.05,YEL,top)});
 beam(V(x,.6,.55),V(x+1,ty(x+1),0),.03,YEL,top);beam(V(x+1,ty(x+1),0),V(x+2,.6,-.55),.03,YEL,top);beam(V(x,.6,.55),V(x,.6,-.55),.03,YEL,top);
 beam(V(x,ty(x),0),V(x+2,ty(x+2),0),.05,YEL,top)}
for(var x=0;x>-10;x-=2){[.55,-.55].forEach(function(z){beam(V(x,.6,z),V(x-2,.6,z),.05,YEL,top)});beam(V(x,.6,.55),V(x,.6,-.55),.03,YEL,top)}
[-5,-7.5,-9].forEach(function(x){B(1.2,1.3,1.9,CON,x,1.25,0,top)});
beam(apex,V(30,.9,0),.025,STL,top);beam(apex,V(-10,.6,0),.025,STL,top);
var trol=new THREE.Group();trol.position.set(14,0,0);top.add(trol);B(1,.4,1.3,YEL,0,.2,0,trol);
var RL=20;beam(V(0,0,0),V(0,-RL,0),.025,STL,trol);B(.5,.6,.5,STL,0,-RL,0,trol);B(1.9,.9,1.2,BRK,0,-RL-.9,0,trol);
beam(V(0,-RL,0),V(-.8,-RL-.5,.5),.02,STL,trol);beam(V(0,-RL,0),V(.8,-RL-.5,-.5),.02,STL,trol);
var ring=new THREE.Mesh(new THREE.RingGeometry(3.4,3.9,48),new THREE.MeshBasicMaterial({color:0xff8c32,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
ring.rotation.x=-Math.PI/2;ring.position.y=.06;S.add(ring);
var disc=new THREE.Mesh(new THREE.CircleGeometry(3.4,48),new THREE.MeshBasicMaterial({color:0xff4d00,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.x=-Math.PI/2;disc.position.y=.05;S.add(disc);

/* ---------- excavator ---------- */
var exc=new THREE.Group();exc.position.set(-14.5,0,5);exc.rotation.y=.5;S.add(exc);
[-1.4,1.4].forEach(function(x){B(.9,.9,4.6,TRKM,x,.55,0,exc);Cy(.5,.95,STL,x,.55,2.2,exc,16).rotation.z=Math.PI/2;Cy(.5,.95,STL,x,.55,-2.2,exc,16).rotation.z=Math.PI/2});
var sw=new THREE.Group();sw.position.y=1.15;exc.add(sw);Cy(1.2,.4,STL,0,.2,0,sw,20);
B(2.5,.6,3.2,YEL,0,.7,-.3,sw);B(2.2,1.7,1.9,YEL,-.4,1.65,.55,sw);B(2.0,1.0,.1,GLS,-.4,1.85,1.52,sw);B(2.6,1.3,1.8,YEL,0,1.3,-1.6,sw);B(2.6,.5,1.2,STL,0,.8,-2.5,sw);
var bp=new THREE.Group();bp.position.set(.6,1.1,1.3);sw.add(bp);B(.5,.6,4.4,YEL,0,.3,2.2,bp);
var ap=new THREE.Group();ap.position.set(0,.3,4.4);bp.add(ap);B(.4,.45,3.2,YEL,0,0,1.6,ap);
var bk=new THREE.Group();bk.position.set(0,0,3.2);ap.add(bk);B(.3,1.0,.9,STL,0,-.5,.2,bk);B(1.3,.1,1.1,STL,0,-1.0,.4,bk);B(1.3,.8,.1,STL,0,-.65,.9,bk);
for(var i=-2;i<=2;i++)B(.12,.3,.1,DRK,i*.28,-1.08,1.0,bk);

/* ---------- haul truck, cones, barriers ---------- */
var trk=new THREE.Group();S.add(trk);
B(2.8,.6,7,DRK,0,1.1,0,trk);B(2.2,1.9,2.0,M(0xff8c32,.5,.2),0,2.2,2.6,trk);B(2.0,.9,.1,GLS,0,2.5,3.62,trk);
var bed=new THREE.Group();bed.position.set(0,1.5,-.9);trk.add(bed);B(3.0,1.6,4.6,M(0xf0a020,.6,.2),0,.8,0,bed);B(3.2,.2,1.4,M(0xf0a020,.6,.2),0,1.7,2.1,bed);
var wh=[];[[-1.5,2.6],[1.5,2.6],[-1.5,-1.4],[1.5,-1.4],[-1.5,-2.6],[1.5,-2.6]].forEach(function(p){wh.push(wheel(trk,p[0],.95,p[1],.95,.75))});
var cone=new THREE.ConeGeometry(.28,.75,12);
for(var i=0;i<14;i++){var a=i/14*Math.PI*2;P(cone,M(0xff5a00,.6),-14.5+Math.cos(a)*7.5,.38,5+Math.sin(a)*7.5)}
for(var i=0;i<5;i++)B(.5,.9,2.6,STRIPE,18,.45,-12+i*3,S);

/* ---------- extra fleet: 8 more machines ---------- */
var rams=[];
function ram(pa,pl,pb,ql){var A=new THREE.Object3D(),Bn=new THREE.Object3D();A.position.copy(pl);Bn.position.copy(ql);pa.add(A);pb.add(Bn);
 var m=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1,8),M(0xd5dae2,.2,1)),b=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.6,8),DRK);
 m.castShadow=b.castShadow=true;S.add(m);S.add(b);rams.push({A:A,B:Bn,m:m,b:b})}
var _a=V(0,0,0),_b=V(0,0,0),_d=V(0,0,0);
function updRams(){rams.forEach(function(r){r.A.getWorldPosition(_a);r.B.getWorldPosition(_b);_d.subVectors(_b,_a);var l=_d.length()||1;_d.divideScalar(l);
 r.m.position.copy(_a).addScaledVector(_d,l/2);r.m.scale.y=l;r.m.quaternion.setFromUnitVectors(UP,_d);r.b.position.copy(_a).addScaledVector(_d,.3);r.b.quaternion.copy(r.m.quaternion)})}
ram(sw,V(.6,.45,.9),bp,V(0,.1,1.9));ram(bp,V(0,.8,1.2),ap,V(0,.35,.8));ram(ap,V(0,.35,1.3),bk,V(0,-.2,.1));
beacon(exc,0,3.9,-1.6);beacon(trk,0,3.3,2.6);

/* wheel loader */
var ldr=new THREE.Group();ldr.position.set(-24,0,14);ldr.rotation.y=.6;S.add(ldr);
B(2.6,1.5,3,YEL,0,1.7,-1.3,ldr);B(2.2,.8,1.8,YEL,0,2.7,-2.1,ldr);B(2.5,1.2,.9,DRK,0,1.6,-3.1,ldr);Cy(.09,1.1,STL,.7,3.4,-2.3,ldr,8);B(2,1,2.5,YEL,0,1.3,1.7,ldr);
cab(ldr,1.9,1.8,1.8,0,3.5,-.1);beacon(ldr,0,4.7,-.1);
[[-1.45,1.9],[1.45,1.9],[-1.45,-1.5],[1.45,-1.5]].forEach(function(p){wheel(ldr,p[0],1,p[1],1,.85)});
var la=new THREE.Group();la.position.set(0,1.9,2.4);ldr.add(la);[-.8,.8].forEach(function(s){B(.22,.34,3.3,YEL,s,0,1.55,la)});
var lb=new THREE.Group();lb.position.set(0,0,3.2);la.add(lb);B(3,.12,1.5,STL,0,-.5,.6,lb);B(3,1.1,.12,STL,0,0,-.1,lb);[-1.5,1.5].forEach(function(s){B(.12,1,1.5,STL,s,0,.6,lb)});B(3,.14,.18,DRK,0,-.52,1.38,lb);

/* bulldozer */
var doz=new THREE.Group();doz.position.set(-25,0,-2);doz.rotation.y=1.1;S.add(doz);
[-1.3,1.3].forEach(function(x){B(.85,1.1,4.6,TRKM,x,.7,0,doz);[2.2,-2.2].forEach(function(z){Cy(.62,.85,STL,x,.7,z,doz,16).rotation.z=Math.PI/2});Cy(.3,.9,SIL,x,1.35,0,doz,10).rotation.z=Math.PI/2});
B(2.2,1,3.4,YEL,0,1.6,0,doz);B(1.8,.9,1.8,YEL,0,2.3,1.5,doz);cab(doz,1.8,1.5,1.5,0,2.9,-.7);B(2,.6,.8,DRK,0,1.5,-2,doz);beacon(doz,.7,4,-.7);
var bl=new THREE.Group();bl.position.set(0,.8,3);doz.add(bl);B(3.8,1.3,.28,STL,0,.5,.9,bl);B(3.9,.2,.5,SIL,0,-.1,1,bl);[-1.4,1.4].forEach(function(x){B(.2,.25,3,YEL,x,.4,-.5,bl)});

/* cement mixer truck */
var mix=new THREE.Group();mix.position.set(23,0,9);mix.rotation.y=.4;S.add(mix);
B(2.4,.5,8,DRK,0,1.1,0,mix);cab(mix,2.3,1.9,2.1,0,2.3,3,M(0xf5f5f5,.5));B(2.4,.9,.6,ORG,0,1.5,4.2,mix);beacon(mix,0,3.5,3);
[[-1.2,3.3],[1.2,3.3],[-1.2,-1.6],[1.2,-1.6],[-1.2,-3],[1.2,-3]].forEach(function(p){wheel(mix,p[0],.95,p[1],.95,.7)});
var dr=new THREE.Group();dr.position.set(0,3.1,-1.4);dr.rotation.x=-1.37;mix.add(dr);var dm=new THREE.Group();dr.add(dm);
P(new THREE.LatheGeometry([[0,-3],[.9,-2.8],[1.4,-1.8],[1.45,0],[1.2,1.8],[.6,2.9],[.5,3]].map(function(p){return new THREE.Vector2(p[0],p[1])}),28),new THREE.MeshStandardMaterial({color:0xe9e9e4,roughness:.5,metalness:.1,side:THREE.DoubleSide}),0,0,0,dm);
for(var i=0;i<8;i++){var qa=i*.8;B(.08,.7,.3,ORG,Math.cos(qa)*1.46,-1.7+i*.35,Math.sin(qa)*1.46,dm).rotation.y=-qa}
var ch=B(.5,.3,2.4,STL,0,2.7,-4.2,mix);ch.rotation.x=.4;

/* mobile hydraulic crane */
var mcr=new THREE.Group();mcr.position.set(-26,0,-15);mcr.rotation.y=Math.PI/2;S.add(mcr);
B(3,.9,10,YEL,0,1.2,0,mcr);cab(mcr,2.6,2.1,2.2,0,2.5,4);beacon(mcr,0,3.8,4);
[[-1.4,4],[1.4,4],[-1.4,2],[1.4,2],[-1.4,-2],[1.4,-2],[-1.4,-4],[1.4,-4]].forEach(function(p){wheel(mcr,p[0],.9,p[1],.9,.65)});
[-1,1].forEach(function(s){[-2.8,2.8].forEach(function(z){B(2.4,.35,.35,STL,s*2.7,1.1,z,mcr);Cy(.15,1,STL,s*3.8,.6,z,mcr,8);B(1.1,.2,1.1,DRK,s*3.8,.1,z,mcr)})});
var msw=new THREE.Group();msw.position.set(0,1.7,-1);mcr.add(msw);Cy(1.4,.4,STL,0,.2,0,msw,20);B(2.8,1.6,4.2,YEL,0,1.2,-.8,msw);cab(msw,1.6,1.5,1.8,.9,1.7,1.7);B(2.8,1.2,1.6,DRK,0,1,-3.1,msw);
var mb=new THREE.Group();mb.position.set(0,2,1);mb.rotation.x=-.85;msw.add(mb);
B(1,1,5.5,YEL,0,0,2.7,mb);B(.8,.8,5,M(0xe0a010,.5,.3),0,0,6.5,mb);B(.55,.55,4,STL,0,0,10,mb);
beam(V(0,11,8.9),V(0,4,8.9),.03,STL,msw);B(.5,.7,.5,STL,0,3.6,8.9,msw);B(2,.5,1.2,CON,0,2.9,8.9,msw);

/* forklift with pallet */
var fk=new THREE.Group();fk.position.set(13.5,0,2.5);fk.rotation.y=-.5;S.add(fk);
B(1.4,.9,2.4,M(0xff7a00,.5,.2),0,.95,-.2,fk);B(1.3,.7,.8,DRK,0,.9,-1.5,fk);B(.5,.4,.5,DRK,0,1.75,-.4,fk);beacon(fk,0,3.3,-.4);
[[-.6,.5],[.6,.5],[-.6,-.9],[.6,-.9]].forEach(function(p){Cy(.04,1.6,STL,p[0],2.3,p[1],fk,6)});B(1.4,.06,1.6,STL,0,3.1,-.2,fk);
[[-.7,.6,.45,.35],[.7,.6,.45,.35],[-.6,-1.3,.38,.3],[.6,-1.3,.38,.3]].forEach(function(p){wheel(fk,p[0],p[2],p[1],p[2],p[3])});
var mst=new THREE.Group();mst.position.set(0,0,1.2);fk.add(mst);[-.35,.35].forEach(function(x){B(.1,2.8,.14,STL,x,1.4,0,mst)});B(.9,.1,.14,STL,0,2.8,0,mst);
var car=new THREE.Group();car.position.set(0,.45,.15);mst.add(car);B(.9,.5,.1,STL,0,0,0,car);[-.28,.28].forEach(function(x){B(.12,.06,1.1,STL,x,-.2,.55,car)});
B(1,.12,1,WOD,0,-.11,.6,car);[[-.25,.2],[.25,.2],[-.25,-.2],[.25,-.2]].forEach(function(p){B(.42,.34,.36,M(0xc2975a,.9),p[0],.12,.6+p[1],car)});

/* road roller */
var rol=new THREE.Group();rol.position.set(4,0,-19);S.add(rol);
var rd=Cy(.95,2.3,M(0x8a8f96,.35,.7),0,.95,1.6,rol,28);rd.rotation.z=Math.PI/2;[-1.25,1.25].forEach(function(x){B(.2,1.1,.5,YEL,x,1.05,1.6,rol)});
B(1.6,.5,3,YEL,0,1.55,.4,rol);B(2.1,1.2,2.2,YEL,0,1.6,-1.2,rol);B(.5,.4,.5,DRK,0,2.4,-.3,rol);beacon(rol,0,4,-.5);
[[-.8,-.3],[.8,-.3],[-.8,.7],[.8,.7]].forEach(function(p){Cy(.05,1.6,STL,p[0],2.9,p[1],rol,6)});B(1.9,.08,1.8,YEL,0,3.72,.2,rol);
[-1,1].forEach(function(s){wheel(rol,s*1.05,.85,-1.4,.85,.6)});

/* telehandler */
var thd=new THREE.Group();thd.position.set(-6,0,-20);thd.rotation.y=2.8;S.add(thd);
B(2.2,.8,5.2,YEL,0,1.1,0,thd);cab(thd,1.1,1.6,1.5,-.9,2.3,.6);beacon(thd,-.9,3.4,.6);B(1.2,1.1,1.8,YEL,.35,1.9,-1.5,thd);
[[-1.1,1.8],[1.1,1.8],[-1.1,-1.8],[1.1,-1.8]].forEach(function(p){wheel(thd,p[0],.8,p[1],.8,.6)});
var tb=new THREE.Group();tb.position.set(.35,1.9,-1.9);thd.add(tb);B(.7,.7,4.5,YEL,0,0,2.2,tb);B(.55,.55,3.5,STL,0,0,5.2,tb);
var te=new THREE.Group();te.position.set(0,0,7);tb.add(te);B(1.2,.7,.15,STL,0,0,0,te);[-.4,.4].forEach(function(x){B(.1,.08,1.2,STL,x,-.3,.6,te)});
for(var i=0;i<5;i++)B(1.8,.16,.22,WOD,0,-.15+i*.17,.7,te);

/* facade material hoist */
var hs=new THREE.Group();hs.position.set(-17.4,0,-8.5);S.add(hs);var hc=[[-.6,-.6],[.6,-.6],[.6,.6],[-.6,.6]],HH=14;
hc.forEach(function(p){beam(V(p[0],0,p[1]),V(p[0],HH,p[1]),.05,STL,hs)});
for(var y=0;y<HH-.1;y+=1.4){for(var i=0;i<4;i++){var a2=hc[i],b2=hc[(i+1)%4];beam(V(a2[0],y+1.4,a2[1]),V(b2[0],y+1.4,b2[1]),.03,STL,hs);beam(V(a2[0],y,a2[1]),V(b2[0],y+1.4,b2[1]),.03,STL,hs)}}
[4,8,12].forEach(function(y){beam(V(.6,y,0),V(2.4,y,0),.04,STL,hs)});
var hg=new THREE.Group();hg.position.set(1.4,.3,0);hs.add(hg);B(1.2,.12,1.6,STL,0,0,0,hg);B(1.2,.06,1.6,YEL,0,1.9,0,hg);
[[-.55,-.75],[.55,-.75],[.55,.75],[-.55,.75]].forEach(function(p){Cy(.03,1.9,YEL,p[0],.95,p[1],hg,6)});B(.8,.6,.8,BRK,0,.4,0,hg);

/* ---------- ground detail: dirt patch with feathered edge, mud tracks, puddles, rocks ---------- */
(function(){
var dt=gt.clone();dt.needsUpdate=true;dt.repeat.set(8,5);
var fa=document.createElement("canvas");fa.width=fa.height=128;var fx=fa.getContext("2d");fx.fillStyle="#000";fx.fillRect(0,0,128,128);fx.shadowColor="#fff";fx.shadowBlur=7;fx.fillStyle="#fff";fx.fillRect(10,18,108,92);
var ft=new THREE.CanvasTexture(fa);
var dirt=new THREE.Mesh(new THREE.PlaneGeometry(120,80),new THREE.MeshStandardMaterial({map:dt,bumpMap:dt,bumpScale:1.5,roughness:1,alphaMap:ft,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
dirt.rotation.x=-Math.PI/2;dirt.position.set(0,.004,-3);dirt.receiveShadow=true;S.add(dirt);
var mt=document.createElement("canvas");mt.width=2048;mt.height=128;var mx=mt.getContext("2d"),rr=rng(5),i,q;
for(i=0;i<4;i++){mx.strokeStyle="rgba(28,20,12,.32)";mx.lineWidth=10+rr()*6;mx.beginPath();var yy=24+i*26;mx.moveTo(0,yy);for(q=0;q<=2048;q+=64)mx.lineTo(q,yy+(rr()-.5)*8);mx.stroke()}
for(i=0;i<500;i++){mx.fillStyle="rgba(30,22,14,"+rr()*.18+")";mx.fillRect(rr()*2048,rr()*128,2+rr()*8,1+rr()*3)}
var mtt=new THREE.CanvasTexture(mt);mtt.anisotropy=8;mtt.encoding=THREE.sRGBEncoding;
var trk2=new THREE.Mesh(new THREE.PlaneGeometry(120,7),new THREE.MeshStandardMaterial({map:mtt,transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));
trk2.rotation.x=-Math.PI/2;trk2.position.set(0,.03,13);S.add(trk2);
var pm=new THREE.MeshStandardMaterial({color:0x2c2418,roughness:.04,metalness:.5,transparent:true,opacity:.88,envMapIntensity:1.6,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,depthWrite:false});
[[-3,16,1.6],[6,10.6,1.2],[-18,9.5,1.8],[14,17.5,1.4],[-30,-6,1.5],[24,-14,1.3],[2,-14,1.1],[-12,-27,1.6]].forEach(function(c){var m=new THREE.Mesh(new THREE.CircleGeometry(c[2],28),pm);m.rotation.x=-Math.PI/2;m.scale.y=.62;m.position.set(c[0],.018,c[1]);S.add(m)});
var rg=new THREE.DodecahedronGeometry(1,0),rm=M(0x7c7a74,.95),rm2=M(0x6a665e,1),ra=rng(9),n=0;
while(n<80){var x=-46+ra()*92,z=-28+ra()*50;if(x>-17&&x<4&&z>-15&&z<-2)continue;n++;var sz=.08+ra()*ra()*.4,m2=new THREE.Mesh(rg,n%3?rm:rm2);
 m2.scale.set(sz,sz*.6,sz*.8);m2.rotation.set(ra()*3,ra()*3,ra()*3);m2.position.set(x,sz*.3,z);m2.receiveShadow=true;S.add(m2)}
})();

/* ---------- vehicle detail: hoses, exhausts, lights, mirrors, numbers, rams, teeth, mud flaps ---------- */
(function(){
function decal(txt,w,h,fg){var c=document.createElement("canvas");c.width=256;c.height=Math.round(256*h/w);var x=c.getContext("2d");x.fillStyle=fg;x.font="800 "+(c.height*.62)+"px system-ui,Arial,sans-serif";x.textAlign="center";x.textBaseline="middle";x.fillText(txt,c.width/2,c.height/2+2);
 var t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.7,depthWrite:false}))}
function put(m,par,x,y,z,ry){m.position.set(x,y,z);m.rotation.y=ry;par.add(m)}
function both(txt,par,x,y,z,fg){put(decal(txt,.9,.26,fg||"#1a1a1a"),par,x,y,z,Math.PI/2);put(decal(txt,.9,.26,fg||"#1a1a1a"),par,-x,y,z,-Math.PI/2)}
var i,z,s2,MIR=M(0x1d1f23,.5,.4),HOSE=M(0x15161a,.9),MUD=M(0x4a3a28,1);
/* excavator */
both("EXC-01",sw,.712,1.2,.55);B(2.62,.2,.05,STRIPE,0,.95,-2.52,sw);Cy(.07,.7,STL,.8,2.85,-1.9,sw,8);Cy(.095,.05,DRK,.8,3.22,-1.9,sw,8);
beam(V(.27,.62,.35),V(.27,.62,4.1),.028,HOSE,bp);beam(V(-.27,.62,.35),V(-.27,.62,4.1),.028,HOSE,bp);beam(V(.2,.28,.2),V(.2,.28,3),.024,HOSE,ap);beam(V(-.2,.28,.2),V(-.2,.28,3),.024,HOSE,ap);
[-.9,.1].forEach(function(x){B(.3,.12,.08,HL,x,2.42,1.52,sw)});B(.06,.35,.14,MIR,-1.18,2.2,1.4,sw);
[-1,1].forEach(function(sg){for(z=-1.4;z<=1.41;z+=.7)Cy(.2,.07,STL,sg*1.86,.3,z,exc,12).rotation.z=Math.PI/2});
/* dozer */
both("DZR-04",doz,.915,2.8,-.7);Cy(.07,.9,STL,.6,3.2,1.8,doz,8);[-.6,.6].forEach(function(x){B(.25,.15,.08,HL,x,2.4,2.42,doz)});
[-1,1].forEach(function(sg){for(z=-1.4;z<=1.41;z+=.7)Cy(.2,.07,STL,sg*1.75,.35,z,doz,12).rotation.z=Math.PI/2});
ram(doz,V(1,1.4,1.2),bl,V(1.2,.5,.2));ram(doz,V(-1,1.4,1.2),bl,V(-1.2,.5,.2));
/* wheel loader */
both("LDR-02",ldr,.96,3.4,-.1);[-.7,.7].forEach(function(x){B(.3,.15,.08,HL,x,1.65,2.97,ldr)});
for(i=-4;i<=4;i++)B(.14,.14,.3,DRK,i*.33,-.52,1.5,lb);
ram(ldr,V(.8,1.9,1.3),la,V(.8,.2,1.4));ram(ldr,V(-.8,1.9,1.3),la,V(-.8,.2,1.4));ram(la,V(0,.5,1.5),lb,V(0,.2,.1));
B(.06,.35,.14,MIR,-1.1,4.0,.5,ldr);B(.06,.35,.14,MIR,1.1,4.0,.5,ldr);
/* haul truck */
both("TRK-07",trk,1.11,2.2,2.6);Cy(.08,1.7,STL,1.25,2.6,1.6,trk,8);[-1.25,1.25].forEach(function(x){B(.08,.5,.3,MIR,x,2.8,3.45,trk);B(.4,.1,.5,STL,x*.96,1.0,3,trk)});
[-.7,.7].forEach(function(x){B(.35,.2,.08,HL,x,1.7,3.64,trk)});[-1.2,1.2].forEach(function(x){B(.2,.15,.06,TL,x,1.2,-3.55,trk);B(.8,.5,.05,TIRE,x*1.2,.6,-3.5,trk)});
for(i=0;i<5;i++)[-1.53,1.53].forEach(function(x){B(.12,1.6,.12,M(0xc98a10,.6,.2),x,.8,-2+i,bed)});
B(.9,.25,.03,M(0xeeeeee,.6),0,1.1,-3.56,trk);
/* cement mixer, mobile crane, forklift */
both("MIX-03",mix,1.16,2.3,3);both("CRN-02",mcr,1.31,2.5,4);
[-.3,.3].forEach(function(x){beam(V(x,1.2,-4.1),V(x,3.2,-3.4),.025,SIL,mix)});for(i=1;i<7;i++)B(.6,.03,.03,SIL,0,1.2+i*.28,-4.1+i*.1,mix);
[-1.2,1.2].forEach(function(x){B(.3,.15,.08,HL,x,1.5,4.52,mix)});B(.06,.35,.14,MIR,1.3,3.1,3.8,mix);B(.06,.35,.14,MIR,-1.3,3.1,3.8,mix);
Cy(.2,.7,M(0x9aa0a8,.4,.6),0,1.55,-1.95,fk,12);B(.35,.12,.08,HL,0,1.2,.95,fk);
/* crane beacons */
P(new THREE.SphereGeometry(.18,10,8),AMBM,0,7.4,0,top);P(new THREE.SphereGeometry(.15,10,8),AMBM,30,.9,0,top);
})();

/* dust motes + drifting clouds */
var dust=(function(){var n=300,a=new Float32Array(n*3);for(var i=0;i<n*3;i+=3){a[i]=Math.random()*80-40;a[i+1]=Math.random()*14;a[i+2]=Math.random()*60-35}
 var g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(a,3));
 var p=new THREE.Points(g,new THREE.PointsMaterial({color:0xe8d9bd,size:.14,transparent:true,opacity:.35,depthWrite:false}));S.add(p);return p})();
function cumulus(seed){var r=rng(seed),W=512,H=256,c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d"),pf=[];
 for(var i=0;i<46;i++){var u=r(),k=1-Math.abs(u-.5)*1.5,rad=(26+r()*34)*(.55+k*.75);pf.push([W*(.14+.72*u),H*.7-rad*(.25+r()*.75)*(.6+k*.6),rad])}
 function puff(p,dx,dy,sc,rgb,a){var gx=p[0]+dx,gy=p[1]+dy,rr=p[2]*sc,g=x.createRadialGradient(gx,gy,rr*.08,gx,gy,rr);g.addColorStop(0,"rgba("+rgb+","+a+")");g.addColorStop(.55,"rgba("+rgb+","+a*.55+")");g.addColorStop(1,"rgba("+rgb+",0)");x.fillStyle=g;x.fillRect(gx-rr,gy-rr,rr*2,rr*2)}
 pf.forEach(function(p){puff(p,0,0,1,"134,150,182",.9)});pf.forEach(function(p){puff(p,-p[2]*.1,-p[2]*.28,.86,"206,216,236",.8)});pf.forEach(function(p){puff(p,-p[2]*.18,-p[2]*.5,.62,"255,252,246",.85)});
 x.globalCompositeOperation="destination-in";var m=x.createLinearGradient(0,0,0,H);m.addColorStop(0,"#fff");m.addColorStop(.66,"#fff");m.addColorStop(.8,"rgba(255,255,255,0)");x.fillStyle=m;x.fillRect(0,0,W,H);
 var t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
function cirrus(seed){var r=rng(seed),W=512,H=128,c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d");
 for(var i=0;i<26;i++){var y=H*(.2+r()*.6),xx=r()*W*.4,len=W*(.3+r()*.5);x.strokeStyle="rgba(255,255,255,"+(.05+r()*.1)+")";x.lineWidth=2+r()*7;x.lineCap="round";x.beginPath();x.moveTo(xx,y);x.bezierCurveTo(xx+len*.3,y-8-r()*10,xx+len*.7,y+8+r()*10,xx+len,y+r()*8-4);x.stroke()}
 x.globalCompositeOperation="destination-in";var m=x.createLinearGradient(0,0,W,0);m.addColorStop(0,"rgba(255,255,255,0)");m.addColorStop(.25,"#fff");m.addColorStop(.75,"#fff");m.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=m;x.fillRect(0,0,W,H);
 var t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
var clouds=[];(function(){var r=rng(2024),cu=[1,2,3,4].map(function(sd){return cumulus(sd*97)}),ci=[cirrus(5),cirrus(9)];
 for(var k=0;k<26;k++){var cir=k>=18,T=cir?ci[k%2]:cu[k%4],bx=-260+r()*520,by=cir?120+r()*50:36+r()*60,bz=k>=12&&!cir&&k<18?140+r()*120:-270+r()*110,w=cir?260+r()*80:110+r()*120;
  if(cir)bz=-230+r()*70;var m=new THREE.SpriteMaterial({map:T,transparent:true,opacity:cir?.45:.93,depthWrite:false,fog:false});
  if(V(bx,by,bz).normalize().dot(SUND)>.88)m.color.setRGB(1,.93,.8);
  var s=new THREE.Sprite(m);s.position.set(bx,by,bz);s.scale.set(w,w*(cir?.25:.5),1);s.userData.sp=.02+r()*.04;S.add(s);clouds.push(s)}})();

/* ---------- workers (detailed, rigged) ---------- */
var REFL=new THREE.MeshStandardMaterial({color:0xe4e8ec,roughness:.3,metalness:.55,emissive:0x26282b}),
 GLSS=new THREE.MeshStandardMaterial({color:0xa9c3d4,roughness:.08,transparent:true,opacity:.32}),
 UG={sph:new THREE.SphereGeometry(1,14,10),cyl:new THREE.CylinderGeometry(1,1,1,16),half:new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2)},TG={};
function tap(rt,rb,h,m,x,y,z,par){var k=rt+"_"+rb+"_"+h;return P(TG[k]||(TG[k]=new THREE.CylinderGeometry(rt,rb,h,14)),m,x,y,z,par)}
function part(g,m,sx,sy,sz,x,y,z,par){var o=P(g,m,x,y,z,par);o.scale.set(sx,sy,sz);return o}
function strap(a,b,w,m,par){var d=new THREE.Vector3().subVectors(b,a),l=d.length(),o=B(w,l,.012,m,0,0,0,par);o.position.copy(a).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(UP,d.normalize());return o}
var FABT=(function(){var c=document.createElement("canvas");c.width=c.height=64;var x=c.getContext("2d"),i;x.fillStyle="#e8e8e8";x.fillRect(0,0,64,64);
 for(i=0;i<64;i+=2){x.fillStyle="rgba(0,0,0,.14)";x.fillRect(i,0,1,64);x.fillRect(0,i,64,1)}
 for(i=0;i<300;i++){x.fillStyle="rgba(0,0,0,"+Math.random()*.1+")";x.fillRect(Math.random()*64,Math.random()*64,1,1)}
 var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);t.encoding=THREE.sRGBEncoding;return t})(),fabc={};
function fab(c,r){var k=c+"_"+(r||.95);return fabc[k]||(fabc[k]=new THREE.MeshStandardMaterial({color:c,map:FABT,bumpMap:FABT,bumpScale:.5,roughness:r||.95}))}
function worker(o){
 var g=new THREE.Group(),legs=[],knees=[],arms=[],elbows=[],skin=M(o.skin,.6),shirt=fab(o.shirt),pants=fab(o.pants),boot=M(0x4b3624,.65),sole=M(0x141414,.95),
  vm=fab(o.vest,.7),hat=M(o.hat,.35,.05),web=M(0x17181a,.85),eye=M(0x15110e,.4),glove=M(0x3d3d42,.8),lea=M(0x6b4a2b,.7);
 [-1,1].forEach(function(s){var l=new THREE.Group();l.position.set(s*.1,.92,0);g.add(l);
  tap(.085,.07,.44,pants,0,-.22,0,l);B(.032,.12,.09,pants,s*.082,-.2,.02,l);
  var k=new THREE.Group();k.position.set(0,-.44,0);l.add(k);
  tap(.068,.052,.38,pants,0,-.19,0,k);tap(.058,.055,.1,boot,0,-.36,0,k);B(.118,.11,.27,boot,0,-.42,.05,k);B(.124,.03,.285,sole,0,-.465,.052,k);
  if(o.harness)P(new THREE.TorusGeometry(.088,.012,6,16),web,0,-.12,0,l).rotation.x=Math.PI/2;
  legs.push(l);knees.push(k)});
 part(UG.cyl,pants,.165,.2,.115,0,.97,0,g);part(UG.cyl,lea,.174,.05,.124,0,1.07,0,g);B(.05,.04,.012,SIL,0,1.07,.125,g);
 if(o.belt){B(.1,.13,.07,lea,.17,.98,.03,g);B(.09,.11,.06,lea,-.15,.99,.05,g)}
 tap(.185,.16,.56,shirt,0,1.34,0,g).scale.z=.62;tap(.198,.172,.5,vm,0,1.33,0,g).scale.z=.62;
 [1.2,1.45].forEach(function(y,i){tap(i?.197:.184,i?.193:.18,.045,REFL,0,y,0,g).scale.z=.62});
 [-1,1].forEach(function(s){B(.04,.46,.012,REFL,s*.075,1.33,.117,g);B(.04,.46,.012,REFL,s*.075,1.33,-.117,g)});
 if(o.harness){[-1,1].forEach(function(s){strap(V(s*.095,1.585,.12),V(s*.05,1.1,.122),.032,web,g);strap(V(s*.095,1.585,-.12),V(-s*.05,1.1,-.122),.032,web,g);B(.045,.03,.014,SIL,s*.075,1.45,.126,g)});B(.17,.028,.012,web,0,1.45,.124,g);P(new THREE.TorusGeometry(.03,.007,6,12),SIL,0,1.47,-.13,g)}
 [-1,1].forEach(function(s){var a=new THREE.Group();a.position.set(s*.225,1.55,0);g.add(a);part(UG.sph,shirt,.063,.063,.063,0,0,0,a);tap(.052,.046,.29,shirt,0,-.145,0,a);
  var e=new THREE.Group();e.position.set(0,-.29,0);a.add(e);tap(.045,.04,.26,shirt,0,-.13,0,e);part(UG.sph,glove,.046,.056,.05,0,-.29,.006,e);
  a.rotation.z=s*.07;e.rotation.x=-.12;arms.push(a);elbows.push(e)});
 tap(.045,.05,.1,skin,0,1.675,0,g);part(UG.sph,skin,.095,.115,.105,0,1.78,.004,g);part(UG.sph,skin,.017,.024,.024,0,1.762,.104,g);B(.04,.006,.006,M(0x8a4a3a,.6),0,1.728,.098,g);
 [-1,1].forEach(function(s){part(UG.sph,skin,.016,.034,.024,s*.094,1.775,-.004,g);part(UG.sph,eye,.011,.011,.008,s*.036,1.792,.094,g);B(.042,.008,.008,M(0x2b1d14,.9),s*.036,1.814,.094,g);B(.008,.01,.12,web,s*.097,1.792,.04,g)});
 P(new THREE.BoxGeometry(.17,.036,.012),GLSS,0,1.792,.1,g).castShadow=false;
 part(UG.half,hat,.126,.105,.142,0,1.83,0,g);part(UG.cyl,hat,.142,.016,.158,0,1.828,.004,g);part(UG.cyl,hat,.1,.012,.055,0,1.827,.135,g);B(.034,.02,.2,hat,0,1.937,0,g);
 var hr=M(o.hair||0x2b1d14,.9);part(UG.sph,hr,.1,.118,.11,0,1.772,-.018,g);if(o.beard)part(UG.sph,hr,.078,.07,.06,0,1.715,.078,g);
 [-1,1].forEach(function(s){B(.075,.07,.022,M(0x2a2a2a,.8),s*.105,1.2,.122,g);B(.01,.12,.01,web,s*.085,1.74,.06,g)});B(.04,.09,.03,DRK,.14,1.56,.12,g);B(.008,.12,.008,DRK,.14,1.66,.12,g);
 g.scale.setScalar(.95);g.userData={legs:legs,knees:knees,arms:arms,elbows:elbows};S.add(g);return g}
var w1=worker({vest:0xff8c32,hat:0xffd166,skin:0xe0ac84,shirt:0x364a6b,pants:0x3a4252,belt:1}),w2=worker({vest:0x10b981,hat:0xf5f5f0,skin:0xb5835a,shirt:0x505a66,pants:0x6b6150,harness:1}),
 w3=worker({vest:0xfacc15,hat:0xffd166,skin:0x8d5a3a,shirt:0x6a3030,pants:0x3c4048}),w4=worker({vest:0xff8c32,hat:0xffd166,skin:0xdcab88,shirt:0x2f5a4a,pants:0x4a4538,harness:1,belt:1});
w2.position.set(2.6,8.12,-8.5);w2.rotation.y=Math.PI*.85;w3.position.set(9.2,0,4.2);w3.rotation.y=-Math.PI*.65;w4.position.set(-4.5,12.4,-6.5);w4.rotation.y=.45;
w3.userData.arms[1].rotation.x=-2.6;w3.userData.arms[1].rotation.z=-.3;w3.userData.elbows[1].rotation.x=-.15;
var w5=worker({vest:0xff8c32,hat:0xffd166,skin:0xd9a47c,shirt:0x7a7f86,pants:0x3a4252,belt:1,hair:0x3b2a1a}),
 w6=worker({vest:0xfacc15,hat:0xf5f5f0,skin:0xb5835a,shirt:0x2f5a4a,pants:0x4a4538,harness:1,hair:0x111111,beard:1}),
 w7=worker({vest:0xff8c32,hat:0xf5f5f0,skin:0xe0ac84,shirt:0x364a6b,pants:0x2f3640,hair:0x5a3b1e}),
 w8=worker({vest:0xfacc15,hat:0xffd166,skin:0x8d5a3a,shirt:0x6a3030,pants:0x3c4048,hair:0x111111}),
 w9=worker({vest:0xfacc15,hat:0xffd166,skin:0xc08a62,shirt:0x505a66,pants:0x3c4048,harness:1,hair:0x1a1a1a}),
 w10=worker({vest:0xff8c32,hat:0xf5f5f0,skin:0xdcab88,shirt:0xf0f0ee,pants:0x2b3340,hair:0x2a2a2a}),
 w11=worker({vest:0xff8c32,hat:0x222222,skin:0xb5835a,shirt:0x3b3b3b,pants:0x3a3a3a,hair:0x111111});
/* bricklayer on the first floor */
w5.position.set(-9.4,4.4,-12.15);w5.rotation.y=Math.PI;B(1.2,.7,1,M(0xa4553a,.9),-7.6,4.75,-11.8);B(.7,.1,.7,M(0xbfb9a8,.9),-10.6,4.95,-11.9);B(.08,.55,.08,STL,-10.6,4.65,-11.9);
acts.push(function(t){var u=w5.userData;u.arms[1].rotation.x=-1.25+Math.sin(t*3.2)*.3;u.elbows[1].rotation.x=-.5+Math.sin(t*3.2+.6)*.35;u.arms[0].rotation.x=-1;u.elbows[0].rotation.x=-.7;u.arms[0].rotation.z=.15;w5.rotation.y=Math.PI+Math.sin(t*.5)*.12});
/* rebar fixer on the top deck */
w6.position.set(-2.4,12.56,-7);w6.rotation.y=Math.PI*.4;[w1,w2,w3,w4,w5,w6,w7,w8,w9,w10,w11].forEach(function(w){w.rotation.order="YXZ"});
acts.push(function(t){var u=w6.userData;w6.rotation.x=.35;u.arms[0].rotation.x=-.95+Math.sin(t*4)*.12;u.arms[1].rotation.x=-1.05+Math.sin(t*4+1)*.12;u.elbows[0].rotation.x=-.3;u.elbows[1].rotation.x=-.3});
/* surveyor with tripod */
w7.position.set(-6,0,2.4);B(.22,.3,.22,M(0x2b4c7e,.4,.3),-6,1.5,3.7);[[-6,3.7,-6.55,4.15],[-6,3.7,-5.45,4.15],[-6,3.7,-6,3.1]].forEach(function(p){beam(V(p[0],1.35,p[1]),V(p[2],0,p[3]),.025,WOD,S)});
acts.push(function(t){var u=w7.userData;u.arms[0].rotation.x=-1.2;u.arms[1].rotation.x=-1.3;u.elbows[0].rotation.x=-.3;u.elbows[1].rotation.x=-.3;w7.rotation.y=Math.sin(t*.4)*.08});
/* labourer with wheelbarrow */
var wb=new THREE.Group();S.add(wb);B(.75,.28,.95,M(0x2e6db4,.5,.2),0,.78,.15,wb);B(.5,.22,.6,M(0xa4553a,.9),0,.98,.15,wb);Cy(.22,.1,TIRE,0,.22,.65,wb,14).rotation.z=Math.PI/2;
[-.3,.3].forEach(function(x){beam(V(x,.7,-.2),V(x*1.15,1.02,-1.15),.025,STL,wb);beam(V(x,.7,-.2),V(x,.1,-.1),.025,STL,wb)});
acts.push(function(t){var zz=-4+4*Math.sin(t*.11),dzz=Math.cos(t*.11),ry=dzz>=0?0:Math.PI,u=w8.userData;w8.position.set(-23.5,0,zz);w8.rotation.y=ry;walkAnim(w8,t*5,.45);
 u.arms[0].rotation.x=u.arms[1].rotation.x=-.8;u.elbows[0].rotation.x=u.elbows[1].rotation.x=-.3;wb.position.set(-23.5+Math.sin(ry)*1.2,0,zz+Math.cos(ry)*1.2);wb.rotation.y=ry});
/* scaffolder on the top lift */
w9.position.set(3.1,12.11,-5.9);w9.rotation.y=Math.PI/2;
acts.push(function(t){var u=w9.userData;u.arms[1].rotation.x=-1.5+Math.sin(t*5)*.5;u.elbows[1].rotation.x=-.5;u.arms[0].rotation.x=-.9;u.elbows[0].rotation.x=-.6});
/* site manager with clipboard */
B(.3,.02,.38,M(0x8b6f47,.8),-.22,1.28,.32,w10);
acts.push(function(t){var zz=19.5+3*Math.sin(t*.09+1),dzz=Math.cos(t*.09+1),ry=dzz>=0?0:Math.PI,u=w10.userData;w10.position.set(2.4,0,zz);w10.rotation.y=ry;walkAnim(w10,t*5.2,.5);u.arms[0].rotation.x=-1.3;u.elbows[0].rotation.x=-1.4;u.arms[0].rotation.z=.1});
/* welder at a bench with sparks */
w11.position.set(-2,0,-16.3);w11.rotation.y=Math.PI;B(1.6,.9,.8,STL,-2,.45,-17.4);B(1.4,.1,.12,SIL,-2,.95,-17.3);B(.2,.22,.08,DRK,0,1.78,.13,w11);
var spkP=new Float32Array(36*3),spkV=[],spkG=new THREE.BufferGeometry(),spkL=new THREE.PointLight(0xffa040,0,7,2),si;
for(si=0;si<36;si++){spkV.push([0,0,0]);spkP[si*3+1]=-9}
spkG.setAttribute("position",new THREE.BufferAttribute(spkP,3));var spkS=new THREE.Points(spkG,new THREE.PointsMaterial({color:0xffb347,size:.07,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));spkS.frustumCulled=false;S.add(spkS);spkL.position.set(-2,1.15,-17.15);S.add(spkL);
acts.push(function(t,dt){var ff=(dt||.0167)*60,u=w11.userData,k;u.arms[0].rotation.x=-1.15;u.arms[1].rotation.x=-1.3;u.elbows[0].rotation.x=-.3;u.elbows[1].rotation.x=-.2;
 for(k=0;k<36;k++){if(spkP[k*3+1]<.05){spkP[k*3]=-2+(Math.random()-.5)*.1;spkP[k*3+1]=1.0;spkP[k*3+2]=-17.15+(Math.random()-.5)*.1;spkV[k]=[(Math.random()-.5)*2.2,Math.random()*2.2+.6,(Math.random()-.5)*2.2]}
  spkV[k][1]-=.16*ff;spkP[k*3]+=spkV[k][0]*.016*ff;spkP[k*3+1]+=spkV[k][1]*.016*ff;spkP[k*3+2]+=spkV[k][2]*.016*ff}
 spkG.attributes.position.needsUpdate=true;spkL.intensity=1.2+Math.random()*2.4});


/* ---------- AI HUD tags ---------- */
var hudEl=$("hud"),tags=[],inc=false,hudOn=true,incT=0,incDone=false;
function tag(o,off,id,txt,sz){var d=document.createElement("div");d.className="tag";d.innerHTML='<div class="bx"></div><div class="lb"></div>';hudEl.appendChild(d);
 var t={o:o,off:off,id:id,txt:txt,sz:sz,el:d,bx:d.firstChild,lb:d.lastChild};tags.push(t);setTag(t,false);return t}
function setTag(t,bad){if(!t.el||!t.el.classList)return;t.el.classList.toggle("bad",bad);t.lb.innerHTML=bad?"<b>"+t.id+"</b> HARNESS DETACHED":"<b>"+t.id+"</b> "+t.txt}
tag(w1,1,"WRK-001","PPE OK 99%",1);tag(w3,1,"WRK-003","SIGNALLER OK",1);tag(w4,1,"WRK-004","PPE OK 98%",1);
var t2=tag(w2,1,"WRK-002","PPE OK 99%",1);
tag(exc,2,"EXC-01","ZONE CLEAR",3.4);tag(trk,2.4,"TRK-07","12 KM/H",3.4);tag(ldr,3.5,"LDR-02","LOADING",3.4);tag(mix,4,"MIX-03","PARKED",3.4);tag(mcr,6,"CRN-02","LOAD 4.2 T",3.4);tag(fk,3,"FLT-05","LIFTING",3);tag(doz,3.5,"DZR-04","GRADING",3.4);tag(w5,1,"WRK-005","PPE OK 97%",1);tag(w6,1,"WRK-006","HARNESS OK",1);tag(w10,1,"WRK-010","SUPERVISOR",1);tag(w11,1,"WRK-011","HOT WORK PERMIT",1);
var _p=V(0,0,0);
var dimW=window.innerWidth,dimH=window.innerHeight;
function updateContainerDimensions(){var d=getContainerDim();dimW=d.w;dimH=d.h}
function updHud(){if(!hudEl||!hudOn)return;var W=dimW,H=dimH;
 for(var i=0;i<tags.length;i++){var t=tags[i];t.o.getWorldPosition(_p);_p.y+=t.off;var dist=_p.distanceTo(cam.position);_p.project(cam);
  var vis=_p.z<1&&_p.z>-1&&Math.abs(_p.x)<1.05&&Math.abs(_p.y)<1.05&&dist<75;
  if(!vis){if(t.el.style.display!=="none")t.el.style.display="none";continue}
  if(t.el.style.display!=="block")t.el.style.display="block";
  var s=Math.max(26,Math.min(170,t.sz*95*(30/dist)*1.6));t.bx.style.width=(s*(t.sz>1?1.4:.65))+"px";t.bx.style.height=(s*(t.sz>1?.9:1))+"px";
  t.lb.style.top=(-(s*(t.sz>1?.45:.5))-24)+"px";t.el.style.transform="translate("+(((_p.x+1)/2*W))+"px,"+(((1-_p.y)/2*H))+"px)"}}

/* ---------- camera path + intro ---------- */
var pos=[V(-44,46,54),V(-32,28,38),V(-19,10,22),V(-5,6.6,21),V(2,11,5),V(15,21,5),V(15,15,-17),V(22,10.5,28)],
    tgt=[V(0,8,-4),V(-8,9,-6),V(-14.5,3,5),V(5,5,8),V(9,17,-4.5),V(9,25,-4.5),V(2.8,9,-8.5),V(0,7,-4)],
    pc=new THREE.CatmullRomCurve3(pos,false,"centripetal"),tc=new THREE.CatmullRomCurve3(tgt,false,"centripetal");
pc.arcLengthDivisions=400;
var Ls=pc.getLengths(),LT=Ls[Ls.length-1];function wp(i){return Ls[Math.round(i/7*(Ls.length-1))]/LT}
var chS=[0,wp(1),wp(3),wp(5)+(wp(6)-wp(5))*.5,wp(6)+(1-wp(6))*.55];
var CH=[["01","Site Overview","A live digital twin of an active construction site"],["02","Heavy Equipment","Excavators, loaders and haul trucks tracked in real time"],["03","Tower Crane","28 m crane with AI drop-zone geofencing"],["04","Workers at Height","Helmet, vest and harness compliance on every worker"],["05","SafeGuard AI Online","Every worker. Every machine. Every second."]];
var DUR=24,START_FOV=66,START_FOG=.0022,FOG=.0022,FOV=48;
var PRE={site:[V(22,10.5,28),V(0,7,-4)],crane:[V(10.5,30,15),V(9,18,-4.5)],scaf:[V(12,11,-1),V(2.8,8.4,-8.5)],exc:[V(-10,8.5,14),V(-14.5,2.5,5)]};
var cur=pos[0].clone(),curL=tgt[0].clone(),want=PRE.site[0].clone(),wantL=PRE.site[1].clone();
var look={fov:START_FOV,exp:1.14,fog:FOG};
var st={mode:"hold",t:0,el:0,ch:-1,pw:0},mouse={x:0,y:0,tx:0,ty:0};
var ip=V(0,0,0),ig=V(0,0,0);
function ease(x){return .35*x+.65*(-(Math.cos(Math.PI*x)-1)/2)}function sm(x){x=Math.min(1,Math.max(0,x));return x*x*(3-2*x)}

function caption(i){var c=$("cap");if(!c)return;c.classList.remove("in");void c.offsetWidth;var n=$("no"),t=$("ttl"),s=$("sub");if(n)n.textContent=CH[i][0]+" / 05";if(t)t.textContent=CH[i][1];if(s)s.textContent=CH[i][2];c.classList.add("in");
 if(i===4){var sc=$("scan");if(sc){sc.classList.remove("go");void sc.offsetWidth;sc.classList.add("go")}}}
function stepIntro(dt,el){
 if(st.mode==="play"){st.el+=dt;st.t=Math.min(1,st.el/DUR)}
 var s=ease(st.t),u=pc.getUtoTmapping(s);pc.getPoint(u,ip);tc.getPoint(u,ig);
 var env=st.mode==="play"?Math.sin(Math.PI*st.t)*.16:0;
 ip.x+=Math.sin(el*1.3)*env;ip.y+=Math.sin(el*1.7+1)*env*.7;ip.z+=Math.cos(el*1.1)*env;ig.y+=Math.sin(el*.9+2)*env*.75;
 cur.copy(ip);curL.copy(ig);
 look.fov=START_FOV+(FOV-START_FOV)*s;look.exp=1.14;look.fog=FOG;
 cam.position.copy(cur);cam.lookAt(curL);
 if(st.mode!=="play")return;
 var ch=0;for(var i=0;i<chS.length;i++)if(s>=chS[i])ch=i;
 if(ch!==st.ch){st.ch=ch;caption(ch)}
 var p=$("prog");if(p&&p.firstChild)p.firstChild.style.width=(st.t*100).toFixed(2)+"%";
 if(st.t>=1)endIntro()}
function startIntro(){if(st.mode==="play")return;if(inc)setInc(false);incDone=false;st.mode="play";st.t=0;st.el=0;st.ch=-1;st.pw=0;
 root.classList.remove("ready","done");root.classList.add("on");
 want.copy(PRE.site[0]);wantL.copy(PRE.site[1]);setPreset("site",true)}
function endIntro(){if(st.mode!=="play")return;st.mode="free";autoIncident();st.pw=0;want.copy(PRE.site[0]);wantL.copy(PRE.site[1]);
 root.classList.remove("on");root.classList.add("done","ready");setPreset("site",true)}
function setPreset(n,quiet){if(!PRE[n])return;want.copy(PRE[n][0]);wantL.copy(PRE[n][1])}
addEventListener("keydown",function(e){if(e.key==="Escape")endIntro()});
function setInc(on){inc=on;if(on)incT=clock.elapsedTime;setTag(t2,on);var al=$("alert");if(al)al.classList.toggle("show",on);incRing.visible=on}
function autoIncident(){if(incDone)return;incDone=true;setTimeout(function(){if(st.mode!=="free"||inc)return;setPreset("scaf");setInc(true)},1800)}
function onHeroMouseMove(e){
  var cont = $("hero-viewport") || $("hero-3d-viewport") || document.getElementById("hero");
  if(cont && cont.getBoundingClientRect){
    var r = cont.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
  } else {
    mouse.tx = e.clientX / window.innerWidth * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight * 2 - 1);
  }
}
addEventListener("mousemove", onHeroMouseMove, { passive: true });
function getContainerDim(){
  var cont = $("hero-viewport") || $("hero-3d-viewport") || document.getElementById("hero");
  if(cont && cont.clientWidth > 0 && cont.clientHeight > 0){
    return { w: cont.clientWidth, h: cont.clientHeight };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}
function resize(){
  updateContainerDimensions();
  R.setSize(dimW, dimH, false);
  cam.aspect = dimW / dimH;
  cam.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();


/* ---------- animation loop ---------- */
var incRing=new THREE.Mesh(new THREE.RingGeometry(1.1,1.4,40),new THREE.MeshBasicMaterial({color:0xef4444,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));
incRing.rotation.x=-Math.PI/2;incRing.position.set(2.6,8.22,-8.5);incRing.visible=false;S.add(incRing);
var clock=new THREE.Clock(),yaw=Math.PI/2;
function walkAnim(w,ph,amp){var u=w.userData,s=Math.sin(ph);u.legs[0].rotation.x=s*amp;u.legs[1].rotation.x=-s*amp;
 u.knees[0].rotation.x=Math.max(0,-s)*amp*1.5+.03;u.knees[1].rotation.x=Math.max(0,s)*amp*1.5+.03;
 u.arms[0].rotation.x=-s*amp*.7;u.arms[1].rotation.x=s*amp*.7;u.elbows[0].rotation.x=-.25-Math.max(0,s)*.5;u.elbows[1].rotation.x=-.25-Math.max(0,-s)*.5}
function world(t,dt){var fr=(dt||.0167)*60;
 var th=Math.sin(t*.12)*.32;top.rotation.y=th;var tx=14+Math.sin(t*.2)*5;trol.position.x=tx;
 ring.position.x=disc.position.x=9+tx*Math.cos(th);ring.position.z=disc.position.z=-4.5-tx*Math.sin(th);ring.material.opacity=.4+Math.sin(t*3)*.2;
 sw.rotation.y=Math.sin(t*.5)*.9;bp.rotation.x=-.55+Math.sin(t*.9)*.25;ap.rotation.x=1.1+Math.sin(t*.9+1)*.45;bk.rotation.x=.7+Math.sin(t*1.4)*.4;
 var vx=-2+Math.sin(t*.22)*13,dx=Math.cos(t*.22),want_=dx>=0?Math.PI/2:-Math.PI/2;yaw+=(want_-yaw)*Math.min(1,.04*fr);
 trk.position.set(vx,0,13);trk.rotation.y=yaw;wh.forEach(function(w){w.rotation.x=t*3});
 la.rotation.x=-.3+Math.sin(t*.7)*.25;lb.rotation.x=.3+Math.sin(t*.7+1)*.3;bl.position.y=.8+Math.sin(t*.5)*.18;dm.rotation.y=t*.9;msw.rotation.y=Math.sin(t*.15)*.35;
 car.position.y=.45+(Math.sin(t*.4)*.5+.5)*1.3;rol.position.z=-19+Math.sin(t*.25)*3;rol.position.y=Math.sin(t*70)*.012;rd.rotation.x=t*1.5;tb.rotation.x=-.4+Math.sin(t*.35)*.25;
 hg.position.y=.3+(Math.sin(t*.3)*.5+.5)*11.2;AMBM.emissiveIntensity=Math.sin(t*7)>0?2:.15;updRams();
 var da=dust.geometry.attributes.position;for(var q=1;q<da.array.length;q+=3){da.array[q]+=.004*fr;if(da.array[q]>14)da.array[q]=.2}da.needsUpdate=true;
 clouds.forEach(function(c){c.position.x+=c.userData.sp*fr;if(c.position.x>270)c.position.x=-270});
 cars.forEach(function(c){c.g.position.x+=c.s*fr;if(c.g.position.x>200)c.g.position.x=-200;if(c.g.position.x<-200)c.g.position.x=200});
 carsZ.forEach(function(c){c.g.position.z+=c.s*fr;if(c.g.position.z>74)c.g.position.z=-70;if(c.g.position.z<-70)c.g.position.z=74});
 acts.forEach(function(f){f(t,dt)});treeSway.forEach(function(o){o.c.rotation.z=Math.sin(t*.7+o.ph)*.015;o.c.rotation.x=Math.cos(t*.55+o.ph)*.012});
 var z=3.5+Math.sin(t*.16)*5,dz=Math.cos(t*.16);w1.position.set(7.2,0,z);w1.rotation.y=dz>=0?0:Math.PI;walkAnim(w1,t*6,.55);
 [w2,w4].forEach(function(w,i){w.position.y=(i?12.4:8.12)+Math.abs(Math.sin(t*1.5+i))*.01;w.userData.arms[1].rotation.x=-.3+Math.sin(t*.9+i)*.2;w.rotation.y+=Math.sin(t*.4+i)*.002});
 if(inc){var k=Math.min(1,(t-incT)/1.2),u=w2.userData,fl=Math.sin(t*9);w2.rotation.z=fl*.14*k;w2.rotation.x=.12*k;u.arms[0].rotation.x=-2.3*k+fl*.35*k;u.arms[1].rotation.x=-2.3*k-fl*.35*k;u.arms[0].rotation.z=-.5*k;u.arms[1].rotation.z=.5*k;u.knees[0].rotation.x=.5*k;u.knees[1].rotation.x=.5*k;
  incRing.scale.setScalar(1+((t-incT)%1)*.8);incRing.material.opacity=.9*(1-((t-incT)%1));AMBM.emissiveIntensity=Math.sin(t*14)>0?2.5:.1}
 else if(w2.rotation.z!==0){w2.rotation.z=w2.rotation.x=0;var u2=w2.userData;u2.arms[0].rotation.z=-.07;u2.arms[1].rotation.z=.07;u2.arms[0].rotation.x=0;u2.knees[0].rotation.x=u2.knees[1].rotation.x=0}
}

/* ---------- extra realism: mud tracks, puddles, truck dust, sun bloom, film grain, vignette ---------- */
var realFX=(function(){
var css=document.createElement("style");
css.textContent=".fx{position:fixed;inset:0;pointer-events:none}"+
"#vig{z-index:9;background:radial-gradient(ellipse at 50% 50%,transparent 72%,rgba(2,5,10,.10) 100%)}"+
"#sunG{z-index:8;opacity:0;mix-blend-mode:screen;background:radial-gradient(circle at var(--sx,50%) var(--sy,20%),rgba(255,228,175,.4),rgba(255,190,110,.12) 14%,transparent 40%)}";
document.head.appendChild(css);
function mk(id){var d=document.createElement("div");d.id=id;d.className="fx";document.body.appendChild(d);return d}
mk("vig");var sg=mk("sunG");

/* muddy tyre tracks from the gate into the site */
var tc2=document.createElement("canvas");tc2.width=128;tc2.height=512;var tx=tc2.getContext("2d");tx.fillStyle="#000";tx.fillRect(0,0,128,512);
[34,94].forEach(function(bx){for(var y=0;y<512;y+=4){var f=.2+.8*y/512,a=(y%8<4?.5:.25)*f*(.6+Math.random()*.4);
 tx.fillStyle="rgba(255,255,255,"+a+")";tx.fillRect(bx+Math.sin(y*.03)*6-9,y,18,3)}});
for(var k=0;k<500;k++){tx.fillStyle="rgba(255,255,255,"+Math.random()*.12+")";tx.fillRect(Math.random()*128,Math.random()*512,2+Math.random()*4,2)}
var trM=new THREE.Mesh(new THREE.PlaneGeometry(5.5,36),new THREE.MeshStandardMaterial({color:0x2a1d12,alphaMap:new THREE.CanvasTexture(tc2),transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
trM.rotation.x=-Math.PI/2;trM.position.set(0,.04,6);trM.receiveShadow=true;S.add(trM);

/* reflective puddles (mirror the sky via the scene environment) */
function blob(){var c=document.createElement("canvas");c.width=c.height=128;var x=c.getContext("2d"),g=x.createRadialGradient(64,64,6,64,64,60);
 g.addColorStop(0,"#fff");g.addColorStop(.7,"#fff");g.addColorStop(1,"#000");x.fillStyle="#000";x.fillRect(0,0,128,128);x.fillStyle=g;x.beginPath();
 for(var i=0;i<=24;i++){var a=i/24*6.283,r=50+Math.sin(a*3+1)*8+Math.sin(a*5)*5;x[i?"lineTo":"moveTo"](64+Math.cos(a)*r,64+Math.sin(a)*r*.8)}x.fill();return new THREE.CanvasTexture(c)}
[[-14,-1,3.2,2.2],[5,-17,2.6,1.8],[-1.6,16,2.4,1.6],[-20,-14,3,2],[11,-4,1.8,1.2]].forEach(function(p){
 var m=new THREE.Mesh(new THREE.PlaneGeometry(p[2],p[3]),new THREE.MeshStandardMaterial({color:0x4a4034,metalness:.85,roughness:.04,alphaMap:blob(),transparent:true,envMapIntensity:1.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
 m.rotation.x=-Math.PI/2;m.rotation.z=p[0];m.position.set(p[0],.045,p[1]);m.receiveShadow=true;S.add(m)});

/* dust kicked up by the haul truck */
var dc=document.createElement("canvas");dc.width=dc.height=64;var dcx=dc.getContext("2d"),dg=dcx.createRadialGradient(32,32,2,32,32,30);
dg.addColorStop(0,"rgba(190,170,140,.55)");dg.addColorStop(1,"rgba(190,170,140,0)");dcx.fillStyle=dg;dcx.fillRect(0,0,64,64);
var dtex=new THREE.CanvasTexture(dc),dust2=[],di=0,acc=0,n;
for(n=0;n<48;n++){var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:dtex,transparent:true,depthWrite:false,opacity:0}));sp.userData={l:0,v:V(0,0,0)};sp.visible=false;S.add(sp);dust2.push(sp)}
var sunP=V(0,0,0);
return function(t,dt){
 var vx=Math.cos(t*.22)*2.86,sgn=vx>0?1:-1;acc+=dt*Math.min(1,Math.abs(vx)/1.5)*14;
 while(acc>=1){acc--;var s=dust2[di++%48];s.position.set(trk.position.x-sgn*2.6+(Math.random()-.5),.35,13+(Math.random()-.5)*1.6);
  s.userData.l=1;s.userData.v.set(-sgn*(.3+Math.random()*.4),.5+Math.random()*.4,(Math.random()-.5)*.6);s.visible=true;s.scale.setScalar(.8)}
 dust2.forEach(function(s){var u=s.userData;if(u.l<=0)return;u.l-=dt*.45;if(u.l<=0){s.visible=false;return}
  s.position.addScaledVector(u.v,dt);s.scale.setScalar(s.scale.x+dt*1.6);s.material.opacity=Math.min(.55,u.l*.7)});
 sunP.copy(SUND).multiplyScalar(300).add(cam.position).project(cam);
 if(sg){var sx=((sunP.x+1)/2*dimW),sy=((1-sunP.y)/2*dimH);
 sg.style.setProperty("--sx",sx.toFixed(1)+"px");sg.style.setProperty("--sy",sy.toFixed(1)+"px");
 sg.style.opacity=sunP.z<1?(Math.max(0,1-Math.hypot(sunP.x,sunP.y)/2.2)*.8).toFixed(2):0}};
})();


/* ---------- vehicle realism + looping animation ---------- */
var fleetFX=(function(){
var pm={},wasInc=false,incAt=0,now=0,idle=0,wasFree=false,loopOn=true,tk=0,di2=0,_t=V(0,0,0),i;
function wea(g,hs){g.traverse(function(o){if(o.isMesh&&o.material&&o.material.color){var h=o.material.color.getHex();if(hs.indexOf(h)>-1)o.material=pm[h]||(pm[h]=WEA("#"+("000000"+h.toString(16)).slice(-6)))}})}
function lamps(g,z,y,x,m,w){[-x,x].forEach(function(s){B(w||.34,.2,.07,m,s,y,z,g).castShadow=false})}
wea(trk,[0xff8c32,0xf0a020]);wea(fk,[0xff7a00]);wea(mix,[0xf5f5f0]);
/* haul truck: grille, bumper, lamps, mirrors, mudflaps, steps, exhaust stack, bed ribs */
lamps(trk,3.62,1.55,.8,HL);lamps(trk,-3.55,1.3,1.1,TL,.3);B(1.4,.7,.06,DRK,0,1.8,3.63,trk);B(2.9,.3,.35,STL,0,.85,3.7,trk);
[-1,1].forEach(function(s){B(.1,.5,.35,DRK,s*1.25,2.7,3.2,trk);B(.8,.7,.05,TIRE,s*1.5,.8,-3.72,trk);B(.5,.08,.5,STL,s*1.2,.7,2.3,trk);
 for(i=-2;i<=2;i++)B(.1,1.5,.12,STL,s*1.52,.8,i*.9,bed)});
Cy(.1,2.4,STL,1.2,3.1,2.0,trk,8);Cy(.14,.1,DRK,1.2,4.3,2.0,trk,8);
/* other vehicles: head/tail lamps, extra exhaust stacks */
lamps(mix,4.52,1.5,.8,HL);lamps(mix,-4.05,1.1,1,TL,.3);lamps(ldr,.92,4.2,.7,HL);lamps(ldr,-3.56,1.9,1,TL,.3);
lamps(doz,2.42,2.5,.6,HL);lamps(doz,-2.42,1.5,.8,TL,.3);lamps(fk,1.02,1.2,.45,HL,.25);lamps(fk,-1.92,1.0,.4,TL,.25);lamps(mcr,5.12,1.3,1.1,HL);lamps(mcr,-5.02,1.2,1.1,TL,.3);
Cy(.1,2.2,STL,1.3,3.4,2.4,mix,8);Cy(.08,1,DRK,.6,3.2,1.4,doz,8);Cy(.08,.9,DRK,.9,2.5,-1.4,sw,8);
/* exhaust smoke */
var sc_=document.createElement("canvas");sc_.width=sc_.height=64;var sx=sc_.getContext("2d"),sgd=sx.createRadialGradient(32,32,2,32,32,30);
sgd.addColorStop(0,"rgba(255,255,255,.6)");sgd.addColorStop(1,"rgba(255,255,255,0)");sx.fillStyle=sgd;sx.fillRect(0,0,64,64);
var stx=new THREE.CanvasTexture(sc_),pool=[];
for(i=0;i<100;i++){var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:stx,color:0x6a6a6a,transparent:true,depthWrite:false,opacity:0}));sp.userData={l:0,v:V(0,0,0)};sp.visible=false;S.add(sp);pool.push(sp)}
var em=[[trk,1.2,4.45,2.0],[mix,1.3,4.6,2.4],[doz,.6,3.8,1.4],[ldr,.7,4,-2.3],[sw,.9,2.95,-1.4]].map(function(e){var o=new THREE.Object3D();o.position.set(e[1],e[2],e[3]);e[0].add(o);return o});
/* wheel loader + bulldozer shuttle back and forth, loader wheels roll */
var lw=ldr.children.filter(function(c){return c.isGroup&&c.children.length===5&&c.children[0].geometry&&c.children[0].geometry.type==="CylinderGeometry"});
var drv=[[ldr,-24,14,.6,0,1.1],[doz,-33,4,1.1,2,0]].map(function(d){return{g:d[0],x:d[1],z:d[2],f:V(Math.sin(d[3]),0,Math.cos(d[3])),ph:d[4],s:0}});
[w2,w4].forEach(function(w){var e=w.userData.elbows[1];B(.03,.3,.03,WOD,0,-.3,.045,e);B(.13,.05,.05,STL,0,-.46,.045,e)});
/* hazard tape between the excavator cones */
for(var q=0;q<14;q++){var a1=q/14*Math.PI*2,a2=(q+1)/14*Math.PI*2,x1=-14.5+Math.cos(a1)*7.5,z1=5+Math.sin(a1)*7.5,x2=-14.5+Math.cos(a2)*7.5,z2=5+Math.sin(a2)*7.5,tp=B(Math.hypot(x2-x1,z2-z1),.07,.015,STRIPE,(x1+x2)/2,.55,(z1+z2)/2,S);tp.rotation.y=-Math.atan2(z2-z1,x2-x1);tp.castShadow=false}
/* birds circling over the site */
var birds=[];(function(){var g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(new Float32Array([0,0,.25,1.1,0,.05,0,0,-.25]),3));g.computeVertexNormals();
 var m=new THREE.MeshBasicMaterial({color:0x1b1b1d,side:THREE.DoubleSide});
 for(var n=0;n<9;n++){var bg=new THREE.Group(),wa=new THREE.Mesh(g,m),wb=new THREE.Mesh(g,m);wb.scale.x=-1;bg.add(wa);bg.add(wb);bg.scale.setScalar(.9);S.add(bg);birds.push({g:bg,a:wa,c:wb,r:35+n*7,h:34+(n%4)*6,sp:.12+(n%3)*.03,ph:n*1.7})}})();
/* lens depth-of-field: soft focus toward the screen edges */
var dofEl=document.createElement("div");dofEl.id="dof";document.body.appendChild(dofEl);
/* grass tufts scattered over the open ground */
(function(){var cv=document.createElement("canvas");cv.width=cv.height=64;var x=cv.getContext("2d"),r=rng(77),i;
 for(i=0;i<46;i++){var bx=6+r()*52,h=22+r()*38,ln=(r()-.5)*14,gv=70+r()*90|0;x.strokeStyle="rgb("+(gv*.55|0)+","+gv+","+(gv*.3|0)+")";x.lineWidth=1.4+r()*1.2;x.beginPath();x.moveTo(bx,64);x.quadraticCurveTo(bx+ln*.3,64-h*.6,bx+ln,64-h);x.stroke()}
 var tx=new THREE.CanvasTexture(cv);tx.encoding=THREE.sRGBEncoding;
 var g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(new Float32Array([-.5,0,0,.5,0,0,.5,1,0,-.5,1,0,0,0,-.5,0,0,.5,0,1,.5,0,1,-.5]),3));
 g.setAttribute("normal",new THREE.BufferAttribute(new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0]),3));
 g.setAttribute("uv",new THREE.BufferAttribute(new Float32Array([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1]),2));g.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);
 var N=2600,im=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({map:tx,alphaTest:.45,side:THREE.DoubleSide,roughness:1}),N),
  ci=[[-26,-15,8],[30,-22,9],[-38,-24,5],[23,9,7],[13.5,2.5,5],[-33,4,8],[-24,14,7],[-14,-23,3],[40,-12,3],[42,-20,6],[-40,-6,3],[13,-15,5],[15,-18,3],[-20,-7,4],[-11,-17,5],[-14.5,5,9],[-18.6,7.2,4],[33,-6,4.5],[-36,-4,4],[18,-6,3]],
  rr=rng(2024),d=new THREE.Object3D(),col=new THREE.Color(),n=0,tries=0,k;
 function bad(px,pz){if(px>-20&&px<10&&pz>-19.5&&pz<2.5)return 1;if(pz>8&&pz<18)return 1;if(px>-5&&px<5&&pz>12&&pz<25)return 1;if(px>6&&px<8.5)return 1;if(px>6&&px<12&&pz>-7&&pz<-2)return 1;
  for(k=0;k<ci.length;k++){var dx=px-ci[k][0],dz=pz-ci[k][1];if(dx*dx+dz*dz<ci[k][2]*ci[k][2])return 1}return 0}
 while(n<N&&tries<60000){tries++;var px=-46+rr()*92,pz=-28+rr()*50;if(bad(px,pz))continue;
  var w=.35+rr()*.5,h=.3+rr()*.45;d.position.set(px,0,pz);d.rotation.y=rr()*6.28;d.scale.set(w,h,w);d.updateMatrix();im.setMatrixAt(n,d.matrix);im.setColorAt(n,col.setHSL(.22+rr()*.07,.5,.55+rr()*.25));n++}
 im.count=n;im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.frustumCulled=false;im.receiveShadow=true;S.add(im)})();
/* intro loops: replays after 16 s idle */
["pointerdown","keydown","wheel"].forEach(function(n){addEventListener(n,function(){idle=now},{passive:true})});
return function(t,dt){now=t;
 birds.forEach(function(o){var a=t*o.sp+o.ph;o.g.position.set(Math.cos(a)*o.r,o.h+Math.sin(a*2)*2,Math.sin(a)*o.r*.8-10);o.g.rotation.y=Math.atan2(-Math.sin(a),.8*Math.cos(a));o.a.rotation.z=Math.sin(t*9+o.ph)*.6;o.c.rotation.z=-o.a.rotation.z});
 var u4=w4.userData,k4=t*4.2,u2=w2.userData,k2=t*3.4+1,u3=w3.userData,k3=t*2.6;
 u4.arms[1].rotation.x=-1.25+Math.sin(k4)*.5;u4.elbows[1].rotation.x=-.5+Math.sin(k4+.6)*.45;u4.arms[0].rotation.x=-.9;u4.elbows[0].rotation.x=-.7;w4.rotation.x=.25;
 if(!inc){u2.arms[1].rotation.x=-1.25+Math.sin(k2)*.5;u2.elbows[1].rotation.x=-.5+Math.sin(k2+.6)*.45;u2.arms[0].rotation.x=-.9;u2.elbows[0].rotation.x=-.7;w2.rotation.x=.15}
 u3.arms[1].rotation.x=-2.6+Math.sin(k3)*.2;u3.arms[1].rotation.z=-.3+Math.sin(k3)*.35;u3.elbows[1].rotation.x=-.15+Math.sin(k3+1)*.3;u3.arms[0].rotation.x=-1.3;u3.elbows[0].rotation.x=-.4;w3.rotation.y=-Math.PI*.65+Math.sin(t*.35)*.35;
 trk.position.y=Math.abs(Math.sin(t*7))*.02;trk.rotation.z=Math.sin(t*2.3)*.006;
 drv.forEach(function(d){var s=Math.sin(t*.18+d.ph)*3.5,ds=s-d.s;d.s=s;d.g.position.set(d.x+d.f.x*s,0,d.z+d.f.z*s);if(d.g===ldr)lw.forEach(function(w){w.rotation.x+=ds})});
 tk+=dt;if(tk>.2){tk=0;em.forEach(function(o){var p=pool[di2++%100],u=p.userData;o.getWorldPosition(_t);p.position.copy(_t);u.l=1;u.v.set(.35+Math.random()*.2,.7+Math.random()*.4,(Math.random()-.5)*.2);p.visible=true;p.scale.setScalar(.25)})}
 pool.forEach(function(p){var u=p.userData;if(u.l<=0)return;u.l-=dt*.5;if(u.l<=0){p.visible=false;return}p.position.addScaledVector(u.v,dt);p.scale.setScalar(p.scale.x+dt*.7);p.material.opacity=Math.min(.3,u.l*.4)});
 if(st.mode!=="free"){wasFree=false;wasInc=false}else{if(!wasFree){wasFree=true;idle=t}if(inc&&!wasInc)incAt=t;wasInc=inc;if(loopOn&&!reduce&&((inc&&t-incAt>4)||t-idle>8))startIntro()}};
})();
var lastT=0;
var isHeroInView = true;
if ("IntersectionObserver" in window) {
  var heroCont = $("hero-viewport") || $("hero-3d-viewport") || document.getElementById("hero");
  if (heroCont) {
    var obs = new IntersectionObserver(function(entries) {
      isHeroInView = entries[0].isIntersecting;
      if (isHeroInView && !document.hidden) {
        clock.getDelta();
      }
    }, { threshold: 0.05 });
    obs.observe(heroCont);
  }
}

function loop(){
  requestAnimationFrame(loop);
  if (!isHeroInView || document.hidden) {
    clock.getDelta();
    return;
  }
  var dt=Math.min(clock.getDelta(),.06),el=clock.elapsedTime;
  world(el,dt);realFX(el,dt);fleetFX(el,dt);mouse.x+=(mouse.tx-mouse.x)*.05;mouse.y+=(mouse.ty-mouse.y)*.05;
  if(st.mode==="hold"||st.mode==="play")stepIntro(dt,el);
  else{var k=1-Math.exp(-dt*2.6);cur.lerp(want,k);curL.lerp(wantL,k);st.pw=Math.min(1,st.pw+dt/1.6);var p=sm(st.pw);
   cam.position.set(cur.x+mouse.x*2.8*p+Math.sin(el*.7)*.05*p,cur.y+mouse.y*1.6*p+Math.sin(el*1.1+1)*.04*p,cur.z);cam.lookAt(curL);
   var k2=1-Math.exp(-dt*3);look.fov+=(FOV-look.fov)*k2;look.exp+=(1.14-look.exp)*k2;look.fog=FOG}
  if(Math.abs(cam.fov-look.fov)>.001){cam.fov=look.fov;cam.updateProjectionMatrix()}
  R.toneMappingExposure=look.exp;
  S.fog.density=look.fog;
  skyDome.position.copy(cam.position);
  R.render(S,cam);
  updHud();
}
document.addEventListener("visibilitychange",function(){if(!document.hidden)clock.getDelta()});
loop();

/* ---------- boot: short loading veil, then roll ---------- */
var reduce=matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
requestAnimationFrame(function(){$("vb").firstChild.style.width="100%"});
setTimeout(function(){$("veil").classList.add("lift");setTimeout(function(){if($("veil"))$("veil").style.display="none"},1100);
 if(reduce){st.mode="free";cur.copy(PRE.site[0]);curL.copy(PRE.site[1]);look.fov=FOV;look.exp=1.14;look.fog=FOG;root.classList.add("ready","done")}
 else{startIntro()}},1500);
})();