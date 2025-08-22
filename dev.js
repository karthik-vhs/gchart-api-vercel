import app from './lib/app.js';

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Local server: http://localhost:${PORT}/chart`);
});
