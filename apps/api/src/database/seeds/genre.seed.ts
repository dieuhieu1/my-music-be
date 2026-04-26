import { DataSource } from 'typeorm';
import { Genre } from '../../modules/genres/entities/genre.entity';

// DB_HOST in .env is 'postgres' (Docker internal hostname) — not usable from the host machine.
// Use SEED_DB_HOST / SEED_DB_PORT env vars to override; otherwise default to localhost:5433
// (the host-mapped port from docker-compose: "5433:5432").
const ds = new DataSource({
  type: 'postgres',
  host:     process.env.SEED_DB_HOST ?? 'localhost',
  port:     parseInt(process.env.SEED_DB_PORT ?? '5433', 10),
  username: process.env.DB_USER      ?? 'mymusic',
  password: process.env.DB_PASSWORD  ?? 'mymusic_password',
  database: process.env.DB_NAME      ?? 'mymusic_db',
  entities: [Genre],
  synchronize: false,
});

const GENRES: Array<{ name: string; description: string }> = [
  { name: 'Pop',         description: 'Mainstream popular music with broad appeal' },
  { name: 'Rock',        description: 'Guitar-driven music with strong rhythms' },
  { name: 'Hip-Hop',     description: 'Rhythmic vocals, beats and rap culture' },
  { name: 'R&B',         description: 'Rhythm and blues with soulful vocal performances' },
  { name: 'Electronic',  description: 'Synthesizer-based and digitally produced music' },
  { name: 'Jazz',        description: 'Improvisation-driven music with complex harmonies' },
  { name: 'Classical',   description: 'Orchestral and chamber music from the Western tradition' },
  { name: 'Country',     description: 'American folk-inspired music with guitar and storytelling' },
  { name: 'Metal',       description: 'Heavy guitar tones, distortion and aggressive sound' },
  { name: 'Indie',       description: 'Independent alternative music outside mainstream labels' },
  { name: 'Folk',        description: 'Acoustic, traditional or roots-based acoustic music' },
  { name: 'Reggae',      description: 'Jamaican-originated rhythm with offbeat guitar style' },
  { name: 'Latin',       description: 'Spanish and Portuguese language music across many styles' },
  { name: 'Blues',       description: 'Expressive music rooted in African-American tradition' },
  { name: 'Funk',        description: 'Groove-heavy music with syncopated rhythms and bass lines' },
  { name: 'Punk',        description: 'Fast, raw and energetic short-form rock music' },
  { name: 'Alternative', description: 'Non-mainstream rock and experimental sounds' },
  { name: 'Lo-fi',       description: 'Intentionally low-fidelity music with a relaxed aesthetic' },
  { name: 'Ambient',     description: 'Atmospheric, textural music focused on mood and space' },
  { name: 'House',       description: 'Four-on-the-floor electronic dance music from Chicago' },
  { name: 'Techno',      description: 'Industrial electronic dance music from Detroit' },
  { name: 'Trap',        description: 'Hip-hop sub-genre with hi-hats and 808 bass drums' },
  { name: 'Dance',       description: 'Uptempo music made for dancing' },
  { name: 'Soul',        description: 'Emotionally expressive African-American vocal music' },
  { name: 'Acoustic',    description: 'Unplugged, instrument-forward music without amplification' },
  { name: 'Ballad',      description: 'Slow, emotional narrative songs' },
  { name: 'K-Pop',       description: 'Korean popular music with polished production and choreography' },
  { name: 'V-Pop',       description: 'Vietnamese popular music blending local and global styles' },
  { name: 'Bolero',      description: 'Slow Vietnamese romantic ballad rooted in Latin bolero style' },
  { name: 'Cải Lương',   description: 'Traditional Vietnamese reformed opera music theatre' },
];

async function seed() {
  await ds.initialize();
  const repo = ds.getRepository(Genre);

  let inserted = 0;
  let skipped = 0;

  for (const g of GENRES) {
    const exists = await repo.findOne({ where: { name: g.name } });
    if (exists) {
      skipped++;
    } else {
      await repo.save(repo.create(g));
      console.log(`  + ${g.name}`);
      inserted++;
    }
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} already existed.`);
  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
