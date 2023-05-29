const socket = io({autoConnect: false}), canvas = document.getElementById('canvas'), canvas2 = document.getElementById('canvas2');

const nameForm = document.getElementById('name-form');
const systemmessage0 = document.getElementById('system-message0'), systemmessage1 = document.getElementById('system-message1'), systemmessage2 = document.getElementById('system-message2'), systemmessage3 = document.getElementById('system-message3'), systemmessage4 = document.getElementById('system-message4'), systemmessage5 = document.getElementById('system-message5');
const systemmessage0ck = document.getElementById('system-message0-ck'), systemmessage1ck = document.getElementById('system-message1-ck'), systemmessage2ck = document.getElementById('system-message2-ck'), systemmessage3ck = document.getElementById('system-message3-ck'), systemmessage4ck = document.getElementById('system-message4-ck'), systemmessage5ck = document.getElementById('system-message5-ck');
// Get the element with id="defaultOpen" and click on it
document.getElementById("defaultOpen").click();

let win = 0, loose = 0, play = 0;

document.getElementById('save').addEventListener('click', save);
document.getElementById('connectButton').addEventListener('click', connectButton);
document.getElementById('disconnectButton').addEventListener('click', disconnectButton);

let playerName = localStorage.getItem('playerName'); // get playerName from local storage
if (playerName) {
  document.getElementById('player-name').value = playerName
  connectButton();
};
// Attach event listeners to the buttons
window.onload = function() {
  //do something?
};
socket.on('gameState', data => {
  console.log('got game state');
  systemmessage0.value = data.systemmessages[0].value;
  systemmessage0ck.checked = data.systemmessages[0].checked;
  autoResize(systemmessage0);
  systemmessage1.value = data.systemmessages[1].value;
  systemmessage1ck.checked = data.systemmessages[1].checked;
  autoResize(systemmessage1);
  systemmessage2.value = data.systemmessages[2].value;
  systemmessage2.disabled = true;
  systemmessage2ck.checked = data.systemmessages[2].checked;
  systemmessage2ck.disabled = true;
  autoResize(systemmessage2);
  systemmessage3.value = data.systemmessages[3].value;
  systemmessage3ck.checked = data.systemmessages[3].checked;
  autoResize(systemmessage3);
  systemmessage4.value = data.systemmessages[4].value;
  systemmessage4ck.checked = data.systemmessages[4].checked;
  autoResize(systemmessage4);
  systemmessage5.value = data.systemmessages[5].value;
  systemmessage5ck.checked = data.systemmessages[5].checked;
  autoResize(systemmessage5);

  document.getElementById('temperature').value = data.settings.temperature;
  document.getElementById('maxTokens').value = data.settings.maxTokens;
  document.getElementById('model').value = data.settings.model;
});
socket.onAny((event, ...args) => {
  console.log(event, args);
});
socket.on('error', data => {
  alert (data);
  if (data == 'user not authenticated'){
    document.getElementById('player-name').value = ''
    localStorage.removeItem('playerName');
    localStorage.removeItem('authNonce');
  }
});
socket.on('connect', () => {
  console.log('Connected to server');
  //nameForm.style.display = 'none';
  document.getElementById('player-name').disabled = true;
  document.getElementById('disconnectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Change';
});
socket.on('slap', (playerName) => {
  // are you alive message?
});
socket.on('nameChanged', (name) => {
  localStorage.setItem('playerName', name);
  playerName = name
  document.getElementById('player-name').disabled = true;
  document.getElementById('player-name').value = name;
  document.getElementById('connectButton').innerText = 'Change';
});
socket.on('nonce', (nonce) => {
  localStorage.setItem('authNonce', nonce);
});
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  document.getElementById('connectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Connect';
  document.getElementById('disconnectButton').disabled = true;
  document.getElementById('player-name').disabled = false;
});
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
function save() {
  console.log('save');
  socket.emit("save",{"systemmessages":[
                        {"value":systemmessage0.value,"checked":systemmessage0ck.checked},
                        {"value":systemmessage1.value,"checked":systemmessage1ck.checked},
                        {"value":systemmessage2.value,"checked":systemmessage2ck.checked},
                        {"value":systemmessage3.value,"checked":systemmessage3ck.checked},
                        {"value":systemmessage4.value,"checked":systemmessage4ck.checked},
                        {"value":systemmessage5.value,"checked":systemmessage5ck.checked}
                      ],"settings":{
                        "temperature":document.getElementById('temperature').value,
                        "maxTokens":document.getElementById('maxTokens').value,
                        "model":document.getElementById('model').value
                      }
                     }
              )
}
function connectButton() {
  let temp = document.getElementById('player-name').value
  document.getElementById('player-name').value = temp.trim().replace(/[^a-zA-Z0-9]/g,'');
  if (document.getElementById('player-name').value.length == 0) {
    alert('name must not be empty')
  } else if (document.getElementById('connectButton').innerText == 'Connect' && document.getElementById('player-name').value.length > 0){
    let playerName = document.getElementById('player-name').value; // get playerName from local storage
    let authNonce = localStorage.getItem('authNonce') || ''; // get authNonce from local storage
    socket.auth = { playerName, authNonce };
    socket.connect();
    console.log('connect attempt')
  } else if (document.getElementById('player-name').disabled && document.getElementById('connectButton').innerText == 'Change') {
    console.log('enabling change name feature')
    document.getElementById('player-name').disabled = false;
    document.getElementById('connectButton').innerText = 'Submit';
  } else {
    console.log('requesting name change')
    socket.emit("changeName",document.getElementById('player-name').value);
  }
}
function disconnectButton() {
  socket.disconnect();
}
function saveplaying(){
  console.log('saveplaying');
  socket.emit("saveplaying",playing.checked);
}
function openPage(pageName,elmnt,color) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablink");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
  }
  document.getElementById(pageName).style.display = "block";
  elmnt.style.backgroundColor = color;
}
