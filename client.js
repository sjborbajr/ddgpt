const socket = io({autoConnect: false});

let playerName = '', currentTab = localStorage.getItem('currentTab');
if(document.getElementById(currentTab+'Btn')){
  console.log("currentTab",currentTab);
  document.getElementById(currentTab+'Btn').click();
} else {
  console.log("nocurrentTab");
  document.getElementById("HomeBtn").click();
}

document.getElementById('SystemBtn').style.display = 'none';
document.getElementById('character1').style.display = 'none';
document.getElementById('character2').style.display = 'none';
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
  let optionDoc = document.getElementById('characters_list'), curChar = document.getElementById('characters_list').value;
  if (optionDoc.options.length > 0) {
    for(let i = (optionDoc.options.length - 1); i >= 0; i--) {
      optionDoc.remove(i);
    }
  }
  let displayChar = false;
  if (data.length) {
    for(let i = 0; i < data.length; i++){
      optionDoc.options[i] = new Option(data[i].name, data[i]._id);
    }
    charData = data._id;
    displayChar = data[0]._id;
  } else if (data) {
    optionDoc.options[0] = new Option(data[i].name, data[i]._id);
    displayChar = data._id;
    charData = [data];
  }
  if (curChar == '') {
    document.getElementById('character1').style.display = 'none';
    document.getElementById('character2').style.display = 'none';
    socket.emit('fetchCharData',displayChar)
  } else {
    document.getElementById('characters_list').value = curChar;
    if (document.getElementById('characters_list').value != curChar){
      document.getElementById('character1').style.display = 'none';
      document.getElementById('character2').style.display = 'none';
    }
  }
});
socket.on('charData', (data) => {
  if (localStorage.getItem('currentTab') == 'Characters') {
    if (document.getElementById('characters_list').value == data._id) {
      document.getElementById('character1').style.display = 'inline';
      document.getElementById('character2').style.display = 'inline';
      document.getElementById('character_name').value = data.name;
      document.getElementById('character_id').value = data._id;
      document.getElementById('character_owner').options[0].value = data.owner_id;
      document.getElementById('character_owner').options[0].innerText = 'resolving...';
      document.getElementById('character_owner').value = data.owner_id;
      socket.emit('listOwners');
      document.getElementById('character_state').value = data.state;
      document.getElementById('character_activeAdventure').value = data.activeAdventure;
      let attributes = ["Race","Gender","Lvl","STR","DEX","CON","INT","WIS","CHA","HP","AC","Weapon","Armor","Class","Inventory","Backstory"];
      for (let i = 0 ; i < attributes.length; i++){
        document.getElementById('character_'+attributes[i]).value = data.details[attributes[i]];
      };
    } else {
      console.log("recieved data for "+data._id+" but drop down set to "+document.getElementById('characters_list').value)
    }
  } else {
    console.log('no longer on char tab');
  }
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
socket.on('listedOwners', (data) => {
  if (localStorage.getItem('currentTab') == 'Characters') {
    let optionDoc = document.getElementById('character_owner'), owner = optionDoc.options[0].value;
    if (data.length) {
      for(let i = 0; i < data.length; i++){
        optionDoc.options[i] = new Option(data[i].name, data[i]._id);
      }
      optionDoc.value = owner;
    } else if (data) {
      if (data._id == optionDoc.options[0].value){
        optionDoc.options[0].innerText = data.name
      } else {
        optionDoc.options[1] = new Option(data.name, data._id);
      }
    }
    optionDoc.disabled = false;
  } else {
    console.log("recieved owner list but no longer on char tab");
  }
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
  socket.emit("saveChar",{_id: document.getElementById('character_id').value,
                     owner_id: document.getElementById('character_owner').value,
                         data:{
                           name: document.getElementById('character_name').value,
                     adventures: document.getElementById('character_adventures').value.split(","),
                          state: document.getElementById('character_state').value,
                        details: {
                             Race: document.getElementById('character_Race').value,
                           Gender: document.getElementById('character_Gender').value,
                            Class: document.getElementById('character_Class').value,
                              Lvl: document.getElementById('character_Lvl').value,
                              STR: document.getElementById('character_STR').value,
                              DEX: document.getElementById('character_DEX').value,
                              CON: document.getElementById('character_CON').value,
                              INT: document.getElementById('character_INT').value,
                              WIS: document.getElementById('character_WIS').value,
                              CHA: document.getElementById('character_CHA').value,
                               HP: document.getElementById('character_HP').value,
                               AC: document.getElementById('character_AC').value,
                           Weapon: document.getElementById('character_Weapon').value.split(","),
                            Armor: document.getElementById('character_Armor').value.split(","),
                        Inventory: document.getElementById('character_Inventory').value.split(","),
                        Backstory: document.getElementById('character_Backstory').value
                                  }
                          }}
              )
}
function showCharsOption() {
  if (document.getElementById('all_characters').checked) {
    socket.emit('showCharacters','All')
    socket.emit('tab','Characters') //will refresh data
  } else {
    socket.emit('showCharacters','Own')
    socket.emit('tab','Characters') //will refresh data
  }
}
function showChar(id) {
  document.getElementById('character1').style.display = 'none';
  document.getElementById('character2').style.display = 'none';
  
  //remove all but the top owner 
  let optionDoc = document.getElementById('character_owner');
  if (optionDoc.options.length > 1) {
    for(let i = (optionDoc.options.length - 1); i >= 1; i--) {
      //optionDoc.remove(i);
    }
  }
  optionDoc.disabled = true;
  optionDoc.options[0].value = 'unowned';
  optionDoc.options[0].innerText = 'unowned';
  socket.emit('fetchCharData',id);
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
