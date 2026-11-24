import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Camera,
  Download,
  Heart,
  ImagePlus,
  LoaderCircle,
  Minus,
  Pause,
  Plus,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { clearRecords, deleteRecord, getAllRecords, putRecord } from "./relationship-storage.js";
import {
  createCloudPhoto,
  deleteCloudPhoto,
  fetchCloudPhotos,
  removeCloudSubscription,
  subscribeToCoupleTable,
  updateCloudPhoto,
} from "./supabase-content.js";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const DEFAULT_EFFECTS = {
  floatingHearts: true,
  fallingPetals: false,
  glowingBorder: true,
  goldenSparkles: false,
  polaroidMotion: true,
  slideshow: false,
  fadeTransition: true,
  gentleZoom: true,
  floatingPhoto: false,
  backgroundParticles: false,
};
const EFFECT_OPTIONS = [
  { id: "floatingHearts", label: "Floating hearts" },
  { id: "fallingPetals", label: "Falling rose petals" },
  { id: "glowingBorder", label: "Glowing heart border" },
  { id: "goldenSparkles", label: "Golden sparkles" },
  { id: "polaroidMotion", label: "Polaroid sway" },
  { id: "slideshow", label: "Romantic slideshow" },
  { id: "fadeTransition", label: "Fade transitions" },
  { id: "gentleZoom", label: "Gentle zoom" },
  { id: "floatingPhoto", label: "Floating frame" },
  { id: "backgroundParticles", label: "Background particles" },
];
const HEART_POSITIONS = [10, 28, 48, 69, 87];
const PETAL_POSITIONS = [14, 33, 54, 74, 91];
const SPARKLE_POSITIONS = [18, 39, 62, 81];
const PARTICLE_POSITIONS = [12, 26, 43, 58, 76, 91];

const FRAME_OPTIONS = [
  { id: "polaroid", name: "Romantic Polaroid", background: "#fff8f3", border: "#f6dfd6", accent: "#8e3b58", kind: "polaroid" },
  { id: "vintage", name: "Luxury Vintage Frame", background: "#40251d", border: "#a66e46", accent: "#e5bd91", kind: "vintage" },
  { id: "golden", name: "Golden Sparkle Frame", background: "#35251b", border: "#c9a24c", accent: "#f2d98c", kind: "golden" },
  { id: "heart", name: "Animated Heart Frame", background: "#481b2b", border: "#d85c7d", accent: "#ffb4c8", kind: "heart" },
  { id: "rose", name: "Pink Floral Frame", background: "#3b1725", border: "#b94c68", accent: "#f39bad", kind: "rose" },
  { id: "double-heart", name: "Double Heart Frame", background: "#521b30", border: "#e88ca9", accent: "#ffd3df", kind: "double" },
  { id: "pink-glow", name: "Pink Glow", background: "#32111f", border: "#f06b9e", accent: "#ff9fc4", kind: "glow" },
  { id: "neon", name: "Neon Glow Frame", background: "#190e19", border: "#ff4ea3", accent: "#ff8bcb", kind: "neon" },
  { id: "white", name: "Elegant White", background: "#fffdfb", border: "#f4e9e5", accent: "#a75b72", kind: "white" },
  { id: "collage", name: "Couple Collage", background: "#f7e9e3", border: "#c4777c", accent: "#8b3e55", kind: "collage" },
  { id: "letter", name: "Forever Love Frame", background: "#f3e2d5", border: "#d6a8a0", accent: "#97465e", kind: "letter" },
  { id: "anniversary", name: "Anniversary Frame", background: "#342319", border: "#d2ad60", accent: "#f0d998", kind: "anniversary" },
  { id: "rose-petal", name: "Rose Petal Frame", background: "#451a2b", border: "#ce6683", accent: "#ffc0d0", kind: "petals" },
];

function toStoredPhoto(photo) {
  const { src, ...storedPhoto } = photo;
  return storedPhoto;
}

function makeId() {
  return window.crypto?.randomUUID?.() || `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getFrame(frameId) {
  return FRAME_OPTIONS.find((frame) => frame.id === frameId) || FRAME_OPTIONS[0];
}

function PhotoImage({ src, alt, className = "", style }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div role="img" aria-label={`${alt}: preview unavailable`} className={`flex items-center justify-center bg-[#210b12] text-rose-200/45 ${className}`} style={style}>
        <span className="flex flex-col items-center gap-2 text-xs">
          <Camera size={22} /> Preview unavailable
        </span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} style={style} onError={() => setFailed(true)} />;
}

function PhotoCard({ photo, selected, onSelect, onDelete }) {
  const frame = getFrame(photo.frame);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`group overflow-hidden rounded-xl border transition ${selected ? "border-rose-300/70 bg-[#35121e] shadow-lg shadow-rose-950/30" : "border-rose-200/10 bg-[#2a0e18] hover:border-rose-300/30"}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
        aria-label={`Edit ${photo.title || "untitled photo"}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[#19070d]">
          <PhotoImage src={photo.src} alt={photo.title || "Uploaded memory"} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-[#210b12]/75 px-2.5 py-1 text-[10px] uppercase tracking-wider text-rose-100/90 backdrop-blur">
            {frame.name}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-3">
          <span className="min-w-0">
            <span className="block truncate font-serif text-sm text-rose-50">{photo.title || "Untitled memory"}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-rose-100/45">
              <CalendarDays size={12} /> {photo.date || "No date"}
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-rose-200/15 px-3 py-1.5 text-xs text-rose-200 transition group-hover:border-rose-300/50 group-hover:bg-rose-300/10">
            Edit
          </span>
        </div>
      </button>
      <div className="flex justify-end border-t border-rose-200/10 px-3 py-2">
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-rose-100/45 transition hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
          aria-label={`Delete ${photo.title || "photo"}`}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </motion.article>
  );
}

function FramePreview({
  photo,
  frame,
  effects = DEFAULT_EFFECTS,
  speed = 1,
  isPlaying = true,
  isPreviewing = true,
  className = "",
}) {
  const isLight = ["polaroid", "white", "collage", "letter"].includes(frame.kind);
  const isAnimating = isPlaying && isPreviewing;
  const frameMotionEnabled = isAnimating && (effects.floatingPhoto || (effects.polaroidMotion && frame.kind === "polaroid"));
  const frameAnimation = {};
  if (frameMotionEnabled && effects.floatingPhoto) frameAnimation.y = [0, -5, 0];
  if (frameMotionEnabled && effects.polaroidMotion && frame.kind === "polaroid") frameAnimation.rotate = [-1.25, 1.25, -1.25];

  return (
    <motion.div
      aria-label={isPreviewing ? "Animated photo preview" : "Still photo preview"}
      animate={frameMotionEnabled ? frameAnimation : { y: 0, rotate: 0 }}
      transition={{ duration: (effects.polaroidMotion ? 5 : 6) / speed, ease: "easeInOut", repeat: frameMotionEnabled ? Infinity : 0 }}
      className={`relative mx-auto w-full max-w-[330px] p-3 pb-4 ${className}`}
      style={{
        background: frame.background,
        border: `${frame.kind === "vintage" ? 8 : frame.kind === "golden" || frame.kind === "anniversary" ? 5 : 3}px ${frame.kind === "vintage" ? "ridge" : "solid"} ${frame.border}`,
        borderRadius: frame.kind === "polaroid" ? 4 : frame.kind === "heart" ? 24 : 12,
        boxShadow: frame.kind === "glow" || frame.kind === "neon" ? `0 0 24px ${frame.accent}66, inset 0 0 12px ${frame.accent}22` : `0 12px 32px ${frame.border}26`,
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#210b12]" style={{ borderRadius: frame.kind === "heart" ? 14 : 4 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={photo.src}
            initial={{ opacity: isPreviewing && effects.fadeTransition ? 0 : 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: isPreviewing && effects.fadeTransition ? 0 : 1 }}
            transition={{ duration: (isPreviewing && effects.fadeTransition ? 0.6 : 0) / speed }}
            className="absolute inset-0"
          >
            <motion.div
              className="absolute inset-0"
              animate={isAnimating && effects.gentleZoom ? { scale: [1, 1.045, 1] } : { scale: 1 }}
              transition={{ duration: 8 / speed, ease: "easeInOut", repeat: isAnimating && effects.gentleZoom ? Infinity : 0 }}
            >
              <PhotoImage
                src={photo.src}
                alt={photo.title || "Photo preview"}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  objectPosition: `${50 + photo.positionX / 2}% ${50 + photo.positionY / 2}%`,
                  transform: `scale(${photo.zoom}) rotate(${photo.rotation}deg)`,
                }}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
        {frame.kind === "neon" && <div className="pointer-events-none absolute inset-2 rounded-sm border border-fuchsia-200/80 shadow-[0_0_14px_#ff4ea3]" />}
        {frame.kind === "heart" && <Heart className="pointer-events-none absolute right-3 top-3 h-8 w-8 fill-rose-400/70 text-rose-100 drop-shadow" />}
        {frame.kind === "rose" && <Heart className="pointer-events-none absolute left-3 top-3 h-6 w-6 fill-rose-300/80 text-white/80 drop-shadow" />}
        {frame.kind === "anniversary" && <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-amber-100/70 bg-amber-900/45 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-amber-50">Love</span>}
        {frame.kind === "petals" && <span className="pointer-events-none absolute left-3 top-3 h-3 w-2 rotate-[-35deg] rounded-full bg-rose-200 shadow-[0_0_12px_#ffb4c8]" />}
        {isAnimating && effects.glowingBorder && (
          <motion.div
            className="pointer-events-none absolute inset-1 rounded-lg border border-rose-100/50"
            animate={{ boxShadow: ["0 0 8px #f06b9e55", "0 0 22px #f06b9eaa", "0 0 8px #f06b9e55"] }}
            transition={{ duration: 3.8 / speed, ease: "easeInOut", repeat: Infinity }}
          />
        )}
        {isAnimating && effects.floatingHearts && HEART_POSITIONS.map((left, index) => (
          <motion.span
            key={`heart-${left}`}
            className="pointer-events-none absolute bottom-[-18px] text-rose-200/80 drop-shadow"
            style={{ left: `${left}%` }}
            animate={{ y: [0, -190], x: [0, index % 2 ? 10 : -9], opacity: [0, 0.85, 0] }}
            transition={{ duration: (5.5 + index * 0.35) / speed, delay: index * 0.55, ease: "linear", repeat: Infinity }}
          >
            <Heart size={12 + (index % 2) * 5} fill="currentColor" />
          </motion.span>
        ))}
        {isAnimating && effects.fallingPetals && PETAL_POSITIONS.map((left, index) => (
          <motion.span
            key={`petal-${left}`}
            className="pointer-events-none absolute top-[-18px] h-3.5 w-2.5 rounded-full bg-rose-300/85 shadow-[0_0_10px_#f39bad66]"
            style={{ left: `${left}%` }}
            animate={{ y: [0, 210], x: [0, index % 2 ? -14 : 13], rotate: [0, 180, 360], opacity: [0, 0.9, 0] }}
            transition={{ duration: (5 + index * 0.4) / speed, delay: index * 0.7, ease: "linear", repeat: Infinity }}
          />
        ))}
        {isAnimating && effects.goldenSparkles && SPARKLE_POSITIONS.map((left, index) => (
          <motion.span
            key={`sparkle-${left}`}
            className="pointer-events-none absolute text-amber-100 drop-shadow-[0_0_8px_#f0d998]"
            style={{ left: `${left}%`, top: `${18 + (index % 2) * 42}%` }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.2, 0.7], rotate: [0, 35, 0] }}
            transition={{ duration: (2.6 + index * 0.3) / speed, delay: index * 0.4, ease: "easeInOut", repeat: Infinity }}
          >
            <Sparkles size={14 + (index % 2) * 5} />
          </motion.span>
        ))}
        {isAnimating && effects.backgroundParticles && PARTICLE_POSITIONS.map((left, index) => (
          <motion.span
            key={`particle-${left}`}
            className="pointer-events-none absolute h-1 w-1 rounded-full bg-rose-100/80 shadow-[0_0_8px_#ffd3df]"
            style={{ left: `${left}%`, top: `${20 + (index % 3) * 23}%` }}
            animate={{ y: [0, -9, 0], opacity: [0.15, 0.75, 0.15], scale: [0.8, 1.3, 0.8] }}
            transition={{ duration: (3 + index * 0.25) / speed, delay: index * 0.3, ease: "easeInOut", repeat: Infinity }}
          />
        ))}
      </div>
      <div className={`px-2 pt-3 text-center ${isLight ? "text-[#542638]" : "text-rose-50"}`}>
        <p className="truncate font-serif text-lg">{photo.caption || photo.title || "Our memory"}</p>
        <p className={`mt-1 text-[10px] uppercase tracking-[0.2em] ${isLight ? "text-[#8f6673]" : "text-rose-100/55"}`}>
          {photo.date || "Add a date"}
        </p>
      </div>
      {(frame.kind === "double" || frame.kind === "collage" || frame.kind === "letter") && (
        <Heart className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 fill-current" style={{ color: frame.accent }} />
      )}
    </motion.div>
  );
}

function RangeControl({ label, value, min, max, step = 1, onChange, valueLabel }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-xs text-rose-100/70">
        <span>{label}</span>
        <span className="tabular-nums text-rose-200">{valueLabel}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-rose-400"
      />
    </label>
  );
}

function roundedRectPath(context, x, y, width, height, radius) {
  const boundedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + boundedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, boundedRadius);
  context.arcTo(x + width, y + height, x, y + height, boundedRadius);
  context.arcTo(x, y + height, x, y, boundedRadius);
  context.arcTo(x, y, x + width, y, boundedRadius);
  context.closePath();
}

function drawHeart(context, centerX, centerY, size, color) {
  context.save();
  context.translate(centerX, centerY);
  context.scale(size / 32, size / 32);
  context.beginPath();
  context.moveTo(0, 28);
  context.bezierCurveTo(-4, 23, -25, 9, -25, -5);
  context.bezierCurveTo(-25, -21, -6, -25, 0, -12);
  context.bezierCurveTo(6, -25, 25, -21, 25, -5);
  context.bezierCurveTo(25, 9, 4, 23, 0, 28);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawPetal(context, centerX, centerY, size, color, rotation = 0) {
  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation);
  context.beginPath();
  context.ellipse(0, 0, size * 0.42, size, 0, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawSparkle(context, centerX, centerY, size, color) {
  context.save();
  context.translate(centerX, centerY);
  context.beginPath();
  context.moveTo(0, -size);
  context.lineTo(size * 0.24, -size * 0.24);
  context.lineTo(size, 0);
  context.lineTo(size * 0.24, size * 0.24);
  context.lineTo(0, size);
  context.lineTo(-size * 0.24, size * 0.24);
  context.lineTo(-size, 0);
  context.lineTo(-size * 0.24, -size * 0.24);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();
}

function drawCaption(context, text, x, y, maxWidth, fontSize) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  context.font = `${fontSize}px Georgia, serif`;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  context.textAlign = "center";
  context.textBaseline = "middle";
  lines.slice(0, 2).forEach((captionLine, index) => {
    context.fillText(captionLine, x, y + index * (fontSize + 10), maxWidth);
  });
}

function exportFramedPhoto(photo, frame) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1600;
        canvas.height = 2000;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not create the photo canvas.");

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.fillStyle = frame.background;
        context.fillRect(0, 0, canvas.width, canvas.height);

        const photoX = 120;
        const photoY = 115;
        const photoWidth = 1360;
        const photoHeight = 1510;
        const borderWidth = frame.kind === "vintage" ? 28 : frame.kind === "golden" || frame.kind === "anniversary" ? 22 : 14;

        if (frame.kind === "collage") {
          context.fillStyle = `${frame.accent}55`;
          context.fillRect(172, 1680, 360, 170);
          context.fillRect(1070, 1680, 360, 170);
          drawHeart(context, 800, 1765, 58, frame.accent);
        }

        context.save();
        if (["glow", "neon"].includes(frame.kind)) {
          context.shadowColor = frame.accent;
          context.shadowBlur = frame.kind === "neon" ? 48 : 34;
        }
        context.strokeStyle = frame.border;
        context.lineWidth = borderWidth;
        context.strokeRect(48, 48, 1504, 1904);
        if (["golden", "anniversary", "vintage"].includes(frame.kind)) {
          context.lineWidth = 5;
          context.strokeStyle = frame.accent;
          context.strokeRect(68, 68, 1464, 1864);
        }
        if (frame.kind === "golden") {
          [[116, 116], [1484, 116], [116, 1884], [1484, 1884]].forEach(([x, y]) => drawSparkle(context, x, y, 25, frame.accent));
        }
        if (frame.kind === "double") {
          context.lineWidth = 9;
          context.strokeStyle = `${frame.accent}aa`;
          context.strokeRect(82, 82, 1436, 1836);
        }
        context.restore();

        const zoom = Math.max(1, photo.zoom || 1);
        const scale = Math.max(photoWidth / image.naturalWidth, photoHeight / image.naturalHeight) * zoom;
        const drawnWidth = image.naturalWidth * scale;
        const drawnHeight = image.naturalHeight * scale;
        const offsetX = ((drawnWidth - photoWidth) / 2) * ((photo.positionX || 0) / 100);
        const offsetY = ((drawnHeight - photoHeight) / 2) * ((photo.positionY || 0) / 100);

        context.save();
        roundedRectPath(context, photoX, photoY, photoWidth, photoHeight, frame.kind === "heart" ? 40 : 8);
        context.clip();
        context.translate(photoX + photoWidth / 2 + offsetX, photoY + photoHeight / 2 + offsetY);
        context.rotate(((photo.rotation || 0) * Math.PI) / 180);
        context.drawImage(image, -drawnWidth / 2, -drawnHeight / 2, drawnWidth, drawnHeight);
        context.restore();

        context.textAlign = "center";
        context.fillStyle = frame.accent;
        if (["heart", "double", "rose"].includes(frame.kind)) {
          drawHeart(context, 105, 1790, 52, frame.accent);
          drawHeart(context, 1495, 1790, 52, frame.accent);
        }
        if (frame.kind === "petals") {
          for (let index = 0; index < 8; index += 1) {
            drawPetal(context, 150 + index * 185, 1685 + (index % 2) * 28, 22, frame.accent, (index % 2 ? 1 : -1) * 0.4);
          }
        }
        if (frame.kind === "anniversary") {
          context.font = "24px Georgia, serif";
          context.fillText("A CELEBRATION OF US", 800, 1710);
        }

        context.fillStyle = ["polaroid", "white", "collage", "letter"].includes(frame.kind) ? "#542638" : "#fff1f4";
        drawCaption(context, photo.caption || photo.title || "Our memory", 800, 1760, 1140, 54);
        context.font = "26px Arial, sans-serif";
        context.fillStyle = frame.accent;
        context.fillText(photo.date || "", 800, 1885);
        context.font = "18px Arial, sans-serif";
        context.globalAlpha = 0.7;
        context.fillText("OUR LOVE STORY", 800, 1940);
        context.globalAlpha = 1;

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("The browser could not export this photo. Try another image."));
            return;
          }
          resolve(blob);
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("This photo could not be loaded for export. Try re-uploading it."));
    image.crossOrigin = "anonymous";
    image.src = photo.src;
  });
}

function PhotoEditor({ photo, photos, onUpdate, onDownload, downloading }) {
  const frame = getFrame(photo.frame);
  const [draftEffects, setDraftEffects] = useState(() => ({ ...DEFAULT_EFFECTS, ...photo.animationEffects }));
  const [animationSpeed, setAnimationSpeed] = useState(photo.animationSpeed || 1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [slideIndex, setSlideIndex] = useState(() => Math.max(0, photos.findIndex((item) => item.id === photo.id)));
  const update = (patch) => onUpdate(photo.id, patch);

  useEffect(() => {
    setDraftEffects({ ...DEFAULT_EFFECTS, ...photo.animationEffects });
    setAnimationSpeed(photo.animationSpeed || 1);
    setIsPlaying(true);
    setIsPreviewing(true);
    setSlideIndex(Math.max(0, photos.findIndex((item) => item.id === photo.id)));
  }, [photo.id]);

  useEffect(() => {
    if (!isPlaying || !isPreviewing || !draftEffects.slideshow || photos.length < 2) return undefined;
    const intervalId = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % photos.length);
    }, 4200 / animationSpeed);
    return () => window.clearInterval(intervalId);
  }, [animationSpeed, draftEffects.slideshow, isPlaying, isPreviewing, photos.length]);

  const slidePhoto = photos[slideIndex] || photo;
  const previewPhoto = slidePhoto.id === photo.id
    ? photo
    : { ...slidePhoto, frame: photo.frame, caption: slidePhoto.caption || slidePhoto.title };
  const toggleEffect = (effectId, enabled) => {
    setDraftEffects((current) => ({ ...current, [effectId]: enabled }));
    setIsPreviewing(true);
  };
  const applyEffects = () => update({ animationEffects: draftEffects, animationSpeed });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-rose-200/10 bg-[#260c16] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-rose-300/70">Live preview</p>
            <h3 className="mt-1 font-serif text-xl text-rose-50">{frame.name}</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/15 px-2.5 py-1 text-[10px] uppercase tracking-wider text-rose-100/55">
            <Sparkles size={12} /> Animation preview
          </span>
        </div>
        <FramePreview
          photo={previewPhoto}
          frame={frame}
          effects={draftEffects}
          speed={animationSpeed}
          isPlaying={isPlaying}
          isPreviewing={isPreviewing}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((playing) => !playing)}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/15 px-3 py-2 text-xs text-rose-100/80 transition hover:bg-rose-300/10"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => setIsPreviewing((previewing) => !previewing)}
            aria-pressed={isPreviewing}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/15 px-3 py-2 text-xs text-rose-100/80 transition hover:bg-rose-300/10"
          >
            <Sparkles size={14} /> {isPreviewing ? "Hide effects" : "Preview effects"}
          </button>
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-70"
        >
          {downloading ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />}
          {downloading ? "Preparing PNG..." : "Download HD PNG"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-5 text-rose-100/40">Animation is preview-only. PNG export captures a high-resolution still.</p>
      </div>

      <div className="rounded-xl border border-rose-200/10 bg-[#260c16] p-4 sm:p-5">
        <h3 className="font-serif text-lg text-rose-50">Memory details</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-rose-100/60">Photo title</span>
            <input value={photo.title} onChange={(event) => update({ title: event.target.value })} maxLength={80} className="w-full rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm text-rose-50 outline-none transition placeholder:text-rose-100/30 focus:border-rose-300/60" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-rose-100/60">Caption</span>
            <input value={photo.caption} onChange={(event) => update({ caption: event.target.value })} maxLength={80} placeholder="A little note..." className="w-full rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm text-rose-50 outline-none transition placeholder:text-rose-100/30 focus:border-rose-300/60" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-rose-100/60">Date</span>
            <input type="date" value={photo.date} onChange={(event) => update({ date: event.target.value })} className="w-full rounded-md border border-rose-200/15 bg-[#1e0911] px-3 py-2.5 text-sm text-rose-50 outline-none transition focus:border-rose-300/60 [color-scheme:dark]" />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-rose-200/10 bg-[#260c16] p-4 sm:p-5">
        <h3 className="font-serif text-lg text-rose-50">Choose a frame</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {FRAME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => update({ frame: option.id })}
              aria-pressed={photo.frame === option.id}
              className={`min-w-0 rounded-md border p-2 text-left transition hover:-translate-y-0.5 ${photo.frame === option.id ? "border-rose-300 bg-rose-300/10" : "border-rose-200/10 bg-[#1e0911] hover:border-rose-200/30"}`}
            >
              <span className="mb-2 block h-8 rounded-sm" style={{ background: option.background, border: `3px solid ${option.border}`, boxShadow: ["glow", "neon"].includes(option.kind) ? `0 0 9px ${option.accent}88` : "none" }} />
              <span className="block text-[10px] leading-tight text-rose-100/80">{option.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-rose-200/10 bg-[#260c16] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg text-rose-50">Animation effects</h3>
            <p className="mt-1 text-xs leading-5 text-rose-100/45">Preview combinations, then apply them to this photo.</p>
          </div>
          <Sparkles className="mt-1 shrink-0 text-rose-300/70" size={18} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EFFECT_OPTIONS.map((effect) => (
            <label key={effect.id} className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md border border-rose-200/10 bg-[#1e0911] px-3 py-2.5 transition hover:border-rose-200/25">
              <input
                type="checkbox"
                checked={Boolean(draftEffects[effect.id])}
                onChange={(event) => toggleEffect(effect.id, event.target.checked)}
                className="h-4 w-4 shrink-0 accent-rose-400"
              />
              <span className="text-xs leading-4 text-rose-100/75">{effect.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-5">
          <RangeControl
            label="Animation speed"
            value={animationSpeed}
            min={0.5}
            max={2}
            step={0.1}
            valueLabel={`${animationSpeed.toFixed(1)}×`}
            onChange={setAnimationSpeed}
          />
        </div>
        <button
          type="button"
          onClick={applyEffects}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-rose-300/30 bg-rose-300/10 px-4 py-2.5 text-sm text-rose-100 transition hover:bg-rose-300/15"
        >
          <Sparkles size={15} /> Apply animation settings
        </button>
      </div>

      <div className="rounded-xl border border-rose-200/10 bg-[#260c16] p-4 sm:p-5">
        <h3 className="font-serif text-lg text-rose-50">Crop & position</h3>
        <div className="mt-4 space-y-4">
          <RangeControl label="Zoom" value={photo.zoom} min={1} max={3} step={0.05} valueLabel={`${photo.zoom.toFixed(2)}×`} onChange={(zoom) => update({ zoom })} />
          <RangeControl label="Horizontal position" value={photo.positionX} min={-100} max={100} valueLabel={`${photo.positionX}%`} onChange={(positionX) => update({ positionX })} />
          <RangeControl label="Vertical position" value={photo.positionY} min={-100} max={100} valueLabel={`${photo.positionY}%`} onChange={(positionY) => update({ positionY })} />
          <RangeControl label="Rotation" value={photo.rotation} min={-180} max={180} valueLabel={`${photo.rotation}°`} onChange={(rotation) => update({ rotation })} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => update({ zoom: Math.min(3, Number((photo.zoom + 0.1).toFixed(2))) })} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/15 px-3 py-2 text-xs text-rose-100/80 hover:bg-rose-300/10"><Plus size={14} /> Zoom in</button>
          <button type="button" onClick={() => update({ zoom: Math.max(1, Number((photo.zoom - 0.1).toFixed(2))) })} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/15 px-3 py-2 text-xs text-rose-100/80 hover:bg-rose-300/10"><Minus size={14} /> Zoom out</button>
          <button type="button" onClick={() => update({ rotation: (photo.rotation + 90) % 360 })} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/15 px-3 py-2 text-xs text-rose-100/80 hover:bg-rose-300/10"><RotateCw size={14} /> Rotate</button>
          <button type="button" onClick={() => update({ zoom: 1, positionX: 0, positionY: 0, rotation: 0 })} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/15 px-3 py-2 text-xs text-rose-100/80 hover:bg-rose-300/10"><RotateCcw size={14} /> Reset crop</button>
        </div>
      </div>
    </div>
  );
}

export default function PhotoGallery({ supabase, coupleId, user }) {
  const [photos, setPhotos] = useState([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const uploadRef = useRef(null);
  const objectUrlsRef = useRef(new Set());
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) || photos[0] || null;

  const createObjectUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  };

  const revokeObjectUrl = (url) => {
    if (url && objectUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let cancelled = false;
    if (supabase && coupleId) {
      setLoading(true);
      const loadCloud = async () => {
        try {
          const cloudPhotos = await fetchCloudPhotos(supabase, coupleId);
          if (!cancelled) {
            setPhotos(cloudPhotos);
            setSelectedPhotoId((current) => cloudPhotos.some((photo) => photo.id === current) ? current : cloudPhotos[0]?.id || null);
          }
        } catch (loadError) {
          if (!cancelled) setError(loadError.message || "Could not load shared photos.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      loadCloud();
      const channel = subscribeToCoupleTable(supabase, "photos", coupleId, loadCloud);
      return () => {
        cancelled = true;
        removeCloudSubscription(supabase, channel);
      };
    }

    const load = async () => {
      try {
        const storedPhotos = await getAllRecords("photos");
        const loadedPhotos = storedPhotos
          .sort((first, second) => second.createdAt - first.createdAt)
          .map((photo) => ({ ...photo, src: createObjectUrl(photo.blob) }));
        if (cancelled) {
          loadedPhotos.forEach((photo) => revokeObjectUrl(photo.src));
          return;
        }
        setPhotos(loadedPhotos);
        setSelectedPhotoId(loadedPhotos[0]?.id || null);
      } catch (storageError) {
        if (!cancelled) setError(storageError.message || "Could not load photos from this browser.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, [supabase, coupleId]);

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const validFiles = files.filter((file) => ACCEPTED_EXTENSIONS.test(file.name) && (!file.type || ACCEPTED_TYPES.has(file.type)));
    if (validFiles.length !== files.length) {
      setError("Choose JPG, JPEG, PNG, or WEBP images. Unsupported files were skipped.");
    } else {
      setError("");
    }
    if (!validFiles.length) return;

    try {
      const addedPhotos = [];
      for (const file of validFiles) {
        const photo = {
          id: makeId(),
          title: file.name.replace(/\.[^/.]+$/, ""),
          caption: "",
          date: todayLocal(),
          frame: "polaroid",
          zoom: 1,
          positionX: 0,
          positionY: 0,
          rotation: 0,
          createdAt: Date.now(),
          blob: file,
        };
        if (supabase) {
          const cloudPhoto = await createCloudPhoto(supabase, { coupleId, userId: user.id, file, photo });
          addedPhotos.push(cloudPhoto);
        } else {
          await putRecord("photos", photo);
          addedPhotos.push({ ...photo, src: createObjectUrl(file) });
        }
      }
      setPhotos((current) => [...addedPhotos.filter((photo, index) => addedPhotos.findIndex((other) => other.id === photo.id) === index), ...current.filter((photo) => !addedPhotos.some((added) => added.id === photo.id))]);
      setSelectedPhotoId(addedPhotos[0].id);
    } catch (storageError) {
      setError(storageError.message || "Photos could not be saved in this browser. Check available storage and try again.");
    }
  };

  const updatePhoto = async (id, patch) => {
    const currentPhoto = photos.find((photo) => photo.id === id);
    if (!currentPhoto) return;
    const updatedPhoto = { ...currentPhoto, ...patch };
    setPhotos((current) => current.map((photo) => photo.id === id ? updatedPhoto : photo));
    setError("");
    try {
      const savedPhoto = supabase
        ? await updateCloudPhoto(supabase, coupleId, updatedPhoto)
        : await putRecord("photos", toStoredPhoto(updatedPhoto)).then(() => updatedPhoto);
      setPhotos((current) => current.map((photo) => photo.id === id ? savedPhoto : photo));
    } catch (storageError) {
      setPhotos((current) => current.map((photo) => photo.id === id ? currentPhoto : photo));
      setError(storageError.message || "This change could not be saved to browser storage.");
    }
  };

  const deletePhoto = async (photo) => {
    try {
      if (supabase) await deleteCloudPhoto(supabase, coupleId, photo);
      else {
        await deleteRecord("photos", photo.id);
        revokeObjectUrl(photo.src);
      }
      const remainingPhotos = photos.filter((item) => item.id !== photo.id);
      setPhotos(remainingPhotos);
      if (selectedPhotoId === photo.id) setSelectedPhotoId(remainingPhotos[0]?.id || null);
      setError("");
    } catch (storageError) {
      setError(storageError.message || "This photo could not be deleted.");
    }
  };

  const clearGallery = async () => {
    if (!window.confirm("Delete all saved photos from this browser? This cannot be undone.")) return;
    try {
      if (supabase) {
        const { error: deleteError } = await supabase.from("photos").delete().eq("couple_id", coupleId);
        if (deleteError) throw deleteError;
        const paths = photos.map((photo) => photo.storagePath).filter(Boolean);
        if (paths.length) {
          const { error: storageError } = await supabase.storage.from("couple-memories").remove(paths);
          if (storageError) throw storageError;
        }
      } else {
        await clearRecords("photos");
        photos.forEach((photo) => revokeObjectUrl(photo.src));
      }
      setPhotos([]);
      setSelectedPhotoId(null);
      setError("");
    } catch (storageError) {
      setError(storageError.message || "The gallery could not be cleared.");
    }
  };

  const downloadPhoto = async () => {
    if (!selectedPhoto) return;
    setDownloading(true);
    setError("");
    try {
      const blob = await exportFramedPhoto(selectedPhoto, getFrame(selectedPhoto.frame));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(selectedPhoto.title || "our-memory").replace(/[\\/:*?"<>|]+/g, "-")}-framed.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.message || "The photo could not be exported. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section id="gallery" className="mx-auto max-w-7xl px-6 py-28">
      <div className="text-center mb-12">
        <p className="mb-3 text-xs uppercase tracking-[0.35em] text-rose-400">Captured forever</p>
        <h2 className="font-serif text-4xl text-rose-50 md:text-5xl">Our Beautiful Memories</h2>
        <p className="mt-4 text-rose-100/50">Little moments, big feelings, endless memories.</p>
        <div className="mx-auto mt-6 h-px w-20 bg-rose-400/60" />
      </div>

      <div className="mb-7 flex flex-col gap-4 border-y border-rose-200/10 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-300/20 bg-rose-300/5 text-rose-300"><Camera size={18} /></span>
          <div>
            <p className="font-serif text-lg text-rose-50">Your private gallery</p>
            <p className="text-xs text-rose-100/45">{photos.length} {photos.length === 1 ? "photo" : "photos"} saved on this device</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {photos.length > 0 && (
            <button type="button" onClick={clearGallery} className="inline-flex items-center gap-2 rounded-md border border-rose-200/15 px-4 py-2.5 text-sm text-rose-100/70 transition hover:border-rose-300/40 hover:bg-rose-300/5 hover:text-rose-100">
              <Trash2 size={15} /> Clear gallery
            </button>
          )}
          <button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-400">
            <Upload size={16} /> Add photos
          </button>
          <input ref={uploadRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple onChange={handleUpload} className="hidden" />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-rose-300/25 bg-rose-950/50 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-xl text-rose-50">Photo collection</h3>
            {photos.length > 0 && <span className="text-xs text-rose-100/40">Select a memory to edit</span>}
          </div>
          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-xl border border-rose-200/10 bg-[#260c16] text-rose-200/60">
              <LoaderCircle className="mr-2 animate-spin" size={18} /> Loading saved memories...
            </div>
          ) : photos.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-rose-200/20 bg-[#260c16]/70 px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-300/20 bg-rose-300/5 text-rose-300"><ImagePlus size={24} /></span>
              <h4 className="mt-5 font-serif text-xl text-rose-50">Your story starts with a photo</h4>
              <p className="mt-2 max-w-sm text-sm leading-6 text-rose-100/50">Add a favorite memory to frame, personalize, and keep saved privately on this device.</p>
              <button type="button" onClick={() => uploadRef.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-md border border-rose-300/30 px-4 py-2.5 text-sm text-rose-100 transition hover:bg-rose-300/10"><Upload size={15} /> Choose photos</button>
            </motion.div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              <AnimatePresence initial={false}>
                {photos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    selected={selectedPhoto?.id === photo.id}
                    onSelect={() => setSelectedPhotoId(photo.id)}
                    onDelete={() => deletePhoto(photo)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-xs text-rose-100/35"><Heart size={12} className="fill-rose-300/50 text-rose-300/50" /> Photos stay in this browser and are never uploaded.</p>
        </div>

        <div>
          <h3 className="mb-4 font-serif text-xl text-rose-50">Photo frame editor</h3>
          {selectedPhoto ? (
            <PhotoEditor photo={selectedPhoto} photos={photos} onUpdate={updatePhoto} onDownload={downloadPhoto} downloading={downloading} />
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-rose-200/10 bg-[#260c16]/70 px-6 text-center">
              <Heart className="text-rose-300/55" size={28} />
              <p className="mt-4 font-serif text-lg text-rose-50">Your frame awaits</p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-rose-100/45">Add or select a photo to customize its frame, crop, and caption.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}