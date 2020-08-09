attribute vec3 random;
uniform float time;
uniform vec3 velocity;
const vec3 wind = vec3(0.1, 0, 0);
const vec3 gravity = vec3(0, 0, -9.8);
varying float kira, duration;
vec3 velocityAt(vec3 v0, float a, float t) {
  return wind + gravity / a + ((v0 - wind) - gravity / a) * exp(-a * t);
}
vec3 positionAt(vec3 v0, float a, float t) {
  return (wind + gravity / a) * t - ((v0 - wind) - gravity / a) / a * (exp(-a * t) - 1.0);
}

void main() {
  gl_PointSize = 4.0;
  vec3 wind = vec3(0.1, 0, 0);
  vec3 v0 = velocity * 8.0 + random * 0.02;
  vec3 pos;
  float rnd1 = 16.0 * velocity.x - floor(16.0 * velocity.x);
  float rnd = 512.0 * random.x - floor(512.0 * random.x);
  float tf = 0.4 * rnd;
  float t = time - 0.01 * rnd;
  duration = 0.5 + 0.2 * rnd1;

  if (t > tf) {
    kira = 0.6+ 0.4 * sin((123.0 + 23.0 * rnd) * t + rnd * 1234.0);
    pos = positionAt(v0, 6.0, tf) + positionAt(velocityAt(v0, 6.0, tf) + random * 0.4, 16.0, t - tf);
  } else {
    kira = 0.5;
    pos = positionAt(v0, 6.0, t);
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1);
}
