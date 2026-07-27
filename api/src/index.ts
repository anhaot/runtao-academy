import { registerShutdownHandlers, startServer } from './app.js';

const main = async () => {
  try {
    const server = await startServer();
    registerShutdownHandlers(server);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

main();
