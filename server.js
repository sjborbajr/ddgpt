// Import required modules
import { Configuration, OpenAIApi } from "openai";
//const express = require('express'), http = require('http'), socketIO = require('socket.io'), fs = require('fs'), path = require('path'), openai = require('openai');
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { inspect } from 'util';
//import { createRequire } from 'module';
//const require = createRequire(import.meta.url);


//RateLimit = require('express-rate-limit'),
// Set up the server
const app = express(), server = http.createServer(app);
const io = new SocketIO(server);

const mongoUri = "mongodb://localhost/test?retryWrites=true";
const client = new MongoClient(mongoUri);
//try {
  await client.connect();
  console.log('Connected to MongoDB');

  const database = client.db('ddgpt');
  const gameStatePrivateCollection = database.collection('gameStatePrivate');
  const gameStatePublicCollection = database.collection('gameStatePublic');
  const responseCollection = database.collection('responses');

  // Load game state from the collections
  //const gameStatePrivate = await gameStatePrivateCollection.findOne();
  //const gameStatePublic = await gameStatePublicCollection.findOne();

  // ...

//} catch (e) {
//  console.error(e);
//}


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let joincount = 0, turnTimeout = null;//, limiter = RateLimit({windowMs: 500,max: 25});

// Start the server
const port = 9000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// apply rate limiter to all requests
//app.use(limiter);
//serv from the public folder
app.use(express.static(join(__dirname, 'public')));
//client.js is in root dir with server.js
app.get('/client.js', (req, res) => { res.set('Content-Type', 'text/javascript'); res.sendFile(join(__dirname, 'client.js')); });
//send public/index.html if no specific file is requested
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

const gameStatePrivate = JSON.parse(fs.readFileSync('gameStatePrivate.private'));
const gameStatePublic = JSON.parse(fs.readFileSync('gameStatePublic.private'));
setInterval(ServerEvery1Second, (1*1000));

for (let playerID in gameStatePublic.players) {
  gameStatePublic.players[playerID].connected = false;
}

//const configuration = {organization: gameStatePrivate.organization,apiKey: gameStatePrivate.apiKey};
const configuration = new Configuration({
  apiKey: gameStatePrivate.apiKey,
});
const openai = new OpenAIApi(configuration);

gameStatePublic.systemmessages[2].value = CreateCharTable();

if(1 == 1){
  let systemMessage = ""
  for (let i = 0 ; i < gameStatePublic.systemmessages.length; i++){
    console.log(i,gameStatePublic.systemmessages[i].checked);
    if (gameStatePublic.systemmessages[i].checked){
      systemMessage+=gameStatePublic.systemmessages[i].value+'\n'
    }
  };
  console.log("systemMessage",systemMessage)
  let assistantMessages = ["Let's Start the adventure.",'As you all gather at the local tavern, a hooded figure approaches your group. "I have a task for brave adventurers such as yourselves," the figure says, sliding a map towards the center of the table. "There have been reports of a goblin raiding party in the nearby woods. They have stolen a valuable artifact from our village and we need it back. Will you help us?"\nLarry examines the map and notices a few potential traps set around the goblin camp. "I can use my arcane focus to detect any magical traps," he offers.\nTrueBlade nods in agreement. "I can lead the charge with my sword and crossbow," he says confidently.\nBlu grins mischievously. "And I can make sure the goblins dont see us coming," she adds, twirling her short sword.\nEvan grunts in approval. "I will be ready to smash any goblin in sight," he declares, gripping his great axe tightly.\nDonny nods solemnly. "And I will be praying for our success," he says, holding his mace and holy symbol.\nSteve raises his tankard of grog. "To victory!" he exclaims, taking a swig.\nThe group sets off towards the woods, prepared for battle.'];
  //let systemMessage = 'You are a helpful assistant.';
  //let assistantMessages = ['What is the weather today?', 'Tell me a joke.'];
  let UserMessage = 'Steve says: "Can I bring some grog?"';

  openaiCall(systemMessage, assistantMessages,UserMessage)
  .then(response => {
    console.log('Generated response:', response);
    fs.writeFileSync('response.private', JSON.stringify(response, null, 2));
    // Do something with the generated response
  })
  .catch(error => {
    // Handle error
  });
}

io.on('connection', (socket) => {
  // Get the user id from handshake
  const playerName = socket.handshake.auth.playerName;
  console.log('User connected: '+playerName);
  if ( !(gameStatePublic.players[playerName])) {
    addPlayer(playerName);
  }
  gameStatePublic.players[playerName].connected = true;
  // Send current game state to the player
  sendState(socket,playerName)
  //gameStatePublic.players[playerName].turnTimeout = setTimeout(() => { handleInactivity(socket,playerName); }, ( 30 * 1000 ));

  // Log all recieved events/data
  socket.onAny((event, ...args) => {
    console.log(event, args);
  });
  
  socket.on('save', data => {
    console.log('Player '+playerName+' saved');
    gameStatePublic.systemmessages = data;
    io.emit('gameState', gameStatePublic)
    saveState();
  });
  socket.on("saveplaying", data => {
    console.log("saveplaying for user:",playerName)
    gameStatePublic.players[playerName].playing = data;
    saveState();
  })
  socket.on('disconnect', () => {
    console.log('Player disconnected:', playerName);
    gameStatePublic.players[playerName].connected = false;
  });
});
async function saveState() {
  fs.writeFileSync('gameStatePrivate.private', JSON.stringify(gameStatePrivate, null, 2));
  fs.writeFileSync('gameStatePublic.private', JSON.stringify(gameStatePublic, null, 2));
  
  try {
    // Update the game state documents in the collections
    await gameStatePrivateCollection.updateOne({}, { $set: gameStatePrivate }, { upsert: true });
    await gameStatePublicCollection.updateOne({}, { $set: gameStatePublic }, { upsert: true });

    console.log('Game state saved to MongoDB');
  } catch (error) {
    console.error('Error saving game state to MongoDB:', error);
  }
}
function sendState(socket,playerName) {
  //send game state to everyone
  console.log('send state to: '+playerName);
  socket.emit('gameState', gameStatePublic);
}
function handleInactivity(socket,playerName) {
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
function addPlayer(playerName) {
  console.log('adding user: '+playerName)
  gameStatePublic.players[playerName] = {
    hand: [],
    score: 0,
    join_order: joincount++,
    playing: false,
    played: false,
    turn: false,
    winner: null,
  };
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
async function openaiCall(systemMessage, assistantMessages,UserMessage) {
  try {
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
    fs.writeFileSync('response2.private', safeResponse);
    try {
      await responseCollection.insertOne({}, safeResponse);
    } catch (error) {
      console.error('Error saving response to MongoDB:', error);
    }
    // Extract the generated response from the API
    //console.log("original response",response);
    const generatedResponse = response.data;

    return generatedResponse;
  } catch (error) {
    console.error('Error generating response from OpenAI:', error);
    throw error;
  }
}
