export const simulationCommon = /* glsl */ `
uniform sampler2D uHome;
uniform float uDelta, uTime, uField, uCharge, uBloom, uDown, uSpeed, uMotion;
uniform vec3 uPointer;
vec3 homeTarget(vec4 home) {
  vec3 dust=home.xyz*vec3(4.2,2.8,2.5);
  vec3 shape=home.xyz*(1.0+sin(home.y*4.0+uTime*0.12)*0.065);
  shape.x+=sin(home.y*3.0+uTime*0.08)*0.09;
  return mix(dust,shape,uField);
}
`;
export const positionSimulation = /* glsl */ `
${simulationCommon}
void main() {
  vec2 uv=gl_FragCoord.xy/resolution.xy;
  vec4 p=texture2D(texturePosition,uv);
  vec3 velocity=texture2D(textureVelocity,uv).xyz;
  gl_FragColor=vec4(p.xyz+velocity*uDelta,p.w);
}
`;
export const velocitySimulation = /* glsl */ `
${simulationCommon}
void main() {
  vec2 uv=gl_FragCoord.xy/resolution.xy;
  vec4 home=texture2D(uHome,uv);
  vec3 p=texture2D(texturePosition,uv).xyz;
  vec3 v=texture2D(textureVelocity,uv).xyz;
  vec3 target=homeTarget(home);
  vec3 force=(target-p)*mix(0.8,9.0,uField);
  float t=uTime*0.15;
  vec3 flow=vec3(sin(p.y*2.0+t)-cos(p.z*1.7-t),sin(p.z*1.8+t*.8)-cos(p.x*2.1+t),sin(p.x*1.6-t)-cos(p.y*2.0+t));
  force+=flow*mix(0.028,0.16,uField)*uMotion;
  vec3 away=p-uPointer;
  float dist=length(away);
  float radius=0.55+min(uSpeed,8.0)*0.065;
  float influence=exp(-dist*dist/(radius*radius));
  force+=away/max(dist,0.08)*influence*mix(5.0,-8.0,uDown)*mix(0.5,1.0,uField);
  force-=p*uCharge*1.4;
  force+=normalize(p+vec3(.001))*uBloom*7.0;
  v=(v+force*uDelta)*exp(-mix(2.3,3.6,uField)*uDelta);
  float speed=length(v); if(speed>5.0) v*=5.0/speed;
  gl_FragColor=vec4(v,1);
}
`;
