import { create, get, join, unjoin, queue } from './api';
import express from 'express';
import cors from 'cors';
import { Response } from 'express-serve-static-core';
import rateLimit from 'express-rate-limit';


const queueApiLimiter = rateLimit({
    windowMs: 1 * 1000,
    max: 1,
    standardHeaders: true
});

const apiLimiter = rateLimit({
  windowMs: 1 * 1000,
  max: 10,
  standardHeaders: true
});

//--------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const error = (res: Response<any, Record<string, any>, number>, err: string) => {
    console.error(err);
    res.status(500).send('Internal server error');
}

app.use(cors());

app.use(apiLimiter);
app.use('/queue', queueApiLimiter);

//--------------------------------------------------------
app.post('/game', (req, res) => {
  get(req.body.id, req.body.token)
    .then(result => res.json(result))
    .catch(err => error(res, err.message));
});

app.post('/create', (req, res) => {
  create(req.body.time, req.body.increment, req.body.timer, [req.body.lower_strength, req.body.upper_strength], req.body.black, req.body.white)
    .then(result => res.json(result))
    .catch(err => error(res, err.message));
});

app.post('/pool', (req, res) => {
  join(req.body.token, res)
    .catch(err => error(res, err.message));
});

app.get('/queue', (_req, res) => {
  // console.log('/q', queue.length);
  res.json(queue.length);
});

//--------------------------------------------------------
const PORT = (process.env.NODE_ENV === "production") ? process.env.PORT || 8080 : 8080;
app.listen(PORT, () =>
  console.log(`Listening at http://localhost:${PORT}`),
);

// # of milliseconds before someone is removed from the queue
const QUEUE_TIMEOUT = 10 * 1000; // 10s

const checkTimeout = () => {
  const now = Date.now();
  for (const player of queue) {
    // console.log(player.token, now - player.time, queue.length);

    // Remove old players from the queue
    if (now - player.time >= QUEUE_TIMEOUT) {
      player.res.send({ 'id': 'timeout' });
      unjoin(player.token);
    }
  }
}

// Check queue for timeouts every 1/2 second
setInterval(checkTimeout, 500);
