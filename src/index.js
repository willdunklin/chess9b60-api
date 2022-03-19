import { create, get, join } from './api.js';
import express from 'express';
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/game/:gameid', (req, res) => {
  console.log('getting game', req.params.gameid, 'cookie:', req.cookies);
  return res.send('Getting game' + req.params.gameid);
});
  
app.post('/create', (req, res) => {
  console.log(req.body);
  return res.send('Creating a game');
});

app.post('/pool', (req, res) => {
  console.log(req.body);
  return res.send('Joining pool');
});


const PORT = (process.env.NODE_ENV === "production") ? process.env.PORT || 8000 : 8000;
app.listen(PORT, () =>
  console.log(`Example app listening on port ${PORT}!`),
);