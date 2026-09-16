/**
 * Wipes all content and rebuilds both organizations with the 16 sections
 * present but EMPTY, so you can fill in your own details.
 *
 *   node src/scripts/blank.js
 *
 * Logins are untouched. Run `node src/scripts/reseed.js` to get the demo
 * content back.
 */
import { load } from '../models/db.js';
import { ensureDirs } from '../config/paths.js';
import { seedIfEmpty } from '../services/seed.service.js';
import { ensureSeedUsers } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

ensureDirs();
load();
await ensureSeedUsers();
await seedIfEmpty({ force: true, blank: true });
logger.info('blank layout ready — sign in as admin and start adding blocks');
