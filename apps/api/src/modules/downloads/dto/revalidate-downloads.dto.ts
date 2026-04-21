import { IsArray, IsUUID, ArrayMaxSize } from 'class-validator';

export class RevalidateDownloadsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(300)
  songIds: string[];
}
