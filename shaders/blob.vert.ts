// GLSL kept in a typed source module, so Next needs no raw-loader dependency.
export const blobVertexShader = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform vec3 uAnchor;
uniform vec3 uHoverPoint;
uniform vec3 uDrag;
uniform vec3 uLag;
uniform vec3 uCenter;
uniform float uPress;
uniform float uProximity;
uniform float uReleaseTime;
uniform float uReleaseStrength;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vRest;
varying float vContact;

vec3 deform(vec3 p) {
  float t = uTime * mix(0.015, 0.085, uMotion);
  float a = sin(p.x * 2.7 + p.y * 1.5 + t * 0.71);
  float b = sin(p.y * 3.1 - p.z * 1.6 - t * 0.57);
  float c = sin(p.z * 3.4 + p.x * 1.8 + t * 0.43);
  float n2 = sin(p.x * 5.2 - t * 0.6) * sin(p.y * 4.1 + p.z * 2.2 + t * 0.8);
  float radius = 1.0 + a*b*c*0.135 + n2*0.027 + sin(t*1.4)*0.018;
  vec3 q = p * vec3(1.075, 1.035, 0.94) * radius;
  q.x += 0.075*p.y*p.y - 0.03;
  q.y += 0.035*sin(t*0.8);
  float dist = distance(p, uAnchor);
  float grab = exp(-dist*dist*3.4);
  float hover = exp(-dot(p-uHoverPoint,p-uHoverPoint)*3.8);
  q += p * hover * uProximity * 0.047;
  q -= p * uPress * grab;
  q += p * uPress * 0.075 * (1.0-grab);
  q += uDrag * grab * 0.93;
  q += uLag * (1.0-grab) * 0.105;
  float shear = (uDrag.x-uLag.x)*p.y - (uDrag.y-uLag.y)*p.x;
  q.xy += vec2(-p.y,p.x)*shear*0.11;
  float age = uTime-uReleaseTime;
  if (age >= 0.0 && age < 2.0) {
    q += p*sin(dist*10.0-age*13.0)*exp(-age*4.4)*exp(-dist*0.7)*uReleaseStrength*0.032;
  }
  return q + uCenter;
}

void main() {
  vec3 p = normalize(position);
  vec3 tangent = normalize(cross(abs(p.y)>0.95 ? vec3(1,0,0) : vec3(0,1,0),p));
  vec3 bitangent = normalize(cross(p,tangent));
  vec3 q = deform(p);
  // Reconstruct the actual deformed surface normal; highlights bend with touch.
  float eps = 0.007;
  vec3 dt = deform(normalize(p+tangent*eps))-q;
  vec3 db = deform(normalize(p+bitangent*eps))-q;
  vNormal = normalize(mat3(modelMatrix)*normalize(cross(dt,db)));
  vPosition = (modelMatrix*vec4(q,1.0)).xyz;
  vRest = p;
  vContact = exp(-dot(p-uAnchor,p-uAnchor)*3.4)*uPress;
  gl_Position = projectionMatrix*viewMatrix*vec4(vPosition,1.0);
}
`;
