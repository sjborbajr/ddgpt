// Import required modules
import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';
import fs from 'fs';
import tail from 'tail';
const Tail = tail.Tail;
import SSI from 'node-ssi';

const mongoUri = process.env.MONGODB || "mongodb://localhost/ddgpt?retryWrites=true";
const client = new MongoClient(mongoUri);
try {
  await client.connect();
} catch (error) {
  console.error('Error connecting to MongoDB:', error);
}
const database = client.db();
const settingsCollection = database.collection('settings'), gameDataCollection = database.collection('gameData'), responseCollection = database.collection('allResponses');

gameDataCollection.updateMany({type:'player'},{$set:{connected:false,sockets:[]}});

// Set up the app/web/io server
const app = express(), server = http.createServer(app), io = new SocketIO(server);
const __filename = fileURLToPath(import.meta.url), __dirname = dirname(__filename);
const ssi = new SSI({baseDir: join(__dirname, 'public'),encoding: 'utf-8'});
server.listen(process.env.PORT || 9000);

//send public/index.html if no specific file is requested
app.get('/', (req, res) => {
  ssi.compileFile(join(__dirname, 'public/index.html'), (err, content) => {
    res.send(content);
  });
});
//configure the web server, serv from the public folder
app.use(express.static(join(__dirname, 'public')));
//client.js is in root dir with server.js
app.get('/client.js', (req, res) => { res.set('Content-Type', 'text/javascript'); res.sendFile(join(__dirname, 'client.js')); });

io.on('connection', async (socket) => {
  // Get the email from the oidc upstream through headers
  let email = socket.handshake.headers['oidc_claim_email'], clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address;
  console.log('['+new Date().toUTCString()+'] User connected: '+email+' From: '+clientIp);

  let showCharacters = 'Own', showActiveAdventures = true, historyFilterByFunction='all', historyTextSearch='', playerData = await gameDataCollection.findOne({email:email,type:'player'});

  if ( playerData ) {
    socket.emit('playerName',playerData.name);
    socket.emit('realmList',(await settingsCollection.distinct("realm")));
    socket.emit('modelList',(await settingsCollection.find({type:'model'},{projection:{enable:1,model:1,provider:1,lastused:1}}).toArray()));

    gameDataCollection.updateOne({type:'player',_id:playerData._id},{$set:{connected:true},$push:{sockets:socket.id}});
  
    socket.onAny((event, ...args) => {
      // Log all recieved events/data except a few
      if (event != 'save' && event != 'listOwners' && event != 'saveChar' && event != 'API_Key'){
        console.log('['+new Date().toUTCString()+'] playerName('+playerData.name+'), socket('+event+')', args);
      }
    });

    socket.on('API_Key', async data => {
      await gameDataCollection.updateOne({type:"player",_id:playerData._id},{$set:data}); //TODO validate data is a single key
      playerData = await gameDataCollection.findOne({email:email,type:'player'});
      socket.emit('keys',Object.keys(playerData.api_keys));
    });
    socket.on('changeName', async newName => {
      if (newName == newName.trim().replace(/[^a-zA-Z0-9]/g,'')){
        console.log('Player changing name from '+playerData.name+' to '+newName);
        let test = await gameDataCollection.findOne({name:newName,type:'player'});
        if (test) {
          socket.emit("error","player name already taken");
        } else {
          await gameDataCollection.updateOne({type:'player',name:playerData.name},{$set:{name:newName}});
          socket.emit("nameChanged",newName);
          playerData.name = newName;
        }
      } else {
        socket.emit('alertMsg',{message:'New name appeared to have invalid chars, not changing!',color:'red',timeout:5000});      
      }
    });

    socket.on('getName', async () => {
      let returndata = await settingsCollection.aggregate([{$match:{type:'name'}},{$sample:{size:1}}]).toArray();
      let uniqueTest = await gameDataCollection.find({type:'character',uniquename:returndata[0].name.trim().replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}).toArray();

      while (uniqueTest.length) {
        console.log('NameUsed',returndata[0])
        await settingsCollection.updateOne({type:'name',_id:returndata[0]._id},{$set:{used:true}})
        returndata = await settingsCollection.aggregate([{$match:{type:'name'}},{$sample:{size:1}}]).toArray();
        uniqueTest = await gameDataCollection.find({type:'character',uniquename:returndata[0].name.trim().replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}).toArray();

      }
      
      socket.emit("name",returndata)
    });
    socket.on('getClasses', async () => {
      let returndata = await settingsCollection.find({type:'class'}).toArray();
      socket.emit("classes",returndata)
    });
    socket.on('getRaces', async () => {
      let returndata = await settingsCollection.find({type:'race'}).toArray();
      socket.emit("races",returndata)
    });
    socket.on('getBackgrounds', async () => {
      let returndata = await settingsCollection.find({type:'background-basic'},{projection:{_id:0,type:0}}).toArray();
      socket.emit("background-basic",returndata)
      returndata = await settingsCollection.find({type:'background-basic-choice'}).toArray();
      socket.emit("background-basic-choice",returndata)
    });
    socket.on('getAlignments', async () => {
      let returndata = await settingsCollection.find({type:'alignment'}).toArray();
      socket.emit("alignments",returndata)
    });
    socket.on('getAbilities', async () => {
      let returndata = await settingsCollection.find({type:'ability'}).toArray();
      socket.emit("abilities",returndata);
    });
    socket.on('generateBackgroundStory', async data => {
      let messages = await formatMessages("generateBackgroundStory",[{role:'user',content:data}]);
      let settings = await settingsCollection.findOne({type:'function',"function":'generateBackgroundStory'});
      let api_keys = Object.assign({},playerData.api_keys);
      if (!api_keys) api_keys = {}
      if (!api_keys.gemini) {
        let model = await settingsCollection.findOne({type:'model',"provider":'gemini'});
        api_keys.gemini = model.apiKey
      }
      let response = await aiCall(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens),api_keys,'generateBackgroundStory')
      socket.emit('backgroundStory',response);
    });
    socket.on('generateBackgroundSummary', async data => {
      let messages = await formatMessages("generateBackgroundSummary",[{role:'user',content:data}]);
      let settings = await settingsCollection.findOne({type:'function',"function":'generateBackgroundSummary'});
      let api_keys = Object.assign({},playerData.api_keys);
      if (!api_keys) api_keys = {}
      if (!api_keys.gemini) {
        let model = await settingsCollection.findOne({type:'model',"provider":'gemini'});
        api_keys.gemini = model.apiKey
      }
      let response = await aiCall(messages,settings.model,Number(settings.temperature),Number(settings.maxTokens),playerData.api_keys,'generateBackgroundSummary')
      socket.emit('backgroundSummary',response);
    });
    socket.on('saveChar', async data => {
      try{
        console.log('['+new Date().toUTCString()+'] Player '+playerData.name+' saving char '+data.data.name);
        data.data.type = 'character'
        data.data.uniquename = data.data.name.trim().replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
        if (data._id.length == 24) {
          //existing Char, updating
          let charData = await gameDataCollection.findOne({type:"character",_id:new ObjectId(data._id)});
          if (charData) {
            if (playerData.admin || charData.owner_id.toString() == playerData._id.toString()){
              data.data.owner_id = new ObjectId(data.owner_id);
              data.data.details = {...charData.details,...data.data.details}

              await gameDataCollection.updateOne({type:"character",_id:new ObjectId(data._id)},{$set:data.data});
              socket.emit('alertMsg',{message:'Character '+data.data.name+' saved.',color:'green',timeout:1500});
            } else {
              socket.emit('alertMsg',{message:'no access - Character '+data.data.name+' not saved!',color:'red',timeout:5000});
            }
          }
        } else if (data._id == '') {
          //new char, create and send back
          data.data.owner_id = playerData._id
          await gameDataCollection.insertOne(data.data);
          socket.emit('charData',data.data);
          socket.emit('alertMsg',{message:'Character '+data.data.name+' created.',color:'green',timeout:5000});
      }
      } catch(error) {
        console.error('error saving',error);
        socket.emit('alertMsg',{message:'Character '+data.data.name+' not saved!',color:'red',timeout:5000});
      }
    });
    socket.on('showCharOption', data =>{
      //sets the variable for this socket to show all charaters or current living ones
      if (data == 'All' || data == 'Own') {
        showCharacters = data;
      } else {
        socket.emit('alertMsg',{message:'Invalid option!',color:'red',timeout:5000});
      }
    });
    socket.on('listOwners', async () => {
      let owners
      if (playerData.admin) {
        owners = await gameDataCollection.find({type:'player'}).project({name:1,_id:1}).toArray();
      } else {
        //TODO current friends list is based on who you have played with
        let myAdventures = [], myChars = await gameDataCollection.find({type:'character',owner_id:playerData._id}).project({adventures:1,_id:0}).toArray();
        for (let i = 0 ; i < myChars.length; i++) {
          let temp = myAdventures.concat(myChars[i].adventures);
          myAdventures = temp
        }
        myAdventures = [...new Set(myAdventures)];
        myAdventures = myAdventures.filter(n => n);

        owners = await gameDataCollection.find({type:'character',adventures:{$in:myAdventures}}).project({owner_id:1,_id:0}).toArray();
        owners = [...new Set(owners)];
        for (let i = 0 ; i < owners.length; i++) {
          owners[i] = owners[i].owner_id;
        }
        owners.push(playerData._id)
        owners = await gameDataCollection.find({type:'player',_id:{$in:owners}}).project({name:1,_id:1}).toArray();
      }
      socket.emit('listedOwners',owners);
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

    socket.on('fetchAllAdventureHistory',async adventure_id =>{
      try {
        if (adventure_id.length == 24){
          socket.join('Adventure-'+adventure_id);
          sendAdventureData(adventure_id,socket);
          sendAdventurers(adventure_id,socket);
        }
      } catch (error) {
        console.log(error)
      }
    });
    socket.on('approveAdventureInput',async UserInput =>{
      if (UserInput.content.length > 1) {
        let settings = await settingsCollection.findOne({type:'function',"function":'game'});
  
        UserInput.approverName = playerData.name;
        UserInput.adventure_id = new ObjectId(UserInput.adventure_id);
        UserInput.date = new Date().toUTCString();
        UserInput.created = Math.round(new Date(UserInput.date).getTime()/1000);
        UserInput.type = 'message';
        
        if (settings.active == 'true'){
          try {
            await gameDataCollection.insertOne(UserInput,{safe: true});
            continueAdventure(UserInput.adventure_id);
          } catch (error) {
            console.error('Error saving response to MongoDB:', error);
          }
        }
        io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEvent',UserInput);
      }
    });
    socket.on('bootAdventurer',async data =>{
      //you can boot chars before the adventure starts if it is your adventure
      //or you can boot your own chars
      //or if you are admin
      try{
        let [ adventure , character ] = await Promise.all([
          gameDataCollection.findOne({type:'adventure',_id:new ObjectId(data.adventure_id)}),
          gameDataCollection.findOne({type:'character',_id:new ObjectId(data.character_id),owner_id:playerData._id})
        ]);
        if ((adventure.state == "forming" && adventure.owner_id.toString() == playerData._id.toString()) || character || playerData.admin){
          await Promise.all([
            gameDataCollection.updateOne({type:'adventure',_id:new ObjectId(data.adventure_id)},{$pull:{characters:{_id:new ObjectId(data.character_id)}}}),
            gameDataCollection.updateOne({type:'character',_id:new ObjectId(data.character_id)},{$unset:{activeAdventure:1},$pull:{adventures:{_id:new ObjectId(data.adventure_id)}}})
          ])
          io.sockets.in('Adventure-'+adventure._id).emit('RemoveAdventurer',data.character_id);
        }
      } catch (error) {
        console.log(error);
      }
    });
    socket.on('deleteMessage',async message_id =>{
      //you can delete messages if it is your adventure or you are admin
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
        UserInput.playerName = playerData.name;
        io.sockets.in('Adventure-'+UserInput.adventure_id).emit('adventureEventSuggest',UserInput);
      }
    });
    socket.on('setAdventureModel',async data =>{
      console.log('['+new Date().toUTCString()+'] Player '+playerData.name+' requested to set model to '+data.model)
      try {
        data.adventure_id = new ObjectId(data.adventure_id);
        if (data.model == 'unset'){
          await gameDataCollection.updateOne({type:'adventure',_id:data.adventure_id},{$unset:{model:1}});
        } else {
          await gameDataCollection.updateOne({type:'adventure',_id:data.adventure_id},{$set:{model:data.model}});
        }
        socket.emit('alertMsg',{message:'model updated',color:'green',timeout:3000});
      } catch (error) {
        console.log(error)
      }
    });
    socket.on('setAdventureRealm',async data =>{
      console.log('['+new Date().toUTCString()+'] Player '+playerData.name+' requested to set realm to '+data.realm)
      try {
        data.adventure_id = new ObjectId(data.adventure_id);
        if (data.model == 'unset' || data.model == '<default>'){
          await gameDataCollection.updateOne({type:'adventure',_id:data.adventure_id},{$unset:{realm:1}});
        } else {
          await gameDataCollection.updateOne({type:'adventure',_id:data.adventure_id},{$set:{realm:data.realm}});
        }
        socket.emit('alertMsg',{message:'realm updated',color:'green',timeout:3000});
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
        socket.emit('alertMsg',{message:'Party Joined',color:'green',timeout:3000});
      } catch (error) {
        console.log(error);
      }
    });
    socket.on('createParty',async NewName =>{
      try {
        if (playerData.api_keys) {
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
                  api_key:playerData.api_keys
                }
                await gameDataCollection.insertOne(adventure);
                //TODO Let player select characters
                await gameDataCollection.updateMany({owner_id:playerData._id,type:'character',activeAdventure:{$exists:false}},{$set:{activeAdventure:{name:adventure.name,_id:adventure._id}},$push:{adventures:{name:adventure.name,_id:adventure._id}}});
                socket.emit('partyJoined',{_id:adventure._id,name:adventure.name});
                socket.emit('alertMsg',{message:'Party Forming',color:'green',timeout:3000});
                io.sockets.emit("partyForming",{party_name:adventure.party_name, _id:adventure._id})
              } else {
                socket.emit('alertMsg',{message:"Not creating, you already have a forming party!",color:'red',timeout:5000});
              }
            } else {
              socket.emit('alertMsg',{message:"You don't have any available characters!",color:'red',timeout:5000});
            }
          } else {
            socket.emit('alertMsg',{message:"must have a name!",color:'red',timeout:5000});
          }
        } else {
          socket.emit('alertMsg',{message:"You don't have an api key!",color:'red',timeout:5000});
        }
      } catch (error){
        console.log(error);
      }
    });
    socket.on('listModels',async data =>{
      let modelList = await settingsCollection.find({type:'model'},{projection:{apiKey:0}}).toArray();
      socket.emit('modelList',modelList);
    });

    socket.on('tab',async tabName =>{
      if (tabName == 'Home'){
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

        socket.emit('keys',Object.keys(playerData.api_keys));
  
      } else if (tabName == 'Characters'){
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
        let advetureNames = ''
        if (showActiveAdventures){
          advetureNames = await gameDataCollection.distinct('activeAdventure',{type:'character',owner_id: new ObjectId(playerData._id)})
        } else {
          if (playerData.admin){
            advetureNames = await gameDataCollection.find({type:'adventure'}).project({name:1,_id:1}).toArray();
          } else {
            advetureNames = await gameDataCollection.distinct('adventures',{type:'character',owner_id: new ObjectId(playerData._id)})
          }
        }
        if (advetureNames != ''){
          socket.emit('adventureList',advetureNames);
        }
      } else if (tabName == 'History' && playerData.admin) {
        let historyFilter = {deleted:{$ne:true}};
        if (historyFilterByFunction != 'all' && historyTextSearch != '') {
          historyFilter = {$and:[{function:historyFilterByFunction,deleted:{$ne:true}},{$or:[{response:{$regex:historyTextSearch,$options:'i'}},{request:{$regex:historyTextSearch,$options:'i'}}]}]}
        } else if (historyFilterByFunction != 'all') {
          historyFilter = {function:historyFilterByFunction,deleted:{$ne:true}}
        } else if (historyTextSearch != '') {
          historyFilter = {$and:[{deleted:{$ne:true}},{$or:[{response:{$regex:historyTextSearch,$options:'i'}},{request:{$regex:historyTextSearch,$options:'i'}}]}]}
        }
        let history = await responseCollection.find(historyFilter).project({date:1,_id:1,created:1}).sort({created:-1}).toArray()
        socket.emit('historyList',history)
      }
    });


    if (playerData.admin){
      socket.emit('serverRole','admin')
      socket.on('historyFilterByFunction', async limit => {
        historyFilterByFunction = limit;
      });
      socket.on('historyDelete', async id => {
        try {
          await responseCollection.updateOne({_id:new ObjectId(id)},{$set:{deleted:true},$unset:{request:'',response:'',responseRaw:''}});
        } catch (error){
          console.log(error);
        }
      });
      socket.on('fetchHistory', async id => {
        try {
          let query = {_id:new ObjectId(id)};
          let history = await responseCollection.findOne(query);
          if (history){
            socket.emit('historyData',history);
          } else {
            socket.emit('error','could not find history with ID: '+id);
          }    
        } catch (error){
          console.log('error',error);
        }
      });
      socket.on('historyTextSearch',async data =>{
        historyTextSearch = data;
      });
      socket.on('replay',async data =>{
        socket.emit('alertMsg',{message:'replay recieved, running!',color:'green',timeout:10000});
        let response = await aiCall(data.messages,data.model,Number(data.temperature),Number(data.maxTokens),playerData.api_keys,'Replay')
        socket.emit('replayRan',{date:response.date,_id:response.allResponse_id});
      });

      socket.on('functionList',async data =>{
        let allFunctions = await settingsCollection.distinct("function",{type:"function"});
        socket.emit('functionList',allFunctions);
      });
      socket.on('fetchFunction',async functionName =>{
        try {
          let [ functionSettings , functionMessage ] = await Promise.all([
            settingsCollection.findOne({type:'function',"function":functionName}),
            settingsCollection.find({type:'message',"function":functionName}).toArray()
          ]);
          if (functionMessage){
            functionSettings.messages = functionMessage;
          }
          socket.emit('functionSettings',functionSettings)
        } catch (error) {
          console.log(error);
        }
      });
      socket.on('listLogs',async data =>{
        fs.readdir(__dirname+'/logs/', (err, files) => {
          if (err) {
            console.error(err);
            return;
          }
          files.sort((a, b) => b.localeCompare(a)); // Reverse sort
          socket.emit('logList',files)
        });
      });
      socket.on('tailLog',async logfile =>{
        sendLogs(socket,__dirname+'/logs/'+logfile)
      });
      socket.on('restartServer',async data =>{
        process.exit(0)
      });
      socket.on('changeProvider',async data =>{
        try {
          await settingsCollection.updateOne({type:'model',_id:new ObjectId(data.id)},{$set:{provider:data.provider}})
          socket.emit('alertMsg',{message:'Changed Provider',color:'green',timeout:1000});
        } catch (error) {
          console.log(error);
        }
      });
      socket.on('deleteModel',async data =>{
        try {
          await settingsCollection.deleteOne({type:'model',_id:new ObjectId(data)})
          socket.emit('alertMsg',{message:'Deleted Model',color:'green',timeout:1000});
        } catch (error) {
          console.log(error);
        }
      });
      socket.on('enableModel',async data =>{
        try {
          await settingsCollection.updateOne({type:'model',_id:new ObjectId(data)},{$set:{enable:true}})
          socket.emit('alertMsg',{message:'Enabled Model',color:'green',timeout:1000});
        } catch (error) {
          console.log(error);
        }
      });
      socket.on('disableModel',async data =>{
        try {
          await settingsCollection.updateOne({type:'model',_id:new ObjectId(data)},{$set:{enable:false}})
          socket.emit('alertMsg',{message:'Disabled Provider',color:'green',timeout:1000});
        } catch (error) {
          console.log(error);
        }
      });
      socket.on('renameModel',async data =>{
        try {
          await settingsCollection.updateOne({type:'model',_id:new ObjectId(data.id)},{$set:{model:data.newName}})
          socket.emit('alertMsg',{message:'Rename Model',color:'green',timeout:1000});
        } catch (error) {
          console.log(error);
        }
      });
      socket.on('newModel',async data =>{
        try {
          await settingsCollection.updateOne({type:'model',model:data.model},{$set:{provider:data.provider}},{upsert:true})
          socket.emit('alertMsg',{message:'Changed Provider',color:'green',timeout:1000});
        } catch (error) {
          console.log(error);
        }
      });
      socket.on('saveSettings', data => {
        console.log('['+new Date().toUTCString()+'] Player '+playerData.name+' saved');
        saveSettings(data,socket);
      });

      socket.on('scotRun',async data =>{
        socket.emit('alertMsg',{message:'Message recieved, running!',color:'green',timeout:10000});
        let response = await aiCall(data.messages,data.model,Number(data.temperature),Number(data.maxTokens),playerData.api_keys,'ScotGPT')
        if (response.role) {
          socket.emit('ScotRan',response.content);
        } else {
          socket.emit('alertMsg',{message:'Scot run failed!',color:'red',timeout:10000});
          socket.emit('ScotRan',response.content);
        }
      });
    }
    socket.on('disconnect', async () => {
      await gameDataCollection.updateOne({type:'player',_id:playerData._id},{$pull:{sockets:socket.id}});
      let test = await gameDataCollection.findOne({type:'player',_id:playerData._id});
      if (test.sockets.length == 0) {
        gameDataCollection.updateOne({type:'player',_id:playerData._id},{$set:{connected:false}});
        console.log('['+new Date().toUTCString()+'] Player disconnected:', playerData.name);
      }
    });
  } else {
    if (socket.handshake.auth.playerName) {
      playerData = await addPlayer(email,socket,clientIp);
    }
    if (playerData) {
      socket.emit("error",'Player added, refresh page to use');
      socket.disconnect();
    } else {
      if (socket.handshake.auth.playerName) {
        socket.emit("error","error adding user - maybe, refresh to check");
      } else {
        socket.emit("error","Enter Player Name, then click connect");
      }
      socket.disconnect();
    }
  }
});
async function saveSettings(data,socket){
  try {
    //clear previous saved messages
    await settingsCollection.deleteMany({type:'message-delete','function':data.function})
    //mark pre-existing 
    await settingsCollection.updateMany({type:'message','function':data.function},{$set:{updated:'no'}})
    
    //update
    for (let i = 0 ; i < data.messages.length; i++) {
      data.messages[i].updated = 'yes';
      data.messages[i].type = 'message';
      data.messages[i].function = data.function;
      console.log(data.messages[i])
      await settingsCollection.updateOne({type:'message','function':data.function,name:data.messages[i].name},{$set:data.messages[i]},{upsert:true})
    }
    delete data.messages
    await settingsCollection.updateOne({type:'function','function':data.function},{$set:data},{upsert:true})
    settingsCollection.updateMany({type:'message','function':data.function,updated:'no'},{$set:{type:'message-delete'}})
    settingsCollection.updateMany({type:'message','function':data.function,updated:'yes'},{$unset:{updated:''}})

    socket.emit('alertMsg',{message:'Settings saved.',color:'green',timeout:3000});
  } catch (error) {
    console.error('Error updating settings:', error);
    socket.emit('error',error)
  }
}
async function addPlayer(email,socket,clientIp) {
  let playerName = socket.handshake.auth.playerName.trim().replace(/[^a-zA-Z0-9]/g,'');
  let test = await gameDataCollection.findOne({type:'player',name:{$regex: new RegExp("^"+playerName+'$',"i")}});
  if (test) {
    socket.emit('alertMsg',{message:'Name already taken',color:'red',timeout:3000});
    socket.disconnect();
  } else {
    if (playerName.length > 0 && !test){
      console.log('adding user: '+playerName);
      let playerDoc = {
        name: playerName,
        type: 'player',
        ipList: [ clientIp ],
        email:email
      }
      try {
        await gameDataCollection.insertOne(playerDoc,{safe: true});
        return playerDoc
      } catch (error){
        console.error('Error saving response to MongoDB:', error);
      }
    }
  }
}
async function aiCall(messages, model, temperature, maxTokens, apiKeys,call_function) {
  temperature = Number(temperature);
  maxTokens = Number(maxTokens);
  let modelInfo = await settingsCollection.findOne({type:'model',"model":model});
  let response = ''
  let generatedResponse = ''
  try {
    if (modelInfo.provider == 'openai'){
      temperature = 1.7 * Number(temperature)
      response = await openaiCall(messages, model, temperature, maxTokens, apiKeys.openai );
    } else if (modelInfo.provider == 'gemini'){
      response = await geminiCall(messages, model, temperature, maxTokens, apiKeys.gemini );
    } else if (modelInfo.provider == 'anthropic'){
      response = await anthropicCall(messages, model, temperature, maxTokens, apiKeys.anthropic );
    } else {
      console.error('invalid provider:', ('invalid provider '+modelInfo.provider));
      return
    }
    settingsCollection.updateOne({model:response.model,provider:modelInfo.provider,type:'model'},{$set:{lastUsed:response.created}},{upsert:true})//record last time a model is used and create new models for the sub models openai creates (use gpt-4, actual could be gpt-4-0613)
    response.function = call_function
    await responseCollection.insertOne(response);
    generatedResponse = {
      content:response.response,
      date:response.date,
      role:'assistant',
      tokens:response.completion_tokens,
      allResponse_id:response._id
    }
    return generatedResponse;
  } catch (error) {
    console.error('Error generating response from OpenAI:', error);
    let generatedResponse = '['+new Date().toUTCString()+']'
    if (error.response) {
      generatedResponse += " Status: "+error.response.status+", "+error.response.statusText;
    }
    if (error.response.data.error.message) {
      generatedResponse += "\n"+error.response.data.error.message;
    }
    if (error.errno) {
      generatedResponse += " errno: "+error.errno;
    }
    if (error.code) {
      generatedResponse += " code: "+error.code;
    }
    try {
      delete error.config.headers['x-goog-api-key'];
      delete error.config.headers['x-api-key'];
      delete error.config.headers['Authorization'];
      let errorFormatted={
        temperature:temperature,
        max_tokens:maxTokens,
        messages:messages,
  
        headersSent:error.config.headers,
        requestSent:error.config.data,
  
        created:Math.round(new Date(error.response.headers.date).getTime()/1000),
        date:error.response.headers.date,
        headersResponse:error.response.headers,
        url:error.config.url,
        status:error.response.status,
        statusText:error.response.statusText,
  
        data:error.response.data,
        model:model,
        response:generatedResponse,
        finish_reason:error.response.status+":"+error.response.statusText,
      }
      responseCollection.insertOne(errorFormatted);

    } catch (error2) {console.log(error2)}
    return {content:generatedResponse}
  }
}
async function geminiCall(messages, model, temperature, maxTokens, apiKey) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  const headers = {'Content-Type': 'application/json','x-goog-api-key': apiKey};
  const systemMessage = messages.find(msg => msg.role === 'system');
  const nonSystemMessages = messages.filter(msg => msg.role !== 'system');

  const formattedMessages = nonSystemMessages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const data = {
    contents: formattedMessages,
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens,
      topP: 0.8,
      topK: 40
    }
  };

  if (systemMessage) {
    data.systemInstruction = {
      role: 'user',
      parts: [{ text: systemMessage.content }]
    };
  }

  try {
    const response = await axios.post(url, data, { headers });
    delete response.headers['x-goog-api-key'];
    delete response.config.headers['x-goog-api-key'];
    let responseFormatted={
      temperature:temperature,
      max_tokens:maxTokens,
      messages:messages,

      headersSent:response.config.headers,
      requestSent:data,

      created:Math.round(new Date(response.headers.date).getTime()/1000),
      date:response.headers.date,
      duration:response.headers['server-timing'].replace("gfet4t7; dur=",""),
      headersResponse:response.headers,
      url:url,
      status:response.status,
      statusText:response.statusText,

      data:response.data,
      model:response.data.modelVersion,
      response:response.data.candidates[0].content.parts[0].text,
      finish_reason:response.data.candidates[0].finishReason,
      prompt_tokens:response.data.usageMetadata.promptTokenCount,
      completion_tokens:response.data.usageMetadata.candidatesTokenCount,
      tokens:response.data.usageMetadata.totalTokenCount,
    }
    return responseFormatted;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}
async function anthropicCall(messages, model, temperature, maxTokens, apiKey) {
  const url = 'https://api.anthropic.com/v1/messages';

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  };
  messages[0].role = 'user';//Anthropic kept throughing errors if the first role isn't user
  const data = {
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    messages: messages
  };
  try {
    const start = Date.now();
    const response = await axios.post(url, data, { headers });
    const duration = Date.now() - start;
    delete response.headers['x-api-key'];
    delete response.config.headers['x-api-key'];
    let responseFormatted={
      temperature:temperature,
      max_tokens:maxTokens,
      messages:messages,

      headersSent:response.config.headers,
      requestSent:data,
      created:Math.round(new Date(response.headers.date).getTime()/1000),
      date:response.headers.date,
      duration:duration,
      headersResponse:response.headers,
      url:url,
      status:response.status,
      statusText:response.statusText,

      data:response.data,
      model:data.model,
      response:response.data.content[0].text,
      finish_reason:response.data.stop_reason,
      prompt_tokens:response.data.usage.input_tokens,
      completion_tokens:response.data.usage.output_tokens,
      tokens:response.data.usage.input_tokens+response.data.usage.output_tokens,
    }
    return responseFormatted;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}
async function openaiCall(messages, model, temperature, maxTokens, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': "Bearer "+apiKey,
  };
  const data = {
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    messages: messages
  };
  try {
    const response = await axios.post(url, data, { headers });
    delete response.headers['Authorization'];
    delete response.config.headers['Authorization'];
    let responseFormatted={
      temperature:temperature,
      max_tokens:maxTokens,
      messages:messages,

      headersSent:response.config.headers,
      requestSent:data,

      created:Math.round(new Date(response.headers.date).getTime()/1000),
      date:response.headers.date,
      duration:response['headers']['openai-processing-ms'],
      headersResponse:response.headers,
      url:url,
      status:response.status,
      statusText:response.statusText,

      data:response.data,
      model:response.data.model,
      response:response.data.choices[0].message.content,
      finish_reason:response.data.choices[0].finish_reason,
      prompt_tokens:response.data.usage.prompt_tokens,
      completion_tokens:response.data.usage.completion_tokens,
      tokens:response.data.usage.total_tokens
    }
    return responseFormatted;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}
async function sendAdventureData(adventure_id,socket){
  let [ adventureMessages , adventureData ] = await Promise.all([
    gameDataCollection.find({type:'message',adventure_id:new ObjectId(adventure_id)}).sort({created:1}).toArray(),
    gameDataCollection.findOne({type:'adventure',_id:new ObjectId(adventure_id)},{projection:{api_keys:0,api_key:0,owner_id:0,_id:0}}),
  ]);
  if (adventureData.api_key) {
    adventureData.api_key = null;
  }
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

  let settings = await settingsCollection.findOne({type:'function',"function":'adventureStart'});
  let apiKeys = adventure.api_keys;
  let model = adventure.model || settings.model

  let characters = await gameDataCollection.find({type:'character','activeAdventure._id':adventure._id}).toArray();
  
  //let messages = formatStartMessages(settings,characters);
  let messages = await formatMessages("adventureStart",null,{"characters":characters},adventure.realm);

  if (settings.active == 'true'){
    let openAiResponse = await aiCall(messages,model,Number(settings.temperature),Number(settings.maxTokens),apiKeys,'adventureStart');
    if (openAiResponse.id) {
      openAiResponse.type = 'message';
      openAiResponse.adventure_id = adventure._id;
      openAiResponse.originMessage = true;
      openAiResponse.date = new Date().toUTCString();
      openAiResponse.created = Math.round(new Date(openAiResponse.date).getTime()/1000);

      io.sockets.in('Adventure-'+adventure._id).emit('adventureEvent',openAiResponse);
      try {
        gameDataCollection.insertOne(openAiResponse,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }
      
      messages = await formatMessages("adventureName",[{role:"user",content:openAiResponse.content}],{party_name:adventure.party_name});
      
      let cru_settings = await settingsCollection.findOne({type:'function',"function":'adventureName'});
      let croupierResponse = await aiCall(messages,cru_settings.model,Number(cru_settings.temperature),Number(cru_settings.maxTokens),apiKeys,'adventureName');
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
      }
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
      //TODO
      //level up character
    }
  } catch (error) {
    console.error('Error ending adventure:', error);
  }
}
async function continueAdventure(adventure_id){
  io.sockets.in('Adventure-'+adventure_id).emit('continueAdventure',true); //put the confidence builder dots in chat
  let openAiResponse;
  //get all the info from database at the same time
  let [ adventure , allMessages, characters, settings] = await Promise.all([
    gameDataCollection.findOne({type:'adventure',_id:adventure_id}),
    gameDataCollection.find({type:'message',adventure_id:adventure_id}).sort({created:1}).toArray(),
    gameDataCollection.find({type:'character','activeAdventure._id':adventure_id}).toArray(),
    await settingsCollection.findOne({type:'function',"function":'game'})
  ]);
  let apiKeys = adventure.api_keys;
  let model = adventure.model || settings.model;
  let messages = await formatMessages("game",allMessages,{characters:characters,model:model,maxTokens:settings.maxTokens,adventure_id:adventure_id},adventure.realm);
  
  if (settings.active == 'true'){
    openAiResponse = await aiCall(messages,model,Number(settings.temperature),Number(settings.maxTokens),apiKeys,'game');
    if (openAiResponse.id) {
      openAiResponse.type = 'message';
      openAiResponse.adventure_id = adventure_id;
      openAiResponse.owner_id = adventure.owner_id;
      openAiResponse.date = new Date().toUTCString();
      openAiResponse.created = Math.round(new Date(openAiResponse.date).getTime()/1000);
      try {
        await gameDataCollection.insertOne(openAiResponse,{safe: true});
      } catch (error) {
        console.error('Error saving response to MongoDB:', error);
      }
      io.sockets.in('Adventure-'+adventure_id).emit('adventureEvent',openAiResponse);
    }
  } else {
    console.log(messages,model,Number(settings.temperature),Number(settings.maxTokens));
    setTimeout(()=> {io.sockets.in('Adventure-'+adventure_id).emit('adventureEvent',{role:'assistent',content:'fake'})}, 3000);
  }
}
async function formatMessages(functionName,userMessages = [],additionData = {},realm){
  if (!additionData.characters) additionData.characters={}

  let allOrders = await settingsCollection.distinct("order",{"function":functionName,$or:[{realm:"<default>"},{realm:realm}]});
  let messages=[], userMessagesIx=1000;

  let userMessagesRemain = 0
  //for game message, need to put the last user message after the last assistant
  if (functionName === "game") {
    userMessagesRemain = 1
  }
  for (let i = 0 ; i < allOrders.length; i++) {
    //game messages start at 1000, blend messages in the middle if there are messages > 1000
    while (allOrders[i] > userMessagesIx && userMessages.length > userMessagesRemain) {
      let message = userMessages.shift()
      messages.push({role:message.role,content:message.content});
      userMessagesIx = userMessagesIx + 10;
    }
    let message = await settingsCollection.findOne({order:allOrders[i],"function":functionName,"realm":realm});
    if (!message) {
      message = await settingsCollection.findOne({order:allOrders[i],"function":functionName,"realm":"<default>"});
    }
    
    messages.push({role:message.role,content:message.content});
  }

  //Append the rest of the game messages
  while (userMessages.length > 0) {
    let message = userMessages.shift()
    messages.push({role:message.role,content:message.content});
    userMessagesIx = userMessagesIx + 10;
  }

  //message macros
  messages = JSON.stringify(messages);
  let regex = /(?<=\$\{)(.*?)(?=\})/g;
  let match = messages.match(regex);
  if (match){
    for (let i = 0 ; i < match.length; i++) {
      if (match[i] == 'Party_Name') {
        messages = messages.replaceAll('${Party_Name}',additionData.party_name);
        jsonData = JSON.parse(JSON.stringify(jsonData).replaceAll('${Party_Name}',additionData.party_name));
      } else if (match[i] == 'char_count' && additionData.characters) {
        messages = messages.replaceAll('${char_count}',additionData.characters.length);
      } else if (match[i] == 'next_level' && additionData.characters) {
        let level = (additionData.characters.reduce((prev, curr) => prev.details.Lvl < curr.details.Lvl ? prev : curr)).details.Lvl;
        messages = messages.replaceAll('${next_level}',level);
      } else if (match[i] == 'CharTable' && additionData.characters) {
        let charTable = CreateCharTable(additionData.characters);
        messages = messages.replaceAll('${CharTable}',charTable);
      } else if (match[i] == 'char_list' && additionData.characters) {
        let character_info = additionData.characters[0].name+" is a "+additionData.characters[0].details.Class;
        for (let i = 1 ; i < additionData.characters.length; i++){
          character_info += '\\n'+additionData.characters[i].name+" is a "+additionData.characters[i].details.Class;
        }
        messages = messages.replaceAll('${char_list}',character_info);
      } else {
        console.log("message formatting error","found macro: '"+match[i]+"' but not valid or missing additionData");
      }
    }
  }
  messages = JSON.parse(messages);

  return messages
}
async function sendLogs(socket,logfile) {
  var maxlen = 10000
  var fileContent = fs.readFileSync(logfile).toString();
  if (fileContent.length > maxlen) {
    fileContent = fileContent.substring(fileContent.length-maxlen)
  }
  socket.emit('logStart',fileContent);

  socket.tail = new Tail(logfile);
  socket.tail.on("line", function(data) {
    socket.emit('logTail',data);
  });
}
function CreateCharTable(characters){
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
    table+='\\n'+CharData.name;
    if (CharData.name.length < 10){
      table+=spaces.substring(0,10-CharData.name.length);
    }
    for (let i = 0 ; i < attributes.length; i++){
      table+=('|'+CharData.details[attributes[i]]).replace(/\n/g,' ');
      if ((''+CharData.details[attributes[i]]).length < attributesLen[i]){
        table+=spaces.substring(0,attributesLen[i]-(''+CharData.details[attributes[i]]).length)
      }
    };
  });
  return table;
}