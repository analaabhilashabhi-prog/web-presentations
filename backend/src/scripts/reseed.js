/**
 * Wipes organizations, sections and seeded images, then re-creates the demo
 * content. User accounts and sessions are left alone.
 *
 *   node src/scripts/reseed.js
 */
import { load } from '../models/db.js';
import { ensureDirs } from '../config/paths.js';
import { seedIfEmpty } from '../services/seed.service.js';
import { ensureSeedUsers } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

ensureDirs();
load();
await ensureSeedUsers();
await seedIfEmpty({ force: true });
logger.info('reseed complete');
