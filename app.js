(function () {
  "use strict";

  var players = [];
  var nextId = 1;
  var timerInterval = null;

  var playerListEl = document.getElementById("player-list");
  var seasonListEl = document.getElementById("season-list");
  var gameView = document.getElementById("game-view");
  var seasonView = document.getElementById("season-view");
  var modalOverlay = document.getElementById("modal");
  var modalMessage = document.getElementById("modal-message");
  var modalConfirm = document.getElementById("modal-confirm");
  var modalCancel = document.getElementById("modal-cancel");

  // --- Persistence ---

  function save() {
    var data = players.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        currentGameSeconds: p.currentGameSeconds,
        seasonTotalSeconds: p.seasonTotalSeconds,
        isRunning: p.isRunning,
        startedAt: p.startedAt
      };
    });
    localStorage.setItem("teamtimer_players", JSON.stringify(data));
    localStorage.setItem("teamtimer_nextId", String(nextId));
  }

  function load() {
    var raw = localStorage.getItem("teamtimer_players");
    if (raw) {
      try {
        players = JSON.parse(raw);
      } catch (e) {
        players = [];
      }
    }
    var nid = localStorage.getItem("teamtimer_nextId");
    if (nid) nextId = parseInt(nid, 10) || 1;
  }

  // --- Time formatting ---

  function getElapsed(player) {
    var secs = player.currentGameSeconds;
    if (player.isRunning && player.startedAt) {
      secs += (Date.now() - player.startedAt) / 1000;
    }
    return Math.floor(secs);
  }

  function getTotalWithCurrent(player) {
    return player.seasonTotalSeconds + getElapsed(player);
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

  // --- Render game view ---

  function renderPlayers() {
    playerListEl.innerHTML = "";
    players.forEach(function (player) {
      var row = document.createElement("div");
      row.className = "player-row";
      row.setAttribute("data-id", player.id);

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

      row.appendChild(deleteBtn);
      row.appendChild(nameSpan);
      row.appendChild(timeSpan);
      row.appendChild(toggleBtn);
      playerListEl.appendChild(row);
    });
  }

  function updateTimerDisplays() {
    players.forEach(function (player) {
      if (!player.isRunning) return;
      var el = playerListEl.querySelector('[data-timer="' + player.id + '"]');
      if (el) el.textContent = formatTime(getElapsed(player));
    });
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
      players.push(player);
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
    var player = players.find(function (p) { return p.id === id; });
    if (!player) return;
    showModal('Delete "' + player.name + '"?', true, function () {
      players = players.filter(function (p) { return p.id !== id; });
      save();
      renderPlayers();
    });
  }

  // --- Timer controls ---

  function toggleTimer(id) {
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

  // --- New Game ---

  document.getElementById("btn-new-game").addEventListener("click", function () {
    showModal("Start new game? Current times will be saved to season totals.", false, function () {
      players.forEach(function (p) {
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
    gameView.classList.remove("active");
    seasonView.classList.add("active");
  });

  document.getElementById("btn-back").addEventListener("click", function () {
    seasonView.classList.remove("active");
    gameView.classList.add("active");
  });

  document.getElementById("btn-reset-season").addEventListener("click", function () {
    showModal("Reset all season totals? This cannot be undone.", true, function () {
      players.forEach(function (p) {
        p.seasonTotalSeconds = 0;
      });
      save();
      renderSeasonTotals();
    });
  });

  function renderSeasonTotals() {
    seasonListEl.innerHTML = "";
    var sorted = players.slice().sort(function (a, b) {
      return (b.seasonTotalSeconds + getElapsed(b)) - (a.seasonTotalSeconds + getElapsed(a));
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

  // --- Add player button ---

  document.getElementById("btn-add-player").addEventListener("click", addPlayer);

  // --- Timer tick ---

  function startTick() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplays, 1000);
  }

  // --- Visibility change: update displays when app comes back to foreground ---

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
  startTick();
})();
