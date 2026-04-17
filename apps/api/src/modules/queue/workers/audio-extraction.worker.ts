import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { firstValueFrom } from 'rxjs';

import { QUEUE_NAMES } from '../queue.constants';
import { Song } from '../../songs/entities/song.entity';
import { StorageService } from '../../storage/storage.service';

interface AudioExtractionJobData {
  songId: string;
}

interface DspExtractResponse {
  bpm: number;
  camelotKey: string;
  energy: number;
  duration: number;
}

// Processes audio-extraction jobs enqueued by SongsService.upload().
// Calls the Python DSP sidecar to extract BPM, Camelot Key, energy (BL-37A),
// and duration, then updates the Song record.
@Injectable()
@Processor(QUEUE_NAMES.AUDIO_EXTRACTION)
export class AudioExtractionWorker extends WorkerHost {
  private readonly logger = new Logger(AudioExtractionWorker.name);
  private readonly dspUrl: string;

  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    private readonly storage: StorageService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    super();
    this.dspUrl = this.config.get<string>('dsp.url') ?? 'http://localhost:5000';
  }

  async process(job: Job<AudioExtractionJobData>): Promise<void> {
    const { songId } = job.data;
    this.logger.log(`Processing audio extraction for songId=${songId}`);

    const song = await this.songs.findOne({ where: { id: songId } });
    if (!song) {
      this.logger.warn(`Song ${songId} not found — skipping extraction`);
      return;
    }

    // Generate a 1-hour presigned URL for the DSP to stream the unencrypted file
    let audioUrl: string;
    try {
      audioUrl = await this.storage.presignedGetObject(
        this.storage.getBuckets().audio,
        song.fileUrl,
        3600,
      );
    } catch (err) {
      this.logger.error(`Failed to generate presigned URL for song ${songId}: ${err.message}`);
      throw err; // BullMQ will retry
    }

    // Call the DSP sidecar
    const { data } = await firstValueFrom(
      this.httpService.post<DspExtractResponse>(`${this.dspUrl}/extract`, { audioUrl }),
    );

    // Persist extracted metadata — energy is stored but NEVER exposed via API (BL-37A)
    await this.songs.update(songId, {
      bpm: data.bpm,
      camelotKey: data.camelotKey,
      energy: data.energy,
      duration: data.duration,
    });

    this.logger.log(
      `Extraction complete for songId=${songId}: bpm=${data.bpm}, key=${data.camelotKey}, duration=${data.duration}s`,
    );
  }
}
