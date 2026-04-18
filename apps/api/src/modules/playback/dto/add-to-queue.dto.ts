import { IsUUID } from 'class-validator';

export class AddToQueueDto {
  @IsUUID()
  songId: string;
}
