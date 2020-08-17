import * as THREE from 'three'
const sphereGeometry = new THREE.SphereBufferGeometry(1, 16, 16, undefined, undefined, 0, Math.PI / 2 * 1.2)

export const skyMesh = new THREE.Mesh(
  sphereGeometry,
  new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 color;
      void main(){
        vec3 view = position.xzy;
        gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + 16.0 * view, 1);
        float n = dot(vec3(view.xy, max(view.z, 0.0)), vec3(0.05, 0.05, 1));
        color = vec3(0.4, 0.6, 0.75) * (1.0 - 0.5 * n) * 0.4;
        if (n < 0.2) color = color * (1.0 + 2.0 * (n - 0.1)) + vec3(1,0.5,0) * (0.1 - n);
      }
    `,
    fragmentShader: `varying vec3 color;void main(){gl_FragColor = vec4(color,1);}`,
    side: THREE.DoubleSide
  })
)