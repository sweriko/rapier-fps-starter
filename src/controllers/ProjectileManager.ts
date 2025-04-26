import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { Projectile, ProjectileOptions, createProjectile } from '../objects/Projectile';
import { DebugVisualizer } from '../utils/DebugVisualizer';

export class ProjectileManager {
  private projectiles: Projectile[] = [];
  private scene: THREE.Scene;
  private physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> };
  private lastShootTime: number = 0;
  private shootCooldown: number = 200; // milliseconds
  private debugVisualizer: DebugVisualizer | null = null;
  private trajectoryLines: Map<Projectile, THREE.Line> = new Map();
  
  constructor(
    scene: THREE.Scene, 
    physics: { world: RAPIER.World; rigidBodies: Map<THREE.Object3D, RAPIER.RigidBody> }
  ) {
    this.scene = scene;
    this.physics = physics;
  }
  
  // Set the debug visualizer reference
  setDebugVisualizer(debugVisualizer: DebugVisualizer) {
    this.debugVisualizer = debugVisualizer;
  }
  
  // Shoot a projectile from the given position in the given direction
  shoot(position: THREE.Vector3, direction: THREE.Vector3, options: ProjectileOptions = {}) {
    const now = Date.now();
    
    // Apply cooldown
    if (now - this.lastShootTime < this.shootCooldown) {
      return;
    }
    
    this.lastShootTime = now;
    
    // Create projectile
    const projectile = createProjectile(this.physics, position, direction, options);
    
    // Add to scene and tracking array
    this.scene.add(projectile.mesh);
    this.projectiles.push(projectile);
    
    return projectile;
  }
  
  // Update all projectiles
  update() {
    // Update positions from physics
    this.projectiles.forEach(projectile => {
      projectile.update();
      
      // Update trajectory visualization if debug is active
      if (this.debugVisualizer && this.debugVisualizer.isActive()) {
        this.updateTrajectoryVisualization(projectile);
      }
    });
    
    // Check for and remove old projectiles
    this.removeExpiredProjectiles();
  }
  
  // Update trajectory visualization for a projectile
  private updateTrajectoryVisualization(projectile: Projectile) {
    if (!this.debugVisualizer) return;
    
    // Get trajectory points
    const points = projectile.getTrajectoryPoints();
    
    // If there's an existing line for this projectile, remove it
    if (this.trajectoryLines.has(projectile)) {
      const line = this.trajectoryLines.get(projectile)!;
      this.scene.remove(line);
      line.geometry.dispose();
      if (line.material instanceof THREE.Material) {
        line.material.dispose();
      }
      this.trajectoryLines.delete(projectile);
    }
    
    // Create new line with updated points
    const material = new THREE.LineBasicMaterial({ 
      color: (projectile.mesh.material as THREE.MeshStandardMaterial).color.getHex(),
      transparent: true,
      opacity: 0.7
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    
    // Set visibility based on debug status
    line.visible = this.debugVisualizer.isActive();
    
    // Add to scene and tracking map
    this.scene.add(line);
    this.trajectoryLines.set(projectile, line);
  }
  
  // Remove projectiles that have expired or fallen out of the world
  private removeExpiredProjectiles() {
    const projectilesToRemove = this.projectiles.filter(p => p.shouldRemove());
    
    projectilesToRemove.forEach(projectile => {
      projectile.remove(this.scene, this.physics);
      
      // Remove trajectory line if exists
      if (this.trajectoryLines.has(projectile)) {
        const line = this.trajectoryLines.get(projectile)!;
        this.scene.remove(line);
        line.geometry.dispose();
        if (line.material instanceof THREE.Material) {
          line.material.dispose();
        }
        this.trajectoryLines.delete(projectile);
      }
    });
    
    // Filter out the removed projectiles from the array
    this.projectiles = this.projectiles.filter(p => !p.shouldRemove());
  }
  
  // Get the count of active projectiles
  getProjectileCount(): number {
    return this.projectiles.length;
  }
  
  // Clean up all projectiles
  cleanUp() {
    this.projectiles.forEach(projectile => {
      projectile.remove(this.scene, this.physics);
      
      // Remove trajectory lines
      if (this.trajectoryLines.has(projectile)) {
        const line = this.trajectoryLines.get(projectile)!;
        this.scene.remove(line);
        line.geometry.dispose();
        if (line.material instanceof THREE.Material) {
          line.material.dispose();
        }
      }
    });
    
    this.projectiles = [];
    this.trajectoryLines.clear();
  }
} 