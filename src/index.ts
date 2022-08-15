import { create, get, join, unjoin, queue_query } from './api';
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

app.post('/game', (req, res) => {
  get(req.body.id, req.body.token).then(result => res.send(JSON.stringify(result)))
    .catch(err => error(res, err.message));
});

app.post('/create', (req, res) => {
  create(req.body.time, req.body.increment, req.body.timer, [req.body.lower_strength, req.body.upper_strength], req.body.black, req.body.white)
    .then(result => {
      res.send(JSON.stringify(result))
    })
    .catch(err => error(res, err.message));
});

app.post('/pool', (req, res) => {
  join(req.body.token, res)
    .catch(err => error(res, err.message));
});

app.post('/depool', (req, res) => {
  unjoin(req.body.token)
    .catch(err => error(res, err.message));
});

app.post('/queue', (_req, res) => {
  queue_query()
    .then(result => {
      res.send(JSON.stringify(result))
    })
    .catch(err => error(res, err.message));
});

const PORT = (process.env.NODE_ENV === "production") ? process.env.PORT || 8080 : 8080;
app.listen(PORT, () =>
  console.log(`Listening at http://localhost:${PORT}`),
);
