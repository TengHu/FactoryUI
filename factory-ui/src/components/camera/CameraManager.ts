/**
 * CameraManager - Handles camera device enumeration, stream management, and frame processing
 */

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface CameraStream {
  stream: MediaStream;
  displayIntervalId: NodeJS.Timeout;
  backendIntervalId: NodeJS.Timeout;
}

export interface FrameProcessorOptions {
  width?: number;
  height?: number;
  quality?: number;
  displayFps?: number;
  backendFps?: number;
}

export class CameraManager {
  private streams: Map<string, CameraStream> = new Map();
  private videoRefs: Map<string, HTMLVideoElement> = new Map();
  private canvasRefs: Map<string, HTMLCanvasElement> = new Map();
  private frameBuffers: Map<string, string> = new Map();
  private rateLimitTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Enumerate available camera devices
   */
  async enumerateDevices(): Promise<CameraDevice[]> {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(-4)}`,
          kind: device.kind
        }));
      
      return videoDevices;
    } catch (error) {
      console.error('Error enumerating camera devices:', error);
      throw new Error('Could not access camera devices. Please check permissions.');
    }
  }

  /**
   * Start camera stream with specified device
   */
  async startCamera(
    inputName: string,
    deviceId?: string,
    options: FrameProcessorOptions = {}
  ): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      };

      if (deviceId) {
        (constraints.video as MediaTrackConstraints).deviceId = { exact: deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Store stream reference (intervals will be set later in setupFrameProcessing)
      this.streams.set(inputName, {
        stream,
        displayIntervalId: setTimeout(() => {}, 0) as NodeJS.Timeout, // Placeholder
        backendIntervalId: setTimeout(() => {}, 0) as NodeJS.Timeout   // Placeholder
      });
      
      // Clear the placeholder timeouts immediately
      const placeholderStream = this.streams.get(inputName)!;
      clearTimeout(placeholderStream.displayIntervalId);
      clearTimeout(placeholderStream.backendIntervalId);

      return stream;
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw new Error('Could not access camera. Please check permissions.');
    }
  }

  /**
   * Stop camera stream and cleanup
   */
  stopCamera(inputName: string): void {
    const cameraStream = this.streams.get(inputName);
    if (cameraStream) {
      // Clear intervals
      if (cameraStream.displayIntervalId) {
        clearInterval(cameraStream.displayIntervalId);
      }
      if (cameraStream.backendIntervalId) {
        clearInterval(cameraStream.backendIntervalId);
      }

      // Stop stream tracks
      cameraStream.stream.getTracks().forEach(track => track.stop());

      // Clear video element
      const video = this.videoRefs.get(inputName);
      if (video) {
        video.srcObject = null;
      }

      // Clear canvas
      const canvas = this.canvasRefs.get(inputName);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      // Clear buffers and timeouts
      this.frameBuffers.delete(inputName);
      const timeout = this.rateLimitTimeouts.get(inputName);
      if (timeout) {
        clearTimeout(timeout);
        this.rateLimitTimeouts.delete(inputName);
      }

      // Remove references
      this.streams.delete(inputName);
      this.videoRefs.delete(inputName);
      this.canvasRefs.delete(inputName);
    }
  }

  /**
   * Setup frame processing for camera stream
   */
  setupFrameProcessing(
    inputName: string,
    onFrameCapture: (inputName: string, frameData: string) => void,
    options: FrameProcessorOptions = {}
  ): void {
    const {
      width = 320,
      height = 240,
      quality = 0.7,
      displayFps = 30,
      backendFps = 30
    } = options;

    // Create processing canvas
    const processingCanvas = document.createElement('canvas');
    const processingCtx = processingCanvas.getContext('2d');
    processingCanvas.width = width;
    processingCanvas.height = height;

    // Display update function
    const updateDisplay = () => {
      const video = this.videoRefs.get(inputName);
      const displayCanvas = this.canvasRefs.get(inputName);

      if (video && video.readyState === 4 && displayCanvas) {
        requestAnimationFrame(() => {
          try {
            const displayCtx = displayCanvas.getContext('2d');
            if (displayCtx) {
              displayCtx.drawImage(video, 0, 0, displayCanvas.width, displayCanvas.height);
            }
          } catch (error) {
            console.warn('Display update error:', error);
          }
        });
      }
    };

    // Backend frame processing function
    const processFrameForBackend = () => {
      const video = this.videoRefs.get(inputName);

      if (video && video.readyState === 4 && processingCtx) {
        try {
          processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);
          const frameData = processingCanvas.toDataURL('image/jpeg', quality);
          
          this.sendFrameToBackend(inputName, frameData, onFrameCapture);
        } catch (error) {
          console.warn('Backend frame processing error:', error);
        }
      }
    };

    // Set up intervals
    const displayInterval = setInterval(updateDisplay, 1000 / displayFps) as NodeJS.Timeout;
    const backendInterval = setInterval(processFrameForBackend, 1000 / backendFps) as NodeJS.Timeout;

    // Update stream reference with intervals
    const cameraStream = this.streams.get(inputName);
    if (cameraStream) {
      cameraStream.displayIntervalId = displayInterval;
      cameraStream.backendIntervalId = backendInterval;
    }
  }

  /**
   * Rate-limited frame sender
   */
  private sendFrameToBackend(
    inputName: string,
    frameData: string,
    onFrameCapture: (inputName: string, frameData: string) => void
  ): void {
    // Store frame for consistency
    this.frameBuffers.set(inputName, frameData);

    // Rate limiting: only send if no timeout is pending
    if (!this.rateLimitTimeouts.has(inputName)) {

      // Send immediately via setTimeout to break synchronous execution
      setTimeout(() => {
        onFrameCapture(inputName, frameData);
      }, 0);

      // Set timeout to prevent next send for 1 second
      const timeout = setTimeout(() => {
        this.rateLimitTimeouts.delete(inputName);
      }, 1000) as NodeJS.Timeout;

      this.rateLimitTimeouts.set(inputName, timeout);
    }
  }

  /**
   * Register video element reference
   */
  setVideoRef(inputName: string, video: HTMLVideoElement | null): void {
    if (video) {
      this.videoRefs.set(inputName, video);
      
      // Assign stream if available
      const cameraStream = this.streams.get(inputName);
      if (cameraStream) {
        video.srcObject = cameraStream.stream;
        video.onloadedmetadata = () => {
          video.play().catch(console.error);
        };
      }
    } else {
      this.videoRefs.delete(inputName);
    }
  }

  /**
   * Register canvas element reference
   */
  setCanvasRef(inputName: string, canvas: HTMLCanvasElement | null): void {
    if (canvas) {
      this.canvasRefs.set(inputName, canvas);
    } else {
      this.canvasRefs.delete(inputName);
    }
  }

  /**
   * Initialize canvas with placeholder or clear state
   */
  initializeCanvas(canvas: HTMLCanvasElement, showPlaceholder = true): void {
    canvas.width = 200;
    canvas.height = 150;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (showPlaceholder) {
        // Draw placeholder
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No Camera', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('Selected', canvas.width / 2, canvas.height / 2 + 10);
      } else {
        // Clear for camera feed
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  /**
   * Check if camera is active for input
   */
  isCameraActive(inputName: string): boolean {
    return this.streams.has(inputName);
  }

  /**
   * Get current frame data for input
   */
  getCurrentFrame(inputName: string): string | undefined {
    return this.frameBuffers.get(inputName);
  }

  /**
   * Get all active stream keys
   */
  getActiveStreamKeys(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Get all camera frames for a specific node
   */
  getCameraFramesForNode(nodeId: string): Record<string, string> {
    const frames: Record<string, string> = {};
    const streamKeys = Array.from(this.streams.keys());
    
    for (const streamKey of streamKeys) {
      if (streamKey.startsWith(`${nodeId}:`)) {
        const inputName = streamKey.split(':').slice(1).join(':');
        const currentFrame = this.getCurrentFrame(streamKey);
        
        if (currentFrame) {
          frames[inputName] = currentFrame;
        }
      }
    }
    
    return frames;
  }

  /**
   * Check if a node has any active camera streams
   */
  nodeHasActiveStreams(nodeId: string): boolean {
    const streamKeys = Array.from(this.streams.keys());
    for (const streamKey of streamKeys) {
      if (streamKey.startsWith(`${nodeId}:`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Cleanup all cameras
   */
  cleanup(): void {
    const inputNames = Array.from(this.streams.keys());
    for (const inputName of inputNames) {
      this.stopCamera(inputName);
    }
  }
}

// Singleton instance
export const cameraManager = new CameraManager();