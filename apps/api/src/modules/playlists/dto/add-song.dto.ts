import { IsUUID } from 'class-validator';

export class AddSongDto {
  @IsUUID()
  songId: string;
}
