import {
  sandVertex,
  sandFragment,
  grainFragment,
  heightGLSL,
} from "../sand/surface";
import { studio } from "./material";
const morphHeight = (s: string) =>
  s
    .replace(
      "uniform sampler2D uField;",
      "uniform float uSand;\nuniform sampler2D uField;",
    )
    .replace(
      "return h - border * 0.07;",
      "return (h - border * 0.07) * uSand;",
    );
export const morphSurfaceVertex = morphHeight(sandVertex);
export const morphSurfaceFragment = morphHeight(sandFragment)
  .replace(
    "uniform vec2 uPointer;",
    "uniform float uBubble;\nuniform vec2 uPointer;",
  )
  .replace(
    "gl_FragColor = vec4(color,",
    "float sheetLight=exp(-length((vUv-vec2(.25,.8))*vec2(1.2,1.5)));\nvec3 sheet=mix(vec3(.022,.030,.037),vec3(.095,.126,.133),mix(.22,1.0,uBubble))*(.7+sheetLight*.5);\ncolor=mix(sheet,color,uSand);\ngl_FragColor = vec4(color,",
  );
export const morphBodyVertex = /* glsl */ `
uniform vec3 uWeights;
attribute vec4 aCell;attribute vec4 aTouch;attribute vec4 aBead;attribute vec2 aExtra;
varying vec3 vWorld;varying vec3 vNormal;varying vec2 vLocal;varying float vSeed;varying float vBubble;
float capHeight(vec2 p){float dome=pow(max(0.0,1.0-dot(p,p)),1.3);vec2 d=p-clamp(aTouch.xy,vec2(-.6),vec2(.6));return (.49-.65*exp(-dot(d,d)*5.0)*aCell.w)*dome*aCell.z*2.4;}
void main(){
  float bubble=uWeights.y,beads=uWeights.z,total=bubble+beads;
  float sphere=beads/max(.0001,total),size=mix(aCell.z*aExtra.y,aBead.w,sphere)*total;
  vLocal=position.xy;vSeed=aExtra.x;vBubble=1.0-sphere;
  float h=capHeight(position.xy);if(position.z<0.0)h=-.01;
  vec2 center=mix(aCell.xy,aBead.xy,sphere);
  vWorld=vec3(center+position.xy*size,mix((.045+h)*total,aBead.z+position.z*aBead.w,sphere));
  vWorld.xy+=aTouch.zw*max(0.0,1.0-dot(position.xy,position.xy))*bubble;
  if(total<.001||size<.001)vWorld.z=-1.0;
  float e=.012;vec2 slope=vec2(capHeight(position.xy+vec2(e,0.0))-capHeight(position.xy-vec2(e,0.0)),capHeight(position.xy+vec2(0.0,e))-capHeight(position.xy-vec2(0.0,e)))/(2.0*e*aCell.z);
  vNormal=normalize(mix(normalize(vec3(-slope,1.0)),normal,sphere));
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
}`;
export const morphBodyFragment = /* glsl */ `
${studio}
uniform vec3 uWeights;
varying vec3 vWorld;varying vec3 vNormal;varying vec2 vLocal;varying float vSeed;varying float vBubble;
void main(){
 float radius=length(vLocal);vec3 color=materialLight(vWorld,normalize(vNormal),smoothstep(.18,.5,vSeed)*(1.0-vBubble),mix(vSeed,.38,vBubble),0.0);
 float collar=.55+.45*smoothstep(1.0,.70,radius);color*=mix(.70+.30*smoothstep(.01,.3,vWorld.z),collar,vBubble);
 color+=vec3(.30,.29,.23)*exp(-pow((radius-.94)*55.0,2.0))*.32*vBubble;
 float grain=fract(sin(dot(floor(vWorld.xy*95.0),vec2(127.1,311.7)))*43758.5453);
 vec3 granular=vec3(.17,.21,.23)*(.55+max(dot(normalize(vNormal),normalize(vec3(-.83,.42,.36))),0.0))*(.72+grain*.5);
 color=mix(color,granular,smoothstep(.15,.8,uWeights.x));
 gl_FragColor=vec4(color,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export const morphGrainVertex = /* glsl */ `
${heightGLSL}
uniform vec3 uWeights;uniform float uDpr;
attribute vec3 aAttractor;attribute float aSize;varying float vLight;
void main(){
 float condense=1.0-uWeights.x;
 vec3 destination=aAttractor;
 vec3 p=mix(vec3(position.xy,heightAt(position.xy/uSize+.5)+.008),destination,condense);
 p.z+=sin(condense*3.14159)*.17;
 vLight=hash(position.xy*31.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
 gl_PointSize=aSize*uDpr*max(0.0,1.0-condense*1.2);
}`;
export { grainFragment };
