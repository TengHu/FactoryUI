import React from 'react';
import { CameraDevice } from './CameraManager';

export interface CameraInputProps {
  inputName: string;
  nodeId: string;
  isActive: boolean;
  isMenuOpen: boolean;
  devices: CameraDevice[];
  onToggleMenu: (inputName: string) => void;
  onSelectDevice: (inputName: string, deviceId: string) => void;
  onSetupCanvas: (inputName: string, canvas: HTMLCanvasElement | null) => void;
  onSetupVideo: (inputName: string, video: HTMLVideoElement | null) => void;
}

export const CameraInput: React.FC<CameraInputProps> = ({
  inputName,
  nodeId,
  isActive,
  isMenuOpen,
  devices,
  onToggleMenu,
  onSelectDevice,
  onSetupCanvas,
  onSetupVideo
}) => {
  return (
    <div className="camera-input-container">
      <span className="input-label">{inputName}:</span>
      
      <div className="camera-controls">
        <button
          className="camera-button"
          onClick={async (e) => {
            e.stopPropagation();
            await onToggleMenu(inputName);
          }}
        >
          {isActive ? '⏹️ Stop' : '📹 Camera'}
        </button>
        
        {isMenuOpen && !isActive && (
          <div className="camera-menu">
            <div className="camera-menu-header">Select Camera:</div>
            {devices.length === 0 ? (
              <div className="camera-menu-item loading">Loading devices...</div>
            ) : (
              devices.map((device, index) => (
                <button
                  key={device.deviceId}
                  className="camera-menu-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDevice(inputName, device.deviceId);
                  }}
                >
                  {device.label || `Camera ${index + 1}`}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Always present camera display container */}
      <div className="camera-display-container">
        {/* Hidden video element for stream processing */}
        <video
          ref={(el) => onSetupVideo(inputName, el)}
          autoPlay
          muted
          playsInline
          style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            width: '1px',
            height: '1px'
          }}
        />
        
        {/* Persistent camera view */}
        <div className="camera-view">
          <canvas
            ref={(el) => onSetupCanvas(inputName, el)}
            className={`camera-canvas ${isActive ? 'active' : 'placeholder'}`}
          />
        </div>
      </div>
    </div>
  );
};