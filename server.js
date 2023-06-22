// Import required modules
import { Configuration, OpenAIApi } from "openai";
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';

const mongoUri = "mongodb://localhost/?retryWrites=true";
const client = new MongoClient(mongoUri,{ forceServerObjectId: true });
try {
  await client.connect();
} catch (error) {
  console.error('Error connecting to MongoDB:', error);
}
const database = client.db('ddgpt');
const settingsCollection = database.collection('settings'), gameDataCollection = database.collection('gameData'), responseCollection = database.collection('allResponses');

const timers = {};

// Set up the app/web/io server
const app = express(), server = http.createServer(app), io = new SocketIO(server);
const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);

// Start the web server
server.listen(process.env.PORT || 9000);

//configure the web server, serv from the public folder
app.use(express.static(join(__dirname, 'public')));
//client.js is in root dir with server.js
app.get('/client.js', (req, res) => { res.set('Content-Type', 'text/javascript'); res.sendFile(join(__dirname, 'client.js')); });
//send public/index.html if no specific file is requested
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

gameDataCollection.updateMany({type:'player'},{$set:{connected:false}});

if (1 == 2){
  //testing out new openai functions
  let message = await gameDataCollection.findOne({_id: new ObjectId("648a23b822b92b61b83a119c")});
  let settings = await getSetting('');
  let systemMessage = settings.messages.croupier_system2;
  let diceFunction = settings.messages.croupier_dice_function.json;

  let messages = [
    {content:systemMessage.content,role:systemMessage.role},
    {content:message.content,role:'user'}
  ];
  let functions = [
    diceFunction
  ];

  let response = ''
  if (settings.forReal){
    response = await openaiCall2(
      messages,
      functions,
      settings.cru_model,
      Number(settings.cru_temperature),
      Number(settings.cru_maxTokens),
      settings.apiKey
    );
  } else {
    response = [
      messages,
      {functions: JSON.stringify(functions,null,2)},
      settings.cru_model,
      Number(settings.cru_temperature),
      Number(settings.cru_maxTokens),
      settings.apiKey
    ];
  }

  console.log(response);

}

io.on('connection', async (socket) => {
  // Get the user id, auth token and IP from handshake
  let playerName = socket.handshake.auth.playerName || '', clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address, authNonce = socket.handshake.auth.authNonce || '';
  let showCharacters = 'Own', showActiveAdventures = true;
  playerName = playerName.trim().replace(/[^a-zA-Z0-9]/g,'');
  console.log('User connected: '+playerName+'\nFrom: '+clientIp);

  let playerData = await fetchPlayerData(playerName)
  if ( playerData ) {
    //Valid Player, let make sure it is really them
    if (playerData.name == playerName && playerData.authNonce == authNonce && authNonce != '') {
      console.log('player had his nonce');
      //update database of new logon, should I add IP? - what if mobile or at friend?
    } else if (playerData.authNonce != authNonce && playerData.name == playerName && playerData.ipList.includes(clientIp)) {
      console.log('give '+playerName+' his nonce');
      socket.emit('nonce',playerData.authNonce);
    } else {
      socket.emit("error","user not authenticated");
      socket.disconnect();
      console.log('player '+playerName+' did not have nonce and did not have IP - Kicked');
    }
  } else {
    console.log("add player "+playerName);
    playerData = await addPlayer(playerName,socket,clientIp);
    if (!playerData) {
      socket.emit("error",'Could not add user with name "'+playerName+'"');
      socket.disconnect();
    }
  }

  gameDataCollection.updateOne({type:'player',name:playerName},{$set:{connected:true}});
  if (playerData.admin){
    socket.emit('serverRole','admin')
  }

  //timers[("player_"+playerName)] = { activityTimer:(setTimeout(() => { handleInactivity(socket,playerName); }, ( 30 * 1000 )))};
  
  // Log all recieved events/data
  socket.onAny((event, ...args) => {
    if (event != 'save'){
      console.log('['+new Date().toUTCString()+'] playerName('+playerName+'), socket('+event+')', args);
    }
  });
  socket.on('save', data => {
    if (playerData.admin){
      console.log('Player '+playerName+' saved');
      socket.to('System').emit('settings', data)
      saveSettings(data,socket);
    } else {
      console.log('Player '+playerName+' tried to save');
      socket.emit("error","user not admin");
      socket.disconnect();
    }
  });
  socket.on('saveChar', async data => {
    console.log('Player '+playerName+' saving char '+data.data.name);
    //socket.to('System').emit('settings', data)
    let charData = await gameDataCollection.findOne({_id:new ObjectId(data._id)});
    if (charData) {
      if (playerData.admin || charData.owner_id.toString() == playerData._id.toString()){
        try {
          data.data.owner_id = new ObjectId(data.owner_id);
          gameDataCollection.updateOne({_id:new ObjectId(data._id)},{$set:data.data});
          let message = {message:'Character '+data.data.name+' saved.',color:'green',timeout:1500};
          socket.emit('alertMsg',message);
        } catch(error) {
          let message = {message:'Character '+data.data.name+' not saved!',color:'red',timeout:5000};
          console.error('error saving',error);
          socket.emit('alertMsg',message);
        }
      } else {
        let message = {message:'no access - Character '+data.data.name+' not saved!',color:'red',timeout:5000}
        socket.emit('alertMsg',message);
      }
    }
  });
  socket.on('showCharOption', data =>{
    //sets the variable for this socket to show all charaters or current living ones
    if (data == 'All' || data == 'Own') {
      showCharacters = data;
    } else {
      let message = {message:'Invalid response!',color:'red',timeout:5000}
      socket.emit('alertMsg',message);
    }
  });
  socket.on('listOwners', async () => {
    //TODO limit the owner list for non-admins
    let owners = await gameDataCollection.find({type:'player'}).project({name:1,_id:1}).toArray();
    socket.emit('listedOwners',owners);
  });
  socket.on("saveplaying", data => {
    console.log("saveplaying for user:",playerName)
    //gameStatePublic.players[playerName].playing = data;
    saveState();
  });
  socket.on('disconnect', () => {
    console.log('Player disconnected:', playerName);
    gameDataCollection.updateOne({type:'player',name:playerName},{$set:{connected:false}});
  });
  socket.on('changeName', async newName => {
    console.log('Player changing name from '+playerName+' to '+newName);
    let test = await fetchPlayerData(newName)
    console.log(test)
    if (test) {
      socket.emit("error","player name already taken");
    } else {
      let rc = await updatePlayer(playerName,{$set:{name:newName}})
      if (rc == 'success') {
        socket.emit("nameChanged",newName);
        playerName = newName;
      } else {
        socket.emit("error","error changing name");
      }
    }
  });
  socket.on('fetchHistory', async id => {
    let query = ''
    if (playerData.admin) {
      query = {_id:new ObjectId(id)};
      let history = await responseCollection.findOne(query);
      if (history){
        socket.emit('historyData',history);
      } else {
        socket.emit('error','could not find history with ID: '+id);
      }    
    }
  });
  socket.on('fetchCharData', async id => {
    let query = ''
    if (playerData.admin) {
      query = {_id:new ObjectId(id)}
    } else {
      query = {_id:new ObjectId(id),owner_id:playerData._id}
    }
    let charData = await gameDataCollection.findOne(query);
    if (charData){
      socket.emit('charData',charData);
    } else {
      socket.emit('error','could not find character with ID: '+id)
    }
  });
  socket.on('scotRun',async data =>{
    let message = {message:'Message recieved, running!',color:'green',timeout:10000}
    socket.emit('alertMsg',message);
    let messages = [{role:'system',content:data.systemmessage},
                    {role:'assistant',content:data.assistantmessage},
                    {role:'user',content:data.user}
                   ]
    let response = await openaiCall(messages,data.model,Number(data.temperature),Number(data.maxTokens),data.apikey)
    socket.emit('ScotRan',response.content);
  });
  socket.on('fetchAllAdventureHistory',async adventure_id =>{
    if (adventure_id.length == 24){
      sendAdventureData(adventure_id,socket);
      socket.join('Adventure-'+adventure_id);
    }
  });
  socket.on('approveAdventureInput',async UserInput =>{
    let settings = await getSetting('');

    UserInput.approverName = playerName;
    UserInput.adventure_id = new ObjectId(UserInput.adventure_id);
    UserInput.date = new Date().toUTCString();
    UserInput.type = 'message';
    if (settings.forReal){
      try {
        gameDataCollection.insertOne(UserInput,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }
    }
    io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEvent',UserInput);
    
    continueAdventure(UserInput.adventure_id);
  });
  socket.on('suggestAdventureInput',async UserInput =>{
    if (UserInput.content.length > 1) {
      UserInput.playerName = playerName;
      io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEventSuggest',UserInput);
    }
  });
  socket.on('endAdventure',async adventure_id =>{
    completeAdventure(new ObjectId(adventure_id));
  });
  socket.on('listActiveAdventure',async data =>{
    showActiveAdventures = data;
  });
  socket.on('beginAdventure',async adventure_id =>{
    adventure_id = new ObjectId(adventure_id);
    let adventure = await gameDataCollection.findOne({_id:new ObjectId(adventure_id),state:'forming',type:'adventure'});
    if (adventure.owner_id == playerData._id || playerData.admin) {
      //await gameDataCollection.updateMany({owner_id:playerData._id,type:'character'},{$pull:{adventures:{_id:adventure._id}}});
      //await gameDataCollection.updateMany({owner_id:playerData._id,type:'character'},{$push:{adventures:{name:adventure.name,_id:adventure._id}}});
      await gameDataCollection.updateOne({_id:adventure_id,type:'adventure'},{$set:{state:'discovery'}});
      await startAdventure(adventure);
      await gameDataCollection.updateOne({_id:adventure_id,type:'adventure'},{$set:{state:'active'}});
    }
  });
  socket.on('joinParty',async adventure_id =>{
    let adventure = await gameDataCollection.findOne({_id:new ObjectId(adventure_id),state:'forming',type:'adventure'});
    let myCharacters = await gameDataCollection.find({owner_id:playerData._id,type:'character'}).project({_id:1,name:1}).toArray();
    await gameDataCollection.updateMany({owner_id:playerData._id,type:'character'},{$set:{activeAdventure:{name:adventure.name,_id:adventure._id}},$pull:{adventures:{_id:adventure._id}}});
    await gameDataCollection.updateMany({owner_id:playerData._id,type:'character'},{$push:{adventures:{name:adventure.name,_id:adventure._id}}});
    await gameDataCollection.updateOne({_id:adventure._id,type:'adventure'},{$push:{characters:{$each:myCharacters}}});
    let message = {message:'Party Joined',color:'green',timeout:3000}
    socket.emit('alertMsg',message);    
  });
  socket.on('createParty',async NewName =>{
    let character_ids = await gameDataCollection.find({type:'character',owner_id:playerData._id}).project({_id:1}).toArray();
    let document = {
      type:'adventure',
      party_name:NewName,
      name:(NewName+': <forming>'),
      state:'forming',
      characters:character_ids,
      owner_id:playerData._id
    }
    await gameDataCollection.updateOne({owner_id:playerData._id,state:'forming',type:'adventure'},{$set:document},{ upsert: true });
    let adventure = await gameDataCollection.findOne({owner_id:playerData._id,state:'forming',type:'adventure'});
    await gameDataCollection.updateMany({owner_id:playerData._id,type:'character'},{$set:{activeAdventure:{name:adventure.name,_id:adventure._id}},$pull:{adventures:{_id:adventure._id}}});
    await gameDataCollection.updateMany({owner_id:playerData._id,type:'character'},{$push:{adventures:{name:adventure.name,_id:adventure._id}}});
    let message = {message:'Party Forming',color:'green',timeout:3000}
    socket.emit('alertMsg',message);

  });
  socket.on('tab',async tabName =>{    playerData = await fetchPlayerData(playerName);
    updatePlayer(playerName,{$set:{tabName:tabName}});
    //remove player from old tab channel
    if (tabName == 'Home'){
      socket.join('Tab-'+tabName);
      //send friends or if admin send all if selected
      if (playerData.admin){
        let connectedPlayers = await gameDataCollection.find({type:'player',connected:true}).project({name:1,_id:-1}).toArray();
        socket.emit('connectedPlayers',connectedPlayers);
      }
      let formingParties = await gameDataCollection.find({type:'adventure',state: 'forming'}).project({party_name:1,_id:-1}).toArray();
      socket.emit('formingParties',formingParties);

    } else if (tabName == 'Characters'){
      socket.join('Tab-'+tabName);
      let characterNames = ''
      if (showCharacters == 'All'){
        if (playerData.admin) {
          characterNames = await gameDataCollection.find({type:'character'}).project({name:1,_id:1}).toArray();
        } else {
          characterNames = await gameDataCollection.find({type:'character',owner_id:playerData._id}).project({name:1,_id:1}).toArray();
        }
      } else {
        characterNames = await gameDataCollection.find({type:'character',state:'alive',owner_id:playerData._id}).project({name:1,_id:1}).toArray();
      }
      if (characterNames) {
        socket.emit('charList',characterNames);
      }
    } else if (tabName == 'Adventures'){
      socket.join('Tab-'+tabName);
      let advetureNames = ''
      if (showActiveAdventures){
        advetureNames = await gameDataCollection.distinct('activeAdventure',{type:'character',owner_id: new ObjectId(playerData._id)})
      } else {
        if (playerData.admin){
          advetureNames = await gameDataCollection.find({type:'adventure'}).project({name:1,_id:1}).toArray();
        } else {
          advetureNames = await gameDataCollection.distinct('adventures',{type:'character',owner_id: new ObjectId(playerData._id)})
          console.log('in',advetureNames);
        }
        //advetureNames = await gameDataCollection.find({type:'adventure'}).project({name:1,_id:1}).toArray();
      }
      if (advetureNames != ''){
        socket.emit('adventureList',advetureNames);
      }
    } else if (tabName == 'System' && playerData.admin) {
      socket.join('Tab-'+tabName);
      let allSettings = await getSetting('');
      delete allSettings.apiKey;
      delete allSettings._id;
      socket.emit('settings',allSettings);
    } else if (tabName == 'ScotGPT' && playerData.admin) {
      socket.join('Tab-'+tabName);
    } else if (tabName == 'History' && playerData.admin) {
      console.log('History');
      socket.join('Tab-'+tabName);
      let history = await responseCollection.find({}).project({date:1,_id:1,created:1}).sort({created:-1}).toArray()
      socket.emit('historyList',history)
    } else {
      console.log('unknown tabName',tabName);
      socket.emit('error','unknown tab')
    }
  });
});
async function fetchPlayerData(playerName) {
  let findFilter = {name:playerName,type:'player'}, playerData = ''
  try {
    playerData = await gameDataCollection.findOne(findFilter);
    return playerData;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
async function handleInactivity(socket,playerName) {
  clearTimeout(turnTimeout);
  turnTimeout = null;
  if (Object.values(gameStatePublic.players).filter((player) => player.connected).length > 1) {
    console.log("Slap "+playerName);
    
    if (gameStatePublic.players[playerName].connected){
      socket.emit("slap",playerName);
    }
    
    sendState(socket);
  }

}
async function saveSettings(data,socket){
  try {
    await settingsCollection.updateOne({}, { $set: data }, { upsert: true });
    let message = {message:'Settings saved.',color:'green',timeout:3000}
    socket.emit('alertMsg',message);
    io.sockets.in('Tab-System').emit('settings',data);
  } catch (error) {
    console.error('Error updating settings:', error);
    socket.emit('error',error)
  }
}
async function addPlayer(playerName,socket,clientIp) {
  if (playerName.length > 0){
    console.log('adding user: '+playerName);
    let nonce = crypto.randomBytes(64).toString('base64');
    socket.emit('nonce',nonce)
    let playerDoc = {
      name: playerName,
      type: 'player',
      ipList: [ clientIp ],
      authNonce: nonce
    }
    try {
      await gameDataCollection.insertOne(playerDoc,{safe: true});
      return playerDoc
    } catch (error){
      console.error('Error saving response to MongoDB:', error);
    }
  }
}
async function updatePlayer(playerName,update) {
  try {
    await gameDataCollection.updateOne({type:'player',name:playerName},update);
    return 'success'
  } catch (error){
    console.error('Error saving response to MongoDB:', error);
  }
}
async function CreateCharTable(characters){
  let table = 'Name      ', attributes = ["Race","Gender","Lvl","STR","DEX","CON","INT","WIS","CHA","HP","AC","Weapon","Armor","Class","Inventory","Backstory"];
  let attributesLen = [10,6,3,3,3,3,3,3,3,2,2,24,17,9,1,1], spaces = '                   ';
  for (let i = 0 ; i < attributes.length; i++){
    table+='|'+attributes[i];
    if (attributes[i].length < attributesLen[i]){
      table+=spaces.substring(0,attributesLen[i]-attributes[i].length);
    };
  };
  table+=' or Abilities'
  characters.forEach((CharData) => {
    table+='\n'+CharData.name;
    if (CharData.name.length < 10){
      table+=spaces.substring(0,10-CharData.name.length);
    }
    for (let i = 0 ; i < attributes.length; i++){
      table+='|'+CharData.details[attributes[i]];
      if ((''+CharData.details[attributes[i]]).length < attributesLen[i]){
        table+=spaces.substring(0,attributesLen[i]-(''+CharData.details[attributes[i]]).length)
      }
    };
  });
  return table;
}
async function ServerEvery1Second() {
  if (!gameStatePublic.gameover) {
    //let CurrentPlayer = getCurrentPlayer();
    //console.log("current player: "+CurrentPlayer);
    //let PlayerCount = Object.values(gameStatePublic.players).filter((player) => player.playing).length;
    //console.log("player count: "+PlayerCount);
  }
}
async function saveResponse(responseRaw){
  let response = {}
  if (responseRaw.status) {
    response.status = responseRaw.status
  }
  if (responseRaw.statusText) {
    response.statusText = responseRaw.statusText
  }
  if (responseRaw.date) {
    response.date = responseRaw.date
  } else if (responseRaw.headers.date) {
    response.date = responseRaw.headers.date
  }
  if (responseRaw['headers']['openai-processing-ms']) {
    response.duration = responseRaw['headers']['openai-processing-ms']
  }
  if (responseRaw.headers['openai-version']) {
    response.openaiversion = responseRaw.headers['openai-version']
  }
  if (responseRaw.headers['x-request-id']) {
    response.xrequestid = responseRaw.headers['x-request-id']
  }
  if (responseRaw.config.data) {
    response.request = responseRaw.config.data
  }
  if (responseRaw.config.url) {
    response.url = responseRaw.config.url
  }
  if (responseRaw.data){
    if (responseRaw.data.id) {
      response.id = responseRaw.data.id
    }
    if (responseRaw.data.object) {
      response.type = responseRaw.data.object
    }
    if (responseRaw.data.created) {
      response.created = responseRaw.data.created
    } else if (response.date) {
      response.created = Math.round(new Date(response.date).getTime()/1000);
    }
    if (responseRaw.data.model) {
      response.model = responseRaw.data.model
    }
    if (responseRaw.data.usage){
      if (responseRaw.data.usage.prompt_tokens) {
        response.prompt_tokens = responseRaw.data.usage.prompt_tokens
      }
      if (responseRaw.data.usage.completion_tokens) {
        response.completion_tokens = responseRaw.data.usage.completion_tokens
      }
      if (responseRaw.data.usage.total_tokens) {
        response.tokens = responseRaw.data.usage.total_tokens
      }
    }
    if (responseRaw.data.choices){
      if (responseRaw.data.choices[0].message.content) {
        response.response = responseRaw.data.choices[0].message.content
      } else {
        response.response = JSON.stringify(responseRaw.data.choices)
      }
      response.responseRaw = JSON.stringify(responseRaw.data.choices[0])
      if (responseRaw.data.choices[0].finish_reason) {
        response.finish_reason = responseRaw.data.choices[0].finish_reason
      }
    }
  }
  try {
    await responseCollection.insertOne(response);
  } catch (error) {
    console.error('Error saving response to MongoDB:', error);
  }
};
async function openaiCall(messages, model, temperature, maxTokens, apiKey) {
  temperature = Number(temperature);
  maxTokens = Number(maxTokens);
  try {
    let openai = new OpenAIApi(new Configuration({apiKey: apiKey}));
    const response = await openai.createChatCompletion({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    });
    
    saveResponse(response);
    // Extract the generated response from the API
    const generatedResponse = {
      content:response.data.choices[0].message.content,
      date:response.headers.date,
      role:response.data.choices[0].message.role,
      id:response.data.id
    }
    
    return generatedResponse;
  } catch (error) {
    console.error('Error generating response from OpenAI:', error);
    let generatedResponse = '['+new Date().toUTCString()+']'
    if (error.response) {
      generatedResponse += " Status: "+error.response.status+", "+error.response.statusText;
    }
    if (error.errno) {
      generatedResponse += " errno: "+error.errno;
    }
    if (error.code) {
      generatedResponse += " code: "+error.code;
    }
    try {
      saveResponse(error.response);
    } catch (error2) {console.log(error2)}
    return {content:generatedResponse}
  }
}
async function openaiCall2(messages,functions, model, temperature, maxTokens, apiKey) {
  temperature = Number(temperature);
  maxTokens = Number(maxTokens);
  try {
    let openai = new OpenAIApi(new Configuration({apiKey: apiKey}));
    const response = await openai.createChatCompletion({
      model: model,
      messages: messages,
      functions: functions,
      temperature: temperature,
      max_tokens: maxTokens
    });
    
    saveResponse(response);
    console.log(JSON.stringify(response.data.choices[0]));
    // Extract the generated response from the API
    const generatedResponse = {
      content:response.data.choices[0].message.content,
      date:response.headers.date,
      role:response.data.choices[0].message.role,
      id:response.data.id
    }
    
    return generatedResponse;
  } catch (error) {
    console.error('Error generating response from OpenAI:', error);
    let generatedResponse = '['+new Date().toUTCString()+']'
    if (error.response) {
      generatedResponse += " Status: "+error.response.status+", "+error.response.statusText;
    }
    if (error.errno) {
      generatedResponse += " errno: "+error.errno;
    }
    if (error.code) {
      generatedResponse += " code: "+error.code;
    }
    try {
      saveResponse(error.response);
    } catch (error2) {console.log(error2)}
    return {content:generatedResponse}
  }
}
async function getSetting(setting){
  //get setting from database
  let dbsetting = await settingsCollection.findOne({});
  if (setting.length > 0) {
    dbsetting = dbsetting[setting];
  };
  return dbsetting
}
async function formatStartMessages(settings,adventure_id){
  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':adventure_id}).toArray();
  let charTable = await CreateCharTable(characters);

  let dmSystemMessage = settings.messages.dm_system;
  let assistantCharTable = settings.messages.dm_char_table;
  let assistantMessageLast = settings.messages.dm_create_adventure;

  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${char_count}',characters.length);
  console.log(characters)
  let level = (characters.reduce((prev, curr) => prev.details.Lvl < curr.details.Lvl ? prev : curr)).details.Lvl;
  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${next_level}',level);
  assistantCharTable.content = assistantCharTable.content.replaceAll('${CharTable}',charTable);

  let messages = [
    {content:dmSystemMessage.content,role:dmSystemMessage.role},
    {content:assistantCharTable.content,role:assistantCharTable.role},
    {content:assistantMessageLast.content,role:assistantMessageLast.role}
  ]
  return messages
}
async function formatAdventureMessages(settings,adventure_id){
  let allMessages = await gameDataCollection.find({type:'message',adventure_id:adventure_id}).sort({created:1}).toArray();
  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':adventure_id}).toArray();
  let charTable = await CreateCharTable(characters);

  let dmSystemMessage = settings.messages.dm_system;
  let assistantCharTable = settings.messages.dm_char_table;
  let assistantMessageLast = settings.messages.dm_continue_adventure;

  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${char_count}',characters.length);
  let level = (characters.reduce((prev, curr) => prev.details.Lvl < curr.details.Lvl ? prev : curr)).details.Lvl;
  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${next_level}',level);
  assistantCharTable.content = assistantCharTable.content.replaceAll('${CharTable}',charTable);

  let messages = [
    {content:dmSystemMessage.content,role:dmSystemMessage.role},
    {content:assistantCharTable.content,role:assistantCharTable.role}
  ]
  for (let i = 0 ; i < allMessages.length; i++){
    if (!allMessages[i].originMessage){
      //need to adjust to only use summaries if prompt tokens are high
      if (allMessages[i].summary && settings.useSummary){
        allMessages[i].content = allMessages[i].summary;
      }
      messages.push({content:allMessages[i].content,role:allMessages[i].role})
    }
  }
  messages.push({content:assistantMessageLast.content,role:assistantMessageLast.role})
  return messages
}
async function formatSummaryMessages(settings,content){
  let croupier_system = settings.messages.croupier_system;
  let croupier_summary = settings.messages.croupier_summary;

  let messages = [
    {content:croupier_system.content,role:croupier_system.role},
    {content:croupier_summary.content,role:croupier_summary.role},
    {content:content,role:'user'}
  ];

  return messages
}
async function formatCroupierMessages(settings,content,adventure_id){
  let croupier_system = settings.messages.croupier_system;
  let croupier_assistant = settings.messages.croupier_assistant;
  let croupier_characters = settings.messages.croupier_characters;
  let croupier_end = settings.messages.croupier_end;
  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':adventure_id}).toArray();

  //the croupier needs to know information about the party to generate good responses
  croupier_characters.content = croupier_characters.content.replaceAll('${char_count}',characters.length);
  let character_info = characters[0].name+" is a "+characters[0].details.Class
  for (let i = 1 ; i < characters.length; i++){
    character_info += '\n'+characters[i].name+" is a "+characters[i].details.Class
  }
  croupier_characters.content = croupier_characters.content.replaceAll('${char_list}',character_info);
  
  let messages = [
    {content:croupier_system.content,role:croupier_system.role},
    {content:croupier_assistant.content,role:croupier_assistant.role},
    {content:croupier_characters.content,role:croupier_characters.role},
    {content:content,role:'user'},
    {content:croupier_end.content,role:croupier_end.role}
  ];

  return messages
}
async function sendAdventureData(adventure_id,socket){
  let adventureMessages = await gameDataCollection.find({type:'message',adventure_id:new ObjectId(adventure_id)}).sort({created:1}).toArray();
  let adventureData = await gameDataCollection.findOne({type:'adventure',_id:new ObjectId(adventure_id)});
  if (adventureData){
    adventureData.messages = adventureMessages;
  } else {
    adventureData = {messages:adventureMessages};
  }
  socket.emit('AllAdventureHistory',adventureData);
}
async function startAdventure(adventure){
  let settings = await getSetting('');
  let adventure_id = adventure._id;
  let messages = await formatStartMessages(settings,adventure_id)

  io.sockets.in('Adventure-'+adventure_id).emit('continueAdventure',true); //put the confidence builder dots in chat
  if (settings.forReal){
    let openAiResponse = await openaiCall(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens),settings.apiKey)
    if (openAiResponse.id) {
      openAiResponse.type = 'message';
      openAiResponse.adventure_id = adventure._id;
      openAiResponse.originMessage = true;
      openAiResponse.created = Math.round(new Date(allMessages[i].date).getTime()/1000);

      io.sockets.in('Adventure-'+adventure_id).emit('adventureEvent',openAiResponse);
      try {
        gameDataCollection.insertOne(openAiResponse,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }
    } else {
      //something went wrong getting creating adventure
    }
  } else {
    console.log(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens));
    setTimeout(()=> {io.sockets.in('Adventure-'+adventure_id).emit('adventureEvent',{role:'assistent',content:'fake'})}, 3000);
  }  
}
async function completeAdventure(adventure_id){
  //mark adventure as over, remove active adventure from chars
  let adventureData = await gameDataCollection.findOne({type:'adventure',_id:new ObjectId(adventure_id)});
  if (adventureData.state == 'forming') {
    try {
      gameDataCollection.deleteOne({type:'adventure',_id:new ObjectId(adventure_id)});
      gameDataCollection.updateMany({type:'character','activeAdventure._id':new ObjectId(adventure_id)},{$pull:{adventures:{_id:new ObjectId(adventure_id)}}});
      gameDataCollection.updateMany({type:'character','activeAdventure._id':new ObjectId(adventure_id)},{$unset:{activeAdventure:1}});
    } catch (error) {
      console.error('Error removing adventure:', error);
    }
  } else {
    try {
      gameDataCollection.updateOne({type:'adventure',_id:new ObjectId(adventure_id)},{$set:{state:'succeeded'}});
      gameDataCollection.updateMany({type:'character','activeAdventure._id':new ObjectId(adventure_id)},{$unset:{activeAdventure:1}});
      sendAdventureData(adventure_id,io.sockets.in('Adventure-'+adventure_id));
    } catch (error) {
      console.error('Error ending adventure:', error);
    }
  }
  //level up character
}
async function continueAdventure(adventure_id){
  io.sockets.in('Adventure-'+adventure_id).emit('continueAdventure',true); //put the confidence builder dots in chat
  let settings = await getSetting('');
  let apiKey = settings.apiKey; //should this be by adventure?
  let openAiResponse;

  let messages = await formatAdventureMessages(settings,adventure_id)
  if (settings.forReal){
    openAiResponse = await openaiCall(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens),apiKey)
    if (openAiResponse.id) {
      openAiResponse.type = 'message';
      openAiResponse.adventure_id = adventure_id;
      openAiResponse.created = Math.round(new Date(allMessages[i].date).getTime()/1000);
      io.sockets.in('Adventure-'+adventure_id).emit('adventureEvent',openAiResponse);
      try {
        gameDataCollection.insertOne(openAiResponse,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }

      if (settings.doSummary) {
        messages = await formatSummaryMessages(settings,openAiResponse.content);
        let summaryResponse = openaiCall(messages,settings.cru_model,Number(settings.cru_temperature),Number(settings.cru_maxTokens),apiKey);
        summaryResponse.then((response) => {
          if (response.id){
            try {
              gameDataCollection.updateOne({type:'message',id:openAiResponse.id},{$set:{summary:response.content}});
            } catch (error) {
              console.error('Error saving summary response to MongoDB:', error);
            }
          } else {
            //something went wrong with summary
          }
        })
      }

      //get system data and enhance the experiance
      messages = await formatCroupierMessages(settings,openAiResponse.content,adventure_id)
      let croupierResponse = await openaiCall(messages,settings.cru_model,Number(settings.cru_temperature),Number(settings.cru_maxTokens),apiKey);
      if (croupierResponse.id){
        //we got data back, is it json?
        try {
          gameDataCollection.updateOne({type:'message',id:openAiResponse.id},{$set:{croupier:croupierResponse.content}});
        } catch (error) {
          console.error('Error saving summary response to MongoDB:', error);
        }

        let json = JSON.parse(croupierResponse.content)
        if (json.adventure_completed) {
          if (json.adventure_completed.toLowerCase() == "yes"){
            io.sockets.in('Adventure-'+adventure_id).emit('adventureEndFound',true); //we found it, but lets have the players decide if it is right
          }
        }
        //other stuff?
      } else {
        //something went wrong getting croupier data
      }
    } else {
      //something went wrong getting adventure message
    }
  } else {
    console.log(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens));
    setTimeout(()=> {io.sockets.in('Adventure-'+adventure_id).emit('adventureEvent',{role:'assistent',content:'fake'})}, 3000);
    if (settings.doSummary) {
      messages = formatSummaryMessages(settings,"Fake response from Previous fake")
      console.log(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens));
    }
  }
}
