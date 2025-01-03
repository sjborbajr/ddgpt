//const socket = io({autoConnect: false});
const socket = io();

let playerName = '', currentTab = localStorage.getItem('currentTab') || 'Home', settingEditCell, allRealms = ["<default>"], modelList = [ 'gpt-4' ];

//Global variable for resize - shared between to functions
var startX, initialLeftWidth, resizeTarget;

//global variables for data from server
let char_classes, abilities, alignments, races, backgrounds, basecut = .65, testers = ["Steve","Evan","Ronin"];
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;
recognition.onerror = (event) => {
  console.error('Speech recognition error:', event.error);
};
recognition.onresult = (event) => {
  const transcript = Array.from(event.results).map(result => result[0].transcript).join(' ');
  document.getElementById('player-input-field-mic').value = (document.getElementById('player-input-field').value.trim()+" ").trim()+transcript.replaceAll("  "," ").replaceAll(" carriage return","\n").replaceAll(" period",".").replaceAll("\n ","\n");;
};

window.onload = function() {
  let playerNameRead = localStorage.getItem('playerName');
  if (playerNameRead) {
    document.getElementById('player-name').value = playerNameRead
    connectButton();
  };
  if(document.getElementById(currentTab+'Btn')){
    document.getElementById(currentTab+'Btn').click();
  } else {
    document.getElementById("HomeBtn").click();
  }
  if (localStorage.getItem('temperatureScot')){
    document.getElementById('temperatureScot').value = localStorage.getItem('temperatureScot');
  }
  if (localStorage.getItem('maxTokensScot')){
    document.getElementById('maxTokensScot').value = localStorage.getItem('maxTokensScot');
  }
  if (localStorage.getItem('modelScot')){
    document.getElementById('modelScot').value = localStorage.getItem('modelScot');
  }
};

socket.onAny((event, ...args) => {
  if (event != 'settings' && event != 'logTail'){
    console.log(event, args);
  }
});
socket.on('serverRole', role => {
  if (role == 'admin') {
    document.getElementById('SystemBtn').style.display = 'inline';
    document.getElementById('ScotGPTBtn').style.display = 'inline';
    document.getElementById('HistoryBtn').style.display = 'inline';
    setTimeout(function() {
      document.getElementById('HomeBtn').style.width = '16%'
      document.getElementById('CharactersBtn').style.width = '16%'
      document.getElementById('AdventuresBtn').style.width = '17%'
      document.getElementById('SystemBtn').style.width = '17%'
      document.getElementById('ScotGPTBtn').style.width = '17%'
      document.getElementById('HistoryBtn').style.width = '17%'
    }, 100); //had to wait till they were shown to resize them
  };
});
socket.on('functionList', allFunctions => {
  let optionDoc = document.getElementById('functionList'), curOption = document.getElementById('functionList').value,firstFunction;
  while (optionDoc.length > 0) optionDoc.remove(0);
  if (allFunctions.length) {
    for(let i = 0; i < allFunctions.length; i++){
      optionDoc.options[i] = new Option(allFunctions[i], allFunctions[i]);
    }
    firstFunction = allFunctions[0];
  } else if (allFunctions) {
    optionDoc.options[0] = new Option(allFunctions, allFunctions);
    firstFunction = allFunctions;
  }
  
  if (curOption == '') {
    if (firstFunction) {
      socket.emit('fetchFunction',firstFunction);
    }
  } else {
    optionDoc.value = curOption;
    socket.emit('fetchFunction',curOption);
  }
});
socket.on('functionSettings', functionSettings => {
  let optionDoc = document.getElementById('functionList'), table = document.getElementById('functionSettingsTable'), messageTable = document.getElementById('functionSettingsMessages')
  if (optionDoc.value = functionSettings.function){
    while (table.rows.length > 1) table.deleteRow(1);
    while (messageTable.rows.length > 1) messageTable.deleteRow(1);
    for (let property in functionSettings) {
      if (property != 'type' && property != 'messages' && property != '_id' && property != 'function') {
        let row = table.insertRow(1);
        let cell1 = row.insertCell(0), cell2 = row.insertCell(1);
        cell1.innerHTML = property;
        if (property == 'active') {
          cell2.innerHTML = functionSettings[property];
          cell2.addEventListener('click',swapTrueFalse);
        } else if (property == 'model') {
          let selectList = document.createElement("select");
          for (let i = 0; i < modelList.length; i++) {
            let option = document.createElement("option");
            option.value = modelList[i].model;
            option.text = modelList[i].model;
            selectList.appendChild(option);
          }
          selectList.value = functionSettings[property];
          cell2.appendChild(selectList)
        } else if (property == 'maxTokens' || property == 'temperature') {
          cell2.innerHTML = '<input value = "'+functionSettings[property]+'"></input>';
        } else {
          cell2.innerHTML = functionSettings[property];
          cell2.addEventListener('dblclick',editCell);
        }
      }
    }
    if (functionSettings.messages.length > 0) {
      for (let i = 0; i < functionSettings.messages.length; i++) {
        let row = messageTable.insertRow(1);
        let cell1 = row.insertCell(0), cell2 = row.insertCell(1), cell3 = row.insertCell(2), cell4 = row.insertCell(3), cell5 = row.insertCell(4), cell6 = row.insertCell(5);
        cell1.innerHTML = functionSettings.messages[i].order;
        cell1.addEventListener('dblclick',editCell);
        cell2.innerHTML = functionSettings.messages[i].role;
        cell2.addEventListener('click',swapRole);
        cell3.innerHTML = functionSettings.messages[i].content;
        cell3.addEventListener('dblclick',editCell);
        cell4.innerHTML = functionSettings.messages[i].name;
        cell4.addEventListener('dblclick',editCell);

        let selectList = document.createElement("select");
        for (let i = 0; i < allRealms.length; i++) {
          let option = document.createElement("option");
          option.value = allRealms[i];
          option.text = allRealms[i];
          selectList.appendChild(option);
        }
        let option = document.createElement("option");
        option.value = "<new>";
        option.text = "<new>";
        selectList.appendChild(option);
        selectList.addEventListener('change',realmChange)
        selectList.value = functionSettings.messages[i].realm;
        cell5.appendChild(selectList)

        if (functionSettings.messages[i].notes) cell6.innerHTML = functionSettings.messages[i].notes;
        cell6.addEventListener('dblclick',editCell);

        let button = document.createElement('button');
        button.className = 'delete2';
        button.onclick = function() {
          this.parentElement.remove();
        }
        button.textContent = 'x';
        row.append(button);
      }
      sortTable(0,'functionSettingsMessages');
    }
  }
});
socket.on('realmList', data => {
  allRealms = data;
});
socket.on('modelList', data => {
  modelList = data;
  //Fill system table
  let systemModels = document.getElementById('system-Models-table');
  while (systemModels.rows.length > 1) systemModels.deleteRow(1);
  for(let i = 0; i < modelList.length; i++) {
    var tr = document.createElement('tr');
    if(modelList[i].enable == false) {
      tr.innerHTML = '<td><input type="checkbox" onclick="disableModel(this.parentElement.parentElement)"></td>'
    } else {
      tr.innerHTML = '<td><input type="checkbox" checked onclick="disableModel(this.parentElement.parentElement)"></td>'
    }
    tr.innerHTML = tr.innerHTML + '<td id="'+ modelList[i]._id +'"><div onblur="renameModel(this.parentElement.parentElement)" contenteditable>' + modelList[i].model + '</div></td>' +
                    '<td onclick="swapProvider(this)">' + modelList[i].provider + '</td>'+
                    '<td>' + (modelList[i].lastUsed || 0) + '</td>'+
                    '<button class="delete2" onclick="deleteModel(this.parentElement)">x</button>'
    systemModels.appendChild(tr);
  }

  //find out all lists with class model list and update
  let modelLists = document.querySelectorAll(".modelList");
  modelList = data.filter(item => item.enable !== false);
  for(let i = 0; i < modelLists.length; i++) {
    let saveSelect = modelLists[i].value
    while (modelLists[i].options[0]) modelLists[i].remove(0);
    for(let j = 0; j < modelList.length; j++) {
      modelLists[i].options[j] = new Option(modelList[j].model, modelList[j].model);
    }
    if (modelLists[i].id == 'adventure-model') modelLists[i].options[modelList.length] = new Option('default', 'unset');
    if (modelLists[i].id == 'modelScot') saveSelect = localStorage.getItem('modelScot');
    modelLists[i].value = saveSelect;
  }
});
socket.on('error', data => {
  alert (data);
  if (data == 'user not authenticated'){
    document.getElementById('player-name').value = ''
    localStorage.removeItem('playerName');
  }
});
socket.on('alertMsg',data => {
  document.getElementById('alertMsg').style.color = data.color;
  document.getElementById('alertMsg').innerText = data.message;
  document.getElementById('alertMsg').style.display = 'inline';
  setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',data.timeout);
});
socket.on('connect', () => {
  document.getElementById('player-name').disabled = true;
  document.getElementById('disconnectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Change';
  localStorage.setItem('playerName', playerName);
  socket.emit('tab',currentTab);
  if (document.getElementById('AdventuresBtn').style.display != 'inline') {
    document.getElementById('alertMsg').style.color = "#4CAF50";
    document.getElementById('alertMsg').innerText = "Connected to server";
    document.getElementById('alertMsg').style.display = 'inline';
    setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',1500);

    document.getElementById('HomeBtn').style.width = '33.3%'
    document.getElementById('AdventuresBtn').style.width = '33.3%'
    document.getElementById('CharactersBtn').style.width = '33.3%'
    document.getElementById('AdventuresBtn').style.display = 'inline';
    document.getElementById('CharactersBtn').style.display = 'inline';
  }
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
    displayChar = data[0]._id;
  } else if (data) {
    optionDoc.options[0] = new Option(data.name, data._id);
    displayChar = data._id;
  }
  if (curChar == '') {
    if(displayChar) {
      socket.emit('fetchCharData',displayChar)
    }
  } else {
    document.getElementById('characters_list').value = curChar;
  }
});
socket.on('charData', (data) => {
  if (document.getElementById('characters_list').value == data._id || data.name == document.getElementById('character_name').value || 
       (data.name == document.getElementById('new-char-name').value && document.getElementById('next-new-char-btn').innerText == "Create")) {
    if (data.name == document.getElementById('new-char-name').value && document.getElementById('next-new-char-btn').innerText == "Create") {
      //close & hide divs in new char
      document.getElementById("new-char-dev").style.width = "0"
      document.getElementById('new-char-content-dev1').style.display = "none";
      document.getElementById('new-char-content-dev2').style.display = "none";
    }
    
    document.getElementById('characters_list').value = data._id;
    if (document.getElementById('characters_list').value != data._id.toString()){
      document.getElementById('characters_list').options[document.getElementById('characters_list').options.length] = new Option(data.name, data._id);
      document.getElementById('characters_list').value = data._id;
    }
    document.getElementById('character_name').value = data.name;
    document.getElementById('character_id').value = data._id;
    if (document.getElementById('character_owner').value != data.owner_id.toString()){
      document.getElementById('character_owner').options[0].value = data.owner_id;
      document.getElementById('character_owner').options[0].innerText = 'resolving...';
      document.getElementById('character_owner').value = data.owner_id;
      //fill the drop down with potential owners
      socket.emit('listOwners');
    }
    document.getElementById('character_state').value = data.state;
    if (data.activeAdventure) {
      document.getElementById('character_activeAdventure').value = data.activeAdventure.name;
    } else {
      document.getElementById('character_activeAdventure').value = '';
    }
    if (!data.adventures) data.adventures = []
    if (data.adventures.length > 0) {
      document.getElementById('character_adventures').value = data.adventures[0].name;
      for (let i = 1 ; i < data.adventures.length; i++){
        document.getElementById('character_adventures').value += ','+data.adventures[i].name;
      };
    } else {
      document.getElementById('character_adventures').value = ''
    }
    let attributes = ["Race","Lvl","STR","DEX","CON","INT","WIS","CHA","HP","AC","Weapon","Armor","Class","Inventory","Backstory","Backstory_Full","Skills","Alignment","Background","Hit_Die"];
    for (let i = 0 ; i < attributes.length; i++){
      if (data.details[attributes[i]]) {
        document.getElementById('character_'+attributes[i]).value = data.details[attributes[i]];
      } else {
        document.getElementById('character_'+attributes[i]).value = '';
      }
    };
  } else {
    console.log("recieved data for "+data._id+" but drop down set to "+document.getElementById('characters_list').value);
  }
});
socket.on('name', (name) => {
  document.getElementById('new-char-name').value = name[0].name
});
socket.on('backgroundStory', (story) => {
  document.getElementById('new-char-background-story').value = story.content;
  socket.emit('generateBackgroundSummary',story.content);
});
socket.on('backgroundSummary', (summary) => {
  document.getElementById('new-char-background-summary').value = summary.content;
});
socket.on('classes', (data) => {
  let optionDoc = document.getElementById('new-char-class')
  char_classes = data
  while (optionDoc.options[0]) optionDoc.remove(0);
  for(let i = 0; i < data.length; i++) {
    optionDoc.options[i] = new Option(data[i].name, data[i].name);
  }
  optionDoc.value = data[Math.floor(Math.random() * data.length)].name;
});
socket.on('abilities', (data) => {
  classes = data
});
socket.on('alignments', (data) => {
  let optionDoc = document.getElementById('new-char-alignment')
  alignments = data
  while (optionDoc.options[0]) optionDoc.remove(0);
  for(let i = 0; i < data.length; i++) {
    optionDoc.options[i] = new Option(data[i].name, data[i].name);
  }
  optionDoc.value = data[Math.floor(Math.random() * data.length)].name;
});
socket.on('races', (data) => {
  let optionDoc = document.getElementById('new-char-race')
  races = data
  while (optionDoc.options[0]) optionDoc.remove(0);
  for(let i = 0; i < data.length; i++) {
    optionDoc.options[i] = new Option(data[i].name, data[i].name);
  }
  optionDoc.value = data[Math.floor(Math.random() * data.length)].name;
});
socket.on('background-basic', (data) => {
  let optionDoc = document.getElementById('new-char-background')
  backgrounds = data
  while (optionDoc.options[0]) optionDoc.remove(0);
  for(let i = 0; i < data.length; i++) {
    optionDoc.options[i] = new Option(data[i].name, data[i].name);
  }
  optionDoc.value = data[Math.floor(Math.random() * data.length)].name;
});
socket.on('background-basic-choice', (data) => {
  let optionDoc = document.getElementById('new-char-bond')
  while (optionDoc.options[0]) optionDoc.remove(0);
  for(let i = 0; i < data[0].Bonds.length; i++) {
    optionDoc.options[i] = new Option(data[0].Bonds[i], data[0].Bonds[i]);
  }
  optionDoc.value = optionDoc.options[Math.floor(Math.random() * optionDoc.options.length)].value;

  optionDoc = document.getElementById('new-char-flaw')
  while (optionDoc.options[0]) optionDoc.remove(0);
  for(let i = 0; i < data[0].Flaws.length; i++) {
    optionDoc.options[i] = new Option(data[0].Flaws[i], data[0].Flaws[i]);
  }
  optionDoc.value = optionDoc.options[Math.floor(Math.random() * optionDoc.options.length)].value;

  optionDoc = document.getElementById('new-char-ideal')
  while (optionDoc.options[0]) optionDoc.remove(0);
  for(let i = 0; i < data[0].Ideals.length; i++) {
    optionDoc.options[i] = new Option(data[0].Ideals[i], data[0].Ideals[i]);
  }
  optionDoc.value = optionDoc.options[Math.floor(Math.random() * optionDoc.options.length)].value;

  optionDoc = document.getElementById('new-char-trait')
  while (optionDoc.options[0]) optionDoc.remove(0);
  for(let i = 0; i < data[0]['Personality Traits'].length; i++) {
    optionDoc.options[i] = new Option(data[0]['Personality Traits'][i], data[0]['Personality Traits'][i]);
  }
  optionDoc.value = optionDoc.options[Math.floor(Math.random() * optionDoc.options.length)].value;
});
socket.on('playerName', (name) => {
  localStorage.setItem('playerName', name);
  playerName = name
  document.getElementById('player-name').disabled = true;
  document.getElementById('player-name').value = name;
  document.getElementById('connectButton').innerText = 'Change';
});
socket.on('AllAdventureHistory', (data) => {
  //addAllAdventureHistory(data);
  if (data.messages) {addAllAdventureHistory(data.messages);};
  if (data.model) {document.getElementById('adventure-model').value = data.model;} else {document.getElementById('adventure-model').value = 'unset'}
  if (data.state == 'active'){
    document.getElementById('player-input-end').disabled = false;
    document.getElementById('adventureAction').disabled = false;
    document.getElementById('player-input-edit').disabled = false;
    document.getElementById('player-input-field').disabled = false;
  } else if (data.state == 'forming') {
    document.getElementById('player-input-end').disabled = false;
    document.getElementById('adventureAction').disabled = false;
    document.getElementById('adventureAction').innerText = 'Begin';
    document.getElementById('player-input-edit').disabled = true;
    document.getElementById('player-input-field').disabled = true;
  } else {
    document.getElementById('player-input-end').disabled = true;
    document.getElementById('adventureAction').disabled = true;
    document.getElementById('player-input-edit').disabled = true;
    document.getElementById('player-input-field').disabled = true;
  }
});
socket.on('AllAdventurers', (data) => {
  document.getElementById('adventurers').innerHTML = "";
  for(let i = 0; i < data.length; i++){
    AddAdventurer(data[i]);
  }
});
socket.on('AddAdventurer', (data) => {
  for(let i = 0; i < data.length; i++){
    AddAdventurer(data[i]);
  }
});
socket.on('adventureRename', (data) => {
  if (document.getElementById('adventure_list').value ==  data._id.toString()){
    document.getElementById('adventure_list').innerText = data.name;
  }
});
socket.on('RemoveAdventurer', (data) => {
  document.getElementById('div-'+data).remove();
});
socket.on('adventureEventSuggest', (data) => {
  if (!document.getElementById('player-input-field').disabled && document.getElementById('player-input-field').value.length > 0 && data.playerName != playerName){
    document.getElementById('player-input-field').value = data.content+"\n"+document.getElementById('player-input-field').value;
  } else {
    document.getElementById('player-input-field').value = data.content;
    document.getElementById('player-input-field').disabled = true;
    document.getElementById('adventureAction').innerText = 'Approve';
    document.getElementById('player-input-edit').hidden = false;
  }
  document.getElementById("player-input-header").innerText = "Player Input - "+data.playerName;
});
socket.on('adventureEventDelete', (message_id) => {
  document.getElementById('div-'+message_id).remove();
});
socket.on('adventureEvent', (data) => {
  addAdventureHistory(data);
  document.getElementById('player-input-field').value = '';
  document.getElementById('player-input-field').disabled = false;
  document.getElementById("player-input-header").innerText = "Player Input";
  document.getElementById('adventureAction').innerText = 'Suggest';
  document.getElementById('player-input-edit').hidden = true;
});
socket.on('adventureList', (data) => {
  let optionDoc = document.getElementById('adventure_list'), curOption = document.getElementById('adventure_list').value, firstId = false;
  if (optionDoc.options.length > 0) {
    for(let i = (optionDoc.options.length - 1); i >= 0; i--) {
      optionDoc.remove(i);
    }
  }
  if (data.length) {
    for(let i = 0; i < data.length; i++){
      optionDoc.options[i] = new Option(data[i].name, data[i]._id);
    }
    firstId = data[0]._id;
  } else if (data) {
    optionDoc.options[0] = new Option(data.name, data._id);
    firstId = data._id;
  }
  
  if (curOption == '') {
    if (firstId) {
      socket.emit('fetchAllAdventureHistory',firstId)
    }
  } else {
    document.getElementById('adventure_list').value = curOption;
    socket.emit('fetchAllAdventureHistory',curOption)
  }
});
socket.on('replayRan', (response) => {
  let list = document.getElementById('gpt-history-list');
  let entry=document.createElement('li');
  entry.onclick=function () {getResponseData(this);};
  entry.innerText=response.date;
  entry.id = response._id;
  list.prepend(entry);
  getResponseData(entry);
});
socket.on('historyList', (data) => {
  let list = document.getElementById('gpt-history-list');
  list.innerHTML = "";
  for(let i = 0; i < data.length; i++){
    let response=data[i];
    let entry=document.createElement('li');
    entry.onclick=function () {getResponseData(this);};
    entry.innerText=response.date;
    entry.id = response._id;
    list.appendChild(entry);
  }
  document.getElementById('history_search').value = document.getElementById('history_search_sent').value;
});
socket.on('partyJoined', (data) => {
  document.getElementById('adventure_list').options[0] = new Option(data.name, data._id);
  document.getElementById('adventure_list').value = data._id;
  document.getElementById('AdventuresBtn').click();
});
socket.on('partyForming', (data) => {
  let list = document.getElementById('starting-parties');
  let entry=document.createElement('li');
  entry.onclick=function () {partyClick(this);};
  entry.innerText=data.party_name;
  entry.id = data._id;
  entry.value = 6;
  list.appendChild(entry);
});
socket.on('keys', (data) => {
  let list = document.getElementById('API_Keys');
  list.innerHTML = "";
  for(let i = 0; i < data.length; i++){
    let entry=document.createElement('li');
    //entry.onclick=function () {playerClick(this);};
    entry.innerText=data[i];
    entry.id = data[i];
    list.appendChild(entry);
  }
});
socket.on('formingParties', (data) => {
  let list = document.getElementById('starting-parties');
  list.innerHTML = "";
  for(let i = 0; i < data.length; i++){
    let entry=document.createElement('li');
    entry.onclick=function () {partyClick(this);};
    entry.innerText=data[i].party_name;
    entry.id = data[i]._id;
    entry.value = 6;
    list.appendChild(entry);
  }
});
socket.on('connectedPlayers', (data) => {
  let list = document.getElementById('home-users-connected');
  list.innerHTML = "";
  for(let i = 0; i < data.length; i++){
    let user=data[i];
    let entry=document.createElement('li');
    entry.onclick=function () {playerClick(this);};
    entry.innerText=user.name;
    entry.id = user._id;
    list.appendChild(entry);
  }
});
socket.on('historyData', (data) => {
  let attributes = ["model","completion_tokens","duration","finish_reason","prompt_tokens","url","temperature","max_tokens","function"];
  for (let i = 0 ; i < attributes.length; i++){
    if (data[attributes[i]]) {
      document.getElementById('history_'+attributes[i]).value = data[attributes[i]];
    } else {
      document.getElementById('history_'+attributes[i]).value = '';
    }
  };
  document.getElementById('history_status').value = data.status.toString()+':'+data.statusText;
  let messages;
  if(data.messages){
    messages = data.messages;
  } else {
    messages = JSON.parse(data.request);
    if (messages.messages) {
      messages = messages.messages;
    }
  }

  let table = document.getElementById('history_table');
  while(table.rows[0]) table.deleteRow(0);

  for (let i = 0 ; i < messages.length; i++){
    let newrow = document.createElement('tr');
    newrow.innerHTML = '<th onclick="swapRole(this)" style="cursor: pointer;">'+messages[i].role+'</th><td width="90%" ><textarea style="height:180px;">'+messages[i].content+'</textarea></td>';
    table.append(newrow);
  };
  let newrow = document.createElement('tr');
  newrow.innerHTML = '<th>Response</th><td width="90%"><textarea style="height:300px;" disabled>'+data.response+'</textarea></td>';
  table.append(newrow);
  newrow = document.createElement('tr');
  newrow.innerHTML = '<th>raw</th><td width="90%"><textarea style="height:500px;" disabled>'+JSON.stringify(data,null,2)+'</textarea></td>';
  table.append(newrow);
  document.getElementById('gpt-history-messages').scrollTop = document.getElementById('gpt-history-messages').scrollHeight;
});
socket.on('listedOwners', (data) => {
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
});
socket.on('ScotRan', (data) => {
  document.getElementById('response-messageScot').value = data;
});
socket.on('continueAdventure', data => {
  if (data){
    const adventureHistoryDiv = document.getElementById('adventure-history');
    let messageDiv = document.createElement('div');
    messageDiv.className = 'message dm-message loading';
    messageDiv.id = 'loading';
    messageDiv.text = 'processing'
    adventureHistoryDiv.appendChild(messageDiv);
    adventureHistoryDiv.scrollTop = adventureHistoryDiv.scrollHeight;
  } else {
    let messageDiv = document.getElementById('loading');
    if (messageDiv){
      messageDiv.remove();
    }
  }
});
socket.on('adventureEndFound', data => {
  //this really isn't in use
  if (data){
    const adventureEnd = document.getElementById('player-input-end');
    adventureEnd.width = adventureEnd.width*2;
    adventureEnd.height = adventureEnd.height*2;
  }
});
socket.on('logList', (data) => {
  let optionDoc = document.getElementById('logList');
  while (optionDoc.length > 0) optionDoc.remove(0);
  if (data.length) {
    optionDoc.options[0] = new Option("","");
    for(let i = 0; i < data.length; i++){
      optionDoc.options[i+1] = new Option(data[i], data[i]);
    }
  } else if (allFunctions) {
    optionDoc.options[0] = new Option("","");
    optionDoc.options[1] = new Option(data, data);
  }
});
socket.on('logTail', (data) => {
  document.getElementById('logTail').innerHTML = document.getElementById('logTail').innerHTML+"<br>"+data.replaceAll('\n',"<br>")
  document.getElementById('logTail').scrollTo(0, document.getElementById('logTail').scrollHeight)
});
socket.on('logStart', (data) => {
  document.getElementById('logTail').innerHTML = data.replaceAll('\n',"<br>")
  document.getElementById('logTail').scrollTo(0, document.getElementById('logTail').scrollHeight)
});
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  document.getElementById('connectButton').disabled = false;
  document.getElementById('connectButton').innerText = 'Connect';
  document.getElementById('disconnectButton').disabled = true;
  document.getElementById('player-name').disabled = false;
  //document.getElementById('alertMsg').style.color = "red";
  //document.getElementById('alertMsg').innerText = "Disconnected from server";
  //document.getElementById('alertMsg').style.display = 'inline';

  //document.getElementById('HomeBtn').style.width = '100%'
  //document.getElementById('AdventuresBtn').style.display = 'none';
  //document.getElementById('CharactersBtn').style.display = 'none';
  //document.getElementById('SystemBtn').style.display = 'none';
  //document.getElementById('HistoryBtn').style.display = 'none';
  //document.getElementById('ScotGPTBtn').style.display = 'none';
});

function restartServer(){
  socket.emit('restartServer','');
}
function fetchModels(provider){
  //todo
}
function systemList(listItem){
  if(listItem.tagName === 'LI') {
    selected= document.querySelector('li.selected');
    if(selected) selected.className= '';
    listItem.className= 'selected';

    document.getElementById('system-div-right-column').childNodes.forEach(function(item){item.hidden = true})
    document.getElementById('system-div-'+listItem.innerText).hidden = false
    if (listItem.innerText == 'Functions') {
      socket.emit('functionList','');
    } else if (listItem.innerText == 'Logs') {
      socket.emit('listLogs','');
    } else if (listItem.innerText == 'Models') {
      socket.emit('listModels','');
    }
  }
}
function getResponseData(listItem){
  socket.emit('fetchHistory',listItem.id);
  let table = document.getElementById('history_table');
  while(table.rows[0]) table.deleteRow(0);
  if(listItem.tagName === 'LI') {
    selected= document.querySelector('li.selected');
    if(selected) selected.className= '';
    listItem.className= 'selected';
  }
}
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
function addFunction() {
  let optionDoc = document.getElementById('functionList'), table = document.getElementById('functionSettingsTable'), messageTable = document.getElementById('functionSettingsMessages')
  let newFunction = prompt("New Function", '');
  if (newFunction){
    optionDoc.options[optionDoc.options.length] = new Option(newFunction, newFunction);
    optionDoc.value = newFunction
    while (table.rows.length > 1) table.deleteRow(1);
    while (messageTable.rows.length > 1) messageTable.deleteRow(1);
  }
}
function addFunctionSettings() {
  let table = document.getElementById('functionSettingsTable')
  let newSetting = prompt("New Setting Name", '');
  if (newSetting){
    let row = table.insertRow(table.rows.length);
    let cell1 = row.insertCell(0), cell2 = row.insertCell(1);
    cell1.innerHTML = newSetting;
    cell2.addEventListener('dblclick',editCell);
  }
}
function realmChange(event) {
  if (event.target.value == '<new>') {
    let newRealm = prompt("New Realm", '');
    if (newRealm) {
      newRealm = newRealm.trim().replace(/[^a-zA-Z0-9 &-]/g,'');
      event.target.options[event.target.options.length] = new Option(newRealm, newRealm);
      event.target.value = newRealm;
      socket.to('Tab-System').emit( 'addRealm',  newRealm);
    } else {
      event.target.value = '<default>'
    }
  }
}
function addFunctionSettingsMessages() {
  let messageTable = document.getElementById('functionSettingsMessages')
  let row = messageTable.insertRow(messageTable.rows.length);
  let cell1 = row.insertCell(0), cell2 = row.insertCell(1), cell3 = row.insertCell(2), cell4 = row.insertCell(3), cell5 = row.insertCell(4), cell6 = row.insertCell(5);
  cell1.addEventListener('dblclick',editCell);
  cell2.addEventListener('click',swapRole);
  cell3.addEventListener('dblclick',editCell);
  cell4.addEventListener('dblclick',editCell);

  let selectList = document.createElement("select");
  for (let i = 0; i < allRealms.length; i++) {
    let option = document.createElement("option");
    option.value = allRealms[i];
    option.text = allRealms[i];
    selectList.appendChild(option);
  }
  let option = document.createElement("option");
  option.value = "<new>";
  option.text = "<new>";
  selectList.appendChild(option);
  selectList.value = "<default>";
  cell5.appendChild(selectList)

  cell6.addEventListener('dblclick',editCell);
}
function saveEdit() {
  let editField = document.getElementById("editField");
  settingEditCell.textContent = editField.value;
  settingEditCell = null;
  editBox.style.display = "none";
}
function cancelEdit() {
  settingEditInfo = null;
  editBox.style.display = "none";
}
function editCell(event) {
  settingEditCell = event.target;
  let editField = document.getElementById("editField");
  editField.value = settingEditCell.textContent;
  editBox.style.display = "block";
  editField.focus();
}
function saveSettings() {
  let userConfirmed = window.confirm("Are you sure you want to save this function?");
  if (userConfirmed) {
    // User clicked OK, perform the delete action
    let optionDoc = document.getElementById('functionList'), table = document.getElementById('functionSettingsTable'), messageTable = document.getElementById('functionSettingsMessages')
    let functionSettings = {function:optionDoc.value}
    for (var i = 1, row; row = table.rows[i]; i++) {
      if (row.cells[1].firstChild.value) {
        functionSettings[row.cells[0].innerHTML] = row.cells[1].firstChild.value;
      } else {
        functionSettings[row.cells[0].innerHTML] = row.cells[1].innerHTML;
      }
    }
    let messages = []
    for (var i = 1, row; row = messageTable.rows[i]; i++) {
      let message = {type:"message",function:optionDoc.value}
      if (row.cells[0].innerHTML) message.order = row.cells[0].innerHTML
      if (row.cells[1].innerHTML) message.role = row.cells[1].innerHTML
      if (row.cells[2].innerHTML) message.content = row.cells[2].innerHTML
      if (row.cells[3].innerHTML) message.name = row.cells[3].innerHTML
      if (row.cells[4].innerHTML) message.realm = row.cells[4].firstChild.value
      if (row.cells[5].innerHTML) message.notes = row.cells[5].innerHTML
      messages.push(message)
    }
    functionSettings.messages = messages;
    socket.emit('saveSettings',functionSettings);
  }
}
function saveChar() {
  socket.emit("saveChar",{_id: document.getElementById('character_id').value,
                     owner_id: document.getElementById('character_owner').value,
                         data:{
                           name: document.getElementById('character_name').value,
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
                          Hit_Die: Number(document.getElementById('character_Hit_Die').value),
                               HP: document.getElementById('character_HP').value,
                               AC: document.getElementById('character_AC').value,
                           Weapon: document.getElementById('character_Weapon').value.split(","),
                            Armor: document.getElementById('character_Armor').value.split(","),
                        Inventory: document.getElementById('character_Inventory').value.split(","),
                        Alignment: document.getElementById('character_Alignment').value,
                       Background: document.getElementById('character_Background').value,
                           Skills: document.getElementById('character_Skills').value,
                        Backstory: document.getElementById('character_Backstory').value,
                   Backstory_Full: document.getElementById('character_Backstory_Full').value
                                 }
                        }}
             )
}
function showCharsOption() {
  if (document.getElementById('all_characters').checked) {
    socket.emit('showCharOption','All')
  } else {
    socket.emit('showCharOption','Own')
  }
  socket.emit('tab','Characters') //will cause list refresh
}
function showChar(id) {
  //remove all but the top owner 
  let optionDoc = document.getElementById('character_owner');
  if (optionDoc.options.length > 1) {
    for(let i = (optionDoc.options.length - 1); i >= 1; i--) {
      //optionDoc.remove(i);
    }
  }
  optionDoc.options[0].value = 'resolving';
  optionDoc.options[0].innerText = 'resolving';
  socket.emit('fetchCharData',id);
}
function replay() {
  let messages = [], table = document.getElementById('history_table');;
  for (var i = 0, row; row = table.rows[i]; i++) {
    if (row.cells[0].innerText == 'system' || row.cells[0].innerText == 'user' || row.cells[0].innerText == 'assistant') {
      messages.push({
        role:row.cells[0].innerText,
        content:row.cells[1].firstChild.value
      })
    } else if (row.cells[0].innerText == 'Response') {
      row.cells[1].firstChild.remove();
      row.cells[1].innerText = 'processing'
      row.cells[1].className = 'loading';
    } else {
      row.remove();
    }
  }
  let replayData = {
    temperature:document.getElementById('history_temperature').value,
    maxTokens:document.getElementById('history_max_tokens').value,
    model:document.getElementById('history_model').value,
    messages:messages
  }
  socket.emit("replay",replayData);
}
function historyDelete(){
  let li = document.querySelector('li.selected')
  socket.emit('historyDelete',li.id)
  li.remove()
  let table = document.getElementById('history_table');
  while(table.rows[0]) table.deleteRow(0);
}
function replayAdd(){
  let table = document.getElementById('history_table');
  if (table.rows[table.rows.length-1].cells[0].innerHTML == 'raw') table.rows[table.rows.length-1].remove()
  if (table.rows[table.rows.length-1].cells[0].innerHTML == 'Response') {
    table.rows[table.rows.length-1].cells[0].innerHTML = 'assistant'
    table.rows[table.rows.length-1].cells[0].addEventListener('click', swapRole);
    table.rows[table.rows.length-1].cells[0].style="cursor: pointer;"
    table.rows[table.rows.length-1].cells[1].firstChild.removeAttribute("disabled")
  }
  let newrow = document.createElement('tr');
  newrow.innerHTML = '<th onclick="swapRole(this)" style="cursor: pointer;">user</th><td><textarea oninput="autoResize(this)"></textarea></td>';
  table.append(newrow);
}
function replayRemove(){
  let table = document.getElementById('history_table');
  if (table.rows[table.rows.length-1].cells[0].innerHTML == 'raw') table.rows[table.rows.length-1].remove()
  if (table.rows[table.rows.length-1].cells[0].innerHTML == 'Response') table.rows[table.rows.length-1].remove()
  if (table.rows.length > 2) {
    table.rows[table.rows.length-1].remove();
  }
}
function swapTrueFalse(item) {
  if(item.target) {
    item = item.target;
    if (item.innerText == 'true'){
      item.innerText = 'false';
    } else {
      item.innerText = 'true';
    }
  } else {
    if (item.innerText == 'false'){
      item.innerText = 'true';
    } else {
      item.innerText = 'false';
    }
  }
}
function swapRole(item,order) {
  if(item.target) {
    item = item.target;
    if (item.innerText == 'user'){
      item.innerText = 'system';
    } else if (item.innerText == 'system') {
      item.innerText = 'assistant';
    } else {
      item.innerText = 'user';
    }
  } else {
    if (item.innerText == 'user'){
      item.innerText = 'assistant';
    } else if (item.innerText == 'assistant' && order == 'first'){
      item.innerText = 'system';
    } else {
      item.innerText = 'user';
    }
  }
}
function historyFilterByFunction(filterText) {
  socket.emit('historyFilterByFunction',filterText);
  socket.emit('tab','History');
}
function connectButton() {
  let temp = document.getElementById('player-name').value
  document.getElementById('player-name').value = temp.trim().replace(/[^a-zA-Z0-9]/g,'');
  if (document.getElementById('connectButton').innerText == 'Connect'){
    playerName = document.getElementById('player-name').value;
    socket.auth = { playerName };
    socket.connect();
  } else if (document.getElementById('player-name').disabled && document.getElementById('connectButton').innerText == 'Change') {
    document.getElementById('player-name').disabled = false;
    document.getElementById('connectButton').innerText = 'Suggest';
  } else {
    socket.emit("changeName",document.getElementById('player-name').value);
  }
}
function disconnectButton() {
  socket.disconnect();
}
function historySearch(e){
  if (e.key === 'Enter' || e.keyCode === 13) {
    socket.emit("historyTextSearch",document.getElementById('history_search').value);
    document.getElementById('history_search_sent').value = document.getElementById('history_search').value;
    socket.emit('tab','History');
  }
}
function scotAdd(){
  let table = document.getElementById('scotMessages');
  let newrow = document.createElement('tr');
  newrow.innerHTML = '<th onclick="swapRole(this)" style="cursor: pointer;">user</th><td><textarea oninput="autoResize(this)"></textarea></td>';
  table.append(newrow);
}
function swapProvider(item) {
  if(item.target) item = item.target;
  if (item.innerText == 'openai'){
    item.innerText = 'anthropic';
  } else if (item.innerText == 'anthropic') {
    item.innerText = 'gemini';
  } else {
    item.innerText = 'openai';
  }
  socket.emit("changeProvider",{id:item.parentElement.cells[1].id,provider:item.parentElement.cells[2].innerText})
}
function deleteModel(row){
  socket.emit("deleteModel",row.cells[1].id)
  row.remove()
}
function disableModel(row){
  if(row.cells[0].firstChild.checked==true) {
    socket.emit("enableModel",row.cells[1].id)
  } else {
    socket.emit("disableModel",row.cells[1].id)
  }
}
function renameModel(row){
  socket.emit("renameModel",{id:row.cells[1].id,newName:row.cells[1].innerText})
}
function saveNewModel(row){
  socket.emit("newModel",{model:row.cells[1].innerText,provider:row.cells[2].innerText})
}
function addModel(){
  let systemModels = document.getElementById('system-Models-table');
  var tr = document.createElement('tr');
  tr.innerHTML = '<td><input type="checkbox" checked disabled></td>' +
                 '<td><div onblur="saveNewModel(this.parentElement.parentElement)" contenteditable></div></td>' +
                 '<td onclick="swapProvider(this)">openai</td>'
  systemModels.appendChild(tr);
}
function scotRemove(){
  let table = document.getElementById('scotMessages');
  if (table.rows.length > 1) {
    table.rows[table.rows.length-1].remove();
  }
}
function ScotRun(){
  let messages = [], table = document.getElementById('scotMessages');
  for (var i = 0, row; row = table.rows[i]; i++) {
    if (row.cells[0].innerText == 'system' || row.cells[0].innerText == 'user' || row.cells[0].innerText == 'assistant') {
      messages.push({
        role:row.cells[0].innerText,
        content:row.cells[1].firstChild.value
      })
    }
  }
  let ScotData = {
    temperature:document.getElementById('temperatureScot').value,
    maxTokens:document.getElementById('maxTokensScot').value,
    model:document.getElementById('modelScot').value,
    messages:messages
  }
  socket.emit("scotRun",ScotData);
  localStorage.setItem('temperatureScot',ScotData.temperature);
  localStorage.setItem('maxTokensScot',ScotData.maxTokens);
  localStorage.setItem('modelScot',ScotData.model);
  document.getElementById('response-messageScot').value = "";
}
function AddAPIKey() {
  let AddAPIKey={
    ["api_keys."+document.getElementById('API_provider').value]:document.getElementById('API_Key').value
  }
  socket.emit('API_Key',AddAPIKey)
  document.getElementById('API_Key').value = ''
}
function showTab(elmnt) {
  let pageName = elmnt.id.substring(0,elmnt.id.length-3)
  let tabcontent = document.getElementsByClassName("tabcontent");
  //hide all content
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  //reset color
  let tablinks = document.getElementsByClassName("tablink");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
  }
  //show the right page
  document.getElementById(pageName).style.display = "block";
  //set tab color
  let colors = {
    HomeBtn:'green',
    CharactersBtn:'blue',
    AdventuresBtn:'orange',
    SystemBtn:'red',
    HistoryBtn:'#008080',
    ScotGPTBtn:'#008080'
  }
  elmnt.style.backgroundColor = colors[elmnt.id];
  //tell the server which tab was selected
  if (!document.getElementById('disconnectButton').disabled){
    socket.emit('tab',pageName);
  }
  //remember which tab was last
  localStorage.setItem('currentTab',pageName);
}
function addAllAdventureHistory(data) {
  const adventureHistoryDiv = document.getElementById('adventure-history');
  adventureHistoryDiv.innerHTML = '';
  data.forEach((entry) => {
    addAdventureHistory(entry);
  });
}
function addAdventureHistory(entry) {
  const markdownParser = new MarkdownParser();
  const adventureHistoryDiv = document.getElementById('adventure-history');
  let messageDiv = document.getElementById('loading');
  if (!messageDiv){
    messageDiv = document.createElement('div');
  }
  messageDiv.className = 'message ' + (entry.role === 'user' ? 'player-message' : 'dm-message');
  if (entry.role === 'user') {
    messageDiv.textContent = entry.content;
  } else {
    messageDiv.innerHTML = markdownParser.parse(entry.content);
  }
  
  if (entry._id) {
    messageDiv.id = 'div-'+entry._id;
    let button = document.createElement('button');
    button.className = 'delete';
    button.id = entry._id;
    button.onclick = function() {
      socket.emit('deleteMessage', this.id);
    }
    button.textContent = 'x';
    messageDiv.appendChild(button);
  } else {
    messageDiv.id = '';
  }
  adventureHistoryDiv.appendChild(messageDiv);
  adventureHistoryDiv.scrollTop = adventureHistoryDiv.scrollHeight;
}
function AddAdventurer(data) {
  let list = document.getElementById('adventurers');

  let entry=document.createElement('div');
  entry.id = data.id = "div-"+data._id;
  entry.className = 'sidepanel-item'
  entry.ondblclick=function () {adventurerClick(this);};
  
  let name = document.createElement('div');
  name.innerText = "Name: " + data.name;
  entry.appendChild(name);
  
  let Class = document.createElement('div');
  Class.innerText = "Class: " + data.details.Class;
  entry.appendChild(Class);
  
  let race = document.createElement('div');
  race.innerText = "Race: " + data.details.Race;
  entry.appendChild(race);
  
  let table = document.createElement('table');
  table.className = "hidden-table"
  table.hidden = true;
  table.id = "hide-"+data._id;
  let tableHeaderRow = table.insertRow();
  let tableHeaderCell1 = tableHeaderRow.insertCell(), tableHeaderCell2 = tableHeaderRow.insertCell();
  tableHeaderCell1.innerText = 'Property';
  tableHeaderCell2.innerText = 'Value';
  for (var key in data.details) {
    let tableRow = table.insertRow();
    let tableCell1 = tableRow.insertCell(), tableCell2 = tableRow.insertCell();
    tableCell1.innerText = key;
    tableCell2.innerText = Array.isArray(data.details[key]) ? data.details[key].join(', ') : data.details[key];
  }
  entry.appendChild(table);
  
  let button = document.createElement('button');
  button.className = 'delete';
  button.id = data._id;
  button.onclick = function() {
    socket.emit('bootAdventurer', {character_id:this.id,adventure_id:document.getElementById('adventure_list').value});
  }
  button.textContent = 'x';

  entry.appendChild(button);
  list.appendChild(entry);
}
function AdventureInputRoll() {
  let characterDivs = document.getElementById('mySidepanel').getElementsByClassName('sidepanel-item');
  let diceSides = document.getElementById("player-input-roll-diceSides").value;
  let diceCount = document.getElementById("player-input-roll-diceCount").value;
  if (diceSides > 1 && diceCount > 0){
    let rolls = Array.from(characterDivs).map(div => {
      let nameDiv = div.querySelector('div:nth-child(1)');
      let name=nameDiv.textContent.replace('Name: ', '');
      let rollSum = 0
      for(let i = 0; i < diceCount; i++) {
        let roll = Math.floor(Math.random() * diceSides) + 1;
        while (testers.includes(name) && roll < (basecut*diceSides)){roll= Math.floor(Math.random() * diceSides) + 1};
        rollSum = rollSum + roll;
      }
      if (document.getElementById('player-input-field').value != "") {
        document.getElementById('player-input-field').value = document.getElementById('player-input-field').value+"\n"
      }
      document.getElementById('player-input-field').value = document.getElementById('player-input-field').value+name+" rolled "+diceCount+"d"+diceSides+" for "+rollSum;
      return {name:name,roll:rollSum};
    });
  }
}
function editAdventureInput() {
  document.getElementById('player-input-field').disabled = false;
  document.getElementById('adventureAction').innerText = 'Suggest';
  document.getElementById('player-input-edit').hidden = true;
}
function endAdventure() {
  socket.emit('endAdventure',document.getElementById('adventure_list').value);
  document.getElementById('HomeBtn').click();
}
function adventureModel(model) {
  if (document.getElementById('player-input-end').disabled == false) {
    socket.emit("setAdventureModel",{model:model,adventure_id:document.getElementById('adventure_list').value});
  }
}
function adventureRealm(realm) {
  if (document.getElementById('player-input-end').disabled == false) {
    socket.emit("setAdventureRealm",{realm:realm,adventure_id:document.getElementById('adventure_list').value});
  }
}
function adventureAction() {
  if (document.getElementById('adventureAction').innerText == 'Suggest') {
    var playerInput = document.getElementById('player-input-field').value.trim();
    if (playerInput.length > 1) {
      socket.emit('suggestAdventureInput',{role:'user',content:playerInput,adventure_id:document.getElementById('adventure_list').value});
      document.getElementById('player-input-field').disabled = true;
      document.getElementById('player-input-edit').hidden = false;
      document.getElementById('adventureAction').innerText = 'Approve';
    }
  } else if (document.getElementById('adventureAction').innerText == 'Approve') {
    let content = document.getElementById('player-input-field').value;
    let adventure_id = document.getElementById('adventure_list').value
    let suggestingPlayerName = document.getElementById("player-input-header").innerText
    suggestingPlayerName = suggestingPlayerName.substring(15,suggestingPlayerName.length)

    socket.emit('approveAdventureInput',{role:'user',
                                         content:content,
                                         adventure_id:adventure_id,
                                         playerName:suggestingPlayerName
                                        });
    document.getElementById('player-input-edit').hidden = true;
  } else if (document.getElementById('adventureAction').innerText == 'Begin') {
    socket.emit('beginAdventure',document.getElementById('adventure_list').value);
  } else {
    console.log(document.getElementById('adventureAction'));
  }
}
function fetchAdventure() {
  if (document.getElementById('adventure_list').value.length == 24) {
    socket.emit('fetchAllAdventureHistory',document.getElementById('adventure_list').value)
  }
  document.getElementById('adventure-history').innerHTML = '';
}
function listAdventureOption() {
  socket.emit('listActiveAdventure',document.getElementById('active_only').checked)
  socket.emit('tab','Adventures');
  let optionDoc = document.getElementById('adventure_list');
  if (document.getElementById('active_only').checked){
    for(let i = (optionDoc.options.length - 1); i >= 0; i--) {
      optionDoc.remove(i);
    }
  }
  document.getElementById('adventure-history').innerHTML = '';
}
function adventurerClick(item){
  let div = document.getElementById('hide-'+item.id.replace("div-",""))
  if (div.hidden){
    div.hidden = false;
  } else {
    div.hidden = true;
  }
}
function playerClick(listItem){
  if(listItem.tagName === 'LI') {
    selected= document.querySelector('li.selected');
    if(selected) selected.className= '';
    listItem.className= 'selected';
  }
}
function partyClick(listItem){
  if(listItem.tagName === 'LI') {
    selected= document.querySelector('li.selected');
    if(selected) selected.className= '';
    listItem.className= 'selected party';
    listItem.tag = 'party';
  }
}
function createParty(){
  let party_name = document.getElementById('party_name').value
  socket.emit('createParty',party_name)
}
function joinParty(){
  let selected = document.querySelector('li.selected');
  if (selected){
    if (selected.value == 6){
      socket.emit('joinParty',selected.id)
    }
  }
}
function newChar() {
  socket.emit('getName','');
  socket.emit('getClasses','');
  socket.emit('getRaces','');
  socket.emit('getBackgrounds','');
  socket.emit('getAbilities','');
  socket.emit('getAlignments','');
  newRoll();
  toggleNav('char-tab-btn');
  newCharPrev();
}
async function newCharNext() {
  let race = races.find(p => p.name === document.getElementById('new-char-race').value)
  let char_class = char_classes.find(p => p.name === document.getElementById('new-char-class').value)
  let background_info = backgrounds.find(p => p.name === document.getElementById('new-char-background').value)

  if (document.getElementById('next-new-char-btn').innerText == "Next"){
    if(document.getElementById('new-char-name').value == "" || document.getElementById('new-char-class').value == '' || document.getElementById('new-char-race').value == '' ||
       document.getElementById('new-char-alignment').value == "" || document.getElementById('new-char-trait').value == '' || document.getElementById('new-char-background').value == '' ||
       document.getElementById('new-char-flaw').value == "" || document.getElementById('new-char-bond').value == '' || document.getElementById('new-char-ideal').value == '' ||
       document.getElementById('new-char-WIS').value == "" || document.getElementById('new-char-CON').value == '' || document.getElementById('new-char-STR').value == '' ||
       document.getElementById('new-char-CHA').value == "" || document.getElementById('new-char-INT').value == '' || document.getElementById('new-char-DEX').value == '') {
      document.getElementById('alertMsg').style.color = 'red';
      document.getElementById('alertMsg').innerText = `Not all fields complete`;
      document.getElementById('alertMsg').style.display = 'inline';
      setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',5000);
      return;
    }

    document.getElementById('new-char-content-dev1').style.display = "none";
    document.getElementById('new-char-content-dev2').style.display = "block";
    document.getElementById('next-new-char-btn').innerText = "Create";
    document.getElementById('prev-new-char-btn').disabled = false;
    
    let info = '--- Character Information ---\n'+
    'This is for the character named '+document.getElementById('new-char-name').value+', race is '+document.getElementById('new-char-race').value+
    ", class is "+document.getElementById('new-char-class').value+" with an alignment of "+document.getElementById('new-char-alignment').value+".\n"+
    "\n"+
    'The character has the background type of '+document.getElementById('new-char-background').value+', the character has the personality trait: "'+document.getElementById('new-char-trait').value+
    '". They hold the ideal: "'+document.getElementById('new-char-ideal').value+'". Their bond is: "'+document.getElementById('new-char-bond').value+
    '". However, they struggle with the flaw: "'+document.getElementById('new-char-flaw').value+'".'
    if (document.getElementById('new-char-background-additional').value.length > 0){
      info = info+"\n\nAdditional background info:\n"+document.getElementById('new-char-background-additional').value
    }
    if (document.getElementById('new-char-background-info').value != info){
      socket.emit("generateBackgroundStory",info)
      document.getElementById('new-char-background-info').value = info;
    }

    document.getElementById('new-char-class-hit-die').value = char_class.hit_die

    let element = document.getElementById('new-char-ability-bonus')
    element.style.display = "none"; element.value='';
    if (race.ability_bonuses.length){
      element.style.display = "block";
      for (let i = 0 ; i < race.ability_bonuses.length; i++){
        element.value = element.value+", "+race.ability_bonuses[i].ability_score.name+"+"+race.ability_bonuses[i].bonus
      }
    }
    if (element.value != '') element.value = element.value.replace(", ","") //remove the leading comma space

    element = document.getElementById('new-char-skills')
    element.style.display = "none"; element.value='';
    if (race.starting_proficiencies.length){
      element.style.display = "block";
      for (let i = 0 ; i < race.starting_proficiencies.length; i++){
        element.value = element.value+", "+race.starting_proficiencies[i].name
      }
    }
    if (race.traits.length > 0){
      element.style.display = "block";
      for (let i = 0 ; i < race.traits.length; i++){
        element.value = element.value+", "+race.traits[i].name
      }
    }
    if (char_class.proficiencies.length){
      element.style.display = "block";
      for (let i = 0 ; i < char_class.proficiencies.length; i++){
        element.value = element.value+", "+char_class.proficiencies[i].name
      }
    }
    if (element.value.length > 3) element.value = element.value.replace(", ","") //remove the leading comma space

    element = document.getElementById('new-char-inventory')
    element.style.display = "none"; element.value='';
    if (char_class.starting_equipment.length){
      element.style.display = "block";
      for (let i = 0 ; i < char_class.starting_equipment.length; i++){
        element.value = element.value+", "+char_class.starting_equipment[i].equipment.name
      }
    }
    if (element.value.length > 3) element.value = element.value.replace(", ","") //remove the leading comma space

    form = document.getElementById('new-char-choices')
    form.innerHTML = ''
    if (race.ability_bonus_options){
      var abilitySection = document.createElement('div');
      abilitySection.className = 'section';
      let abilityHeader = document.createElement('p');
      abilityHeader.textContent = `Ability Bonuses: Choose ${race.ability_bonus_options.choose}`;
      abilitySection.appendChild(abilityHeader);
      const abilityOptions = document.createElement('div');
      abilityOptions.className = 'options';
      race.ability_bonus_options.from.options.forEach((option, index) => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'ability_bonuses';
        checkbox.value = option.ability_score.name;
        checkbox.id = `ability_${index}`;
        label.setAttribute('for', `ability_${index}`);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${option.ability_score.name} (+${option.bonus})`));
        abilityOptions.appendChild(label);
      });
      abilitySection.appendChild(abilityOptions);
      form.appendChild(abilitySection);
    }

    if (race.starting_proficiency_options) {
      const proficiencySection = document.createElement('div');
      proficiencySection.className = 'section';
      const proficiencyHeader = document.createElement('p');
      proficiencyHeader.textContent = `Starting Race Proficiencies: Choose ${race.starting_proficiency_options.choose}`;
      proficiencySection.appendChild(proficiencyHeader);
      
      const proficiencyOptions = document.createElement('div');
      proficiencyOptions.className = 'options';
      race.starting_proficiency_options.from.options.forEach((option, index) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'race_proficiencies';
        input.value = option.item.name;
        input.id = `race_proficiency_${index}`;
        label.setAttribute('for', `race_proficiency_${index}`);
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${option.item.name}`));
        proficiencyOptions.appendChild(label);
      });
      proficiencySection.appendChild(proficiencyOptions);
      form.appendChild(proficiencySection);
    }

    if (char_class.proficiency_choices){
      const proficiencySections = char_class.proficiency_choices.map((proficiencyOption, proficiencyIndex) => {
        const proficiencySection = document.createElement('div');
        proficiencySection.className = 'section';
        const proficiencyHeader = document.createElement('p');
        proficiencyHeader.textContent = `Starting Class Proficiencies ${proficiencyIndex + 1}: Choose ${proficiencyOption.choose}`;
        proficiencySection.appendChild(proficiencyHeader);
        
        const proficiencyOptions = document.createElement('div');
        proficiencyOptions.className = 'options';
        proficiencyOption.from.options.forEach((option, index) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.name = `proficiency_${proficiencyIndex}`;
          if(option.item) {
            input.value = option.item.name;
          } else {
            input.value = option.choice.desc;
          }
          input.id = `proficiency_${proficiencyIndex}_${index}`;
          label.setAttribute('for', `proficiency_${proficiencyIndex}_${index}`);
          label.appendChild(input);
          label.appendChild(document.createTextNode(` ${input.value}`));
          proficiencyOptions.appendChild(label);
        });

        proficiencySection.appendChild(proficiencyOptions);
        return proficiencySection;
      });

      proficiencySections.forEach(proficiencyOptions => form.appendChild(proficiencyOptions));
    }

    const equipmentSections = char_class.starting_equipment_options.map((equipOption, equipIndex) => {
      const equipSection = document.createElement('div');
      equipSection.className = 'section';
      const equipHeader = document.createElement('p');
      equipHeader.textContent = `Starting Equipment Option ${equipIndex + 1}`;
      equipSection.appendChild(equipHeader);
            
      const equipOptions = document.createElement('div');
      equipOptions.className = 'options';
      
      if (equipOption.from.options){
        equipOption.from.options.forEach((option, index) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          
          input.type = (equipOption.choose > 1) ? 'checkbox' : 'radio';
          input.name = `equipment_${equipIndex}`;
          input.id = `equipment_${equipIndex}_option_${index}`;
          
          let labelText = '';
          
          if (option.option_type === 'counted_reference') {
            labelText = `${option.count}x ${option.of.name}`;
            input.value = `${option.count}x ${option.of.name}`;
          } else if (option.option_type === 'choice') {
            labelText = option.choice.desc;
            input.value = option.choice.desc;
          } else if (option.option_type === 'multiple') {
            const itemsText = option.items.map(item => {
              if (item.option_type === 'counted_reference') {
                return `${item.count}x ${item.of.name}`;
              } else if (item.option_type === 'choice') {
                return item.choice.desc;
              } else {
                return item.of.name;
              }
            }).join(' and ');
            labelText = itemsText; 
            input.value = itemsText;
          }
        
          label.setAttribute('for', input.id);
          label.appendChild(input);
          label.appendChild(document.createTextNode(` ${labelText}`));
        
          equipOptions.appendChild(label);
        });
      } else {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `equipment_${equipIndex}`;
        input.id = `equipment_${equipIndex}`;
        input.value = equipOption.desc;
        label.setAttribute('for', input.id);
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${input.value = equipOption.desc}`));
        equipOptions.appendChild(label);
      }
      
      equipSection.appendChild(equipOptions);
      return equipSection;
    });

    equipmentSections.forEach(equipSec => form.appendChild(equipSec));

    //Todo Better Background
    if (!document.getElementById('new-char-skills').value == '') document.getElementById('new-char-skills').value+=", "
    document.getElementById('new-char-skills').value+=background_info.proficiency
    if (!document.getElementById('new-char-inventory').value == '') document.getElementById('new-char-inventory').value+=", "
    document.getElementById('new-char-inventory').value+=background_info.inventory

    //Todo Spells
    //look in levels to find number/level  (contips are level 0)

  } else if (document.getElementById('next-new-char-btn').innerText == "Create") {
    let create = true, char_doc = {
      name:document.getElementById('new-char-name').value,
      state:'alive',
      details:{
        WIS:document.getElementById('new-char-WIS').value,
        CON:document.getElementById('new-char-CON').value,
        STR:document.getElementById('new-char-STR').value,
        CHA:document.getElementById('new-char-CHA').value,
        INT:document.getElementById('new-char-INT').value,
        DEX:document.getElementById('new-char-DEX').value,
        Class:document.getElementById('new-char-class').value,
        Race:document.getElementById('new-char-race').value,
        Alignment:document.getElementById('new-char-alignment').value,
        Trait:document.getElementById('new-char-trait').value,
        Background:document.getElementById('new-char-background').value,
        Flaw:document.getElementById('new-char-flaw').value,
        Bond:document.getElementById('new-char-bond').value,
        Ideal:document.getElementById('new-char-ideal').value,
        Backstory:document.getElementById('new-char-background-summary').value,
        Backstory_Full:document.getElementById('new-char-background-story').value,
        Lvl:1,
        Hit_Die:char_class.hit_die,
        Skills:background_info.proficiency,
        Inventory:background_info.inventory.split(", "),
        Proficiencies:[],
        Equipment:[],
        Armor:[],
        Weapon:[],
        Traits:[]
      }
    }
    
    if (race.ability_bonuses.length){
      for (let i = 0 ; i < race.ability_bonuses.length; i++){
        ability_name=race.ability_bonuses[i].ability_score.name;
        let newNumber = Number(char_doc.details[ability_name])+Number(race.ability_bonuses[i].bonus);
        char_doc.details[ability_name]=""+newNumber;
      }
    }
    if (race.ability_bonus_options) {
      const abilitiesSelected = document.querySelectorAll('input[name="ability_bonuses"]:checked');
      if (abilitiesSelected.length != race.ability_bonus_options.choose) {
        document.getElementById('alertMsg').style.color = 'red';
        document.getElementById('alertMsg').innerText = `Please select exactly ${race.ability_bonus_options.choose} ability bonuses.`;
        document.getElementById('alertMsg').style.display = 'inline';
        setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',5000);
        create = false
        //Todo - Set font red
        //document.getElementById('alertMsg').style.color = 'red';
        return;
      } else {
        abilitiesSelected.forEach((ability, index) => {
          i=ability.id.replace('ability_',"")
          ability_name=race.ability_bonus_options.from.options[i].ability_score.name
          let newNumber = Number(char_doc.details[ability_name])+Number(race.ability_bonus_options.from.options[i].bonus)
          char_doc.details[ability_name]=""+newNumber
        });
      }
    }
    char_doc.details['HP'] = char_class.hit_die+Math.floor(Number(char_doc.details.CON)/2)-5
    char_doc.details['AC'] = 10+Math.floor(Number(char_doc.details.DEX)/2)-5

    //todo - more with background

    if (race.traits.length){
      for (let i = 0 ; i < race.traits.length; i++){
        char_doc.details.Traits.push(race.traits[i]);
        if (char_doc.details.Skills != '') char_doc.details.Skills+=", ";
        char_doc.details.Skills+=race.traits[i].name;
      }
    }
    if (char_class.proficiencies.length){
      for (let i = 0 ; i < char_class.proficiencies.length; i++){
        char_doc.details.Proficiencies.push(char_class.proficiencies[i]);
        if (char_doc.details.Skills != '') char_doc.details.Skills+=", ";
        char_doc.details.Skills+=char_class.proficiencies[i].name;
      }
    }
    if (race.starting_proficiency_options){
      const profSelected = document.querySelectorAll('input[name="race_proficiencies"]:checked');
      if (profSelected.length !== race.starting_proficiency_options.choose) {
        document.getElementById('alertMsg').style.color = 'red';
        document.getElementById('alertMsg').innerText = `Please select exactly ${race.starting_proficiency_options.choose} proficiencies.`;
        document.getElementById('alertMsg').style.display = 'inline';
        setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',5000);
        create = false
        //Todo - Set font red
        //document.getElementById('alertMsg').style.color = 'red';
        return
      } else {
        for (let i = 0 ; i < profSelected.length; i++) {
          i2=profSelected[i].id.replace('race_proficiency_',"")
          if (char_doc.details.Skills != '') char_doc.details.Skills+=", "
          char_doc.details.Skills+=race.starting_proficiency_options.from.options[i2].item.name
          char_doc.details.Proficiencies.push(race.starting_proficiency_options.from.options[i2].item)
        };
      }
    }

    if (char_class.proficiency_choices){
      for (let index = 0 ; index < char_class.proficiency_choices.length; index++) {
        const proficiencies = document.querySelectorAll(`input[name="proficiency_${index}"]:checked`);
        if (proficiencies.length !== char_class.proficiency_choices[index].choose) {
          document.getElementById('alertMsg').style.color = 'red';
          document.getElementById('alertMsg').innerText = `Please select exactly ${char_class.proficiency_choices[index].choose} option(s).`;
          document.getElementById('alertMsg').style.display = 'inline';
          setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',5000);
          //Todo - Set font red
          //document.getElementById('alertMsg').style.color = 'red';
          create = false
          return
        } else {
          for (let p = 0 ; p < proficiencies.length; p++) {
            let i = proficiencies[p].id.split("_")[2]
            if (char_doc.details.Skills != '') char_doc.details.Skills+=", "
            if(char_class.proficiency_choices[index].from.options[i].item) {
              char_doc.details.Skills+=char_class.proficiency_choices[index].from.options[i].item.name
              char_doc.details.Proficiencies.push(char_class.proficiency_choices[index].from.options[i].item)
            } else {
              char_doc.details.Skills+=char_class.proficiency_choices[index].from.options[i].desc
              char_doc.details.Proficiencies.push({name:char_class.proficiency_choices[index].from.options[i].desc})
            }
          };
        }
      };
    }

    if (char_class.starting_equipment.length){
      for (let i = 0 ; i < char_class.starting_equipment.length; i++){
        char_class.starting_equipment[i].equipment.quantity = char_class.starting_equipment[i].quantity
        char_doc.details.Equipment.push(char_class.starting_equipment[i].equipment)
      }
    }
    char_class.starting_equipment_options.forEach((_, index) => {
      const equipSelected = document.querySelectorAll(`input[name="equipment_${index}"]:checked`);
      if (equipSelected.length !== char_class.starting_equipment_options[index].choose) {
        document.getElementById('alertMsg').style.color = 'red';
        document.getElementById('alertMsg').innerText = `Please select exactly ${char_class.starting_equipment_options[index].choose} Equipment option(s).`;
        document.getElementById('alertMsg').style.display = 'inline';
        setTimeout(()=> document.getElementById('alertMsg').style.display = 'none',5000);
        create = false
        //Todo - Set font red
        //document.getElementById('alertMsg').style.color = 'red';
        return
      }

      if (char_class.starting_equipment_options[index].from.option_set_type == 'equipment_category') {
        char_class.starting_equipment_options[index].from.equipment_category.quantity = char_class.starting_equipment_options[index].choose
        char_doc.details.Equipment.push(char_class.starting_equipment_options[index].from.equipment_category)
      } else if (char_class.starting_equipment_options[index].from.option_set_type == "options_array") {
        let i = equipSelected[0].id.split("_")[3]
        if (char_class.starting_equipment_options[index].from.options[i].option_type == "counted_reference") {
          char_class.starting_equipment_options[index].from.options[i].of.quantity = char_class.starting_equipment_options[index].from.options[i].count
          char_doc.details.Equipment.push(char_class.starting_equipment_options[index].from.options[i].of)
        } else if (char_class.starting_equipment_options[index].from.options[i].option_type == "multiple") {
          char_class.starting_equipment_options[index].from.options[i].items.forEach((item) => {
            if (item.option_type == 'choice') {
              item.choice.from.equipment_category.quantity = item.choice.choose
              char_doc.details.Equipment.push(item.choice.from.equipment_category)
            } else {
              item.of.quantity = item.count
              char_doc.details.Equipment.push(item.of)
            }
          });
        } else if (char_class.starting_equipment_options[index].from.options[i].option_type == "choice") {
          char_class.starting_equipment_options[index].from.options[i].choice.from.equipment_category.quantity = char_class.starting_equipment_options[index].from.options[i].choice.choose
          char_doc.details.Equipment.push(char_class.starting_equipment_options[index].from.options[i].choice.from.equipment_category)
        }
      }


    });

    //get equipment detail, file and equip
    char_doc.details.Equipment = await getEquipmentData(char_doc.details.Equipment);
    for (let i = 0 ; i < char_doc.details.Equipment.length; i++){
      let equipment = char_doc.details.Equipment[i]
      if (!equipment.url.includes('equipment-categories')) {
        if (equipment.equipment_category.index == "weapon") {
          char_doc.details.Weapon.push(equipment.quantity+"x "+equipment.name);
        } else if (equipment.equipment_category.index == "armor") {
          if (equipment.armor_category == "Shield") {
            if (!char_doc.details.Shield) {
              char_doc.details.Armor.push(equipment.name)
              char_doc.details.Shield = equipment
              char_doc.details['AC'] += char_doc.details.Shield.armor_class.base
            } else {
              char_doc.details.Inventory.push(equipment.quantity+"x "+equipment.name);
            }
          } else {
            //ToDo check to record the total AC it would be and also use that to see if you equip
            if (!char_doc.details.ArmorEquiped && char_doc.details.STR >= equipment.str_minimum) {
              char_doc.details.Armor.push(equipment.name)
              char_doc.details.ArmorEquiped = equipment
              char_doc.details['AC'] = equipment.armor_class.base
              if (equipment.armor_class.dex_bonus){
                char_doc.details['AC'] += Math.floor(Number(char_doc.details.DEX)/2)-5
              }
              if(char_doc.details.Shield){
                char_doc.details['AC'] += shield.armor_class.base
              }
            } else {
              char_doc.details.Inventory.push(equipment.quantity+"x "+equipment.name);
            }
          }
        } else {
          char_doc.details.Inventory.push(equipment.quantity+"x "+equipment.name);
        }
      } else {
        //ToDo - let them choose from the category in the json doc
        char_doc.details.Inventory.push(equipment.quantity+"x "+equipment.name);
      }
    }

    //Todo Spells
    //look in levels to find number/level  (contips are level 0)
    
    if (create) {
      socket.emit("saveChar",{_id:'',data:char_doc})
    } else {
      console.log(char_doc)
    }
  }
}
async function getEquipmentData(equipment){
  for (let i = 0 ; i < equipment.length; i++){
    if (!equipment[i].url.includes('equipment-categories')) {
      let apiData = await getApiData(equipment[i].url)
      apiData.quantity = equipment[i].quantity
      equipment[i] = apiData
    }
  }
  return equipment
}
async function getApiData(url) {
  try {
    const response = await fetch("https://www.dnd5eapi.co" + url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data; // Return the parsed JSON
  } catch (error) {
    console.error('There was a problem with the fetch operation:', error);
    return null; // Handle the error gracefully by returning null
  }
}
function newCharPrev() {
  document.getElementById('new-char-content-dev1').style.display = "block";
  document.getElementById('new-char-content-dev2').style.display = "none";
  document.getElementById('next-new-char-btn').innerText = "Next";
  document.getElementById('next-new-char-btn').disabled = false;
  document.getElementById('prev-new-char-btn').disabled = true;
}
function newRoll(){
  let abilities = ["STR","DEX","CON","INT","WIS","CHA"];
  let rolls = rollAbility();
  for (let i = 1 ; i < abilities.length; i++){
    rolls = rolls+"\n"+rollAbility();
  };
  document.getElementById('new-char-available-rolls').innerHTML = rolls;
  rolls = rolls.split("\n")
  for (let i = 0 ; i < abilities.length; i++){
    let optionDoc = document.getElementById('new-char-'+abilities[i])
    while (optionDoc.length > 0) optionDoc.remove(0);
    for (let j = 0 ; j < rolls.length; j++){
      optionDoc.options[j+1] = new Option(rolls[j], rolls[j]);
    }
    optionDoc.disabled = false;
  };
}
function abilitySelect(optionDocPassed){
  document.getElementById('new-char-available-rolls').innerHTML = document.getElementById('new-char-available-rolls').innerHTML.replace(optionDocPassed.value,"").replace("\n\n","\n").trim()
  let abilities = ["STR","DEX","CON","INT","WIS","CHA"];
  //look through and remove the first matched value
  for (let i = 0 ; i < abilities.length; i++){
    if (optionDocPassed.id == 'new-char-'+abilities[i]) {
      optionDocPassed.disabled = true;
    } else {
      let optionDoc = document.getElementById('new-char-'+abilities[i])
      for (let j = 0 ; j < optionDoc.length; j++){
        if (optionDoc.disabled == false && optionDoc.options[j].value == optionDocPassed.value) {
          optionDoc.remove(j)
          j = optionDoc.length + 1
        }
      }
    }
  };
}
function rollAbility() {
  let rolls = [ Math.floor(Math.random() * 6 + 1),
                Math.floor(Math.random() * 6 + 1),
                Math.floor(Math.random() * 6 + 1),
                Math.floor(Math.random() * 6 + 1)
              ]
  rolls.sort(function(a, b){return a - b})
  return (rolls[1]+rolls[2]+rolls[3])
}
function toggleNav(button) {
  let pannel, percent;
  if (button=='mySidepanel-btn'){
    pannel=document.getElementById("mySidepanel")
    percent = "33%"
  } else if ("char-tab-btn") {
    pannel=document.getElementById("new-char-dev")
    percent = "100%"
  } else {
    return
  }
  if (pannel.style.width < 1 || pannel.style.width == "0px") {
    pannel.style.width = percent;
  } else {
    pannel.style.width = "0";
  }

}
function initDrag(e) {
  resizeTarget = e.target.id.replace('-resize-bar','')
  startX = e.clientX;
  initialLeftWidth = document.getElementById(resizeTarget+'-left-column').offsetWidth;
  document.addEventListener('mousemove', doDrag);
  document.addEventListener('mouseup', stopDrag);
}
function doDrag(e) {
  var deltaX = e.clientX - startX;
  var newLeftWidth = initialLeftWidth + deltaX;
  var containerWidth = document.getElementById(resizeTarget).offsetWidth;
  var leftWidthPercentage = (newLeftWidth / containerWidth) * 100;
  var rightWidthPercentage = 100 - leftWidthPercentage;
  document.getElementById(resizeTarget+'-left-column').style.width = leftWidthPercentage + '%';
  document.getElementById(resizeTarget+'-right-column').style.width = rightWidthPercentage + '%';
}
function stopDrag() {
  document.removeEventListener('mousemove', doDrag);
  document.removeEventListener('mouseup', stopDrag);
}
function showHide(element) {
  let popupBox = document.getElementById(element.id+'-box');
  if (popupBox.style.display === "block") {
    popupBox.style.display = "none";
  } else {
    popupBox.style.display = "block";
  }
}
function sortTable(n, tableName, columnType) {
  var table = document.getElementById(tableName);
  var rows = Array.from(table.rows).slice(1);
  var th = table.rows[0].getElementsByTagName("th")[n];
  var sortDirection = th.getAttribute("data-sort-direction") || "asc";

  if (columnType === 'checkbox') {
    sortedRows = rows.sort((a, b) => {
      var aChecked = a.getElementsByTagName("input")[0].checked;
      var bChecked = b.getElementsByTagName("input")[0].checked;
      return sortDirection === "asc" ? 
        (aChecked === bChecked ? 0 : aChecked ? -1 : 1) :
        (aChecked === bChecked ? 0 : aChecked ? 1 : -1);
    });
  } else {
    var isNumber = !isNaN(+rows[0].children[n].textContent.trim());
    if (isNumber) {
      sortedRows = rows.sort((a, b) => {
        var aVal = parseFloat(a.children[n].textContent);
        var bVal = parseFloat(b.children[n].textContent);
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      });
    } else {
      sortedRows = rows.sort((a, b) => {
        var aVal = a.children[n].textContent.trim();
        var bVal = b.children[n].textContent.trim();
        return sortDirection === "asc" ? 
          (aVal > bVal ? 1 : -1) :
          (aVal > bVal ? -1 : 1);
      });
    }
  }

  th.setAttribute("data-sort-direction", sortDirection === "asc" ? "desc" : "asc");

  table.querySelectorAll('th').forEach(header => {
    header.textContent = header.textContent.replace(' ↑', '').replace(' ↓', '');
  });

  th.textContent += sortDirection === "asc" ? " ↑" : " ↓";

  while (table.rows.length > 1) table.deleteRow(1);
  for (let row of sortedRows) {
    table.tBodies[0].appendChild(row);
  }
}
function micClick() {
  if (document.getElementById('mic-button').classList.contains('recording')) {   //end recording
    document.getElementById('mic-button').classList.remove('recording');
    document.getElementById('player-input-field').value = document.getElementById('player-input-field-mic').value;
    document.getElementById('player-input-field').id = 'player-input-field-temp';
    document.getElementById('player-input-field-mic').id = 'player-input-field';
    document.getElementById('player-input-field').disabled = false;
    document.getElementById('adventureAction').disabled = false;
    recognition.stop();
  } else {  //start recording
    document.getElementById('mic-button').classList.add('recording');
    document.getElementById('player-input-field-temp').value = document.getElementById('player-input-field').value;
    document.getElementById('player-input-field').id = 'player-input-field-mic';
    document.getElementById('player-input-field-temp').id = 'player-input-field';
    document.getElementById('player-input-field-mic').disabled = true;
    document.getElementById('adventureAction').disabled = true;
    recognition.start();
  }
}

class MarkdownParser {
  constructor() {
    // Regular expressions for different markdown elements
    this.rules = {
      // Headers (h1 to h6)
      headers: /^(#{1,6})\s(.+)$/gm,
      
      // Bold text
      bold: /\*\*(.+?)\*\*/g,
      
      // Italic text
      italic: /\*(.+?)\*/g,
      
      // Code blocks with language specification
      codeBlock: /```(\w+)?\n([\s\S]*?)```/g,
      
      // Inline code
      inlineCode: /`(.+?)`/g,
      
      // Blockquotes
      blockquote: /^>\s(.+)$/gm,
    };
  }

  parse(markdown) {
    let html = markdown;

    // remove double line breaks
    html = html.replace(/\n\n/g, '\n');

    // Process code blocks first to prevent interference with other rules
    html = html.replace(this.rules.codeBlock, (match, language, code) => {
      return `<pre class="code-block ${language || ''}"><code>${this.escapeHTML(code.trim())}</code></pre>`;
    });

    // Process inline code
    html = html.replace(this.rules.inlineCode, '<code>$1</code>');

    // Process headers
    html = html.replace(this.rules.headers, (match, hLevel, text) => {
      const level = hLevel.length;
      return `<h${level}>${text.trim()}</h${level}>`;
    });

    // Process bold text
    html = html.replace(this.rules.bold, '<strong>$1</strong>');

    // Process italic text
    html = html.replace(this.rules.italic, '<em>$1</em>');

    // Process blockquotes
    html = html.replace(this.rules.blockquote, '<blockquote>$1</blockquote>');

    // Process links
    html = html.replace(this.rules.links, '<a href="$2">$1</a>');

    return html;
  }

  // Helper function to escape HTML special characters
  escapeHTML(text) {
    const escapeChars = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => escapeChars[char]);
  }
}