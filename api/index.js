import serverless from 'serverless-http';
import app from '../lib/app.js';

// Remove explicit runtime version (new Vercel requires just 'nodejs' or none)
export default serverless(app);
