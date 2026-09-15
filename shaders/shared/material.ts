export const materialGLSL = /* glsl */ `
float hash31(vec3 p) {
  p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float softbox(vec3 ray,vec3 direction,vec2 size) {
  vec3 forward=normalize(direction);
  vec3 right=normalize(cross(vec3(0,1,0),forward));
  vec3 up=cross(forward,right);
  float facing=dot(ray,forward);
  vec2 uv=vec2(dot(ray,right),dot(ray,up))/max(.05,facing);
  return exp(-pow(abs(uv.x/size.x),4.0)-pow(abs(uv.y/size.y),4.0))*smoothstep(.0,.4,facing);
}
vec3 studio(vec3 r) {
  vec3 base=mix(vec3(.003,.006,.012),vec3(.055,.075,.085),smoothstep(-.8,.9,r.y));
  base+=vec3(1.0,.9,.74)*softbox(r,vec3(-1.4,2.4,1.3),vec2(.95,.23))*3.5;
  base+=vec3(.53,.83,1.0)*softbox(r,vec3(2.5,.35,-.6),vec2(.07,1.15))*4.0;
  base+=vec3(.66,.86,.91)*softbox(r,vec3(-2.3,.3,-1.4),vec2(.12,.85))*2.2;
  base+=vec3(.12,.30,.36)*softbox(r,vec3(.3,-2.0,1.0),vec2(1.3,.2))*.5;
  return base;
}
vec3 shadeMatter(vec3 p, vec3 normal, vec3 rd, float thickness) {
  vec3 view=-rd;
  float facing=max(dot(normal,view),0.0);
  float fresnel=0.08+0.92*pow(1.0-facing,4.0);
  float time=uTime*(0.045+uCharge*0.1);
  vec3 reflected=reflect(rd,normal);
  vec3 refracted=refract(rd,normal,1.0/1.38);
  vec3 inside=p+refracted*(thickness*0.52+0.3);
  float flow=noise3(inside*1.75+vec3(time,-time*0.7,uSeed));
  float layer=noise3(inside*3.3+flow*2.4-time*0.6);
  vec3 absorption=mix(vec3(0.62,0.17,0.09),vec3(0.24,0.16,0.08),smoothstep(0.25,0.72,flow));
  vec3 transmittance=exp(-absorption*thickness*1.7);
  // A refracted studio lobe, separated very slightly by wavelength.
  vec3 refractedLight=vec3(
    studio(refract(rd,normal,1.0/1.375)).r,
    studio(refracted).g,
    studio(refract(rd,normal,1.0/1.386)).b);
  vec3 pearl=mix(vec3(0.052,0.11,0.145),vec3(0.17,0.13,0.078),smoothstep(0.46,0.78,layer));
  float ribbon=exp(-pow((flow+inside.y*0.105-0.55)*17.0,2.0));
  vec3 core=mix(vec3(0.12,0.35,0.42),vec3(0.35,0.28,0.16),sin(uSeed)*0.5+0.5);
  vec3 transmitted=(pearl+refractedLight*0.20)*transmittance;
  transmitted+=core*ribbon*(0.11+uCharge*0.32)*(0.4+facing*0.6);
  // Thin, curved interior membranes reveal depth as the surface bends.
  float membrane=inside.y+sin(inside.x*2.1+time)*.3+cos(inside.z*2.6-time*.7)*.2;
  float vein=exp(-pow((membrane-.08)*32.0,2.0))+.45*exp(-pow((membrane+.38)*22.0,2.0));
  transmitted+=mix(vec3(.075,.20,.23),vec3(.20,.16,.085),flow)*vein*(.40+uCharge*.6);
  transmitted=mix(transmitted,transmitted+vec3(.10,.07,.045)*facing,uPulse*.65);
  vec3 color=mix(transmitted,studio(reflected),0.22+fresnel*0.74-uPulse*.05);
  float film=sin(facing*9.0+layer*3.0+uSeed)*0.5+0.5;
  color+=mix(vec3(0.08,0.105,0.13),vec3(0.14,0.11,0.075),film)*pow(1.0-facing,1.8)*0.36;
  float key=pow(max(dot(normal,normalize(vec3(-0.55,0.8,1.5))),0.0),60.0);
  color+=vec3(1.0,0.9,0.74)*key*0.55;
  float pointerLight=pow(max(dot(normal,normalize(uPointer-p+vec3(0,0,1.3))),0.0),24.0)*uHover;
  color+=vec3(0.48,0.70,0.77)*pointerLight*0.12;
  color+=core*(uCharge*0.19+uBloom*0.33)*facing;
  return color;
}
`;
