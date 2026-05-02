import { PartialType } from '@nestjs/mapped-types';
import { CreateOfficialArtistDto } from './create-official-artist.dto';

export class UpdateOfficialArtistDto extends PartialType(CreateOfficialArtistDto) {}
