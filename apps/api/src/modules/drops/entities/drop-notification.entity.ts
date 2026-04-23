import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Opt-in record — one row per (user, song) pair. Deleted when the drop fires or is cancelled.
@Entity('drop_notifications')
export class DropNotification {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @PrimaryColumn({ name: 'song_id' })
  songId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
