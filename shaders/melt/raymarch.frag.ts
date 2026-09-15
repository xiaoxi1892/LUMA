import { materialGLSL } from "../shared/material";

export const raymarchFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform mat4 uInverseProjection;
uniform mat4 uCameraMatrix;
uniform mat4 uViewProjection;
uniform vec3 uCamera;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform vec4 uBalls[12];
uniform vec4 uMotion[12];
uniform int uCount;
uniform int uSteps;
uniform float uTime;
uniform float uMotionScale;
uniform float uSeed;
uniform float uPulse;
uniform float uField;
uniform float uCharge;
uniform float uBloom;
uniform float uHover;
uniform float uPress;
uniform vec3 uPointer;
uniform vec3 uPulseDrag, uPulseAnchor, uPulseLag;
uniform vec4 uRipples[5];
uniform float uRippleStrength[5];
${materialGLSL}

float smin(float a,float b,float k) {
  float h=max(k-abs(a-b),0.0)/k; return min(a,b)-h*h*k*0.25;
}
float sdf(vec3 p) {
  float t=uTime*mix(0.018,0.13,uMotionScale);
  vec3 warp=vec3(
    sin(p.y*2.1+t*0.71)*sin(p.z*1.8-t*0.31),
    sin(p.z*2.4-t*0.52)*sin(p.x*2.1+t*0.47),
    sin(p.x*2.0+t*0.37)*sin(p.y*1.7-t*0.62));
  vec3 w=p+warp*(0.10+uPulse*0.015);
  w.x=(w.x+sin(p.y*2.4+0.4+t*.21)*.14)/1.12;
  w.y*=1.04;
  vec3 relative=p-uPulseAnchor-uPulseDrag*0.45;
  float grab=exp(-dot(relative,relative)*2.4);
  w-=uPulse*(uPulseDrag*grab*0.9+uPulseLag*(1.0-grab)*0.105);
  float d=100.0;
  for(int i=0;i<12;i++) {
    if(i>=uCount) break;
    vec3 q=w-uBalls[i].xyz;
    vec3 axis=uMotion[i].xyz;
    float stretch=1.0+uMotion[i].w;
    float parallel=dot(q,axis);
    q=(q-axis*parallel)*sqrt(stretch)+axis*parallel/stretch;
    float radius=uBalls[i].w*(1.0+sin(t*1.3+float(i)*2.1)*0.013);
    d=smin(d,length(q)-radius,0.32-uPulse*0.07);
  }
  // Pressure adds positive distance at the touched surface: a real local dent.
  vec3 pressurePoint=uPulseAnchor+uPulseDrag*uPulse;
  d+=exp(-dot(p-pressurePoint,p-pressurePoint)*8.0)*uPress*(0.5+uPulse*0.75);
  d-=exp(-dot(p-uPointer,p-uPointer)*5.0)*uHover*0.025;
  for(int i=0;i<5;i++) {
    float age=uRipples[i].w;
    if(age<0.0 || age>2.1) continue;
    float distance=length(p-uRipples[i].xyz);
    float dent=exp(-distance*distance*11.0)*exp(-age*8.0)*min(age*35.0,1.0)*0.15;
    float ring=sin(distance*14.0-age*13.0)*exp(-pow(distance-age*1.65,2.0)*8.0)*exp(-age*3.0)*0.026;
    d+=(dent+ring)*uRippleStrength[i]*(1.0+uPulse*1.2);
  }
  if(uCharge>0.9) d+=sin(p.x*52.0+uTime*39.0)*sin(p.y*41.0-uTime*27.0)*(uCharge-0.9)*0.021;
  if(uField>0.015) {
    float holes=noise3(p*14.0+vec3(0,uTime*0.04,uSeed));
    d=max(d,(uField*1.25-holes-0.12)*0.12);
  }
  return d;
}
vec3 normalAt(vec3 p) {
  vec2 e=vec2(0.0018,-0.0018);
  return normalize(e.xyy*sdf(p+e.xyy)+e.yyx*sdf(p+e.yyx)+e.yxy*sdf(p+e.yxy)+e.xxx*sdf(p+e.xxx));
}
vec2 bounds(vec3 ro,vec3 rd) {
  vec3 inv=1.0/rd;
  vec3 a=(uBoundsMin-ro)*inv, b=(uBoundsMax-ro)*inv;
  vec3 lo=min(a,b),hi=max(a,b);
  return vec2(max(max(lo.x,lo.y),lo.z),min(min(hi.x,hi.y),hi.z));
}
vec3 background(vec2 uv,vec3 rd) {
  vec2 p=uv-0.5; p.x*=uResolution.x/uResolution.y;
  float haze=exp(-dot(p-vec2(0,0.02),p-vec2(0,0.02))*3.3);
  float floorGlow=exp(-pow(p.y+0.26,2.0)*100.0-p.x*p.x*5.0);
  vec3 color=vec3(0.0024,0.0030,0.0039)+vec3(0.004,0.010,0.013)*haze;
  color+=vec3(0.013,0.021,0.023)*floorGlow;
  color+=vec3(0.025,0.055,0.065)*uBloom*haze;
  float wave=sin(length(p)*24.0-uTime*5.0)*uBloom*0.007*exp(-length(p)*3.0);
  color+=vec3(0.4,0.65,0.74)*wave;
  color*=1.0-smoothstep(0.2,0.9,length(p))*0.38;
  color+=(hash31(vec3(gl_FragCoord.xy,0))-0.5)*0.00065;
  return max(color,vec3(0));
}
void main() {
  vec2 ndc=vUv*2.0-1.0;
  vec4 cameraRay=uInverseProjection*vec4(ndc,1,1);
  vec3 rd=normalize(mat3(uCameraMatrix)*(cameraRay.xyz/cameraRay.w));
  vec3 color=background(vUv,rd);
  float depth=1.0;
  if(uField<0.985 && uCount>0) {
    vec2 interval=bounds(uCamera,rd);
    if(interval.y>max(interval.x,0.0)) {
      float distance=max(interval.x,0.0);
      bool hit=false;
      vec3 p=vec3(0);
      for(int i=0;i<72;i++) {
        if(i>=uSteps) break;
        p=uCamera+rd*distance;
        float d=sdf(p);
        if(d<0.0025) {hit=true;break;}
        distance+=max(d*0.68,0.003);
        if(distance>interval.y) break;
      }
      if(hit) {
        vec3 n=normalAt(p);
        float thickness=0.7;
        for(int i=0;i<12;i++) {
          if(i>=uCount) break;
          vec3 q=p-uBalls[i].xyz;
          float through=max(0.0,uBalls[i].w*uBalls[i].w-dot(q,q)+pow(dot(q,rd),2.0));
          thickness=max(thickness,sqrt(through)*1.8);
        }
        color=shadeMatter(p,n,rd,thickness);
        vec4 clip=uViewProjection*vec4(p,1);
        depth=(clip.z/clip.w)*0.5+0.5;
      }
    }
  }
  gl_FragDepth=depth;
  gl_FragColor=vec4(color,1);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
