export const blobFragmentShader = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uMotion;
uniform float uProximity;
uniform vec3 uHoverPoint;
uniform vec3 uDrag;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vRest;
varying float vContact;

float hash(vec3 p) {
  p=fract(p*0.3183099+vec3(0.1,0.2,0.3));
  p*=17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

// Analytic studio environment: broad silk, long strip lights and dark flags.
// No HDR downloads, bloom pass, or screen-space transmission buffer.
vec3 studio(vec3 r) {
  vec3 color=mix(vec3(0.035,0.055,0.072),vec3(0.64,0.65,0.62),smoothstep(-0.8,0.85,r.y));
  float key=exp(-pow((r.x+0.40)/0.39,4.0)-pow((r.y-0.61)/0.30,4.0));
  float strip=exp(-pow((r.x-0.80)/0.09,2.0)-pow((r.y-0.12)/0.78,4.0));
  float rim=exp(-pow((r.x+0.91)/0.11,2.0)-pow((r.y+0.1)/0.72,4.0));
  float flag=exp(-pow((r.x-0.41)/0.25,4.0)-pow((r.y+0.08)/0.62,4.0));
  color*=1.0-flag*0.87;
  color+=vec3(1.0,0.98,0.92)*key*1.55;
  color+=vec3(0.79,0.87,1.0)*strip*1.4;
  color+=vec3(1.0,0.89,0.75)*rim*0.85;
  return color;
}

void main() {
  float t=uTime*mix(0.008,0.045,uMotion);
  vec3 view=normalize(cameraPosition-vPosition);
  vec3 normal=normalize(vNormal);
  // Quiet microstructure, with no noisy glitter or sparkling speculars.
  float micro=noise(vRest*43.0+t)*0.002;
  normal=normalize(normal+micro*sin(vRest.yzx*71.0));
  float facing=max(dot(normal,view),0.0);
  float fresnel=pow(1.0-facing,3.0);
  vec3 reflection=reflect(-view,normal);
  vec3 refraction=refract(-view,normal,1.0/1.34);
  vec3 inner=vRest+refraction*(0.8+facing*0.65);
  inner.xy+=uDrag.xy*0.11;
  float flow=noise(inner*2.1+vec3(t,-t*0.7,t*0.3));
  float depth=noise(inner*3.5+vec3(-t*0.4,t*0.6,flow));
  float vein=sin(inner.y*3.0+inner.x*2.3+flow*5.0+t*0.4)*0.5+0.5;

  vec3 pearl=vec3(0.40,0.37,0.30);
  vec3 ice=vec3(0.055,0.18,0.25);
  vec3 lavender=vec3(0.19,0.14,0.23);
  vec3 champagne=vec3(0.38,0.23,0.10);
  vec3 body=mix(pearl,ice,smoothstep(0.30,0.75,flow)*0.8);
  body=mix(body,lavender,smoothstep(0.48,0.82,depth)*0.62);
  body=mix(body,champagne,pow(vein,3.0)*0.48);
  float thickness=sqrt(max(0.0,facing));
  vec3 transmitted=mix(vec3(0.68,0.66,0.60),body,0.70+thickness*0.25);
  transmitted*=0.73+0.32*depth;
  // A bent, displaced second environment gives a sense of an interior surface.
  vec3 caustic=studio(normalize(refraction+normal*0.48));
  transmitted+=caustic*0.035*thickness;
  float reflectionWeight=0.38+fresnel*0.52;
  vec3 color=mix(transmitted,studio(reflection),reflectionWeight);

  float silk=pow(max(dot(normal,normalize(vec3(-0.65,1.1,1.8))),0.0),25.0);
  color+=vec3(1.0,0.96,0.85)*silk*0.16;
  color*=mix(0.62,1.0,smoothstep(0.02,0.38,facing));
  float rim=pow(1.0-facing,5.0);
  color+=vec3(0.65,0.73,0.80)*rim*0.12;
  float sensing=pow(max(dot(vRest,uHoverPoint),0.0),8.0)*uProximity;
  color+=vec3(0.92,0.85,0.69)*(sensing*0.035+vContact*0.16);
  color+=(hash(vec3(gl_FragCoord.xy,uTime*0.08))-0.5)*0.0025;
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
