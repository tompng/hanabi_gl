const vec3 color = vec3(1,1,1);
varying vec2 coord;
varying float brightness;
void main(){
  float alpha = max(1.0 - dot(coord, coord), 0.0);
  gl_FragColor = vec4(brightness * alpha * color, 1);
}
