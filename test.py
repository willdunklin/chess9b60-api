import requests
import json

url = 'http://localhost:8080'
# url = 'https://chess9b60-api.herokuapp.com'

# res = requests.post(f'{url}/game', data={'id': 'y1gDk4'})
# print(res, res.text)

# res = requests.post(f'{url}/game', data={'id': 'RLYGwc', 'token': '12345678'})
# print(res, res.text)


# res = requests.post(f'{url}/create', data={'time': 10000, 'increment': 1000, 'timer': True, 'black': 'abcdef'})
# print(res, res.text)

# res = requests.post(f'{url}/create', data={'increment': 1000, 'timer': True, 'black': 'abcdef'})
# print(res, res.text)

# res = requests.post(f'{url}/create', data={'time': 10000, 'timer': True, 'black': 'abcdef'})
# print(res, res.text)

# res = requests.post(f'{url}/create', data={'time': 10000, 'increment': 1000, 'black': 'abcdef'})
# print(res, res.text)


# res = requests.post(f'{url}/pool', data={})
# print(res, res.text)

# res = requests.post(f'{url}/pool', data={'token': 'thisisatest'})
# print(res, res.text)

# res = requests.get(f'{url}/variant/ASCbyz')
# print(res, res.json()['content'])

# res = requests.post(f'{url}/synthesize/YYMuH5', data={'moves': json.dumps(['f1e4', 'h8f5', 'e4b5', 'f8e5', 'h1g3', 'f5g3', 'h2g3', 'e5b4', 'b2b3', 'b4a1', 'b1a1', 'e7e6', 'e2e3', 'g7g6', 'c2c4', 'd7d5', 'd1e2', 'd8f6', 'a1b1', 'd5c4', 'b3c4', 'c7c5', 'b5a8', 'b8a8', 'f2f4', 'h7h5', 'c1c2', 'c8c7', 'b1d1', 'a8d8', 'd2d3', 'e8c6', 'e2f3', 'e6e5', 'g1f1', 'g8g7', 'f3e2', 'b7b6', 'e3e4', 'f6e7', 'd1f2', 'c7d6', 'f4f5', 'd8g8', 'g3g4', 'h5g4', 'f2g4', 'g8h8', 'g4f2', 'h8h2', 'f1g1', 'h2h6', 'f2h3', 'a7a6', 'h3h6', 'e7h6', 'f5g6', 'g7g6', 'g1f2', 'd6c7', 'e2b3', 'a6a5', 'c2d2', 'g6f6', 'd2e2', 'f6e6', 'e1d2', 'h6g5', 'f2e1', 'g5h4', 'e1f1', 'h4d8', 'e2f3', 'f7f6', 'd2e3', 'c7d6', 'f3g4', 'e6e7', 'g4f5', 'a5a4', 'b3d1', 'd6e6', 'a2a3', 'e7d7', 'g2g4', 'e6e7', 'g4g5', 'd7d6', 'd1g4', 'f6g5', 'e3g5', 'c6d7', 'g5e7', 'd6e7', 'g4d5', 'd7f5', 'e4f5', 'e7f6', 'd5a4', 'f6f5', 'a4d7', 'f5f6', 'a3a4', 'e5e4', 'd7e4', 'f6e5', 'f1e1', 'd8f6', 'e1d2', 'f6e7', 'd2c1', 'e7d6', 'c1d2', 'e5d4', 'd2c2', 'd6e7', 'c2c1', 'e7g5', 'c1b1', 'd4e5', 'e4g6', 'e5f4', 'b1b2', 'f4e3', 'b2c2', 'e3d4', 'g6f5', 'g5e7', 'c2d2', 'd4e5', 'f5c6', 'e7d4', 'c6b5', 'e5d6', 'a4a5', 'b6a5', 'd2c2', 'd6e5', 'b5c6', 'e5f4', 'c2d2', 'f4e5', 'c6d5', 'e5d6', 'd2c2', 'd6e5', 'c2b3', 'd4e7', 'd5e4', 'e7d4', 'b3a4', 'd4c3', 'a4b3', 'c3d4', 'e4g2', 'e5f4', 'b3a4', 'f4e5', 'g2d1', 'd4e1', 'd1e4', 'e5d4', 'e4c6', 'e1c3', 'c6e4', 'c3d6', 'a4b5', 'd4c3', 'e4f5', 'c3d4', 'f5e2', 'd4c3', 'e2g4', 'c3d4', 'g4f5', 'd6c7', 'f5e4', 'c7d6', 'e4f5', 'd4c3', 'f5e6', 'c3d4', 'e6g4', 'd4c3', 'g4f5', 'c3d4', 'f5e4', 'd4e5', 'e4d5', 'e5d4', 'd5e4', 'd4e3', 'e4c6', 'e3d4', 'c6e4', 'd4e3', 'e4c6', 'e3d4', 'c6f5', 'd4e3', 'f5g4', 'e3d4', 'g4f5', 'd4e3', 'f5e6', 'e3d4', 'e6f5', 'd4e3', 'f5c6', 'e3d4', 'c6f5', 'd4e3', 'f5e4', 'e3d4', 'e4g2', 'd4e3', 'b5c6', 'd6b8', 'c6b5', 'e3f4', 'b5a4', 'f4e3', 'g2e4', 'e3d4', 'e4c6', 'd4e3', 'c6e4', 'e3d4', 'e4f5', 'd4e3', 'f5e4', 'b8c7', 'e4c6', 'e3d4', 'c6e4', 'c7h2', 'a4a5', 'd4e5', 'a5b5', 'e5d6', 'e4g6', 'h2e5', 'g6f3', 'e5b2', 'f3e4', 'b2e5', 'e4d1', 'e5b2', 'b5a4', 'b2e3', 'a4a5', 'e3d4', 'a5a6', 'd4e5', 'd1g4', 'e5h6', 'a6b7', 'h6f4', 'g4e2', 'f4e1', 'e2f1', 'e1c3', 'f1g2', 'c3a1', 'b7a6', 'a1d2', 'g2h5', 'd2e5', 'h5d1', 'e5f4', 'a6b5', 'f4e5', 'd1e4', 'e5d4', 'b5a6', 'd4f2', 'e4h1', 'd6e5', 'h1g4', 'f2c3', 'g4e2', 'e5d4', 'a6b7', 'd4e3', 'e2f5', 'e3f2', 'b7c8', 'f2e1', 'c8b7', 'e1f2', 'b7c6', 'c3d4', 'f5g4', 'd4a3', 'g4d1', 'f2e3', 'd1a4', 'e3d4', 'a4b1', 'd4e3', 'b1a4', 'e3d4', 'a4b1', 'd4e3', 'c6b7', 'a3d2', 'b1c2', 'e3d4', 'c2f1', 'd2f4', 'f1g2', 'd4c3', 'g2f1', 'c3d4', 'f1g4', 'd4c3', 'g4e2', 'c3b2', 'e2f1', 'b2c3', 'f1g4', 'f4g7', 'g4f1', 'g7f4', 'f1e4', 'f4e3', 'e4f1', 'c3d4', 'f1c2', 'd4c3', 'c2d5', 'c3d3', 'b7b6', 'd3d4', 'b6b5', 'e3f4', 'd5e6', 'd4e5', 'e6f3', 'f4g1', 'f3d1', 'e5d4', 'd1c2', 'g1d2', 'c2f5', 'd4e5', 'f5e2', 'e5d4', 'e2d5', 'd2f4', 'd5e6'])})
# res = requests.post(f'{url}/synthesize/CZvsgw')

res = requests.get(f'{url}/leaderboard')
print(res, res.text)

##############################################################################################
url = 'https://chess9b60-api.herokuapp.com'
# res = requests.post('f'{url}/game', data={'id': 'ZYMrDq'})
# print(res, res.text)

# res = requests.post('f'{url}/create', data={'time': 10000, 'increment': 1000, 'timer': True, 'token': 'abcdef'})
# print(res, res.text)

# res = requests.post('f'{url}/pool', data={'token': 'thisisatest'})
# print(res, res.text)