const socket = io({autoConnect: false}), canvas = document.getElementById('canvas'), canvas2 = document.getElementById('canvas2');

const ctx = canvas.getContext('2d'), nameForm = document.getElementById('name-form');

let win = 0, loose = 0, play = 0;

let playerName = localStorage.getItem('playerName'); // get playerName from local storage
if (playerName) {
  nameForm.style.display = 'none';
  socket.auth = { playerName };
  socket.connect();
};
// Attach event listeners to the buttons
nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!(document.getElementById('player-name').value == '<dealer>')) {
    playerName = document.getElementById('player-name').value;
    socket.auth = { playerName };
    socket.connect();
    nameForm.style.display = 'none';
    localStorage.setItem('playerName', playerName);
  }
});
window.onload = function() {
};
socket.on('gameState', data => {
  console.log('got game state');

});
socket.onAny((event, ...args) => {
  console.log(event, args);
});
socket.on('connect', () => {
  console.log('Connected to server');
});
socket.on('slap', (userId) => {
  // are you alive message?
});
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
