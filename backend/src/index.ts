import { registerShutdownHandlers, startServer } from './app.js';

const main = async () => {
  try {
    registerShutdownHandlers();
    await startServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

main();
