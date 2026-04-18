import { IsString, MinLength } from 'class-validator';

export class RejectSongDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
