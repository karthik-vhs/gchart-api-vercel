import serverless from 'serverless-http';
import app from '../lib/app.js';

// No runtime export (newer Vercel rejects 'nodejs20.x' here)
export default serverless(app);
