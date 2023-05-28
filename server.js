// Import required modules
import { Configuration, OpenAIApi } from "openai";
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import inspect from 'util';
import crypto from 'crypto';

const mongoUri = "mongodb://localhost/?retryWrites=true";
const client = new MongoClient(mongoUri,{ forceServerObjectId: true });
await client.connect();
console.log('Connected to MongoDB');
const database = client.db('ddgpt');
const settingsCollection = database.collection('settings');
const gameDataCollection = database.collection('gameData');
const responseCollection = database.collection('allResponses');

// Set up the server
const app = express(), server = http.createServer(app), io = new SocketIO(server);
const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);

// Start the server
server.listen(process.env.PORT || 9000);

//serv from the public folder
app.use(express.static(join(__dirname, 'public')));
//client.js is in root dir with server.js
app.get('/client.js', (req, res) => { res.set('Content-Type', 'text/javascript'); res.sendFile(join(__dirname, 'client.js')); });
//send public/index.html if no specific file is requested
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  Write
//update all players to disconnected
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  Write

//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  Write
//const openai = new OpenAIApi(new Configuration({apiKey: gameStatePrivate.apiKey}));
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  Write

io.on('connection', async (socket) => {
  // Get the user id, auth token and IP from handshake
  const playerName = socket.handshake.auth.playerName || '', clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address, authNonce = socket.handshake.auth.authNonce || '';
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
      // not you, disconnect
      socket.emit("error","user not authenticated");
      socket.disconnect();
      console.log('player '+playerName+' did not have his nonce and did not have his IP - Kicked');
    }
  } else {
    console.log("add player "+playerName);
    addPlayer(playerName,socket,clientIp);
  }

  //gameStatePublic.players[playerName].connected = true;

  // Send current game state to the player
  //sendState(socket,playerName)

  //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  Write
  // what do I do for a connected player?


  //gameStatePublic.players[playerName].turnTimeout = setTimeout(() => { handleInactivity(socket,playerName); }, ( 30 * 1000 ));
  
  // Log all recieved events/data
  socket.onAny((event, ...args) => {
    if (event != 'save'){
      console.log(event, args);
    }
  });
  socket.on('save', data => {
    console.log('Player '+playerName+' saved');
    //gameStatePublic.systemmessages = data.systemmessages;
    //gameStatePublic.settings = data.settings;
    //io.emit('gameState', gameStatePublic)
    saveState();
  });
  socket.on("saveplaying", data => {
    console.log("saveplaying for user:",playerName)
    //gameStatePublic.players[playerName].playing = data;
    saveState();
  })
  socket.on('disconnect', () => {
    console.log('Player disconnected:', playerName);
    //gameStatePublic.players[playerName].connected = false;
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
async function saveState(){
  //something
}
async function addPlayer(playerName,socket,clientIp) {
  console.log('adding user: '+playerName);
  let nonce = crypto.randomBytes(64).toString('base64');
  socket.emit('nonce',nonce)
  let playerDoc = {
    name: playerName,
    type: 'player',
    ipList: [ clientIp ],
    authNonce: nonce
  }
  await gameDataCollection.insertOne(playerDoc,{safe: true});
}
function CreateCharTable(){
  let table = 'Name      ', attributes = ["Race","Gender","Lvl","STR","DEX","CON","INT","WIS","CHA","HP","AC","Weapon","Armor","Class","Inventory","Backstory"];
  let attributesLen = [10,6,3,3,3,3,3,3,3,2,2,24,17,9,1,1], spaces = '                   ';
  for (let i = 0 ; i < attributes.length; i++){
    table+='|'+attributes[i];
    if (attributes[i].length < attributesLen[i]){
      table+=spaces.substring(0,attributesLen[i]-attributes[i].length);
    };
  };
  table+=' or Abilities'
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  Write
  for (let name in gameStatePublic.players) {
    let CharData = gameStatePublic.players[name];
    table+='\n'+name;
    if (name.length < 10){
      table+=spaces.substring(0,10-name.length);
    }
    for (let i = 0 ; i < attributes.length; i++){
      table+='|'+CharData[attributes[i]];
      if ((''+CharData[attributes[i]]).length < attributesLen[i]){
        table+=spaces.substring(0,attributesLen[i]-(''+CharData[attributes[i]]).length)
      }
    };
  };
  return table;
}
function ServerEvery1Second() {
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
  console.log(response);
  try {
    await responseCollection.insertOne(response,{safe: true});
  } catch (error) {
    console.error('Error saving response to MongoDB:', error);
  }
};
async function openaiCall(systemMessage, assistantMessages,UserMessage) {
  try {
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  Write
    const response = await openai.createChatCompletion({
      model: gameStatePublic.settings.model,
      messages: [
        { role: 'system', content: systemMessage },
        ...assistantMessages.map(message => ({ role: 'assistant', content: message })),
        { role: 'user', content: UserMessage}
      ],
      temperature: gameStatePublic.settings.temperature,
      max_tokens: gameStatePublic.settings.maxTokens
    });

    const safeResponse = inspect(response, {depth: 5})
    fs.writeFileSync('response.'+safeResponse.data.created+'.private', safeResponse);
    saveResponse(response);

    // Extract the generated response from the API
    const generatedResponse = response.data;

    return generatedResponse;
  } catch (error) {
    console.error('Error generating response from OpenAI:', error);
    throw error;
  }
}
async function getSetting(settings){
  //get setting from database
}