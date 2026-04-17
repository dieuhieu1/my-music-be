import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SuggestGenreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
