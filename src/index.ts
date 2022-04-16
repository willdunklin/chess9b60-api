import { create, get, join } from './api';
import express from 'express';
import { Response } from 'express-serve-static-core';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const error = (res: Response<any, Record<string, any>, number>, err: string) => {
    console.error(err);
    res.status(500).send('Internal server error');
}

app.post('/game', (req, res) => {
  get(req.body.id, req.body.token).then(result => res.send(JSON.stringify(result)))
    .catch(err => error(res, err.message));
});

app.post('/create', (req, res) => {
  create(req.body.time, req.body.increment, req.body.timer, req.body.black, req.body.white)
    .then(result => {
      res.send(JSON.stringify(result))
    })
    .catch(err => error(res, err.message));
});

app.post('/pool', (req, res) => {
  join(req.body.token, res)
    .catch(err => error(res, err.message));
});


const PORT = (process.env.NODE_ENV === "production") ? process.env.PORT || 8080 : 8080;
app.listen(PORT, () =>
  console.log(`Listening at http://localhost:${PORT}`),
);