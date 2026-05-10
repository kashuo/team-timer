(function () {
  "use strict";

  var teams = [];
  var activeTeamId = null;
  var nextId = 1;
  var timerInterval = null;
  var selectedPlayerIds = {};

  var playerListEl = document.getElementById("player-list");
  var seasonListEl = document.getElementById("season-list");
  var teamListEl = document.getElementById("team-list");
  var gameView = document.getElementById("game-view");
  var seasonView = document.getElementById("season-view");
  var teamPickerView = document.getElementById("team-picker-view");
  var teamNameLabel = document.getElementById("team-name-label");
  var modalOverlay = document.getElementById("modal");
  var modalMessage = document.getElementById("modal-message");
  var modalConfirm = document.getElementById("modal-confirm");
  var modalCancel = document.getElementById("modal-cancel");

  function getActiveTeam() {
    return teams.find(function (t) { return t.id === activeTeamId; });
  }

  function getPlayers() {
    var team = getActiveTeam();
    return team ? team.players : [];
  }

  // --- Persistence ---

  function save() {
    localStorage.setItem("teamtimer_teams", JSON.stringify(teams));
    localStorage.setItem("teamtimer_activeTeamId", String(activeTeamId));
    localStorage.setItem("teamtimer_nextId", String(nextId));
  }

  function load() {
    var raw = localStorage.getItem("teamtimer_teams");
    if (raw) {
      try {
        teams = JSON.parse(raw);
      } catch (e) {
        teams = [];
      }
    }

    var nid = localStorage.getItem("teamtimer_nextId");
    if (nid) nextId = parseInt(nid, 10) || 1;

    var aid = localStorage.getItem("teamtimer_activeTeamId");
    if (aid) activeTeamId = parseInt(aid, 10) || null;

    // Migrate from old single-team format
    if (teams.length === 0) {
      var oldPlayers = localStorage.getItem("teamtimer_players");
      if (oldPlayers) {
        try {
          var players = JSON.parse(oldPlayers);
          var team = { id: nextId++, name: "My Team", players: players };
          teams.push(team);
          activeTeamId = team.id;
          localStorage.removeItem("teamtimer_players");
          save();
        } catch (e) {}
      }
    }

    // Ensure at least one team exists
    if (teams.length === 0) {
      var defaultTeam = { id: nextId++, name: "My Team", players: [] };
      teams.push(defaultTeam);
      activeTeamId = defaultTeam.id;
      save();
    }

    // Ensure activeTeamId points to a valid team
    if (!getActiveTeam()) {
      activeTeamId = teams[0].id;
      save();
    }
  }

  // --- Time formatting ---

  function getElapsed(player) {
    var secs = player.currentGameSeconds;
    if (player.isRunning && player.startedAt) {
      secs += (Date.now() - player.startedAt) / 1000;
    }
    return Math.floor(secs);
  }

  function formatTime(totalSeconds) {
    var s = Math.floor(totalSeconds);
    if (s < 0) s = 0;
    var hrs = Math.floor(s / 3600);
    var mins = Math.floor((s % 3600) / 60);
    var secs = s % 60;
    if (hrs > 0) {
      return hrs + ":" + pad(mins) + ":" + pad(secs);
    }
    return mins + ":" + pad(secs);
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  // --- Modal ---

  var modalCallback = null;

  function showModal(message, danger, callback) {
    modalMessage.textContent = message;
    modalConfirm.className = danger ? "modal-confirm danger" : "modal-confirm";
    modalOverlay.classList.add("active");
    modalCallback = callback;
  }

  modalConfirm.addEventListener("click", function () {
    modalOverlay.classList.remove("active");
    if (modalCallback) modalCallback();
    modalCallback = null;
  });

  modalCancel.addEventListener("click", function () {
    modalOverlay.classList.remove("active");
    modalCallback = null;
  });

  // --- View switching ---

  function showView(view) {
    gameView.classList.remove("active");
    seasonView.classList.remove("active");
    teamPickerView.classList.remove("active");
    view.classList.add("active");
  }

  // --- Render game view ---

  function updateTeamLabel() {
    var team = getActiveTeam();
    teamNameLabel.textContent = team ? team.name : "Team";
  }

  function renderPlayers() {
    playerListEl.innerHTML = "";
    var players = getPlayers();
    var sorted = players.slice().sort(function (a, b) {
      return getElapsed(a) - getElapsed(b);
    });
    var validIds = {};
    sorted.forEach(function (player) {
      validIds[player.id] = true;

      var row = document.createElement("div");
      row.className = "player-row" + (selectedPlayerIds[player.id] ? " selected" : "");
      row.setAttribute("data-id", player.id);

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "player-checkbox";
      checkbox.checked = !!selectedPlayerIds[player.id];
      checkbox.addEventListener("change", function () {
        togglePlayerSelection(player.id);
      });

      var nameSpan = document.createElement("span");
      nameSpan.className = "player-name";
      nameSpan.textContent = player.name;
      nameSpan.addEventListener("click", function () {
        editPlayerName(player.id);
      });

      var timeSpan = document.createElement("span");
      timeSpan.className = "player-time";
      timeSpan.setAttribute("data-timer", player.id);
      timeSpan.textContent = formatTime(getElapsed(player));

      var toggleBtn = document.createElement("button");
      toggleBtn.className = "btn-start-stop " + (player.isRunning ? "stop" : "start");
      toggleBtn.textContent = player.isRunning ? "Stop" : "Start";
      toggleBtn.addEventListener("click", function () {
        toggleTimer(player.id);
      });

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-delete";
      deleteBtn.textContent = "\u00d7";
      deleteBtn.addEventListener("click", function () {
        deletePlayer(player.id);
      });

      row.appendChild(checkbox);
      row.appendChild(deleteBtn);
      row.appendChild(nameSpan);
      row.appendChild(timeSpan);
      row.appendChild(toggleBtn);
      playerListEl.appendChild(row);
    });

    Object.keys(selectedPlayerIds).forEach(function (id) {
      if (!validIds[parseInt(id, 10)]) delete selectedPlayerIds[id];
    });

    var addRow = document.createElement("div");
    addRow.className = "add-player-row";
    var addBtn = document.createElement("button");
    addBtn.className = "btn-add";
    addBtn.textContent = "+ Add Player";
    addBtn.addEventListener("click", addPlayer);
    addRow.appendChild(addBtn);
    playerListEl.appendChild(addRow);

    updateTeamLabel();
    updateSwitchButton();
  }

  function getSortedIds() {
    return getPlayers().slice().sort(function (a, b) {
      return getElapsed(a) - getElapsed(b);
    }).map(function (p) { return p.id; });
  }

  var lastOrder = [];

  function updateTimerDisplays() {
    getPlayers().forEach(function (player) {
      if (!player.isRunning) return;
      var el = playerListEl.querySelector('[data-timer="' + player.id + '"]');
      if (el) el.textContent = formatTime(getElapsed(player));
    });

    var currentOrder = getSortedIds();
    if (currentOrder.join(",") !== lastOrder.join(",")) {
      lastOrder = currentOrder;
      renderPlayers();
    }
  }

  // --- Player CRUD ---

  function addPlayer() {
    var row = document.createElement("div");
    row.className = "player-row";

    var input = document.createElement("input");
    input.className = "player-name-input";
    input.type = "text";
    input.placeholder = "Player name";
    input.autocomplete = "off";
    input.autocapitalize = "words";

    var okBtn = document.createElement("button");
    okBtn.className = "btn-ok";
    okBtn.textContent = "OK";

    function confirmName() {
      var name = input.value.trim();
      if (!name) {
        row.remove();
        return;
      }
      var player = {
        id: nextId++,
        name: name,
        currentGameSeconds: 0,
        seasonTotalSeconds: 0,
        isRunning: false,
        startedAt: null
      };
      getPlayers().push(player);
      save();
      renderPlayers();
    }

    okBtn.addEventListener("click", confirmName);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") confirmName();
    });

    row.appendChild(input);
    row.appendChild(okBtn);
    playerListEl.appendChild(row);
    input.focus();
    row.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function editPlayerName(id) {
    var players = getPlayers();
    var player = players.find(function (p) { return p.id === id; });
    if (!player) return;

    var row = playerListEl.querySelector('[data-id="' + id + '"]');
    if (!row) return;

    var nameSpan = row.querySelector(".player-name");
    var input = document.createElement("input");
    input.className = "player-name-input";
    input.type = "text";
    input.value = player.name;
    input.autocomplete = "off";
    input.autocapitalize = "words";

    function finishEdit() {
      var name = input.value.trim();
      if (name) player.name = name;
      save();
      renderPlayers();
    }

    input.addEventListener("blur", finishEdit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        input.removeEventListener("blur", finishEdit);
        finishEdit();
      }
    });

    nameSpan.replaceWith(input);
    input.focus();
    input.select();
  }

  function deletePlayer(id) {
    var players = getPlayers();
    var player = players.find(function (p) { return p.id === id; });
    if (!player) return;
    showModal('Delete "' + player.name + '"?', true, function () {
      var team = getActiveTeam();
      team.players = team.players.filter(function (p) { return p.id !== id; });
      save();
      renderPlayers();
    });
  }

  // --- Timer controls ---

  function toggleTimer(id) {
    var players = getPlayers();
    var player = players.find(function (p) { return p.id === id; });
    if (!player) return;

    if (player.isRunning) {
      player.currentGameSeconds += (Date.now() - player.startedAt) / 1000;
      player.isRunning = false;
      player.startedAt = null;
    } else {
      player.isRunning = true;
      player.startedAt = Date.now();
    }
    save();
    renderPlayers();
  }

  // --- Selection & Switch ---

  function togglePlayerSelection(id) {
    if (selectedPlayerIds[id]) {
      delete selectedPlayerIds[id];
    } else {
      selectedPlayerIds[id] = true;
    }
    updateSwitchButton();
    var row = playerListEl.querySelector('[data-id="' + id + '"]');
    if (row) {
      if (selectedPlayerIds[id]) {
        row.classList.add("selected");
      } else {
        row.classList.remove("selected");
      }
    }
  }

  function updateSwitchButton() {
    var btn = document.getElementById("btn-switch-selected");
    var count = Object.keys(selectedPlayerIds).length;
    if (count > 0) {
      btn.textContent = "Switch (" + count + ")";
      btn.disabled = false;
    } else {
      btn.textContent = "Switch";
      btn.disabled = true;
    }
  }

  document.getElementById("btn-switch-selected").addEventListener("click", function () {
    var players = getPlayers();
    var now = Date.now();
    var ids = Object.keys(selectedPlayerIds);
    if (ids.length === 0) return;

    ids.forEach(function (idStr) {
      var id = parseInt(idStr, 10);
      var player = players.find(function (p) { return p.id === id; });
      if (!player) return;

      if (player.isRunning) {
        player.currentGameSeconds += (now - player.startedAt) / 1000;
        player.isRunning = false;
        player.startedAt = null;
      } else {
        player.isRunning = true;
        player.startedAt = now;
      }
    });

    selectedPlayerIds = {};
    save();
    renderPlayers();
  });

  // --- Stop All ---

  document.getElementById("btn-stop-all").addEventListener("click", function () {
    var players = getPlayers();
    var anyRunning = false;
    players.forEach(function (p) {
      if (p.isRunning) {
        p.currentGameSeconds += (Date.now() - p.startedAt) / 1000;
        p.isRunning = false;
        p.startedAt = null;
        anyRunning = true;
      }
    });
    if (anyRunning) {
      save();
      renderPlayers();
    }
  });

  // --- New Game ---

  document.getElementById("btn-new-game").addEventListener("click", function () {
    showModal("Start new game? Current times will be saved to season totals.", false, function () {
      selectedPlayerIds = {};
      getPlayers().forEach(function (p) {
        p.seasonTotalSeconds += getElapsed(p);
        p.currentGameSeconds = 0;
        p.isRunning = false;
        p.startedAt = null;
      });
      save();
      renderPlayers();
    });
  });

  // --- Season Totals ---

  document.getElementById("btn-season").addEventListener("click", function () {
    renderSeasonTotals();
    showView(seasonView);
  });

  document.getElementById("btn-back").addEventListener("click", function () {
    showView(gameView);
  });

  document.getElementById("btn-reset-season").addEventListener("click", function () {
    showModal("Reset all season totals and current game times? This cannot be undone.", true, function () {
      getPlayers().forEach(function (p) {
        p.seasonTotalSeconds = 0;
        p.currentGameSeconds = 0;
        p.isRunning = false;
        p.startedAt = null;
      });
      save();
      renderSeasonTotals();
    });
  });

  function renderSeasonTotals() {
    seasonListEl.innerHTML = "";
    var players = getPlayers();
    var sorted = players.slice().sort(function (a, b) {
      return (a.seasonTotalSeconds + getElapsed(a)) - (b.seasonTotalSeconds + getElapsed(b));
    });

    if (sorted.length === 0) {
      var empty = document.createElement("div");
      empty.className = "season-empty";
      empty.textContent = "No players added yet.";
      seasonListEl.appendChild(empty);
      return;
    }

    sorted.forEach(function (player) {
      var row = document.createElement("div");
      row.className = "season-row";

      var nameSpan = document.createElement("span");
      nameSpan.className = "season-name";
      nameSpan.textContent = player.name;

      var timeSpan = document.createElement("span");
      timeSpan.className = "season-time";
      timeSpan.textContent = formatTime(player.seasonTotalSeconds + getElapsed(player));

      row.appendChild(nameSpan);
      row.appendChild(timeSpan);
      seasonListEl.appendChild(row);
    });
  }

  // --- Team Picker ---

  document.getElementById("btn-team-picker").addEventListener("click", function () {
    renderTeamList();
    showView(teamPickerView);
  });

  document.getElementById("btn-team-picker-back").addEventListener("click", function () {
    showView(gameView);
  });

  function renderTeamList() {
    teamListEl.innerHTML = "";

    teams.forEach(function (team) {
      var row = document.createElement("div");
      row.className = "team-row" + (team.id === activeTeamId ? " active-team" : "");

      var nameSpan = document.createElement("span");
      nameSpan.className = "team-row-name";
      nameSpan.textContent = team.name;
      nameSpan.addEventListener("click", function () {
        switchTeam(team.id);
      });

      var countSpan = document.createElement("span");
      countSpan.className = "team-row-count";
      countSpan.textContent = team.players.length + " players";

      var check = document.createElement("span");
      check.className = "team-row-check";
      check.textContent = team.id === activeTeamId ? "\u2713" : "";

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-delete";
      deleteBtn.textContent = "\u00d7";
      deleteBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteTeam(team.id);
      });

      row.appendChild(nameSpan);
      row.appendChild(countSpan);
      row.appendChild(check);
      if (teams.length > 1) row.appendChild(deleteBtn);
      teamListEl.appendChild(row);
    });

    // Edit team name on tap of the name
    teamListEl.querySelectorAll(".team-row-name").forEach(function (el, i) {
      el.style.cursor = "pointer";
    });

    var addRow = document.createElement("div");
    addRow.className = "add-player-row";
    var addBtn = document.createElement("button");
    addBtn.className = "btn-add";
    addBtn.textContent = "+ Add Team";
    addBtn.addEventListener("click", addTeam);
    addRow.appendChild(addBtn);
    teamListEl.appendChild(addRow);
  }

  function switchTeam(id) {
    selectedPlayerIds = {};
    activeTeamId = id;
    save();
    renderPlayers();
    lastOrder = getSortedIds();
    showView(gameView);
  }

  function addTeam() {
    var row = document.createElement("div");
    row.className = "team-row";

    var input = document.createElement("input");
    input.className = "player-name-input";
    input.type = "text";
    input.placeholder = "Team name";
    input.autocomplete = "off";
    input.autocapitalize = "words";

    var okBtn = document.createElement("button");
    okBtn.className = "btn-ok";
    okBtn.textContent = "OK";

    function confirmName() {
      var name = input.value.trim();
      if (!name) {
        row.remove();
        return;
      }
      var team = { id: nextId++, name: name, players: [] };
      teams.push(team);
      activeTeamId = team.id;
      save();
      renderPlayers();
      lastOrder = getSortedIds();
      showView(gameView);
    }

    okBtn.addEventListener("click", confirmName);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") confirmName();
    });

    row.appendChild(input);
    row.appendChild(okBtn);
    teamListEl.appendChild(row);
    input.focus();
    row.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function deleteTeam(id) {
    if (teams.length <= 1) return;
    var team = teams.find(function (t) { return t.id === id; });
    if (!team) return;
    showModal('Delete team "' + team.name + '" and all its players?', true, function () {
      teams = teams.filter(function (t) { return t.id !== id; });
      if (activeTeamId === id) {
        activeTeamId = teams[0].id;
      }
      save();
      renderTeamList();
    });
  }

  // --- Timer tick ---

  function startTick() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplays, 1000);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      renderPlayers();
    }
  });

  // --- Service Worker ---

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }

  // --- Init ---

  load();
  renderPlayers();
  lastOrder = getSortedIds();
  startTick();
})();
