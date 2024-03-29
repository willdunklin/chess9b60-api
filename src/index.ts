import { create, get, join, unjoin, queues } from './api/game';
import { variant, synthesize_game } from './api/variant';
import { login, getUser, createUser, getLeaderboard } from './api/users';
import { end } from './api/end';
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
    console.error('error:', err);
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
  join(req.body.token, req.body.q_id, res)
    .catch(err => error(res, err.message));
});

app.get('/queue', (_req, res) => {
  // console.log('/q', queue.length);
  res.json(queues.map(q => q.length));
});

app.get('/end/:id', (req, res) => {
  end(req.params.id)
    .then(result => res.json(result))
    .catch(err => error(res, err.message));
});

app.get('/variant/:id/start', (req, res) => {
  // console.log(req.params.id, req.params.start);
  variant(req.params.id, true)
    .then(result => res.json(result))
    .catch(err => error(res, err.message));
});

app.get('/variant/:id', (req, res) => {
  // console.log(req.params.id, req.params.start);
  variant(req.params.id, false)
    .then(result => res.json(result))
    .catch(err => error(res, err.message));
});

app.post('/synthesize/:id', (req, res) => {
  try {
    synthesize_game(req.params.id, JSON.parse(req.body.moves))
      .then(result => res.send(result))
      .catch(err => error(res, err.message));
  } catch (e) {
    error(res, 'Could not parse moves');
  }
});

app.post('/auth/google', (req, res) => {
  login(req.body.token)
    .then(result => res.json(result))
    .catch(err => error(res, err));
});

app.post('/auth/user', (req, res) => {
  getUser(req.body.email, req.body.token)
    .then(result => res.json(result))
    .catch(err => error(res, err));
});

app.post('/auth/create', (req, res) => {
  createUser(req.body.token, req.body.username)
    .then(result => res.json(result))
    .catch(err => error(res, err));
});

app.get('/leaderboard', (_req, res) => {
  getLeaderboard()
    .then(result => res.json(result))
    .catch(err => error(res, err));
});

//--------------------------------------------------------
const PORT = (process.env.NODE_ENV === "production") ? process.env.PORT || 8080 : 8080;
app.listen(PORT, () =>
  console.log(`Listening at http://localhost:${PORT}`),
);

// # of milliseconds before someone is removed from the queue
const QUEUE_TIMEOUT = 6 * 1000; // 6s

const checkTimeout = () => {
  const now = Date.now();
  // In each queue check for timed out players
  queues.forEach((queue, i) => {
    for (const player of queue) {
      // console.log(player.token, now - player.time, queue.length);

      // Remove old players from the queue
      if (now - player.time >= QUEUE_TIMEOUT)
        unjoin(player.token, 'timeout', [i, i + 1]);
    }
  });
}

// Check queue for timeouts every 1/2 second
setInterval(checkTimeout, 100);
