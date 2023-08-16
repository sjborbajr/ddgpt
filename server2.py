
@app.event
async def disconnect(sid):
    print('[{}] Client disconnected: {}'.format(datetime.now(), sid))
   
    if sid in active_sockets:
        del active_sockets[sid]

@app.on('save')
async def save_settings(sid, data):
    if is_admin(sid):
        print('[{}] Player {} saved settings'.format(datetime.now(), get_player_name(sid)))
        await save_settings_to_db(data)
        await sio.emit('alertMsg', {'message': 'Settings saved.', 'color': 'green', 'timeout': 3000}, room=sid)
    else:
        print('[{}] Player {} tried to save settings'.format(datetime.now(), get_player_name(sid)))
        await sio.emit('error', 'User not admin', room=sid)
        await disconnect_client(sid)

@app.on('saveChar')        
async def save_character(sid, data):
    player_data = await fetch_player_data(get_player_name(sid))
   
    if data['_id']: # Updating existing character
        # Verify user has permission to edit this character
        char_data = await game_data_collection.find_one({'_id': data['_id']})
        if is_admin(sid) or char_data['owner_id'] == player_data['_id']:
            await game_data_collection.update_one({'_id': data['_id']}, {'$set': data['data']})
            await sio.emit('alertMsg', {'message': 'Character {} saved.'.format(data['data']['name']), 'color': 'green', 'timeout': 1500}, room=sid)
        else:
            await sio.emit('alertMsg', {'message': 'No access - Character {} not saved!'.format(data['data']['name']), 'color': 'red', 'timeout': 5000}, room=sid)
           
    else: # Creating new character
        data['data']['owner_id'] = player_data['_id']
        await game_data_collection.insert_one(data['data'])
        await sio.emit('charData', data['data'], room=sid)
        await sio.emit('alertMsg', {'message': 'Character {} created.'.format(data['data']['name']), 'color': 'green', 'timeout': 5000}, room=sid)
       
@app.on('showCharOption')        
async def set_show_characters_option(sid, data):
    if data in ['All', 'Own']:
        active_sockets[sid]['showCharacters'] = data
    else:
        await sio.emit('alertMsg', {'message': 'Invalid option!', 'color': 'red', 'timeout': 5000}, room=sid)
       
@app.on('listOwners')
async def list_owners(sid):
    if is_admin(sid):
        owners = await game_data_collection.find({'type': 'player'}).project({'name': 1, '_id': 1}).to_list(None)
        await sio.emit('listedOwners', owners, room=sid)

@app.on('disconnect')        
async def handle_disconnect(sid):
    player_name = get_player_name(sid)
    print('[{}] Player disconnected: {}'.format(datetime.now(), player_name))
   
    await game_data_collection.update_one({'type': 'player', 'name': player_name}, {'$set': {'connected': False}})
   
@app.on('changeName')
async def change_name(sid, new_name):
    new_name = new_name.strip().replace('[^a-zA-Z0-9]', '')
   
    if not await player_name_taken(new_name):
        await update_player(get_player_name(sid), {'$set': {'name': new_name}})
        active_sockets[sid]['playerName'] = new_name
        await sio.emit('nameChanged', new_name, room=sid)
    else:
        await sio.emit('error', 'Player name already taken', room=sid)

@app.on('historyFilterLimit')        
async def set_history_filter_limit(sid, limit):
    active_sockets[sid]['historyFilterLimit'] = limit
   
@app.on('historyDelete')
async def delete_history(sid, history_id):
    if is_admin(sid):
        await response_collection.update_one({'_id': history_id}, {'$set': {'deleted': True}, '$unset': {'request': '', 'response': '', 'responseRaw': ''}})
       
@app.on('fetchHistory')        
async def fetch_history(sid, history_id):
    if is_admin(sid):
        history = await response_collection.find_one({'_id': history_id})
        if history:
            await sio.emit('historyData', history, room=sid)
        else:
            await sio.emit('error', 'Could not find history with ID: {}'.format(history_id), room=sid)
           
@app.on('fetchCharData')
async def fetch_char_data(sid, char_id):
    player_data = await fetch_player_data(get_player_name(sid))
   
    if is_admin(sid):
        query = {'_id': char_id}
    else:
        query = {'_id': char_id, 'owner_id': player_data['_id']}
       
    char_data = await game_data_collection.find_one(query)
   
    if char_data:
        await sio.emit('charData', char_data, room=sid)
    else:
        await sio.emit('error', 'Could not find character with ID: {}'.format(char_id), room=sid)
       
@app.on('scotRun')        
async def run_scot(sid, data):
    if is_admin(sid):
        await sio.emit('alertMsg', {'message': 'Message received, running!', 'color': 'green', 'timeout': 10000}, room=sid)
       
        response = await openai_call(data['messages'], data['model'], data['temperature'], data['maxTokens'], get_api_key(sid), 'ScotGPT')
       
        await sio.emit('ScotRan', response['content'], room=sid)
       
@app.on('replay')
async def replay(sid, data):
    if is_admin(sid):
        await sio.emit('alertMsg', {'message': 'Replay received, running!', 'color': 'green', 'timeout': 10000}, room=sid)
       
        response = await openai_call(data['messages'], data['model'], data['temperature'], data['maxTokens'], get_api_key(sid), 'Replay')
       
        await sio.emit('replayRan', {'date': response['date'], '_id': response['allResponse_id']}, room=sid)
       
@app.on('fetchFunction')        
async def fetch_function(sid, function_name):
    if is_admin(sid):
        function_settings = await get_function_settings(function_name)
        function_messages = await settings_collection.find({'type': 'message', 'function': function_name}).to_list(None)
        if function_messages:
            function_settings['messages'] = function_messages
        await sio.emit('functionSettings', function_settings, room=sid)
       
@app.on('fetchAllAdventureHistory')
async def fetch_all_adventure_history(sid, adventure_id):
    await sio.enter_room(sid, 'Adventure-{}'.format(adventure_id))
    await send_adventure_data(adventure_id, sid)
    await send_adventurers(adventure_id, sid)
   
@app.on('approveAdventureInput')
async def approve_adventure_input(sid, user_input):
    if len(user_input['content']) > 1:
        user_input['approverName'] = get_player_name(sid)
        user_input['adventure_id'] = pymongo.ObjectId(user_input['adventure_id'])
        user_input['date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S GMT')
        user_input['created'] = int(datetime.strptime(user_input['date'], '%a, %d %b %Y %H:%M:%S GMT').timestamp())
        user_input['type'] = 'message'
       
        settings = await get_function_settings('game')
        if settings['active'] == 'true':
            await game_data_collection.insert_one(user_input)
           
        await sio.emit('adventureEvent', user_input, to='Adventure-{}'.format(user_input['adventure_id']))
       
        await continue_adventure(user_input['adventure_id'])
       
@app.on('bootAdventurer')        
async def boot_adventurer(sid, data):
    try:
        adventure = await game_data_collection.find_one({'type': 'adventure', '_id': data['adventure_id'], 'state': 'forming'})
        if adventure:
            await game_data_collection.update_one({'_id': adventure['_id']}, {'$pull': {'characters': {'_id': data['character_id']}}})
            await game_data_collection.update_one({'_id': data['character_id']}, {'$unset': {'activeAdventure': 1}, '$pull': {'adventures': {'_id': adventure['_id']}}})
            await sio.emit('RemoveAdventurer', data['character_id'], to='Adventure-{}'.format(adventure['_id']))
        else:
            await sio.emit('alertMsg', {'message': "Adventure is no longer forming, can't boot.", 'color': 'red', 'timeout': 3000}, room=sid)
    except Exception as e:
        print('Error booting adventurer:', e)
       
@app.on('deleteMessage')        
async def delete_message(sid, message_id):
    message = await game_data_collection.find_one({'_id': message_id}, {'adventure_id': 1})
    if message:
        adventure = await game_data_collection.find_one({'_id': message['adventure_id']}, {'owner_id': 1})
        if is_admin(sid) or adventure['owner_id'] == get_player_id(sid):
            await game_data_collection.update_one({'_id': message_id}, {'$set': {'type': 'deleted-message'}})
            await sio.emit('adventureEventDelete', message_id, to='Adventure-{}'.format(message['adventure_id']))
           
@app.on('suggestAdventureInput')        
async def suggest_adventure_input(sid, user_input):
    user_input['content'] = user_input['content'].strip()
    if len(user_input['content']) > 1:
        user_input['playerName'] = get_player_name(sid)
        await sio.emit('adventureEventSuggest', user_input, to='Adventure-{}'.format(user_input['adventure_id']))
       
@app.on('setAdventureModel')        
async def set_adventure_model(sid, data):
    print('[{}] Player {} requested to set model to {}'.format(datetime.now(), get_player_name(sid), data['model']))
   
    try:
        data['adventure_id'] = pymongo.ObjectId(data['adventure_id'])
        if data['model'] == 'unset':
            await game_data_collection.update_one({'_id': data['adventure_id']}, {'$unset': {'model': 1}})
        else:
            await game_data_collection.update_one({'_id': data['adventure_id']}, {'$set': {'model': data['model']}})
           
        await sio.emit('alertMsg', {'message': 'Model updated', 'color': 'green', 'timeout': 3000}, room=sid)
    except Exception as e:
        print('Error setting adventure model:', e)
       
@app.on('endAdventure')        
async def end_adventure(sid, adventure_id):
    await complete_adventure(pymongo.ObjectId(adventure_id))
   
@app.on('listActiveAdventure')        
async def list_active_adventures(sid, data):
    active_sockets[sid]['showActiveAdventures'] = data
   
@app.on('beginAdventure')
async def begin_adventure(sid, adventure_id):
    try:
        adventure_id = pymongo.ObjectId(adventure_id)
        adventure = await game_data_collection.find_one({'_id': adventure_id, 'state': 'forming'})
        if is_admin(sid) or adventure['owner_id'] == get_player_id(sid):
            await game_data_collection.update_one({'_id': adventure_id}, {'$set': {'state': 'discovery'}})
            await start_adventure(adventure)
            await game_data_collection.update_one({'_id': adventure_id}, {'$set': {'state': 'active'}})
    except Exception as e:
        print('Error beginning adventure:', e)
       
@app.on('joinParty')        
async def join_party(sid, adventure_id):
    try:
        adventure = await game_data_collection.find_one({'_id': adventure_id, 'state': 'forming'})
        my_characters = await game_data_collection.find({'owner_id': get_player_id(sid), 'activeAdventure': {'$exists': False}}).project({'_id': 1, 'name': 1}).to_list(None)
        my_characters_data = await game_data_collection.find({'owner_id': get_player_id(sid), 'activeAdventure': {'$exists': False}}).to_list(None)
       
        await game_data_collection.update_one({'_id': adventure['_id']}, {'$push': {'characters': {'$each': my_characters}}})
        for char in my_characters_data:
            await game_data_collection.update_one({'_id': char['_id']}, {'$set': {'activeAdventure': {'name': adventure['name'], '_id': adventure['_id']}}, '$push': {'adventures': {'name': adventure['name'], '_id': adventure['_id']}}})
           
        await sio.emit('AddAdventurer', my_characters_data, to='Adventure-{}'.format(adventure['_id']))
        await sio.emit('partyJoined', {'_id': adventure['_id'], 'name': adventure['name']}, room=sid)
        await sio.emit('alertMsg', {'message': 'Party Joined', 'color': 'green', 'timeout': 3000}, room=sid)
    except Exception as e:
        print('Error joining party:', e)
       
@app.on('historyTextSearch')        
async def search_history(sid, data):
    active_sockets[sid]['historyTextSearch'] = data
   
@app.on('createParty')
async def create_party(sid, new_name):
    try:
        if len(new_name) > 0 and get_api_key(sid):
            characters = await game_data_collection.find({'owner_id': get_player_id(sid), 'activeAdventure': {'$exists': False}}).project({'_id': 1, 'name': 1}).to_list(None)
           
            if characters:
                existing = await game_data_collection.find_one({'owner_id': get_player_id(sid), 'state': 'forming'})
                if not existing:
                    adventure = {
                        'type': 'adventure',
                        'party_name': new_name,
                        'name': '{}: <forming>'.format(new_name),
                        'state': 'forming',
                        'characters': characters,
                        'owner_id': get_player_id(sid),
                        'api_key': get_api_key(sid)
                    }
                    adventure_id = await game_data_collection.insert_one(adventure).inserted_id
                   
                    for char in characters:
                        await game_data_collection.update_one({'_id': char['_id']}, {'$set': {'activeAdventure': {'name': adventure['name'], '_id': adventure_id}}, '$push': {'adventures': {'name': adventure['