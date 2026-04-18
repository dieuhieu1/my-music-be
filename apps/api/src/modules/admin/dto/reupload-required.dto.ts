import { IsString, MinLength } from 'class-validator';

export class ReuploadRequiredDto {
  @IsString()
  @MinLength(1)
  notes: string;
}
