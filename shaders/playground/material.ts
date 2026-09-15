export const studio = /* glsl */ `
float softbox(vec3 r, vec3 light, float sharpness) {return pow(max(dot(r,normalize(light)),0.0),sharpness);}
vec3 materialLight(vec3 p,vec3 n, float identity, float seed, float memory) {
  vec3 v=normalize(cameraPosition-p), r=reflect(-v,n);
  float fresnel=pow(1.0-max(0.0,dot(n,v)),3.0);
  float key=softbox(r,vec3(-.7,.9,1.2),18.0);
  float strip=exp(-pow((r.x+.42)*7.0,2.0))*smoothstep(-.3,.6,r.y)*.55;
  float rim=softbox(r,vec3(1.2,.15,.45),24.0);
  float broad=softbox(n,vec3(-.6,.65,1.1),1.0);
  vec3 pearl=mix(vec3(.17,.235,.25),vec3(.57,.62,.59),broad);
  vec3 metal=mix(vec3(.032,.043,.052),vec3(.28,.33,.34),broad);
  metal*=mix(.5,1.5,seed);
  vec3 body=mix(pearl,metal,identity);
  body*=.62+.2*n.z;
  // Backlit depth and refracted studio bands through the thin cap.
  float transmitted=pow(max(0.0,dot(-n,normalize(vec3(.5,-.1,-1.0)))),2.0);
  body+=vec3(.15,.24,.26)*transmitted*(1.0-identity)*(.7+memory*.25);
  body+=vec3(.80,.72,.56)*(key*1.3+strip*.6)*(0.7+identity*.9);
  body+=vec3(.43,.60,.69)*rim*.95;
  body+=vec3(.27,.38,.42)*fresnel*(.5+identity*.5);
  body+=sin(vec3(1.0,1.8,2.5)+fresnel*5.0+seed)*fresnel*.022*(1.0-identity*.5);
  return body;
}
`;
export const cellVertex = /* glsl */ `
attribute vec4 aCell; // xy location, radius, pressure
attribute vec4 aTouch; // xy local pressure location, zw bending
attribute float aMemory;
varying vec3 vWorld;varying vec3 vNormal;varying vec2 vLocal;varying float vMemory;
float heightAt(vec2 p) {
  float r=length(p), dome=pow(max(0.0,1.0-r*r),1.3);
  vec2 d=p-clamp(aTouch.xy,vec2(-.6),vec2(.6));
  float dent=exp(-dot(d,d)*5.0)*aCell.w;
  return (.49*dome-.65*dent*dome)*aCell.z;
}
void main(){
  vec2 p=position.xy*2.0; vLocal=p;vMemory=aMemory;
  float h=heightAt(p),e=.012;
  vec2 slope=vec2(heightAt(p+vec2(e,0.0))-heightAt(p-vec2(e,0.0)),heightAt(p+vec2(0.0,e))-heightAt(p-vec2(0.0,e)))/(2.0*e*aCell.z);
  vNormal=normalize(vec3(-slope,1.0));
  vWorld=vec3(aCell.xy+p*aCell.z+aTouch.zw*max(0.0,1.0-dot(p,p)),.045+h*2.4);
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
}`;
export const cellFragment = /* glsl */ `
${studio}
varying vec3 vWorld;varying vec3 vNormal;varying vec2 vLocal;varying float vMemory;
void main(){
  float radius=length(vLocal);if(radius>1.0)discard;
  vec3 n=normalize(vec3(vNormal.xy*2.4,vNormal.z));
  vec3 color=materialLight(vWorld,n,0.0,.38,vMemory);
  // Dark contact collar and a fine, warm meniscus.
  color*=.55+.45*smoothstep(1.0,.70,radius);
  color+=vec3(.30,.29,.23)*exp(-pow((radius-.94)*55.0,2.0))*.32;
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const sheetVertex = /* glsl */ `
varying vec2 vUv;varying vec3 vWorld;uniform vec4 uPress;uniform vec4 uWave;
void main(){vUv=uv;vec3 p=position;float d=distance(p.xy,uPress.xy),w=distance(p.xy,uWave.xy)-uWave.z*3.5;
p.z-=uPress.z*exp(-d*d*1.4)*.075;
p.z+=sin(w*5.0)*exp(-w*w*3.24)*exp(-uWave.z*1.3)*uWave.w*.38;
vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
export const sheetFragment = /* glsl */ `
varying vec2 vUv;varying vec3 vWorld;uniform vec2 uSize;uniform float uMembrane;
void main(){
  vec2 q=abs(vUv-.5)*uSize-uSize*.5+.24;
  float edge=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.24;if(edge>0.0)discard;
  float light=exp(-length((vUv-vec2(.25,.8))*vec2(1.2,1.5)));
  vec3 color=mix(vec3(.022,.030,.037),vec3(.095,.126,.133),uMembrane)*(.7+light*.5);
  float grain=fract(sin(dot(floor(vUv*uSize*140.0),vec2(12.9898,78.233)))*43758.5453);
  color*=.96+grain*.08;vec3 sheetNormal=normalize(cross(dFdx(vWorld),dFdy(vWorld)));color*=.8+.2*max(0.0,sheetNormal.z);color+=vec3(.13,.14,.13)*exp(-abs(edge+.016)*100.0)*.25;
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const beadVertex = /* glsl */ `
attribute float aSeed;varying vec3 vWorld;varying vec3 vNormal;varying float vSeed;
void main(){vSeed=aSeed;vWorld=(modelMatrix*instanceMatrix*vec4(position,1.0)).xyz;vNormal=normalize(mat3(modelMatrix*instanceMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}`;
export const beadFragment = /* glsl */ `
${studio}
varying vec3 vWorld;varying vec3 vNormal;varying float vSeed;
void main(){
 float identity=smoothstep(.18,.5,vSeed);vec3 color=materialLight(vWorld,normalize(vNormal),identity,vSeed,0.0);
 color*=.70+.30*smoothstep(.01,.3,vWorld.z);
 gl_FragColor=vec4(color,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const shadowVertex = /* glsl */ `
varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`;
export const shadowFragment = /* glsl */ `
varying vec2 vUv;void main(){float r=length(vUv-.5)*2.0;if(r>1.0)discard;gl_FragColor=vec4(.002,.008,.011,exp(-r*r*4.0)*.55);}`;
