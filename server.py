import os
import re
from pymongo import MongoClient
import eventlet
import socketio
import datetime
import base64
import hashlib
import random
import json

sio = socketio.Server()
app = socketio.WSGIApp(sio, static_files={
    '/': {'content_type': 'text/html', 'filename': 'public/index.html'},
    '/client.js':{'content_type': 'text/javascript', 'filename': 'client.js'}
})

global active_sockets
active_sockets = {}

mongo_uri = os.environ.get('MONGODB', 'mongodb://localhost/?retryWrites=true')
#mongo_uri = os.getenv("MONGODB") or "mongodb://localhost/?retryWrites=true"
client = MongoClient(mongo_uri)
database = client.ddgpt
settings_collection = database.settings
game_data_collection = database.gameData
response_collection = database.allResponses

@app.route('/')
def index():
  return send_file('public/index.html')

@app.route('/client.js')
def client_js():
  return send_file('client.js', mimetype='text/javascript')

@app.route('/socket.io/socket.io.js')
def socket_io_js():
  return send_file('public/socket.io.js', mimetype='text/javascript')

@socketio.on('showCharOption')
def showCharOption(sid, data):
  if data in ['All', 'Own']:
    active_sockets[sid.get('playerName')]['showCharacters'] = data
  else:
    socketio.emit('alertMsg', {'message': 'Invalid option!', 'color': 'red', 'timeout': 5000}, to=request.sid)


@socketio.on('saveChar')
def saveChar(data):
  print('Received event')
  print(data)

@socketio.on('connect')
def handle_connect(sid):
  player_name = sid.get('playerName', '')
  player_name = re.sub('[^a-zA-Z0-9]', '', player_name)

  client_ip = request.environ.get('REMOTE_ADDR')
  auth_nonce = sid.get('authNonce', '')

  print('[' + str(datetime.datetime.utcnow()) + '] User connected:', player_name, 'From:', client_ip)

  player_data = fetch_player_data(player_name)
  if player_data:
    if player_data['name'] == player_name and player_data['authNonce'] == auth_nonce and auth_nonce != '':
      pass
      # Update database of new logon
    elif player_data['authNonce'] != auth_nonce and player_data['name'] == player_name and client_ip in player_data['ipList']:
      socketio.emit('nonce', player_data['authNonce'], to=request.sid)
    else:
      socketio.emit("error", "user not authenticated", to=request.sid)
      socketio.server().get_session(request.sid).disconnect()
      print('Player', player_name, 'did not have nonce and did not have IP - Kicked')
  else:
    #player_data = add_player(player_name, client_ip, socket)
    if not player_data:
      socketio.emit("error", 'Could not add user with name "' + player_name + '"', to=request.sid)
      socketio.disconnect()

  active_sockets[request.sid] = {
    'player_data': player_data,
    'showCharacters': 'Own',
    'showActiveAdventures': True,
    'historyFilterLimit': 'all',
    'historyTextSearch': ''
  }

  if active_sockets[request.sid]['player_data']['admin'] == True:
    socketio.emit('serverRole','admin', to=request.sid)

def fetch_player_data(player_name):
  find_filter = {"name": player_name, "type": "player"}
  player_data = None
  try:
    player_data = game_data_collection.find_one(find_filter)
    return player_data
  except Exception as error:
    print(error)
    raise error

def add_player(player_name, client_ip, socket):
  if len(player_name) > 0:
    print('Adding user:', player_name)
    nonce = base64.b64encode(os.urandom(64)).decode('utf-8')
    socketio.emit('nonce', nonce, to=request.sid)
    player_doc = {
      "name": player_name,
      "type": "player",
      "ipList": [client_ip],
      "authNonce": nonce
    }
    try:
      game_data_collection.insert_one(player_doc)
      return player_doc
    except Exception as error:
      print('Error saving response to MongoDB:', error)
      return None

if __name__ == '__main__':
  socketio.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 9001)))
