export const heightGLSL = /* glsl */ `
uniform sampler2D uField;
uniform vec2 uSize;
uniform float uResolution;
float heightAt(vec2 p) {
  vec4 data = texture2D(uField, clamp(p, 0.0, 1.0));
  float h = dot(data.rg, vec2(256.0 / 257.0, 1.0 / 257.0)) - 0.5;
  vec2 edge = abs(p - 0.5) * 2.0;
  float border = pow(edge.x, 18.0) + pow(edge.y, 18.0);
  return h - border * 0.07;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

export const sandVertex = /* glsl */ `
${heightGLSL}
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z = heightAt(uv);
  vPosition = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const sandFragment = /* glsl */ `
${heightGLSL}
uniform vec2 uPointer;
uniform float uDown;
uniform float uToolRadius;
uniform float uShadowSamples;
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vec2 corner = max(abs(vUv - 0.5) * uSize - uSize * 0.5 + 0.23, 0.0);
  float edge = length(corner) - 0.23;
  if (edge > 0.0) discard;
  float texel = 1.0 / uResolution;
  float h = heightAt(vUv);
  float l = heightAt(vUv - vec2(texel, 0.0)), r = heightAt(vUv + vec2(texel, 0.0));
  float b = heightAt(vUv - vec2(0.0, texel)), t = heightAt(vUv + vec2(0.0, texel));
  vec2 slope = vec2(l-r, b-t) / (2.0 * texel * uSize);
  vec2 cell = vUv * uSize * 95.0;
  float grain = hash(floor(cell));
  vec2 direction = texture2D(uField, vUv).ba * 2.0 - 1.0;
  float micro = (grain - 0.5) * 0.26;
  vec3 n = normalize(vec3(slope + vec2(micro, -micro * 0.75), 1.0));
  vec3 light = normalize(vec3(-0.83, 0.42, 0.36));
  vec3 fill = normalize(vec3(0.55, -0.3, 0.75));
  vec3 view = normalize(cameraPosition - vPosition);
  float diffuse = max(dot(n, light), 0.0);
  float cool = max(dot(n, fill), 0.0);
  float spec = pow(max(dot(n, normalize(view + light)), 0.0), 30.0);
  float velvet = pow(1.0 - abs(dot(n, view)), 3.0);
  // Short horizon samples supply local self-shadow on grooves and mound edges.
  float obstruction = 0.0;
  for (int i=1; i<=4; i++) {
    if (float(i)>uShadowSamples) break;
    float d = float(i) * 0.033;
    float ahead = heightAt(vUv + light.xy * d / uSize);
    obstruction = max(obstruction, (ahead-h) / d - 0.22);
  }
  float shadow = exp(-max(0.0, obstruction) * 2.1);
  float ao = clamp(1.0 - max(0.0, (l+r+b+t)*0.25-h)*12.0, 0.62, 1.0);
  vec3 silver = mix(vec3(0.095,0.133,0.161),vec3(0.36,0.37,0.345), diffuse);
  float brushed = pow(abs(dot(normalize(direction+0.001), normalize(light.xy))), 3.0);
  vec3 color = silver * (0.20 + diffuse * 1.25 * shadow + cool * 0.20) * ao;
  color *= mix(vec3(1.10,0.99,0.86),vec3(0.78,0.92,1.12),smoothstep(0.0,1.0,vUv.x));
  color += vec3(0.77,0.64,0.45) * spec * 0.22 * shadow;
  color += vec3(0.37,0.44,0.5) * velvet * 0.17;
  color *= 0.71 + grain * 0.49 + brushed * 0.055;
  // Microscopic mineral inclusions, stable in surface space, never blinking.
  color += pow(grain, 40.0) * spec * vec3(0.33,0.30,0.24);
  float vignette = 0.5 + 0.5 * exp(-length((vUv - vec2(0.28,0.72)) * vec2(1.3,1.1)));
  color *= vignette;
  gl_FragColor = vec4(color, 1.0-smoothstep(-0.025, 0.0, edge));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const grainVertex = /* glsl */ `
${heightGLSL}
uniform float uDpr;
uniform vec2 uStirPosition;
uniform float uStir;
uniform float uStirTime;
uniform float uGather;
attribute float aSize;
varying float vLight;
void main() {
  vec2 delta = position.xy-uStirPosition;
  float influence = exp(-dot(delta,delta)*5.0)*uStir;
  float drift = sin(uStirTime*7.0+hash(position.xy)*6.28)*0.055;
  vec2 tangent = normalize(vec2(-delta.y,delta.x)+0.001);
  vec2 stirred = position.xy + tangent*influence*drift + normalize(delta+0.001)*influence*(0.03-uGather*0.065);
  vec2 uv = stirred / uSize + 0.5;
  vec3 p = vec3(stirred, heightAt(uv) + 0.005 + influence*abs(drift)*0.17);
  vLight = hash(position.xy * 31.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
  gl_PointSize = aSize * uDpr;
}`;
export const grainFragment = /* glsl */ `
varying float vLight;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  vec3 c = mix(vec3(0.13,0.17,0.19), vec3(0.62,0.62,0.56), vLight);
  gl_FragColor = vec4(c, (1.0-smoothstep(0.18,0.5,r))*0.28);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
