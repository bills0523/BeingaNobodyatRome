const screens = {
  menu: document.getElementById("menu-screen"),
  wheel: document.getElementById("wheel-screen"),
  story: document.getElementById("story-screen"),
  achievements: document.getElementById("achievements-screen")
};

const roleOrder = ["gladiator", "poet", "blacksmith", "merchant", "soldier", "builder"];
const achievementStorageKey = "romeNobodyUnlockedAchievements";
const appRoot = getAppRoot();

let stories = {};
let achievements = {};
let activeRoleKey = "";
let activeNode = null;
let isTyping = false;
let skipTyping = false;
let currentRotation = 0;
let currentScreenName = "menu";
let screenTransitionTimer = null;
let isWheelSpinning = false;

const startButton = document.getElementById("start-button");
const achievementsButton = document.getElementById("achievements-button");
const wheel = document.getElementById("role-wheel");
const spinResult = document.getElementById("spin-result");
const storyRoleLabel = document.getElementById("story-role-label");
const storyRoleTitle = document.getElementById("story-role-title");
const storyLog = document.getElementById("story-log");
const storyControls = document.getElementById("story-controls");
const achievementList = document.getElementById("achievement-list");
const achievementToast = document.getElementById("achievement-toast");
const toastTitle = document.getElementById("toast-title");
const toastDescription = document.getElementById("toast-description");
const achievementSound = document.getElementById("achievement-sound");

window.addEventListener("DOMContentLoaded", initGame);

async function initGame() {
  try {
    [stories, achievements] = await Promise.all([
      fetchJson([`${appRoot}/data/stories.json`, "/data/stories"]),
      fetchJson([`${appRoot}/data/achievements.json`, "/data/achievements"])
    ]);

    syncUnlockedAchievements();
    bindControls();
    showScreen("menu");
  } catch (error) {
    document.body.innerHTML = "<main class='load-error'><h1>Game data could not load.</h1><p>Start the Flask server with python app.py and refresh this page.</p></main>";
    console.error(error);
  }
}

function getAppRoot() {
  const script = document.currentScript || document.querySelector("script[src*='game.js']");

  if (!script) {
    return ".";
  }

  const scriptUrl = new URL(script.src, window.location.href);
  return scriptUrl.pathname.replace(/\/static\/js\/game\.js$/, "") || "";
}

async function fetchJson(paths) {
  const errors = [];

  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (response.ok) {
        return await response.json();
      }
      errors.push(`${path}: ${response.status}`);
    } catch (error) {
      errors.push(`${path}: ${error.message}`);
    }
  }

  throw new Error(`Could not load JSON data. Tried ${errors.join(", ")}`);
}

function bindControls() {
  const requiredElements = [
    startButton,
    achievementsButton,
    wheel,
    spinResult,
    storyLog,
    storyControls,
    screens.story
  ];

  if (requiredElements.some((element) => !element)) {
    throw new Error("The page HTML is missing required game elements. Refresh the deployed page and clear the browser cache.");
  }

  startButton.addEventListener("click", () => {
    spinResult.textContent = "";
    showScreen("wheel");
  });

  achievementsButton.addEventListener("click", () => {
    renderAchievements();
    showScreen("achievements");
  });

  wheel.addEventListener("click", spinForRole);
  wheel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      spinForRole();
    }
  });

  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
  });

  screens.story.addEventListener("click", handleStoryScreenClick);
}

function handleStoryScreenClick(event) {
  if (event.target.closest("button")) {
    return;
  }

  if (currentScreenName !== "story" || !activeNode) {
    return;
  }

  if (isTyping) {
    skipTyping = true;
    return;
  }

  if (hasRandomChoices(activeNode)) {
    moveToRandomNode(activeNode.random_choices);
    return;
  }

  if (canClickAdvance()) {
    moveToNode(activeNode.next_node);
  }
}

function canClickAdvance() {
  const hasChoices = Array.isArray(activeNode.choices) && activeNode.choices.length > 0;
  const hasRandom = hasRandomChoices(activeNode);
  return (Boolean(activeNode.next_node) || hasRandom) && !activeNode.is_ending && !hasChoices;
}

function hasRandomChoices(node) {
  return Array.isArray(node.random_choices) && node.random_choices.length > 0;
}

function showScreen(name) {
  window.clearTimeout(screenTransitionTimer);

  const currentScreen = screens[currentScreenName];
  const nextScreen = screens[name];

  if (!nextScreen || currentScreenName === name) {
    Object.entries(screens).forEach(([screenName, screen]) => {
      const isActive = screenName === name;
      screen.hidden = !isActive;
      screen.classList.toggle("active", isActive);
      screen.classList.remove("exiting");
    });
    return;
  }

  if (currentScreen) {
    currentScreen.classList.add("exiting");
  }

  screenTransitionTimer = window.setTimeout(() => {
    Object.entries(screens).forEach(([screenName, screen]) => {
      const isActive = screenName === name;
      screen.hidden = !isActive;
      screen.classList.toggle("active", isActive);
      screen.classList.remove("exiting");
    });
    currentScreenName = name;
  }, currentScreen ? 220 : 0);

  if (name !== "story") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function spinForRole() {
  if (isWheelSpinning) {
    return;
  }

  isWheelSpinning = true;
  wheel.classList.add("is-spinning");
  wheel.setAttribute("aria-disabled", "true");
  spinResult.textContent = "The wheel is turning...";

  const selectedIndex = Math.floor(Math.random() * roleOrder.length);
  const selectedRole = roleOrder[selectedIndex];
  const role = stories[selectedRole];
  const segmentSize = 360 / roleOrder.length;
  const targetCenter = selectedIndex * segmentSize;
  const extraSpins = 5 + Math.floor(Math.random() * 3);

  currentRotation += extraSpins * 360 + (360 - targetCenter);
  wheel.style.transform = `rotate(${currentRotation}deg)`;

  window.setTimeout(() => {
    spinResult.textContent = `Fortuna has chosen: ${role.display_name}`;

    window.setTimeout(() => {
      isWheelSpinning = false;
      wheel.classList.remove("is-spinning");
      wheel.setAttribute("aria-disabled", "false");
      beginStory(selectedRole);
    }, 1100);
  }, 4300);
}

function beginStory(roleKey) {
  activeRoleKey = roleKey;
  const role = stories[roleKey];
  activeNode = role.nodes[role.starting_node];

  storyRoleLabel.textContent = role.display_name;
  storyRoleTitle.textContent = role.intro_title || role.display_name;
  storyLog.innerHTML = "";
  storyControls.innerHTML = "";

  showScreen("story");
  window.scrollTo({ top: 0 });
  renderCurrentNode();
}

async function renderCurrentNode() {
  storyControls.innerHTML = "";

  const entry = document.createElement("section");
  entry.className = "story-entry";

  const date = document.createElement("h3");
  date.className = "story-date";
  date.textContent = activeNode.date || "Undated";

  const text = document.createElement("p");
  text.className = "story-text";

  entry.append(date, text);
  storyLog.appendChild(entry);
  entry.scrollIntoView({ behavior: "smooth", block: "start" });

  await typeText(activeNode.text || "", text);

  if (activeNode.image) {
    const image = document.createElement("img");
    image.className = "story-image";
    image.src = activeNode.image;
    image.alt = `${stories[activeRoleKey].display_name} story image`;
    image.addEventListener("error", () => image.remove());
    entry.appendChild(image);
  }

  window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 140);
  renderNodeControls();
}

function renderNodeControls() {
  storyControls.innerHTML = "";

  if (hasRandomChoices(activeNode)) {
    const hint = document.createElement("p");
    hint.className = "click-advance-hint";
    hint.textContent = "Click anywhere to let Fortuna decide";
    storyControls.appendChild(hint);
    return;
  }

  if (Array.isArray(activeNode.choices) && activeNode.choices.length > 0) {
    activeNode.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.textContent = choice.label;
      button.addEventListener("click", () => moveToNode(choice.next_node));
      storyControls.appendChild(button);
    });
    return;
  }

  if (activeNode.is_ending || !activeNode.next_node) {
    const finishButton = document.createElement("button");
    finishButton.className = "primary-button";
    finishButton.textContent = "Finish Life";
    finishButton.addEventListener("click", finishLife);
    storyControls.appendChild(finishButton);
    return;
  }

  const hint = document.createElement("p");
  hint.className = "click-advance-hint";
  hint.textContent = "Click anywhere to continue";
  storyControls.appendChild(hint);
}

function moveToRandomNode(randomChoices) {
  const selectedIndex = Math.floor(Math.random() * randomChoices.length);
  moveToNode(randomChoices[selectedIndex].next_node);
}

function moveToNode(nodeId) {
  const role = stories[activeRoleKey];
  const nextNode = role.nodes[nodeId];

  if (!nextNode) {
    storyControls.innerHTML = "<p class='story-warning'>That story path is missing from stories.json.</p>";
    return;
  }

  activeNode = nextNode;
  renderCurrentNode();
}

async function typeText(text, target) {
  isTyping = true;
  skipTyping = false;
  target.textContent = "";

  for (let index = 0; index < text.length; index += 1) {
    if (skipTyping) {
      target.textContent = text;
      break;
    }

    target.textContent += text[index];
    const delay = ".?!,;:".includes(text[index]) ? 18 : 8;
    await wait(delay);
  }

  isTyping = false;
  skipTyping = false;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function finishLife() {
  if (activeNode.achievement) {
    unlockAchievement(activeNode.achievement);
  }

  storyControls.innerHTML = "";
  const returnButton = document.createElement("button");
  returnButton.className = "primary-button";
  returnButton.textContent = "Return to Main Menu";
  returnButton.addEventListener("click", () => showScreen("menu"));
  storyControls.appendChild(returnButton);
}

function unlockAchievement(id) {
  if (!achievements[id]) {
    return;
  }

  const unlocked = getUnlockedAchievements();

  if (!unlocked.includes(id)) {
    unlocked.push(id);
    localStorage.setItem(achievementStorageKey, JSON.stringify(unlocked));
  }

  showAchievementToast(id);
}

function syncUnlockedAchievements() {
  const unlocked = getUnlockedAchievements();
  const validUnlocked = unlocked.filter((id) => Object.prototype.hasOwnProperty.call(achievements, id));

  if (validUnlocked.length !== unlocked.length) {
    localStorage.setItem(achievementStorageKey, JSON.stringify(validUnlocked));
  }
}

function getUnlockedAchievements() {
  try {
    return JSON.parse(localStorage.getItem(achievementStorageKey)) || [];
  } catch {
    return [];
  }
}

function showAchievementToast(id) {
  const achievement = achievements[id];

  if (!achievement) {
    return;
  }

  toastTitle.textContent = achievement.title;
  toastDescription.textContent = achievement.description;
  achievementToast.classList.remove("show");
  void achievementToast.offsetWidth;
  achievementToast.classList.add("show");

  if (achievementSound) {
    achievementSound.currentTime = 0;
    achievementSound.play().catch(() => {
      // Some browsers block autoplay or ignore the placeholder sound file.
    });
  }
}

function renderAchievements() {
  const unlocked = getUnlockedAchievements();
  achievementList.innerHTML = "";

  Object.entries(achievements).forEach(([id, achievement]) => {
    const isUnlocked = unlocked.includes(id);
    const card = document.createElement("article");
    card.className = `achievement-card ${isUnlocked ? "unlocked" : "locked"}`;

    const role = document.createElement("p");
    role.className = "achievement-role";
    role.textContent = isUnlocked ? achievement.role : "Locked";

    const title = document.createElement("h3");
    title.textContent = isUnlocked ? achievement.title : "???";

    const description = document.createElement("p");
    description.textContent = isUnlocked ? achievement.description : "Finish a life path to reveal this achievement.";

    card.append(role, title, description);
    achievementList.appendChild(card);
  });
}
