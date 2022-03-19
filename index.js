const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    return res.send('Received a GET HTTP method');
});
  
app.post('/', (req, res) => {
    console.log(req.body);
    return res.send('Received a POST HTTP method');
});


const PORT = (process.env.NODE_ENV === "production") ? process.env.PORT || 8000 : 8000;
app.listen(PORT, () =>
  console.log(`Example app listening on port ${PORT}!`),
);