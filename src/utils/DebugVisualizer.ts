import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

/**
 * Debug visualizer class for rendering physics objects and trajectories
 */
export class DebugVisualizer {
  private scene: THREE.Scene;
  private active: boolean = false;
  private objects: THREE.Object3D[] = [];
  private lines: THREE.Line[] = [];
  private tempVector: THREE.Vector3 = new THREE.Vector3();
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  /**
   * Toggle debug visualization on/off
   */
  public toggle(): boolean {
    this.active = !this.active;
    
    // Hide all 3D objects when inactive
    for (const obj of this.objects) {
      obj.visible = this.active;
    }
    
    // Hide all lines when inactive
    for (const line of this.lines) {
      line.visible = this.active;
    }
    
    return this.active;
  }
  
  /**
   * Clear all debug visualizations
   */
  public clear(): void {
    // Remove all 3D objects
    for (const obj of this.objects) {
      this.scene.remove(obj);
      if (obj instanceof THREE.Mesh) {
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        } else if (Array.isArray(obj.material)) {
          for (const material of obj.material) {
            material.dispose();
          }
        }
        obj.geometry.dispose();
      }
    }
    
    // Remove all lines
    for (const line of this.lines) {
      this.scene.remove(line);
      if (line.material instanceof THREE.Material) {
        line.material.dispose();
      }
      line.geometry.dispose();
    }
    
    this.objects = [];
    this.lines = [];
  }
  
  /**
   * Visualize a Rapier collider
   * @param collider Rapier collider to visualize
   * @param color Color of the visualization
   */
  public visualizeCollider(collider: RAPIER.Collider, color: number = 0x00ff00): void {
    const position = collider.translation();
    const rotation = collider.rotation();
    
    let mesh: THREE.Mesh;
    
    // Create appropriate geometry based on collider type
    switch (collider.shape.type) {
      case RAPIER.ShapeType.Cuboid:
        const cuboid = collider.shape as any;
        const halfExtents = cuboid.halfExtents;
        const geometry = new THREE.BoxGeometry(
          halfExtents.x * 2, 
          halfExtents.y * 2, 
          halfExtents.z * 2
        );
        mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.3 
          })
        );
        break;
        
      case RAPIER.ShapeType.Ball:
        const ball = collider.shape as any;
        const radius = ball.radius;
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 16, 16),
          new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.3 
          })
        );
        break;
        
      case RAPIER.ShapeType.Capsule:
        const capsule = collider.shape as any;
        // Combine a cylinder and two spheres for capsule visualization
        const halfHeight = capsule.halfHeight;
        const capsuleRadius = capsule.radius;
        
        const capsuleGroup = new THREE.Group();
        
        // Cylinder body
        const cylinder = new THREE.Mesh(
          new THREE.CylinderGeometry(capsuleRadius, capsuleRadius, halfHeight * 2, 16),
          new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.3 
          })
        );
        capsuleGroup.add(cylinder);
        
        // Top sphere
        const topSphere = new THREE.Mesh(
          new THREE.SphereGeometry(capsuleRadius, 16, 16),
          new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.3 
          })
        );
        topSphere.position.y = halfHeight;
        capsuleGroup.add(topSphere);
        
        // Bottom sphere
        const bottomSphere = new THREE.Mesh(
          new THREE.SphereGeometry(capsuleRadius, 16, 16),
          new THREE.MeshBasicMaterial({ 
            color, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.3 
          })
        );
        bottomSphere.position.y = -halfHeight;
        capsuleGroup.add(bottomSphere);
        
        // Add the capsule group to the scene directly
        capsuleGroup.position.set(position.x, position.y, position.z);
        capsuleGroup.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        capsuleGroup.visible = this.active;
        this.scene.add(capsuleGroup);
        
        // Add to tracked objects for proper toggling
        this.objects.push(capsuleGroup);
        
        // Skip the rest of the function since we already added the capsule group
        return;
        
      default:
        // Default fallback - just create a small sphere at the collider position
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 8),
          new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.3 
          })
        );
        break;
    }
    
    // Set position and rotation
    mesh.position.set(position.x, position.y, position.z);
    mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Hide if debug is inactive
    mesh.visible = this.active;
    
    // Add to scene and track
    this.scene.add(mesh);
    this.objects.push(mesh);
  }
  
  /**
   * Draw a trajectory line for visual debugging
   * @param points Array of points defining the trajectory
   * @param color Color of the line
   */
  public drawTrajectory(points: THREE.Vector3[], color: number = 0xff0000): void {
    if (points.length < 2) return;
    
    const material = new THREE.LineBasicMaterial({ color });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    
    // Hide if debug is inactive
    line.visible = this.active;
    
    // Add to scene and track
    this.scene.add(line);
    this.lines.push(line);
  }
  
  /**
   * Create ray visualization for a specific distance
   * @param origin Starting point of the ray
   * @param direction Direction vector (will be normalized)
   * @param distance Length of the ray visualization
   * @param color Color of the ray
   */
  public visualizeRay(
    origin: THREE.Vector3, 
    direction: THREE.Vector3,
    distance: number,
    color: number = 0xff0000
  ): void {
    const points = [
      origin.clone(),
      origin.clone().add(direction.clone().normalize().multiplyScalar(distance))
    ];
    
    this.drawTrajectory(points, color);
  }
  
  /**
   * Check if debug visualization is active
   */
  public isActive(): boolean {
    return this.active;
  }
  
  /**
   * Update player capsule visualization without recreating it
   * @param collider The player's capsule collider
   */
  public updatePlayerVisualization(collider: RAPIER.Collider): void {
    if (!this.active) return;
    
    const position = collider.translation();
    const rotation = collider.rotation();
    
    // Find the first capsule group - assuming it's the player
    for (const obj of this.objects) {
      if (obj instanceof THREE.Group) {
        // Update position and rotation
        obj.position.set(position.x, position.y, position.z);
        obj.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        return; // Stop after updating the first group
      }
    }
    
    // If no capsule group exists yet, create one
    this.visualizeCollider(collider, 0x00ffff);
  }
} 