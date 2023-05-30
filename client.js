const socket = io({autoConnect: false});

let playerName = '', currentTab = localStorage.getItem('currentTab'), charData;
if(document.getElementById(currentTab+'Btn')){
  console.log("currentTab",currentTab);
  document.getElementById(currentTab+'Btn').click();
} else {
  console.log("nocurrentTab");
  document.getElementById("HomeBtn").click();
}

document.getElementById('SystemBtn').style.display = 'none';
document.getElementById('all_characters').disabled = true;
document.getElementById('character1').style.display = 'none';
document.getElementById('character2').style.display = 'none';
document.getElementById('character3').style.display = 'none';
document.getElementById('save').addEventListener('click', save);
document.getElementById('saveChar').addEventListener('click', saveChar);
document.getElementById('connectButton').addEventListener('click', connectButton);
document.getElementById('disconnectButton').addEventListener('click', disconnectButton);

// Attach event listeners to the buttons
window.onload = function() {
  //do something?
  let playerNameRead = localStorage.getItem('playerName'); // get playerName from local storage
  if (playerNameRead) {
    document.getElementById('player-name').value = playerNameRead
    connectButton();
  };
};
socket.on('settings', data => {
  console.log('got game settings');
  document.getElementById('system-message0').value = data.systemmessages[0].value;
  document.getElementById('system-message0-ck').checked = data.systemmessages[0].checked;
  autoResize(document.getElementById('system-message0'));
  document.getElementById('system-message1').value = data.systemmessages[1].value;
  document.getElementById('system-message1-ck').checked = data.systemmessages[1].checked;
  autoResize(document.getElementById('system-message1'));
  document.getElementById('system-message2').value = data.systemmessages[2].value;
  document.getElementById('system-message2').disabled = true;
  document.getElementById('system-message2-ck').checked = data.systemmessages[2].checked;
  document.getElementById('system-message2-ck').disabled = true;
  autoResize(document.getElementById('system-message2'));
  document.getElementById('system-message3').value = data.systemmessages[3].value;
  document.getElementById('system-message3').checked = data.systemmessages[3].checked;
  autoResize(document.getElementById('system-message3'));
  document.getElementById('system-message4').value = data.systemmessages[4].value;
  document.getElementById('system-message4').checked = data.systemmessages[4].checked;
  autoResize(document.getElementById('system-message4'));
  document.getElementById('system-message5').value = data.systemmessages[5].value;
  document.getElementById('system-message5').checked = data.systemmessages[5].checked;
  autoResize(document.getElementById('system-message5'));

  document.getElementById('temperature').value = data.temperature;
  document.getElementById('maxTokens').value = data.maxTokens;
  document.getElementById('model').value = data.model;
});
socket.onAny((event, ...args) => {
  console.log(event, args);
});
socket.on('serverRole', role => {
  if (role == 'admin') {
    document.getElementById('SystemBtn').style.display = 'inline';
    document.getElementById('all_characters').disabled = false;
  };
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
  document.getElementById('player-name').disabled = true;
  document.getElementById('disconnectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Change';
  localStorage.setItem('playerName', playerName);
  socket.emit('tab',currentTab);
});
socket.on('slap', (playerName) => {
  // are you alive message?
});
socket.on('charList', (data) => {
  let optionDoc = document.getElementById('characters_list');
  //remove options
  if (optionDoc.options.length > 0) {
    for(let i = (optionDoc.options.length - 1); i >= 0; i--) {
      optionDoc.remove(i);
    }
  }
  //for (let name)
  let displayChar = false;
  if (data.length) {
    for(let i = 0; i < data.length; i++){
      optionDoc.options[i] = new Option(data[i].name, data[i].name);
    }
    charData = data;
    displayChar = data[0].name;
  } else if (data) {
    optionDoc.options[0] = new Option(data.name, data.name);
    displayChar = data.name;
    charData = [data];
  }
  showChar(displayChar)
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
                        {"value":document.getElementById('system-message0').value,"checked":document.getElementById('system-message0-ck').checked},
                        {"value":document.getElementById('system-message1').value,"checked":document.getElementById('system-message1-ck').checked},
                        {"value":document.getElementById('system-message2').value,"checked":document.getElementById('system-message2-ck').checked},
                        {"value":document.getElementById('system-message3').value,"checked":document.getElementById('system-message3-ck').checked},
                        {"value":document.getElementById('system-message4').value,"checked":document.getElementById('system-message4-ck').checked},
                        {"value":document.getElementById('system-message5').value,"checked":document.getElementById('system-message5-ck').checked}
                      ],
                      "temperature":document.getElementById('temperature').value,
                      "maxTokens":document.getElementById('maxTokens').value,
                      "model":document.getElementById('model').value
                     }
              )
}
function saveChar() {
  console.log('saveChar');
  //socket.emit("save",{"systemmessages":[
  //                      {"value":document.getElementById('system-message0').value,"checked":document.getElementById('system-message0-ck').checked},
  //                      {"value":document.getElementById('system-message1').value,"checked":document.getElementById('system-message1-ck').checked},
  //                      {"value":document.getElementById('system-message2').value,"checked":document.getElementById('system-message2-ck').checked},
  //                      {"value":document.getElementById('system-message3').value,"checked":document.getElementById('system-message3-ck').checked},
  //                      {"value":document.getElementById('system-message4').value,"checked":document.getElementById('system-message4-ck').checked},
  //                      {"value":document.getElementById('system-message5').value,"checked":document.getElementById('system-message5-ck').checked}
  //                    ],
  //                    "temperature":document.getElementById('temperature').value,
  //                    "maxTokens":document.getElementById('maxTokens').value,
  //                    "model":document.getElementById('model').value
  //                   }
  //            )
}
function showChars() {
  if (document.getElementById('all_characters').checked) {
    socket.emit('showCharacters','All')
    socket.emit('tab','Characters') //will refresh data
  } else {
    socket.emit('showCharacters','Own')
    socket.emit('tab','Characters') //will refresh data
  }
}
function showChar(name) {
  let displayChar = charData.filter(item => {return item.name === name})[0];
  document.getElementById('character1').style.display = 'inline';
  document.getElementById('character2').style.display = 'inline';
  document.getElementById('character3').style.display = 'inline';
  document.getElementById('character_name').value = displayChar.name;
  let attributes = ["Race","Gender","Lvl","STR","DEX","CON","INT","WIS","CHA","HP","AC","Weapon","Armor","Class","Inventory","Backstory"];
  for (let i = 0 ; i < attributes.length; i++){
    document.getElementById('character_'+attributes[i]).value = displayChar.details[attributes[i]];
  };
}
function connectButton() {
  let temp = document.getElementById('player-name').value
  document.getElementById('player-name').value = temp.trim().replace(/[^a-zA-Z0-9]/g,'');
  if (document.getElementById('player-name').value.length == 0) {
    alert('name must not be empty')
  } else if (document.getElementById('connectButton').innerText == 'Connect' && document.getElementById('player-name').value.length > 0){
    playerName = document.getElementById('player-name').value;
    let authNonce = localStorage.getItem('authNonce') || '';
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
  //hide all content
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  //reset color
  tablinks = document.getElementsByClassName("tablink");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
  }
  //show the right page
  document.getElementById(pageName).style.display = "block";
  //set tab color
  elmnt.style.backgroundColor = color;
  //tell the server which tab was selected
  if (!document.getElementById('disconnectButton').disabled){
    socket.emit('tab',pageName);
  }
  //remember which tab was last
  localStorage.setItem('currentTab',pageName);
}
