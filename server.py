import os
from pymongo import MongoClient
from flask import Flask, send_file, request
from flask_socketio import SocketIO
from urllib.parse import urlparse
import datetime
import base64
import random

app = Flask(__name__, static_folder='public')
socketio = SocketIO(app)

mongo_uri = os.environ.get('MONGODB', 'mongodb://localhost/?retryWrites=true')
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

@socketio.on('connect')
def handle_connect():
    player_name = request.args.get('playerName', '').strip().replace('[^a-zA-Z0-9]', '')
    client_ip = request.remote_addr
    auth_nonce = request.args.get('authNonce', '')

    print('[' + str(datetime.datetime.utcnow()) + '] User connected:', player_name, 'From:', client_ip)

    player_data = fetch_player_data(player_name)
    if player_data:
        if player_data['name'] == player_name and player_data['authNonce'] == auth_nonce and auth_nonce != '':
            pass
            # Update database of new logon
        elif player_data['authNonce'] != auth_nonce and player_data['name'] == player_name and client_ip in player_data['ipList']:
            socketio.emit('nonce', player_data['authNonce'])
        else:
            socketio.emit("error", "user not authenticated")
            socketio.disconnect()
            print('Player', player_name, 'did not have nonce and did not have IP - Kicked')
    else:
        player_data = add_player(player_name, client_ip, socket)
        if not player_data:
            socketio.emit("error", 'Could not add user with name "' + player_name + '"')
            socketio.disconnect()

@socketio.on('message')
def handle_message(data):
    # Handle incoming messages
    pass

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
        socketio.emit('nonce', nonce)
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
