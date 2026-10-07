import { config } from 'dotenv';

// Scripts run from apps/api while the shared .env lives at the repo root; the first file wins per variable.
config({ path: ['.env', '../../.env'], quiet: true });
