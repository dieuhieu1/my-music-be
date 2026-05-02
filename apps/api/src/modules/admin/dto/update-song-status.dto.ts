import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SongStatus } from '../../../common/enums';

export class UpdateSongStatusDto {
  @IsEnum(SongStatus)
  status: SongStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
