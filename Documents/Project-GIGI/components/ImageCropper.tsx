import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

const CROP_DIMENSION = 256; // Output dimension for the cropped image (256x256)

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCropComplete, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => setImage(img);
  }, [imageSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set clipping path to a circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2, true);
    ctx.clip();
    
    // Calculate scaled dimensions
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;
    
    // Draw the image with zoom and offset
    ctx.drawImage(
      image,
      offset.x,
      offset.y,
      scaledWidth,
      scaledHeight
    );
    
    ctx.restore(); // remove clipping path

    // Draw circular border
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 1, 0, Math.PI * 2, true);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [image, zoom, offset]);

  useEffect(() => {
    if (image) {
      // Center the image initially
      const canvas = canvasRef.current;
      if(!canvas) return;
      const initialZoom = Math.max(canvas.width / image.width, canvas.height / image.height);
      setZoom(initialZoom);
      setOffset({
        x: (canvas.width - image.width * initialZoom) / 2,
        y: (canvas.height - image.height * initialZoom) / 2,
      });
    }
  }, [image]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleSetImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    // Create a new canvas for the final cropped image
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = CROP_DIMENSION;
    outputCanvas.height = CROP_DIMENSION;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    // Calculate source and destination rectangles for cropping
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;

    // Draw the panned and zoomed image onto the output canvas
    ctx.drawImage(
        image, 
        offset.x, 
        offset.y,
        scaledWidth,
        scaledHeight
    );

    // We need to re-create the final image from the preview canvas
    // to preserve the exact pan/zoom and circular crop.
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = CROP_DIMENSION;
    finalCanvas.height = CROP_DIMENSION;
    const finalCtx = finalCanvas.getContext('2d');
    if(!finalCtx) return;
    
    finalCtx.drawImage(canvas, 0, 0, CROP_DIMENSION, CROP_DIMENSION);


    onCropComplete(finalCanvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl text-white w-full max-w-sm">
        <h3 className="text-xl font-semibold text-center mb-4">Edit Profile Picture</h3>
        <div className="flex justify-center mb-4">
          <canvas
            ref={canvasRef}
            width={250}
            height={250}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-grab active:cursor-grabbing rounded-full bg-gray-900"
          />
        </div>
        
        <div className="mb-4">
            <label htmlFor="zoom-slider" className="block text-sm font-medium text-gray-300 mb-1">Zoom</label>
            <input
                id="zoom-slider"
                type="range"
                min={0.1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
        </div>

        <div className="flex justify-end space-x-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-200 bg-gray-600 rounded-md hover:bg-gray-500 transition">
            Cancel
          </button>
          <button onClick={handleSetImage} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 transition">
            Set Image
          </button>
        </div>
      </div>
    </div>
  );
};
