import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { FeedEventType } from '../../../common/enums';

@Entity('feed_events')
export class FeedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The user who performed the action (liked, followed, created, etc.)
  @Index()
  @Column({ name: 'actor_id' })
  actorId: string;

  @Column({ type: 'enum', enum: FeedEventType })
  eventType: FeedEventType;

  // The primary entity this event is about (songId, playlistId, followeeId, etc.)
  @Column({ name: 'entity_id', nullable: true })
  entityId: string | null;

  // 'SONG' | 'PLAYLIST' | 'USER' — disambiguates entityId
  @Column({ name: 'entity_type', length: 20, nullable: true })
  entityType: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
