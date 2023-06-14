// Import required modules
import { Configuration, OpenAIApi } from "openai";
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';
import { write } from "fs";
import { table } from "console";

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

// Set up the web/io server
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

//const openai = new OpenAIApi(new Configuration({apiKey: getSetting('apiKey')}));

if (1 == 1){
  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':new ObjectId("6478094ce25df0c428be1c1c")}).toArray();
  console.log(JSON.stringify(characters));
}

if (1 == 2) {
  //let adventureData = await gameDataCollection.find({type:'adventure',_id:new ObjectId(UserInput.adventure_id)}).sort({date:1}).toArray();
  //let adventureMessages = await gameDataCollection.find({type:'message',adventure_id:new ObjectId(UserInput.adventure_id)}).sort({date:1}).project({content:1,role:1,_id:0}).toArray();
  //let originMessage = await gameDataCollection.findOne({type:'message',_id:new ObjectId("64726949d07686df087cf7cf")});
  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':new ObjectId("6478094ce25df0c428be1c1c")}).toArray();
  let charTable = await CreateCharTable(characters);
  let settings = await getSetting('');
  let dmSystemMessage = settings.messages.dm_system;
  let assistantCharTable = settings.messages.dm_char_table
  let assistantMessageLast = settings.messages.dm_create_adventure
  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${char_count}',characters.length);
  //needs work, static set to level 2, need to set to floor + 1 of characters.detail.lvl
  dmSystemMessage.content = dmSystemMessage.content.replaceAll('${next_level}',"2");
  assistantCharTable.content = assistantCharTable.content.replaceAll('${CharTable}',charTable);

  let messages = [
    {content:dmSystemMessage.content,role:dmSystemMessage.role},
    {content:assistantCharTable.content,role:assistantCharTable.role},
    {content:assistantMessageLast.content,role:assistantMessageLast.role}
  ];
  console.log("charaters",characters)
  console.log("api:",{messages:messages,model:settings.model,temperature:Number(settings.temperature),maxTokens:Number(settings.maxTokens)})
  let openAiResponse = await openaiCall(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens),settings.apiKey)
  openAiResponse.type = 'message';
  openAiResponse.adventure_id = new ObjectId("6478094ce25df0c428be1c1c");
  openAiResponse.originMessage = true;
  if(openAiResponse.allResponse_id){
    try {
      gameDataCollection.insertOne(openAiResponse,{safe: true});
    } catch (error) {
      console.error('Error saving response to MongoDB:', error);
    }
  }
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
    data.data.owner_id = (''+data.owner_id).replace(/[^a-f0-9]/g,'');
    data._id = (''+data._id).replace(/[^a-f0-9]/g,'');
    if (data.data.owner_id.length == 24 && data._id.length == 24) {
      if (playerData.admin || data.data.owner_id == playerData._id){
        data.data.owner_id = new ObjectId(data.data.owner_id);
        try {
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
    } else {
      let message = {message:'Invalid ID - Character '+data.data.name+' not saved!',color:'red',timeout:5000}
      socket.emit('alertMsg',message);
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
    let charData = await gameDataCollection.findOne(query)
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
    let adventureMessages = await gameDataCollection.find({type:'message',adventure_id:new ObjectId(adventure_id)}).sort({date:1}).toArray();
    socket.emit('AllAdventureHistory',adventureMessages);
    socket.join('Adventure-'+adventure_id);
  });
  socket.on('approveAdventureInput',async UserInput =>{
    let forReal = true;
    UserInput.approverName = playerName;
    UserInput.adventure_id = new ObjectId(UserInput.adventure_id);
    UserInput.date = new Date().toUTCString();
    UserInput.type = 'message';
    if (forReal){
      try {
        gameDataCollection.insertOne(UserInput,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }
    }
    io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEvent',UserInput);

    let originMessage = await gameDataCollection.findOne({type:'message',originMessage:true,adventure_id:UserInput.adventure_id});
    let allMessages = await gameDataCollection.find({type:'message',adventure_id:UserInput.adventure_id}).toArray();
    let characters = await gameDataCollection.find({type:'character','activeAdventure._id':UserInput.adventure_id}).toArray();
    let charTable = await CreateCharTable(characters);
    let settings = await getSetting('');

    let dmSystemMessage = settings.messages.dm_system;
    let assistantCharTable = settings.messages.dm_char_table
    let assistantMessageLast = settings.messages.dm_continue_adventure

    let cru_SystemMessage = settings.messages.croupier_system;
    let croupier_narrator = settings.messages.croupier_summary;

    dmSystemMessage.content = dmSystemMessage.content.replaceAll('${char_count}',characters.length);
    //needs work, static set to level 2, need to set to floor + 1 of characters.detail.lvl
    dmSystemMessage.content = dmSystemMessage.content.replaceAll('${next_level}',"2");
    assistantCharTable.content = assistantCharTable.content.replaceAll('${CharTable}',charTable);

    let messages = [
      {content:dmSystemMessage.content,role:dmSystemMessage.role},
      {content:assistantCharTable.content,role:assistantCharTable.role},
      {content:originMessage.content,role:originMessage.role}
    ]
    for (let i = 0 ; i < allMessages.length; i++){
      if (!allMessages[i].originMessage){
        if (allMessages[i].summary){
          allMessages[i].content = allMessages[i].summary;
        }
        messages.push({content:allMessages[i].content,role:allMessages[i].role})
      }
    }
    messages.push({content:UserInput.content,role:'user'})
    messages.push({content:assistantMessageLast.content,role:assistantMessageLast.role})

    let openAiResponse = '', cru_openAiResponse = '';
    if (forReal){
      openAiResponse = await openaiCall(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens),settings.apiKey)
    } else {
      console.log(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens));
      openAiResponse = {content:"Something that came from the ai"}
    }
    openAiResponse.type = 'message';
    openAiResponse.adventure_id = UserInput.adventure_id;
    io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEvent',openAiResponse);

    let cru_messages = [
      {content:cru_SystemMessage.content,role:cru_SystemMessage.role},
      {content:croupier_narrator.content,role:croupier_narrator.role},
      {content:openAiResponse.content,role:'assistant'}
    ];
    if (forReal) {
      cru_openAiResponse = await openaiCall(cru_messages,settings.cru_model,Number(settings.cru_temperature),Number(settings.cru_maxTokens),settings.apiKey)
    } else {
      console.log(cru_messages,settings.cru_model,Number(settings.cru_temperature),Number(settings.cru_maxTokens),settings.apiKey);
      cru_openAiResponse = {content:"some summary"}
    }

    openAiResponse.summary = cru_openAiResponse.content;
    if (forReal){
      try {
        gameDataCollection.insertOne(openAiResponse,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }
    }

  });
  socket.on('suggestAdventureInput',async UserInput =>{
    UserInput.playerName = playerName;
    io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEventSuggest',UserInput);
  });
  socket.on('tab',async tabName =>{
    playerData = await fetchPlayerData(playerName);
    updatePlayer(playerName,{$set:{tabName:tabName}});
    //remove player from old tab channel
    if (tabName == 'Home'){
      socket.join('Tab-'+tabName);
      //send friends or if admin send all if selected
      if (playerData.admin){
        let connectedPlayers = await gameDataCollection.find({type:'player',connected:true}).project({name:1,_id:-1}).toArray();
        socket.emit(connectedPlayers);
      }
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
        //if (playerData.admin){
        //  advetureNames = await gameDataCollection.find({type:'adventure'}).project({name:1,_id:1}).toArray();
        //} else {
          advetureNames = await gameDataCollection.distinct('activeAdventure',{type:'character',owner_id: new ObjectId(playerData._id)})
        //}
      } else {
        advetureNames = await gameDataCollection.find({type:'adventure',state:'active'}).project({name:1,_id:1}).toArray();
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
  let response = {
    status: responseRaw.status,
    statusText: responseRaw.statusText,
    date:responseRaw.headers.date,
    duration:responseRaw['headers']['openai-processing-ms'],
    openaiversion:responseRaw.headers['openai-version'],
    xrequestid:responseRaw.headers['x-request-id'],
    request:responseRaw.config.data,
    url:responseRaw.config.url,
    id:responseRaw.data.id,
    type:responseRaw.data.object,
    created:responseRaw.data.created,
    model:responseRaw.data.model,
    prompt_tokens:responseRaw.data.usage.prompt_tokens,
    completion_tokens:responseRaw.data.usage.completion_tokens,
    tokens:responseRaw.data.usage.total_tokens,
    response:responseRaw.data.choices[0].message.content,
    finish_reason:responseRaw.data.choices[0].finish_reason
  };
  //console.log(response);
  try {
    await responseCollection.insertOne(response,{safe: true});
    return response._id;
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
    
    let allResponse_id = saveResponse(response);
    // Extract the generated response from the API
    const generatedResponse = {
      content:response.data.choices[0].message.content,
      date:response.headers.date,
      role:response.data.choices[0].message.role,
      allResponse_id:allResponse_id
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