import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X, Camera, RefreshCw, AlertTriangle, QrCode } from "lucide-react";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedText: string) => void;
  language: "kh" | "en";
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  language,
}: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setScanning(true);
      requestCameraPermissionsAndList();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Handle switching cameras
  useEffect(() => {
    if (isOpen && selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId, isOpen]);

  const requestCameraPermissionsAndList = async () => {
    try {
      // Prompt user for camera permission to get permission-cleared device list
      const initialStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      
      // Stop initial stream promptly
      initialStream.getTracks().forEach((track) => track.stop());

      // Query devices
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      if (videoDevices.length > 0) {
        // Try to select the back/environment camera by default if present
        const backCamera = videoDevices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("environment") ||
            d.label.toLowerCase().includes("rear")
        );
        const defaultDevice = backCamera || videoDevices[0];
        setSelectedDeviceId(defaultDevice.deviceId);
      } else {
        setErrorMsg(
          language === "kh"
            ? "រកមិនឃើញកាមេរ៉ាភ្ជាប់ជាមួយឧបករណ៍នេះទេ!"
            : "No cameras found connected to this device!"
        );
      }
    } catch (err: any) {
      console.error("Camera permission error:", err);
      setErrorMsg(
        language === "kh"
          ? "មិនអាចបើកកាមេរ៉ាបានទេ! សូមពិនិត្យការអនុញ្ញាត (Permission) របស់កម្មវិធីរុករក។"
          : "Could not access camera! Please check your browser permission settings."
      );
    }
  };

  const startCamera = async (deviceId: string) => {
    stopCamera();
    try {
      setErrorMsg(null);
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // required for iOS Safari
        videoRef.current.play();
        
        // Start processing frames
        requestRef.current = requestAnimationFrame(tick);
      }
    } catch (err: any) {
      console.error("Error starting camera device:", err);
      // Fallback to general constraints if device-specific constraints fail
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play();
          requestRef.current = requestAnimationFrame(tick);
        }
      } catch (fallbackErr) {
        setErrorMsg(
          language === "kh"
            ? "បរាជ័យក្នុងការបើកកាមេរ៉ាដែលបានជ្រើសរើស។"
            : "Failed to open the selected camera stream."
        );
      }
    }
  };

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const tick = () => {
    if (!videoRef.current || !canvasRef.current || !scanning) {
      requestRef.current = requestAnimationFrame(tick);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = 480;
      canvas.height = (video.videoHeight / video.videoWidth) * 480;

      // Draw the video frame onto the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Extract image data
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Look for a QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        // Trigger haptic if API available
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
        
        // Success! Backoff scanning and send scan details
        stopCamera();
        onScan(code.data);
        return;
      }
    }

    requestRef.current = requestAnimationFrame(tick);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 font-sans backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <QrCode className="text-amber-500" size={18} />
            <span className="text-sm font-bold text-slate-100 font-serif">
              {language === "kh" ? "ម៉ាស៊ីនស្កេន QR / ស្កេនបារកូដ" : "QR & Barcode Scanner"}
            </span>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera Stage */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
          
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />

          {/* Canvas for processing in background */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Custom Scanner Overlay lines */}
          {scanning && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Central scan bracket area */}
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-amber-500/40 rounded-xl flex items-center justify-center">
                {/* Visual corners */}
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-500 rounded-tl-lg" />
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-500 rounded-tr-lg" />
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-500 rounded-bl-lg" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-500 rounded-br-lg" />
                
                {/* Red animated horizontal laser line */}
                <span className="absolute left-1 right-1 h-[2px] bg-red-500 shadow-[0_0_12px_#ef4444] animate-[bounce_2s_infinite]" />
              </div>
              <p className="absolute bottom-4 text-[11px] bg-slate-950/85 px-3 py-1.5 rounded-lg text-amber-500 font-semibold uppercase tracking-wider backdrop-blur-sm">
                {language === "kh" ? "កំពុងស្វែងរក QR កូដ..." : "Align QR within frame..."}
              </p>
            </div>
          )}

          {/* Loader or Error banner */}
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertTriangle className="text-red-500" size={36} />
              <p className="text-xs text-slate-350 leading-relaxed font-medium">
                {errorMsg}
              </p>
              <button
                type="button"
                onClick={requestCameraPermissionsAndList}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-[10px] flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={11} />
                {language === "kh" ? "សាកល្បងឡើងវិញ" : "Retry Access"}
              </button>
            </div>
          )}
        </div>

        {/* Bottom selector controls */}
        {devices.length > 1 && !errorMsg && (
          <div className="bg-slate-950 px-5 py-3 border-t border-slate-900 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1 shrink-0">
              <Camera size={13} />
              {language === "kh" ? "ជ្រើសរើសកាមេរ៉ា៖" : "Select Camera:"}
            </span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1 rounded focus:border-amber-500 focus:outline-none max-w-[200px]"
            >
              {devices.map((device, i) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-slate-900 px-5 py-3 border-t border-slate-900 text-[10px] text-center text-slate-500">
          {language === "kh"
            ? "ម៉ាស៊ីនស្កេននេះដំណើរការក្នុងស្រុកទាំងស្រុង ការពារឯកជនភាព និងសុវត្ថិភាព។"
            : "Scanning is done 100% client-side for full privacy and performance."}
        </div>

      </div>
    </div>
  );
}
