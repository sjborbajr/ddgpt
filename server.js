// Import required modules
import { Configuration, OpenAIApi } from "openai";
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';
import { formatCroupierStartMessages, formatStartMessages, formatAdventureMessages, formatSummaryMessages, formatCroupierMessages, formatDoubleCheckMessages } from './functions.js';
import { encoding_for_model } from "tiktoken";

const mongoUri = process.env.MONGODB || "mongodb://localhost/?retryWrites=true";
const client = new MongoClient(mongoUri);
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

io.on('connection', async (socket) => {
  // Get the user id, auth token and IP from handshake
  let playerName = socket.handshake.auth.playerName || '', clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address, authNonce = socket.handshake.auth.authNonce || '';
  let showCharacters = 'Own', showActiveAdventures = true, historyFilterLimit='all', historyTextSearch='';
  playerName = playerName.trim().replace(/[^a-zA-Z0-9]/g,'');
  console.log('['+new Date().toUTCString()+'] User connected: '+playerName+' From: '+clientIp);

  let playerData = await fetchPlayerData(playerName)
  if ( playerData ) {
    //Valid Player, let make sure it is really them
    if (playerData.name == playerName && playerData.authNonce == authNonce && authNonce != '') {
      //console.log('player had his nonce');
      //update database of new logon, should I add IP? - what if mobile or at friend?
    } else if (playerData.authNonce != authNonce && playerData.name == playerName && playerData.ipList.includes(clientIp)) {
      //console.log('give '+playerName+' his nonce');
      socket.emit('nonce',playerData.authNonce);
    } else {
      socket.emit("error","user not authenticated");
      socket.disconnect();
      console.log('player '+playerName+' did not have nonce and did not have IP - Kicked');
    }
  } else {
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

  socket.onAny((event, ...args) => {
    // Log all recieved events/data except settings save
    if (event != 'save' && event != 'listOwners' && event != 'saveChar'){
      console.log('['+new Date().toUTCString()+'] playerName('+playerName+'), socket('+event+')', args);
    }
  });
  socket.on('save', data => {
    if (playerData.admin){
      console.log('['+new Date().toUTCString()+'] Player '+playerName+' saved');
      saveSettings(data,socket);
    } else {
      console.log('['+new Date().toUTCString()+'] Player '+playerName+' tried to save');
      socket.emit("error","user not admin");
      socket.disconnect();
    }
  });
  socket.on('saveChar', async data => {
    try{
      console.log('['+new Date().toUTCString()+'] Player '+playerName+' saving char '+data.data.name);
      data.data.uniquename = data.data.name.trim().replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
      if (data._id.length == 24) {
        let charData = await gameDataCollection.findOne({type:"character",_id:new ObjectId(data._id)});
        if (charData) {
          if (playerData.admin || charData.owner_id.toString() == playerData._id.toString()){
            data.data.owner_id = new ObjectId(data.owner_id);
            await gameDataCollection.updateOne({type:"character",_id:new ObjectId(data._id)},{$set:data.data});
            let message = {message:'Character '+data.data.name+' saved.',color:'green',timeout:1500};
            socket.emit('alertMsg',message);
          } else {
            let message = {message:'no access - Character '+data.data.name+' not saved!',color:'red',timeout:5000}
            socket.emit('alertMsg',message);
          }
        }
      } else if (data._id == '') {
        data.data.type = 'character'
        data.data.owner_id = playerData._id
        await gameDataCollection.insertOne(data.data);
        socket.emit('charData',data.data);
        let message = {message:'Character '+data.data.name+' created.',color:'green',timeout:5000};
        socket.emit('alertMsg',message);
    }
    } catch(error) {
      let message = {message:'Character '+data.data.name+' not saved!',color:'red',timeout:5000};
      console.error('error saving',error);
      socket.emit('alertMsg',message);
    }
  });
  socket.on('showCharOption', data =>{
    //sets the variable for this socket to show all charaters or current living ones
    if (data == 'All' || data == 'Own') {
      showCharacters = data;
    } else {
      let message = {message:'Invalid option!',color:'red',timeout:5000}
      socket.emit('alertMsg',message);
    }
  });
  socket.on('listOwners', async () => {
    //TODO limit list owner for non-admins
    let owners = await gameDataCollection.find({type:'player'}).project({name:1,_id:1}).toArray();
    socket.emit('listedOwners',owners);
  });
  socket.on('disconnect', () => {
    console.log('['+new Date().toUTCString()+'] Player disconnected:', playerName);
    gameDataCollection.updateOne({type:'player',name:playerName},{$set:{connected:false}});
  });
  socket.on('changeName', async newName => {
    if (newName == newName.trim().replace(/[^a-zA-Z0-9]/g,'')){
      console.log('Player changing name from '+playerName+' to '+newName);
      let test = await fetchPlayerData(newName)
      //console.log(test)
      if (test) {
        socket.emit("error","player name already taken");
      } else {
        let rc = await updatePlayer(playerName,{$set:{name:newName}})
        if (rc == 'success') {
          socket.emit("nameChanged",newName);
          playerName = newName;
          playerData.name = playerName;
        } else {
          socket.emit("error","error changing name");
        }
      }
    } else {
      let message = {message:'New name appeared to have invalid chars, not changing!',color:'red',timeout:5000}
      socket.emit('alertMsg',message);      
    }
  });
  socket.on('historyFilterLimit', async limit => {
    historyFilterLimit = limit;
  });
  socket.on('fetchHistory', async id => {
    if (playerData.admin){
      try {
        let query = ''
        query = {_id:new ObjectId(id)};
        let history = await responseCollection.findOne(query);
        if (history){
          socket.emit('historyData',history);
        } else {
          socket.emit('error','could not find history with ID: '+id);
        }    
      } catch (error){
        console.log('error',error);
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
    if (playerData.admin) {
      let message = {message:'Message recieved, running!',color:'green',timeout:10000}
      socket.emit('alertMsg',message);
      let response = await openaiCall(data.messages,data.model,Number(data.temperature),Number(data.maxTokens),playerData.api_key,'ScotGPT')
      socket.emit('ScotRan',response.content);
    }
  });
  socket.on('replay',async data =>{
    if (playerData.admin) {
      let message = {message:'replay recieved, running!',color:'green',timeout:10000}
      socket.emit('alertMsg',message);
      let response = await openaiCall(data.messages,data.model,Number(data.temperature),Number(data.maxTokens),playerData.api_key,'Replay')
      socket.emit('replayRan',{date:response.date,_id:response.allResponse_id});
    }
  });
  socket.on('fetchAllAdventureHistory',async adventure_id =>{
    try {
      if (adventure_id.length == 24){
        socket.join('Adventure-'+adventure_id);
        sendAdventureData(adventure_id,socket);
        //need more data than what is in the adventure data
        sendAdventurers(adventure_id,socket);
      }
    } catch (error) {
      console.log(error)
    }
  });
  socket.on('approveAdventureInput',async UserInput =>{
    if (UserInput.content.length > 1) {
      let settings = await getSetting('');
      let enc = encoding_for_model(settings.model);

      UserInput.approverName = playerName;
      UserInput.adventure_id = new ObjectId(UserInput.adventure_id);
      UserInput.date = new Date().toUTCString();
      UserInput.created = Math.round(new Date(UserInput.date).getTime()/1000);
      UserInput.type = 'message';
      UserInput.tokens = (enc.encode(UserInput.content)).length;
      
      if (settings.forReal){
        try {
          gameDataCollection.insertOne(UserInput,{safe: true});
        } catch (error) {
          console.error('Error saving response to MongoDB:', error);
        }
      }
      io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEvent',UserInput);
      
      continueAdventure(UserInput.adventure_id);
    }
  });
  socket.on('bootAdventurer',async data =>{
    try{
      let [ adventure , character ] = await Promise.all([
        gameDataCollection.findOne({type:'adventure',_id:new ObjectId(data.adventure_id)}),
        gameDataCollection.findOne({type:'character',_id:new ObjectId(data.character_id),owner_id:playerData._id})
      ]);
      if (adventure.state == "forming" && (adventure.owner_id.toString() == playerData._id.toString() || character || playerData.admin)){
        bootAdventurer(data,socket);
      }
    } catch (error) {
      console.log(error);
    }
  });
  socket.on('deleteMessage',async message_id =>{
    try {
      let message = await gameDataCollection.findOne({type:'message',_id:new ObjectId(message_id)},{adventure_id:1});
      if (message){
        if (!message.origin) {
          let adventure = await gameDataCollection.findOne({type:'adventure',_id:message.adventure_id},{owner_id:1});
          if (playerData.admin || playerData._id.toString() == adventure.owner_id.toString()) {
            await gameDataCollection.updateOne({type:'message',_id:new ObjectId(message_id)},{$set:{type:'deleted-message'}});
            io.sockets.in('Adventure-'+message.adventure_id).emit('adventureEventDelete',message_id);
          }
        }
      }
    } catch (error){
      console.log(error);
    }
  });
  socket.on('suggestAdventureInput',async UserInput =>{
    UserInput.content = UserInput.content.trim();
    if (UserInput.content.length > 1) {
      UserInput.playerName = playerName;
      io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEventSuggest',UserInput);
    }
  });
  socket.on('setAdventureModel',async data =>{
    console.log('['+new Date().toUTCString()+'] Player '+playerName+' requested to set model to '+data.model)
    try {
      data.adventure_id = new ObjectId(data.adventure_id);
      if (data.model == 'unset'){
        await gameDataCollection.updateOne({type:'adventure',_id:data.adventure_id},{$unset:{model:1}});
      } else {
        await gameDataCollection.updateOne({type:'adventure',_id:data.adventure_id},{$set:{model:data.model}});
      }
      let message = {message:'model updated',color:'green',timeout:3000}
      socket.emit('alertMsg',message);
    } catch (error) {
      console.log(error)
    }
  });
  socket.on('endAdventure',async adventure_id =>{
    completeAdventure(new ObjectId(adventure_id));
  });
  socket.on('listActiveAdventure',async data =>{
    showActiveAdventures = data;
  });
  socket.on('beginAdventure',async adventure_id =>{
    try {
      adventure_id = new ObjectId(adventure_id);
      let adventure = await gameDataCollection.findOne({_id:adventure_id,state:'forming',type:'adventure'});
      if (adventure.owner_id.toString() == playerData._id.toString() || playerData.admin) {
        await gameDataCollection.updateOne({_id:adventure_id,type:'adventure'},{$set:{state:'discovery'}});
        await startAdventure(adventure);
        await gameDataCollection.updateOne({_id:adventure_id,type:'adventure'},{$set:{state:'active'}});
      }
    } catch (error){
      console.log(error);
    }
  });
  socket.on('joinParty',async adventure_id =>{
    try {
      let [ adventure , myCharacters, myCharactersData ] = await Promise.all([
        gameDataCollection.findOne({_id:new ObjectId(adventure_id),state:'forming',type:'adventure'}),
        gameDataCollection.find({owner_id:playerData._id,type:'character',activeAdventure:{$exists: false}}).project({_id:1,name:1}).toArray(),
        gameDataCollection.find({owner_id:playerData._id,type:'character',activeAdventure:{$exists: false}}).toArray()
      ]);
      await Promise.all([
        gameDataCollection.updateOne({_id:adventure._id,type:'adventure'},{$push:{characters:{$each:myCharacters}}}),
        gameDataCollection.updateMany({owner_id:playerData._id,type:'character',activeAdventure:{$exists: false}},{$set:{activeAdventure:{name:adventure.name,_id:adventure._id}},$push:{adventures:{name:adventure.name,_id:adventure._id}}})
      ])
      io.sockets.in('Adventure-'+adventure._id).emit('AddAdventurer',myCharactersData);
      socket.emit('partyJoined',{_id:adventure._id,name:adventure.name});
      let message = {message:'Party Joined',color:'green',timeout:3000}
      socket.emit('alertMsg',message);    
    } catch (error) {
      console.log(error);
    }
  });
  socket.on('historyTextSearch',async data =>{
    historyTextSearch = data;
  });
  socket.on('createParty',async NewName =>{
    try {
      if (playerData.api_key) {
        if (NewName.length > 0) {
          let [ character_ids , adventure ] = await Promise.all([
            gameDataCollection.find({type:'character',owner_id:playerData._id,activeAdventure:{$exists:false}}).project({_id:1,name:1}).toArray(),
            gameDataCollection.findOne({owner_id:playerData._id,state:'forming',type:'adventure'})
          ]);
          if (character_ids.length > 0) {
            if (!adventure) {
              adventure = {
                type:'adventure',
                party_name:NewName,
                name:(NewName+': <forming>'),
                state:'forming',
                characters:character_ids,
                owner_id:playerData._id,
                api_key:playerData.api_key
              }
              await gameDataCollection.insertOne(adventure);
              //TODO Let player select characters
              await gameDataCollection.updateMany({owner_id:playerData._id,type:'character',activeAdventure:{$exists:false}},{$set:{activeAdventure:{name:adventure.name,_id:adventure._id}},$push:{adventures:{name:adventure.name,_id:adventure._id}}});
              socket.emit('partyJoined',{_id:adventure._id,name:adventure.name});
              let message = {message:'Party Forming',color:'green',timeout:3000}
              socket.emit('alertMsg',message);
              io.sockets.in("Tab-Home").emit("partyForming",{party_name:adventure.party_name, _id:adventure._id})
            } else {
              let message = {message:"Not creating, you already have a forming party!",color:'red',timeout:5000}
              socket.emit('alertMsg',message);
            }
          } else {
            let message = {message:"You don't have any available characters!",color:'red',timeout:5000}
            socket.emit('alertMsg',message);
          }
        } else {
          let message = {message:"must have a name!",color:'red',timeout:5000}
          socket.emit('alertMsg',message);        
        }
      } else {
        let message = {message:"You don't have an api key!",color:'red',timeout:5000}
        socket.emit('alertMsg',message);
      }
    } catch (error){
      console.log(error);
    }
  });
  socket.on('tab',async tabName =>{
    updatePlayer(playerName,{$set:{tabName:tabName}});
    //remove player from old tab channels?  - Todo
    if (tabName == 'Home'){
      socket.join('Tab-'+tabName);
      //send friends or if admin send all if selected - Todo
      if (playerData.admin){
        let connectedPlayers = await gameDataCollection.find({type:'player',connected:true}).project({name:1,_id:-1}).toArray();
        socket.emit('connectedPlayers',connectedPlayers);
      }
      //send forming parties - need to figure out how to limit who can see which parties
      let formingParties = await gameDataCollection.find({type:'adventure',state:'forming'}).project({party_name:1,_id:-1}).toArray();
      if (formingParties.length > 0 ) {
        socket.emit('formingParties',formingParties);
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
        advetureNames = await gameDataCollection.distinct('activeAdventure',{type:'character',owner_id: new ObjectId(playerData._id)})
      } else {
        if (playerData.admin){
          advetureNames = await gameDataCollection.find({type:'adventure'}).project({name:1,_id:1}).toArray();
        } else {
          advetureNames = await gameDataCollection.distinct('adventures',{type:'character',owner_id: new ObjectId(playerData._id)})
          //console.log('in',advetureNames);
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
      //console.log('History');
      socket.join('Tab-'+tabName);
      let historyFilter = {};
      if (historyFilterLimit != 'all' && historyTextSearch != '') {
        historyFilter = {$and:[{function:historyFilterLimit},{$or:[{response:{$regex:historyTextSearch,$options:'i'}},{request:{$regex:historyTextSearch,$options:'i'}}]}]}
      } else if (historyFilterLimit != 'all') {
        historyFilter = {function:historyFilterLimit}
      } else if (historyTextSearch != '') {
        historyFilter = {$or:[{response:{$regex:historyTextSearch,$options:'i'}},{request:{$regex:historyTextSearch,$options:'i'}}]}
      }
      let history = await responseCollection.find(historyFilter).project({date:1,_id:1,created:1}).sort({created:-1}).toArray()
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
async function saveSettings(data,socket){
  try {
    await settingsCollection.updateOne({}, { $set: data }, { upsert: true });
    let message = {message:'Settings saved.',color:'green',timeout:3000}
    socket.emit('alertMsg',message);
    //This is the data that came from the client, don't need to hide sensitive data
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
async function saveResponse(responseRaw,call_function){
  let response = {}
  if (responseRaw.status) {
    response.status = responseRaw.status
  }
  response.function = call_function;
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
    return response._id;
  } catch (error) {
    console.error('Error saving response to MongoDB:', error);
  }
};
async function openaiCall(messages, model, temperature, maxTokens, apiKey,call_function) {
  temperature = Number(temperature);
  maxTokens = Number(maxTokens);
  try {
    //should we do a retry? - todo
    let openai = new OpenAIApi(new Configuration({apiKey: apiKey}));
    const response = await openai.createChatCompletion({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    });
    
    let allResponse_id = await saveResponse(response,call_function);
    // Extract the generated response from the API
    const generatedResponse = {
      content:response.data.choices[0].message.content,
      date:response.headers.date,
      role:response.data.choices[0].message.role,
      id:response.data.id,
      tokens:response.data.usage.completion_tokens,
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
    try {
      saveResponse(error.response,call_function);
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
async function sendAdventureData(adventure_id,socket){
  let [ adventureMessages , adventureData ] = await Promise.all([
    gameDataCollection.find({type:'message',adventure_id:new ObjectId(adventure_id)}).sort({created:1}).toArray(),
    gameDataCollection.findOne({type:'adventure',_id:new ObjectId(adventure_id)},{api_key:-1,apiKey:-1}),
  ]);
  if (adventureData){
    adventureData.messages = adventureMessages;
  } else {
    adventureData = {messages:adventureMessages};
  }
  socket.emit('AllAdventureHistory',adventureData);
}
async function sendAdventurers(adventure_id,socket){
  let charIds = [], adventure = await gameDataCollection.findOne({type:'adventure',_id:new ObjectId(adventure_id)},{'characters._id':1})
  if (adventure) {
    for (let i = 0 ; i < adventure.characters.length; i++) {
      charIds.push(adventure.characters[i]._id)
    }
    let adventurers = await gameDataCollection.find({type:'character','_id':{$in:charIds}}).toArray();
    if (adventurers.length > 0){
      socket.emit('AllAdventurers',adventurers);
    }
  }
}
async function startAdventure(adventure){
  io.sockets.in('Adventure-'+adventure._id).emit('continueAdventure',true); //put the confidence builder dots in chat

  let settings = await getSetting('');
  let apiKey = adventure.api_key;
  let model = adventure.model || settings.model

  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':adventure._id}).toArray();
  let messages = formatStartMessages(settings,characters)

  if (settings.forReal){
    let openAiResponse = await openaiCall(messages,model,Number(settings.temperature),Number(settings.maxTokens),apiKey,'adventureStart')
    if (openAiResponse.id) {
      openAiResponse.type = 'message';
      openAiResponse.adventure_id = adventure._id;
      openAiResponse.originMessage = true;
      openAiResponse.created = Math.round(new Date(openAiResponse.date).getTime()/1000);

      io.sockets.in('Adventure-'+adventure._id).emit('adventureEvent',openAiResponse);
      try {
        gameDataCollection.insertOne(openAiResponse,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }
      
      messages = formatCroupierStartMessages(settings,adventure,openAiResponse.content);
      
      let croupierResponse = await openaiCall(messages,settings.cru_model,Number(settings.cru_temperature),Number(settings.cru_maxTokens),apiKey,'croupier');
      if (croupierResponse.id){
        let responseJson = JSON.parse(croupierResponse.content)
        if (responseJson){
          io.sockets.in('Adventure-'+adventure._id).emit('adventureRename',{name:responseJson.adventure_name,_id:adventure._id});
          try {
            await gameDataCollection.updateOne({type:'message',id:openAiResponse.id},{$set:{croupier:responseJson}});
          } catch (error) {
            console.error('Error saving croupier response to MongoDB:', error);
          }
          
          if (responseJson.adventure_name) {
            try {
              await gameDataCollection.updateOne({type:'adventure',_id:adventure._id},{$set:{name:responseJson.adventure_name}});
            } catch (error) {
              console.error('Error updating adventure name in MongoDB:', error);
            }
            for (let i = 0 ; i < adventure.characters.length; i++) {
              try {
                await gameDataCollection.updateOne({_id:adventure.characters[i]._id,type:'character'},{$set:{activeAdventure:{name:responseJson.adventure_name,_id:adventure._id}},$pull:{adventures:{_id:adventure._id}}});
                await gameDataCollection.updateOne({_id:adventure.characters[i]._id,type:'character'},{$push:{adventures:{name:responseJson.adventure_name,_id:adventure._id}}});
              } catch (error) {
                console.error('Error saving croupier response to MongoDB:', error);
              }
            }
          }
        }
      } else {
        //something went wrong getting croupier data
      }
    } else {
      //something went wrong getting creating adventure
    }
  } else {
    console.log(messages,model,Number(settings.temperature),Number(settings.maxTokens));
    setTimeout(()=> {io.sockets.in('Adventure-'+adventure._id).emit('adventureEvent',{role:'assistent',content:'fake'})}, 3000);
  }  
}
async function completeAdventure(adventure_id){
  //mark adventure as over, remove active adventure from chars
  try {
    adventure_id = new ObjectId(adventure_id)
    let adventureData = await gameDataCollection.findOne({type:'adventure',_id:adventure_id});
    if (adventureData.state == 'forming') {
      await Promise.all([
        gameDataCollection.deleteOne({type:'adventure',_id:adventure_id}),
        gameDataCollection.updateMany({type:'character','activeAdventure._id':adventure_id},{$pull:{adventures:{_id:adventure_id}},$unset:{activeAdventure:1}})
      ])
    } else {
      await Promise.all([
        gameDataCollection.updateOne({type:'adventure',_id:adventure_id},{$set:{state:'succeeded'},$unset:{api_key:1}}),
        gameDataCollection.updateMany({type:'character','activeAdventure._id':adventure_id},{$unset:{activeAdventure:1}})
      ]);
      sendAdventureData(adventure_id,io.sockets.in('Adventure-'+adventure_id));
      //level up character
    }
  } catch (error) {
    console.error('Error ending adventure:', error);
  }
}
async function bootAdventurer(data,socket){
  try {
    let adventure = await gameDataCollection.findOne({type:'adventure',_id:new ObjectId(data.adventure_id),state:'forming'});
    if (adventure) {
      await Promise.all([
        gameDataCollection.updateOne({type:'adventure',_id:new ObjectId(data.adventure_id)},{$pull:{characters:{_id:new ObjectId(data.character_id)}}}),
        gameDataCollection.updateOne({type:'character',_id:new ObjectId(data.character_id)},{$unset:{activeAdventure:1},$pull:{adventures:{_id:new ObjectId(data.adventure_id)}}})
      ])
      io.sockets.in('Adventure-'+adventure._id).emit('RemoveAdventurer',data.character_id);
    } else {
      let message = {message:"Adventure is no longer forming, can't boot.",color:'red',timeout:3000}
      socket.emit('alertMsg',message);
    }
  } catch (error) {
    console.error('Error booting adventurer:', error);
  }
}
async function continueAdventure(adventure_id){
  io.sockets.in('Adventure-'+adventure_id).emit('continueAdventure',true); //put the confidence builder dots in chat
  let settings = await getSetting('');
  let openAiResponse;

  let [ adventure , allMessages, characters ] = await Promise.all([
    gameDataCollection.findOne({type:'adventure',_id:adventure_id}),
    gameDataCollection.find({type:'message',adventure_id:adventure_id}).sort({created:1}).toArray(),
    gameDataCollection.find({type:'character','activeAdventure._id':adventure_id}).toArray()
  ]);
  let messages = formatAdventureMessages(settings,allMessages,characters);
  let apiKey = adventure.api_key;
  let model = adventure.model || settings.model;


  if (settings.forReal){
    openAiResponse = await openaiCall(messages,model,Number(settings.temperature),Number(settings.maxTokens),apiKey,'game');
    if (openAiResponse.id) {
      if(settings.doubleCheck) {
        let messages = formatDoubleCheckMessages(settings,openAiResponse.content,characters);
        let tempOpenAiResponse = await openaiCall(messages,settings.cru_model,0,Number(settings.maxTokens),apiKey,'doubleCheck');
        if (tempOpenAiResponse.id){
          openAiResponse = tempOpenAiResponse;
        }
      }
      
      openAiResponse.type = 'message';
      openAiResponse.adventure_id = adventure_id;
      openAiResponse.owner_id = adventure.owner_id;
      openAiResponse.created = Math.round(new Date(openAiResponse.date).getTime()/1000);
      try {
        await gameDataCollection.insertOne(openAiResponse,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }
      io.sockets.in('Adventure-'+adventure_id).emit('adventureEvent',openAiResponse);


      if (settings.doSummary) {
        messages = formatSummaryMessages(settings,openAiResponse.content);
        let summaryResponse = openaiCall(messages,settings.cru_model,Number(settings.cru_temperature),Number(settings.cru_maxTokens),apiKey,'summary');
        summaryResponse.then((response) => {
          if (response.id){
            if (response.content.substring(0,8) == "Summary:") {
              response.content = response.content.substring(8,response.content.length-8).trim();
              response.tokens = response.tokens - 1;
            }
            let savings = openAiResponse.tokens - response.tokens
            try {
              gameDataCollection.updateOne({type:'message',id:openAiResponse.id},{$set:{summary:response.content,summary_tokens:response.tokens,tokens_savings:savings}});
            } catch (error) {
              console.error('Error saving summary response to MongoDB:', error);
            }
          } else {
            //something went wrong with summary
          }
        })
      }

      //get system data and enhance the experiance
      if (settings.doCroupier){
        let characters = await gameDataCollection.find({type:'character','activeAdventure._id':adventure_id}).toArray();
        messages = formatCroupierMessages(settings,openAiResponse.content,characters)
        let croupierResponse = await openaiCall(messages,settings.cru_model,Number(settings.cru_temperature),Number(settings.cru_maxTokens),apiKey,'croupier');
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
      }
    } else {
      //something went wrong getting adventure message
    }
  } else {
    console.log(messages,model,Number(settings.temperature),Number(settings.maxTokens));
    setTimeout(()=> {io.sockets.in('Adventure-'+adventure_id).emit('adventureEvent',{role:'assistent',content:'fake'})}, 3000);
    if (settings.doSummary) {
      messages = formatSummaryMessages(settings,"Fake response from Previous fake")
      console.log(messages,settings.cru_model,Number(settings.temperature),Number(settings.maxTokens));
    }
  }
}