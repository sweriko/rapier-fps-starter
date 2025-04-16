export class InputHandler {
  private keys: Set<string> = new Set();
  private debugTogglePressed: boolean = false;
  
  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }
  
  public update(): void {
    // Check for debug toggle (V key)
    if (this.keys.has('KeyV') && !this.debugTogglePressed) {
      this.debugTogglePressed = true;
      document.dispatchEvent(new CustomEvent('toggle-debug'));
    } else if (!this.keys.has('KeyV') && this.debugTogglePressed) {
      this.debugTogglePressed = false;
    }
  }
} 