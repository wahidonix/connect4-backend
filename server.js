const express = require('express');
const cors = require('cors');
const { Worker } = require('worker_threads');
const os = require('os');
const winston = require('winston');
const expressWinston = require('express-winston');
const app = express();
const port = 5000;
const ROWS = 6;
const COLS = 7;
// Define depths for each difficulty level
const EASY_DEPTH = 1;
const MEDIUM_DEPTH = 2;
const HARD_DEPTH = 5;
const EXPERT_DEPTH = 9;

app.use(cors());
app.use(express.json());

// Set up winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'connect4-ai-server' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Add winston logger middleware to Express
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: false,
}));

const workerPool = [];
const numWorkers = os.cpus().length;
for (let i = 0; i < numWorkers; i++) {
  const worker = new Worker('./worker.js');
  workerPool.push(worker);
}

let currentWorker = 0;
function getNextWorker() {
  const worker = workerPool[currentWorker];
  currentWorker = (currentWorker + 1) % numWorkers;
  return worker;
}

app.post('/ai-move', (req, res) => {
  const { board, aiDifficulty, aiColor } = req.body;
  const clientIp = req.ip;

  const worker = getNextWorker();
  worker.postMessage({ board, aiDifficulty, aiColor });
  
  worker.once('message', (result) => {
    res.json({ column: result.column });
    
    logger.info('AI move computed', {
      clientIp,
      aiDifficulty,
      aiColor,
      requestBoard: board,
      aiResponse: result.column,
    });
  });
});

app.listen(port, () => {
  console.log(`Connect4 AI server running on port ${port}`);
  logger.info(`Connect4 AI server started on port ${port}`);
});