import requests
import json

# res = requests.post('http://localhost:8000/game', data={'id': 'r82338', 'token': '12345'})
# print(res, res.text)

# req.body.time, req.body.increment, req.body.timer, null, req.body.token
# res = requests.post('http://localhost:8000/create', data={'time': 10000, 'increment': 1000, 'timer': True, 'token': 'abcdef'})
# print(res, res.text)

res = requests.post('http://localhost:8000/pool', data={'token': 'thisisatest'})
print(res, res.text)