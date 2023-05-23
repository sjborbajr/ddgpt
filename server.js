// Import required modules
const express = require('express'), http = require('http'), socketIO = require('socket.io'), fs = require('fs'), path = require('path');
//RateLimit = require('express-rate-limit'), 
// Set up the server
const app = express(), server = http.createServer(app), io = socketIO(server);
let joincount = 0, turnTimeout = null;//, limiter = RateLimit({windowMs: 500,max: 25});

// Start the server
const port = 9000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// apply rate limiter to all requests
//app.use(limiter);
//serv from the public folder
app.use(express.static(path.join(__dirname, 'public')));
//client.js is in root dir with server.js
app.get('/client.js', (req, res) => { res.set('Content-Type', 'text/javascript'); res.sendFile(path.join(__dirname, 'client.js')); });
//send public/index.html if no specific file is requested
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const gameStatePrivate = JSON.parse(fs.readFileSync('gameStatePrivate.private'));
const gameStatePublic = JSON.parse(fs.readFileSync('gameStatePublic.private'));
setInterval(ServerEvery1Second, (1*1000));

for (let playerID in gameStatePublic.players) {
  gameStatePublic.players[playerID].connected = false;
}

io.on('connection', (socket) => {
  // Get the user id from handshake
  const userId = socket.handshake.auth.playerName;
  console.log('User connected: '+userId);
  if ( !(gameStatePublic.players[userId])) {
    addPlayer(userId);
  }
  gameStatePublic.players[userId].connected = true;
  // Send current game state to the player
  sendState(socket)
  gameStatePublic.players[userId].turnTimeout = setTimeout(() => { handleInactivity(socket,userId); }, ( 30 * 1000 ));

  // Log all recieved events/data
  socket.onAny((event, ...args) => {
    console.log(event, args);
  });
  
  socket.on('hit', () => {
    console.log('Player disconnected:', userId);
  });
  socket.on('disconnect', () => {
    console.log('Player disconnected:', userId);
    gameStatePublic.players[userId].connected = false;
  });
});
function saveState() {
  fs.writeFileSync('gameStatePrivate.private', JSON.stringify(gameStatePrivate, null, 2));
  fs.writeFileSync('gameStatePublic.private', JSON.stringify(gameStatePublic, null, 2));
}
function sendState(socket) {
  //send game state to everyone
  socket.emit('gameState', gameStatePublic);
}
function handleInactivity(socket,userId) {
  clearTimeout(turnTimeout);
  turnTimeout = null;
  if (Object.values(gameStatePublic.players).filter((player) => player.connected).length > 1) {
    console.log("Slap "+userId);
    
    if (gameStatePublic.players[userId].connected){
      socket.emit("slap",userId);
    }
    
    sendState(socket);
  }

}
function addPlayer(userId) {
  console.log('adding user: '+userId)
  gameStatePublic.players[userId] = {
    hand: [],
    score: 0,
    join_order: joincount++,
    playing: false,
    played: false,
    turn: false,
    winner: null,
  };
}
function ServerEvery1Second() {
  if (!gameStatePublic.gameover) {
    //let CurrentPlayer = getCurrentPlayer();
    //console.log("current player: "+CurrentPlayer);
    //let PlayerCount = Object.values(gameStatePublic.players).filter((player) => player.playing).length;
    //console.log("player count: "+PlayerCount);
  }
}