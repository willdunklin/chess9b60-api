import { create, get, join } from './api';
import express from 'express';
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.post('/game', (req, res) => {
  console.log('getting game');
  get(req.body.id, req.body.token).then(result => res.send(JSON.stringify(result)))
  // return res.send('Getting game ' + req.body.id);
});

app.post('/create', (req, res) => {
  // console.log(req.body);
  create(req.body.time, req.body.increment, req.body.timer, null, req.body.token)
    .then(result => {
      res.send(JSON.stringify(result))
    });
  // return res.send('Creating a game');
});

app.post('/pool', (req, res) => {
  // console.log(req.body);
  join(req.body.token, res);
});


const PORT = (process.env.NODE_ENV === "production") ? process.env.PORT || 8000 : 8000;
app.listen(PORT, () =>
  console.log(`Listening at http://localhost:${PORT}`),
);