export class DownloadResponseDto {
  downloadUrl: string;   // 5-min presigned MinIO URL for the .enc file
  licenseJwt: string;    // Client uses this to decrypt with Web Crypto API
  expiresAt: Date;       // 30 days from now — license validity
}

export class DownloadRecordResponseDto {
  id: string;
  songId: string;
  songTitle: string;
  coverArtUrl: string | null;
  downloadedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  licenseJwt: string;
}

export class RevalidateResponseDto {
  renewed: string[];   // songIds whose licenseJwt was refreshed
  revoked: string[];   // songIds whose revokedAt was just set
}
