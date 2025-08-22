import serverless from 'serverless-http';
import app from '../lib/app.js';

// Vercel function config
export const config = {
  runtime: 'nodejs20.x',
  regions: ['bom1'] // optional (Mumbai)
};

export default serverless(app);
