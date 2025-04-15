import * as THREE from 'three';

// Setup scene lighting - simplified version
export function setupLights(scene: THREE.Scene) {
  // Add a very strong ambient light for overall scene brightness
  const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1.0);
  scene.add(ambientLight);
  
  // Simple directional light for shadows
  const dirLight = new THREE.DirectionalLight(0xFFFFFF, 1.0);
  dirLight.position.set(5, 10, 7.5);
  scene.add(dirLight);
} 