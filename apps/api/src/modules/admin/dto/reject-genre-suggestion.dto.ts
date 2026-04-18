import { IsOptional, IsString } from 'class-validator';

export class RejectGenreSuggestionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
