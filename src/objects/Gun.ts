import * as THREE from 'three';

// Create a gun model that will be shown in the first-person view
export function createGun() {
  // Create a group to hold all gun parts
  const gunGroup = new THREE.Group();
  
  // Materials
  const gunMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.5,
    metalness: 0.7
  });
  
  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.9,
    metalness: 0.2
  });
  
  // Gun barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 16);
  const barrel = new THREE.Mesh(barrelGeometry, gunMetalMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.35;
  barrel.position.y = -0.05;
  
  // Gun body
  const bodyGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
  const body = new THREE.Mesh(bodyGeometry, gunMetalMaterial);
  body.position.z = -0.1;
  body.position.y = -0.05;
  
  // Gun grip
  const gripGeometry = new THREE.BoxGeometry(0.08, 0.2, 0.1);
  const grip = new THREE.Mesh(gripGeometry, gripMaterial);
  grip.position.y = -0.15;
  
  // Gun details - sight
  const sightGeometry = new THREE.BoxGeometry(0.02, 0.04, 0.02);
  const sight = new THREE.Mesh(sightGeometry, gunMetalMaterial);
  sight.position.y = 0.02;
  sight.position.z = -0.1;

  // Add all parts to the gun group
  gunGroup.add(barrel);
  gunGroup.add(body);
  gunGroup.add(grip);
  gunGroup.add(sight);
  
  // Position the gun in the bottom right of the screen
  gunGroup.position.set(0.2, -0.2, -0.5);
  
  // Add small random movement to simulate breathing/holding the gun
  let lastTime = 0;
  const animate = (time: number) => {
    const delta = time - lastTime;
    lastTime = time;
    
    const breathingAmplitude = 0.001;
    const breathingSpeed = 0.002;
    gunGroup.position.y = -0.2 + Math.sin(time * breathingSpeed) * breathingAmplitude;
    gunGroup.rotation.z = Math.sin(time * breathingSpeed * 0.5) * 0.01;
    
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  
  return gunGroup;
}

// Muzzle flash effect
export function createMuzzleFlash() {
  // Create a simple particle system for the muzzle flash
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  
  // Create a cone-like arrangement of particles
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.08;
    const z = -Math.random() * 0.2;
    
    vertices.push(
      Math.cos(angle) * radius, 
      Math.sin(angle) * radius, 
      z
    );
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  
  // Create materials
  const material = new THREE.PointsMaterial({
    color: 0xffff00,
    size: 0.05,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8
  });
  
  // Create the particle system
  const particles = new THREE.Points(geometry, material);
  
  // Create a light for the flash
  const light = new THREE.PointLight(0xffff00, 5, 1);
  light.position.set(0, 0, 0);
  
  // Create a group to hold both the particles and light
  const group = new THREE.Group();
  group.add(particles);
  group.add(light);
  
  return group;
} 