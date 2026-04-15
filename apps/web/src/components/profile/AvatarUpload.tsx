'use client';

import { useRef, useState, DragEvent } from 'react';
import { Camera, Loader2, User } from 'lucide-react';

interface AvatarUploadProps {
  currentUrl?: string | null;
  name?: string;
  size?: number;
  uploading?: boolean;
  onChange: (file: File) => void;
}

export default function AvatarUpload({
  currentUrl,
  name,
  size = 96,
  uploading = false,
  onChange,
}: AvatarUploadProps) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hover, setHover]   = useState(false);

  const displayUrl = preview ?? currentUrl;
  const initials   = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '';

  const handleFile = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      style={{ position: 'relative', width: size, height: size, cursor: 'pointer', flexShrink: 0 }}
      onClick={() => !uploading && inputRef.current?.click()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
    >
      {/* Avatar circle */}
      <div
        className={displayUrl ? 'avatar-ring-pulse' : ''}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          border: isDragOver
            ? '2px solid var(--gold)'
            : '2px solid rgba(232,184,75,0.3)',
          boxShadow: isDragOver ? '0 0 0 4px rgba(232,184,75,0.15)' : undefined,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          position: 'relative',
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={name ?? 'avatar'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'rgba(232,184,75,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {initials ? (
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: size * 0.28,
                fontWeight: 500,
                color: 'var(--gold)',
                letterSpacing: '-0.02em',
              }}>
                {initials}
              </span>
            ) : (
              <User size={size * 0.35} style={{ color: 'rgba(232,184,75,0.35)' }} />
            )}
          </div>
        )}

        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(13,13,13,0.72)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 4,
          opacity: (hover || isDragOver) && !uploading ? 1 : 0,
          transition: 'opacity 0.2s',
          borderRadius: '50%',
        }}>
          <Camera size={size * 0.22} style={{ color: 'var(--gold)' }} />
          <span style={{
            fontSize: size * 0.115,
            color: 'var(--ivory)',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {isDragOver ? 'Drop' : 'Change'}
          </span>
        </div>

        {/* Loading overlay */}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(13,13,13,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%',
          }}>
            <Loader2 size={size * 0.25} className="animate-spin" style={{ color: 'var(--gold)' }} />
          </div>
        )}
      </div>

      {/* Camera badge */}
      {!uploading && (
        <div style={{
          position: 'absolute',
          bottom: 2, right: 2,
          width: Math.max(size * 0.25, 22),
          height: Math.max(size * 0.25, 22),
          borderRadius: '50%',
          background: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          opacity: hover ? 0 : 1,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
        }}>
          <Camera size={Math.max(size * 0.12, 10)} style={{ color: '#0d0d0d' }} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
    </div>
  );
}
