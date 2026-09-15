export const particleVertex = /* glsl */ `
uniform sampler2D uPositions;
uniform float uUseSimulation, uTime, uField, uCharge, uBloom, uPixelRatio, uViewportHeight, uDown, uSpeed;
uniform vec3 uPointer;
attribute vec2 reference;
attribute float seed;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec3 dust=position*vec3(4.2,2.8,2.5);
  vec3 home=position*(1.0+sin(position.y*4.0+uTime*.12)*.065);
  vec3 p=mix(dust,home,uField);
  if(uUseSimulation>0.5) p=texture2D(uPositions,reference).xyz;
  else {
    vec3 away=p-uPointer;
    p+=normalize(away+vec3(.001))*exp(-dot(away,away)*2.0)*mix(.3,-.35,uDown);
    p+=normalize(p+vec3(.001))*uBloom*.3;
  }
  float nearPointer=exp(-dot(p-uPointer,p-uPointer)/(0.28+min(uSpeed,8.0)*.08));
  float rare=smoothstep(.87,1.0,seed);
  float shell=pow(length(position),5.0);
  vAlpha=(.003+rare*.025)+nearPointer*(.10+rare*.2)+uCharge*.13+uBloom*(.17+rare*.24);
  vAlpha=mix(vAlpha,.28+shell*.70+rare*.40,uField);
  vColor=mix(vec3(.30,.52,.60),vec3(.87,.80,.65),seed*seed);
  vec4 mv=modelViewMatrix*vec4(p,1);
  gl_Position=projectionMatrix*mv;
  float size=mix(.006,.013,seed)*mix(1.0,1.3,uField)*uViewportHeight/max(1.0,-mv.z);
  gl_PointSize=clamp(size,1.0,3.0*uPixelRatio);
}
`;
export const particleFragment = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float r=length(gl_PointCoord-.5)*2.0;
  if(r>1.0) discard;
  float alpha=exp(-r*r*4.0)*vAlpha;
  gl_FragColor=vec4(vColor,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
